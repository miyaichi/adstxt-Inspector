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

export interface FetchAdsTxtResult {
  data: AdsTxt[];
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
  const isSubdomain = domain !== rootDomain && domain !== `www.${rootDomain}`;
  let isValidSubdmain: boolean = false;
  let adsTxtContent: string | null = null;

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
        if (finalDomain.startsWith('www.')) {
          isValidSubdmain = true;
        }
        break;
      } else if (response.status === 301 || response.status === 302) {
        if (finalDomain && isWithinScope(finalDomain, rootDomain)) {
          const redirectResponse = await fetch(finalUrl);
          if (redirectResponse.ok) {
            adsTxtContent = await redirectResponse.text();
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

  const entries: AdsTxt[] = [];
  const errors: ErrorDetail[] = [];

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

      // Check if the subdomain is valid
      if (trimmedLine.toLowerCase().startsWith('subdomain=')) {
        const subdomain = trimmedLine.split('=')[1].trim();
        if (subdomain === domain) {
          isValidSubdmain = true;
        }
        return;
      }

      // Skip fields that are not checked
      const skipFields = ['contact=', 'inventorypartnerdomain=', 'managerdomain=', 'ownerdomain='];
      if (skipFields.some((field) => trimmedLine.toLowerCase().startsWith(field))) {
        return;
      }

      // Split fields by comma or whitespace
      const fields = trimmedLine.split(/,|\s+/).filter((field) => field !== '');

      // Fields must have at least 3 fields
      if (fields.length < 3) {
        errors.push({
          line: lineNumber,
          content: line,
          message: 'Insufficient number of fields. Expected at least 3 fields.',
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
          message: `Invalid relationship type: "${relationshipField}". Expected "DIRECT" or "RESELLER".`,
        });
        return;
      }

      // Check if the domain field is a valid domain name
      if (!isValidDomain(domainField)) {
        errors.push({
          line: lineNumber,
          content: line,
          message: `Invalid domain format: "${domainField}".`,
        });
        return;
      }

      // Check if the publisher ID is alphanumeric with allowed characters
      if (!publisherId.match(/^[a-zA-Z0-9.\-_=]+$/)) {
        errors.push({
          line: lineNumber,
          content: line,
          message: `Invalid publisher ID format: "${publisherId}".`,
        });
        return;
      }

      // Check if the certification authority ID is alphanumeric with allowed characters
      if (certificationAuthorityId && !certificationAuthorityId.match(/^[a-zA-Z0-9.\-_]+$/)) {
        errors.push({
          line: lineNumber,
          content: line,
          message: `Invalid certification authority ID format: "${certificationAuthorityId}".`,
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
      }
    });

    if (isSubdomain && !isValidSubdmain) {
      errors.push({
        line: 0,
        content: '',
        message: `Subdomain "${domain}" not found in ads.txt file.`,
      });
    }
  } catch (error) {
    // Network errors and other errors are logged
    errors.push({
      line: 0,
      content: '',
      message: `Error fetching ads.txt: ${(error as Error).message}`,
    });
  }

  return { data: entries.sort((a, b) => a.domain.localeCompare(b.domain)), errors };
};

const getRootDomain = (domain: string): string => {
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

const isValidDomain = (domain: string): boolean => {
  const domainRegex = /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
};

/**
 * Returns a list of unique domains from the AdsTxt records.
 * @param adsTxtData - Array of AdsTxt records.
 * @returns Array of unique domains.
 */
export const getUniqueDomains = (adsTxtData: AdsTxt[]): string[] => {
  const uniqueDomains = new Set<string>();
  adsTxtData.forEach((entry) => {
    uniqueDomains.add(entry.domain);
  });
  return Array.from(uniqueDomains).sort();
};

/**
 * Filters AdsTxt records to include only those with a matching domain.
 * @param adsTxtArray - Array of AdsTxt records.
 * @param domain - The domain to match.
 * @returns Array of AdsTxt records with matching domain.
 */
export const filterAdsTxtByDomain = (adsTxtArray: AdsTxt[], domain: string): AdsTxt[] => {
  return adsTxtArray.filter((record) => record.domain === domain);
};
