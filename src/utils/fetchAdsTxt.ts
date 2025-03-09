import * as psl from 'psl';
import { FetchTimeoutError, fetchWithTimeout } from './fetchWithTimeout';

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
  managerDomains?: string[];
  ownerDomain?: string;
  subDomains?: string[];
}

export interface FetchAdsTxtResult {
  adsTxtUrl: string;
  adsTxtContent: string;
  data: AdsTxt[];
  variables: SupportedVariables;
  errors: ErrorDetail[];
  duplicates: ErrorDetail[];
}

/**
 * Fetches and parses the ads.txt file for the specified domain.
 * @param domain Domain name to fetch ads.txt for
 * @param appAdsTxt Whether to fetch app-ads.txt instead of ads.txt
 * @param timeout Timeout duration in milliseconds
 * @returns FetchAdsTxtResult object
 */
export const fetchAdsTxt = async (
  domain: string,
  appAdsTxt: boolean = false,
  timeout: number = 5000
): Promise<FetchAdsTxtResult> => {
  const rootDomain = getRootDomain(domain);
  const isSubdomainDomain = isSubdomain(domain, rootDomain);

  const adsTxtUrls = appAdsTxt
    ? [`https://${rootDomain}/app-ads.txt`, `http://${rootDomain}/app-ads.txt`]
    : [`https://${rootDomain}/ads.txt`, `http://${rootDomain}/ads.txt`];
  let adsTxtContent = '';
  let adsTxtUrl = '';

  for (const url of adsTxtUrls) {
    const result = await tryFetchUrl(url, rootDomain, timeout);
    if (result) {
      adsTxtContent = result.content;
      adsTxtUrl = result.finalUrl;
      break;
    }
  }

  if (!adsTxtContent) {
    throw new Error(`No valid ads.txt found for ${domain}`);
  }

  if (isSubdomainDomain) {
    const declaredSubdomains = extractDeclaredSubdomains(adsTxtContent);
    if (declaredSubdomains.includes(domain)) {
      const subdomainResult = await tryFetchSubdomainAdsTxt(domain, timeout);
      if (subdomainResult) {
        adsTxtContent = subdomainResult.content;
        adsTxtUrl = subdomainResult.finalUrl;
      }
    }
  }

  const { entries, variables, errors, duplicates } = parseAdsTxtContent(adsTxtContent, rootDomain);

  return {
    adsTxtUrl,
    adsTxtContent,
    data: entries,
    variables,
    errors,
    duplicates,
  };
};

/**
 * Add "#" to the beginning of the line for error entries to comment out
 * @param content ads.txt content
 * @param errors Array of error details
 * @returns Modified ads.txt content
 */
export const commentErrorAdsTxtLines = (content: string, errors: ErrorDetail[]): string => {
  const lines = content.split(/\r?\n/);

  // Set of line numbers for duplicate entries
  const lineNumbers = new Set<number>(errors.map((d) => d.line));

  // For each line, add "#" to the beginning if it's a error entry
  const newLines = lines.map((line, index) => {
    const lineNumber = index + 1;
    if (lineNumbers.has(lineNumber)) {
      // If the line is already commented out, return it as is
      if (line.trim().startsWith('#')) {
        return line;
      }
      return `#${line} # error: ${errors.find((d) => d.line === lineNumber)?.message}`;
    }
    return line;
  });

  // Return the concatenated lines as the new content string
  return newLines.join('\n');
};

// Helper functions

interface FetchResult {
  content: string;
  finalUrl: string;
}

/**
 * Retrive ads.txt from the specified URL
 * (if the domain of the final URL is within the scope, even if its redirected, the text will be returned)
 * @param url URL to fetch ads.txt from
 * @param rootDomain Root domain name
 * @returns FetchResult object
 */
const tryFetchUrl = async (
  url: string,
  rootDomain: string,
  timeout: number
): Promise<FetchResult | null> => {
  try {
    const response = await fetchWithTimeout(url, {
      redirect: 'follow',
      headers: { Accept: 'text/plain' },
      timeout,
    });
    const finalUrl = response.url;
    const finalDomain = new URL(finalUrl).hostname;
    if (response.ok && isWithinScope(finalDomain, rootDomain)) {
      return { content: await response.text(), finalUrl };
    }
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      throw new Error(`Timeout fetching ads.txt from ${url}: ${error.message}`);
    }
    throw new Error(`Error fetching ads.txt from ${url}: ${(error as Error).message}`);
  }
  return null;
};

/**
 * Retrieve ads.txt from the subdomain
 * @param domain Subdomain name
 * @returns FetchResult object
 */
const tryFetchSubdomainAdsTxt = async (
  domain: string,
  timeout: number
): Promise<FetchResult | null> => {
  try {
    const url = `https://${domain}/ads.txt`;
    const response = await fetchWithTimeout(url, {
      redirect: 'follow',
      headers: { Accept: 'text/plain' },
      timeout,
    });
    if (response.ok) {
      return { content: await response.text(), finalUrl: response.url };
    }
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      throw new Error(`Timeout fetching ads.txt from ${domain}: ${error.message}`);
    }
  }
  return null;
};

/**
 * Extract subdomain declarations ("subdomain=") from the ads.txt of the root domain
 * @param content ads.txt content
 * @returns Array of subdomains
 */
const extractDeclaredSubdomains = (content: string): string[] => {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.toLowerCase().startsWith('subdomain='))
    .map((line) => line.split('=')[1]?.trim())
    .filter(Boolean) as string[];
};

interface ParseResult {
  entries: AdsTxt[];
  variables: SupportedVariables;
  errors: ErrorDetail[];
  duplicates: ErrorDetail[];
}

/**
 * Parse the contents of ads.txt
 * @param content ads.txt content
 * @param rootDomain Root domain name
 * @returns ParseResult object
 */
const parseAdsTxtContent = (content: string, rootDomain: string): ParseResult => {
  const entries: AdsTxt[] = [];
  const errors: ErrorDetail[] = [];
  const duplicates: ErrorDetail[] = [];
  const variables: SupportedVariables = { ownerDomain: rootDomain };

  const lines = content.split(/\r?\n/);

  // Regular expressions for variable declarations
  const VARIABLE_REGEXES: Record<string, RegExp> = {
    contact: /^CONTACT=/i,
    inventoryPartnerdomain: /^INVENTORYPARTNERDOMAIN=/i,
    managerDomain: /^MANAGERDOMAIN=/i,
    ownerDomain: /^OWNERDOMAIN=/i,
    subDomain: /^SUBDOMAIN=/i,
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    let trimmedLine = line.trim();

    // Skip empty lines and comment lines
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }

    // Remove inline comments
    const commentIndex = trimmedLine.indexOf('#');
    if (commentIndex !== -1) {
      trimmedLine = trimmedLine.substring(0, commentIndex).trim();
    }

    // Process variable declaration lines
    for (const [key, regex] of Object.entries(VARIABLE_REGEXES)) {
      if (regex.test(trimmedLine)) {
        const value = trimmedLine.split('=')[1]?.trim();
        if (value) {
          if (key === 'subDomain') {
            if (!isValidDomain(value)) {
              errors.push({
                line: lineNumber,
                content: line,
                message: chrome.i18n.getMessage('error_14020_invalid_url', [value]),
              });
              return;
            }
            if (variables.ownerDomain && !isSubdomain(value, variables.ownerDomain)) {
              errors.push({
                line: lineNumber,
                content: line,
                message: chrome.i18n.getMessage('error_14030_invalid_subdomain', [
                  value,
                  rootDomain,
                ]),
              });
              return;
            }

            variables.subDomains = variables.subDomains || [];
            if (!variables.subDomains.includes(value)) {
              variables.subDomains.push(value);
            }
          } else if (key === 'managerDomain') {
            variables.managerDomains = variables.managerDomains || [];
            const [managerDomain, countryCode] = value.split(',').map((s) => s.trim());
            if (!isValidDomain(managerDomain)) {
              errors.push({
                line: lineNumber,
                content: line,
                message: chrome.i18n.getMessage('invalid_domain', [managerDomain]),
              });
              return;
            }

            const managerDomainCount = Object.entries(variables).filter(
              ([k, v]) =>
                k === 'managerDomains' && v.some((entry: string) => entry.includes(countryCode))
            ).length;
            if (managerDomainCount > 1) {
              errors.push({
                line: lineNumber,
                content: line,
                message: chrome.i18n.getMessage('multiple_manager_domain_declarations', [
                  countryCode,
                ]),
              });
            } else {
              variables.managerDomains.push(value);
            }
          } else {
            (variables as any)[key] = value;
          }
        }
        return;
      }
    }

    // Are there 2 commas per line (indicating the 3 required fields)?
    const commaCount = (trimmedLine.match(/,/g) || []).length;
    if (commaCount < 2 || commaCount > 3) {
      errors.push({
        line: lineNumber,
        content: line,
        message: chrome.i18n.getMessage('error_11010_missing_required_fields'),
      });
      return;
    }

    // Process ads.txt entry lines
    const fields = trimmedLine.split(/,\s*|\s+/).filter((field) => field !== '');

    // Does the field contain tabs, commas, whitespace?
    if (fields.length < 3 || fields.length > 4) {
      errors.push({
        line: lineNumber,
        content: line,
        message: chrome.i18n.getMessage('error_11010_missing_required_fields'),
      });
      return;
    }

    const [domainField, publisherId, relationshipField, certificationAuthorityId] = fields;
    const relationship = relationshipField.toUpperCase();

    // Does the third required field have either DIRECT or RESELLER in it?
    if (relationship !== 'DIRECT' && relationship !== 'RESELLER') {
      errors.push({
        line: lineNumber,
        content: line,
        message: chrome.i18n.getMessage('error_11020_invalid_relationship', [relationshipField]),
      });
      return;
    }

    // Do Advertising System domains listed obey RFC 1123?
    if (!isValidDomain(domainField)) {
      errors.push({
        line: lineNumber,
        content: line,
        message: chrome.i18n.getMessage('error_11030_invalid_domain'),
      });
      return;
    }

    // Validate the publisher ID and certification authority
    if (!publisherId.match(/^[a-zA-Z0-9.\-_=]+$/)) {
      errors.push({
        line: lineNumber,
        content: line,
        message: chrome.i18n.getMessage('invalid_publisher_id', [publisherId]),
      });
      return;
    }

    // Validate the certification authority ID
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

    const entry: AdsTxt = {
      domain: domainField.toLowerCase(),
      publisherId,
      relationship: relationship as 'DIRECT' | 'RESELLER',
    };

    if (certificationAuthorityId) {
      entry.certificationAuthorityId = certificationAuthorityId;
    }

    const isDuplicate = entries.some(
      (e) =>
        e.domain === entry.domain &&
        e.publisherId === entry.publisherId &&
        e.relationship === entry.relationship
    );

    if (isDuplicate) {
      duplicates.push({
        line: lineNumber,
        content: line,
        message: chrome.i18n.getMessage('duplicate_entries'),
      });
    } else {
      entries.push(entry);
    }
  });

  // Is there at least one valid entry?
  if (entries.length === 0) {
    errors.push({
      line: 0,
      content: '',
      message: chrome.i18n.getMessage('error_11040_empty_file'),
    });
  }

  // Return the entries sorted by domain name and publisher ID
  return {
    entries: entries.sort(
      (a, b) =>
        a.domain.localeCompare(b.domain) ||
        a.publisherId.length - b.publisherId.length ||
        a.publisherId.localeCompare(b.publisherId) ||
        a.relationship.localeCompare(b.relationship)
    ),
    variables,
    errors,
    duplicates,
  };
};

// Utility functions

/**
 * Get the root domain from the domain name
 * @param domain Domain name
 * @returns Root domain name
 */
export const getRootDomain = (domain: string): string => {
  const parsed = psl.parse(domain);
  if ('domain' in parsed) {
    return parsed.domain as string;
  } else {
    throw new Error(`Unable to determine root domain for ${domain}: ${parsed.error}`);
  }
};

/**
 * Whether the target domain is within the scope of the root domain
 */
const isWithinScope = (targetDomain: string, rootDomain: string): boolean => {
  return targetDomain === rootDomain || targetDomain.endsWith(`.${rootDomain}`);
};

/**
 * Check if the domain is a subdomain of the root domain
 * @param domain Domain name to check
 * @param rootDomain Root domain name
 */
const isSubdomain = (domain: string, rootDomain: string): boolean => {
  if (domain === rootDomain || domain === `www.${rootDomain}`) return false;
  return domain.endsWith(`.${rootDomain}`);
};

/**
 * Wether the domain string is valid or not
 * @param domain Domain name to validate
 * @returns True if the domain is valid, false otherwise
 */
const isValidDomain = (domain: string): boolean => {
  return psl.isValid(domain);
};

/**
 * Returns an array of unique domains from the given ads.txt data
 * @param adsTxtData Array of ads.txt records
 * @returns Array of unique domains
 */
export const getUniqueDomains = (adsTxtData: AdsTxt[]): string[] => {
  const uniqueDomains = new Set<string>();
  adsTxtData.forEach((entry) => uniqueDomains.add(entry.domain));
  return Array.from(uniqueDomains).sort();
};

/**
 * Extracts ads.txt records for a given domain
 * @param adsTxtArray Array of ads.txt records
 * @param domain Domain name to filter by
 * @returns Array of ads.txt records for the given domain
 */
export const filterAdsTxtByDomain = (adsTxtArray: AdsTxt[], domain: string): AdsTxt[] => {
  return adsTxtArray.filter((record) => record.domain === domain);
};
