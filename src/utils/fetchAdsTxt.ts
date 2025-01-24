import * as psl from 'psl';

// Type definitions
export interface AdsTxt {
  domain: string;
  publisherId: string;
  relationship: 'DIRECT' | 'RESELLER';
  certificationAuthorityId?: string;
}

export interface ErrorDetail {
  line: number;
  content: string;
  message: string;
}

export interface SupportedVariables {
  contact?: string;
  inventoryPartnerdomain?: string;
  managerDomain?: string;
  ownerDomain?: string;
  subDomain?: string;
}

export interface FetchAdsTxtResult {
  adsTxtUrl: string;
  data: AdsTxt[];
  variables: SupportedVariables;
  errors: ErrorDetail[];
}

/**
 * Fetches and parses the ads.txt file for the specified domain.
 * @param domain - The domain name to fetch the ads.txt file from
 * @returns FetchAdsTxtResult object
 */
export const fetchAdsTxt = async (domain: string): Promise<FetchAdsTxtResult> => {
  const rootDomain = getRootDomain(domain);
  const adsTxtUrls = [`https://${rootDomain}/ads.txt`, `http://${rootDomain}/ads.txt`];
  const isSubdomainDomain = isSubdomain(domain, rootDomain);
  let adsTxtContent: string | null = null;
  let adsTxtUrl = '';
  let subdomainDeclaration: string | null = null;

  // First fetch root domain ads.txt
  for (const url of adsTxtUrls) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          Accept: 'text/plain',
        },
      });
      const finalUrl = response.url;
      const finalDomain = new URL(finalUrl).hostname;

      if (response.ok && isWithinScope(finalDomain, rootDomain)) {
        adsTxtContent = await response.text();
        adsTxtUrl = finalUrl;
        break;
      } else if (response.status === 301 || response.status === 302) {
        if (finalDomain && isWithinScope(finalDomain, rootDomain)) {
          const redirectResponse = await fetch(finalUrl);
          if (redirectResponse.ok) {
            adsTxtContent = await redirectResponse.text();
            adsTxtUrl = finalUrl;
            break;
          }
        }
      }
    } catch (error) {
      throw new Error(`Error fetching ads.txt from ${url}: ${(error as Error).message}`);
    }
  }

  if (!adsTxtContent) {
    throw new Error(`No valid ads.txt found for ${domain}`);
  }

  // If it's a subdomain, check for subdomain declaration in root domain ads.txt
  if (isSubdomainDomain) {
    const lines = adsTxtContent.split(/\r?\n/);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.toLowerCase().startsWith('subdomain=')) {
        const declaredSubdomain = trimmedLine.split('=')[1].trim();
        if (declaredSubdomain === domain) {
          subdomainDeclaration = declaredSubdomain;
          break;
        }
      }
    }

    // If this is a declared subdomain, try to fetch its own ads.txt
    if (subdomainDeclaration) {
      try {
        const subdomainResponse = await fetch(`https://${domain}/ads.txt`);
        if (subdomainResponse.ok) {
          // If subdomain has its own ads.txt, use that instead
          adsTxtContent = await subdomainResponse.text();
          adsTxtUrl = subdomainResponse.url;
        }
        // If subdomain ads.txt doesn't exist, continue with root domain ads.txt (no error)
      } catch (error) {
        // If fetching subdomain ads.txt fails, continue with root domain ads.txt (no error)
      }
    }
  }

  const entries: AdsTxt[] = [];
  const errors: ErrorDetail[] = [];
  const variables: SupportedVariables = {};

  try {
    const lines = adsTxtContent.split(/\r?\n/);

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      let trimmedLine = line.trim();

      // Skip empty lines and comments
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        return;
      }

      // Remove comments from the line
      const commentIndex = trimmedLine.indexOf('#');
      if (commentIndex !== -1) {
        trimmedLine = trimmedLine.substring(0, commentIndex).trim();
      }

      // Process supported variables
      const variableMatches = {
        contact: /^CONTACT=/i,
        inventoryPartnerdomain: /^INVENTORYPARTNERDOMAIN=/i,
        managerDomain: /^MANAGERDOMAIN=/i,
        ownerDomain: /^OWNERDOMAIN=/i,
        subDomain: /^SUBDOMAIN=/i,
      };

      for (const [key, regex] of Object.entries(variableMatches)) {
        if (regex.test(trimmedLine)) {
          const value = trimmedLine.split('=')[1].trim();
          variables[key as keyof SupportedVariables] = value;
          return;
        }
      }

      // Split fields by comma or whitespace
      const fields = trimmedLine.split(/,|\s+/).filter((field) => field !== '');

      // Fields must have at least 3 fields
      if (fields.length < 3) {
        errors.push({
          line: lineNumber,
          content: line,
          message: chrome.i18n.getMessage('insufficient_fields'),
        });
        return;
      }

      const [domainField, publisherId, relationshipField, certificationAuthorityId] = fields;

      // Check if the relationship field is either "DIRECT" or "RESELLER"
      const relationship = relationshipField.toUpperCase();
      if (relationship !== 'DIRECT' && relationship !== 'RESELLER') {
        errors.push({
          line: lineNumber,
          content: line,
          message: chrome.i18n.getMessage('invalid_relationship_type', [relationshipField]),
        });
        return;
      }

      // Check if the domain field is a valid domain name
      if (!isValidDomain(domainField)) {
        errors.push({
          line: lineNumber,
          content: line,
          message: chrome.i18n.getMessage('invalid_domain', [domainField]),
        });
        return;
      }

      // Check if the publisher ID is alphanumeric with allowed characters
      if (!publisherId.match(/^[a-zA-Z0-9.\-_=]+$/)) {
        errors.push({
          line: lineNumber,
          content: line,
          message: chrome.i18n.getMessage('invalid_publisher_id', [publisherId]),
        });
        return;
      }

      // Check if the certification authority ID is alphanumeric with allowed characters
      if (certificationAuthorityId && !certificationAuthorityId.match(/^[a-zA-Z0-9.\-_]+$/)) {
        errors.push({
          line: lineNumber,
          content: line,
          message: chrome.i18n.getMessage('invalid_certification_authority_id', [
            certificationAuthorityId,
          ]),
        });
        return;
      }

      // Add valid entry
      const entry: AdsTxt = {
        domain: domainField.toLowerCase(),
        publisherId,
        relationship: relationship as 'DIRECT' | 'RESELLER',
      };

      if (certificationAuthorityId) {
        entry.certificationAuthorityId = certificationAuthorityId;
      }

      if (
        !entries.some(
          (e) =>
            e.domain === entry.domain &&
            e.publisherId === entry.publisherId &&
            e.relationship === entry.relationship
        )
      ) {
        entries.push(entry);
      } else {
        errors.push({
          line: lineNumber,
          content: line,
          message: chrome.i18n.getMessage('duplicate_entry', [line]),
        });
      }
    });
  } catch (error) {
    errors.push({
      line: 0,
      content: '',
      message: `Error parsing ads.txt: ${(error as Error).message}`,
    });
  }

  return {
    adsTxtUrl,
    data: entries.sort((a, b) => a.domain.localeCompare(b.domain)),
    variables,
    errors,
  };
};

// Other utility functions remain unchanged
export const getRootDomain = (domain: string): string => {
  const parsed = psl.parse(domain);

  if ('domain' in parsed) {
    return parsed.domain as string;
  } else {
    throw new Error(`Unable to determine root domain for ${domain}: ${parsed.error}`);
  }
};

const isWithinScope = (targetDomain: string, rootDomain: string): boolean => {
  return targetDomain === rootDomain || targetDomain.endsWith(`.${rootDomain}`);
};

const isSubdomain = (domain: string, rootDomain: string): boolean => {
  if (domain === rootDomain) return false;
  if (domain === `www.${rootDomain}`) return false;
  return domain.endsWith(`.${rootDomain}`);
};

const isValidDomain = (domain: string): boolean => {
  return psl.isValid(domain);
};

export const getUniqueDomains = (adsTxtData: AdsTxt[]): string[] => {
  const uniqueDomains = new Set<string>();
  adsTxtData.forEach((entry) => {
    uniqueDomains.add(entry.domain);
  });
  return Array.from(uniqueDomains).sort();
};

export const filterAdsTxtByDomain = (adsTxtArray: AdsTxt[], domain: string): AdsTxt[] => {
  return adsTxtArray.filter((record) => record.domain === domain);
};
