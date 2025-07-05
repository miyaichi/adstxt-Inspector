import * as psl from 'psl';
import { fetchFromUrls } from './fetchFromUrls';

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
  fetchError?: string;
  data: AdsTxt[];
  variables: SupportedVariables;
  errors: ErrorDetail[];
  duplicates: ErrorDetail[];
}

const DEFAULT_FETCH_OPTIONS = {
  responseType: 'text/plain' as const,
  timeout: 5000,
};

/**
 * Fetches and parses the ads.txt file for the specified domain.
 * @param domain Domain name to fetch ads.txt for
 * @param appAdsTxt Whether to fetch app-ads.txt instead of ads.txt
 * @returns FetchAdsTxtResult object
 */
export const fetchAdsTxt = async (
  domain: string,
  appAdsTxt: boolean = false
): Promise<FetchAdsTxtResult> => {
  const rootDomain = getRootDomain(domain);
  const isSubdomainDomain = isSubdomain(domain, rootDomain);

  try {
    // Retrieve ads.txt from root domain first
    const rootDomainResult = await fetchAdsTxtForDomain(rootDomain, appAdsTxt);
    let adsTxtContent = rootDomainResult.content;
    let adsTxtUrl = rootDomainResult.finalUrl;

    // Check if the file is empty
    if (!adsTxtContent) {
      throw new Error('error_11040_empty_file');
    }

    // If this is a subdomain and the root domain's ads.txt contains a subdomain declaration,
    // fetch the ads.txt from the subdomain
    if (!appAdsTxt && isSubdomainDomain) {
      const declaredSubdomains = extractDeclaredSubdomains(adsTxtContent);

      if (declaredSubdomains.includes(domain)) {
        const subdomainResult = await fetchAdsTxtForDomain(domain, appAdsTxt);
        adsTxtContent = subdomainResult.content;
        adsTxtUrl = subdomainResult.finalUrl;
      }
    }

    // Parse the ads.txt content
    const { entries, variables, errors, duplicates } = parseAdsTxtContent(
      adsTxtContent,
      rootDomain
    );

    // Throw an error if no entries are found
    if (entries.length === 0) {
      throw new Error('error_11050_no_entries');
    }

    return {
      adsTxtUrl,
      adsTxtContent,
      fetchError: undefined,
      data: entries,
      variables,
      errors,
      duplicates,
    };
  } catch (error) {
    return createErrorResult(error as Error);
  }
};

/**
 * Fetches ads.txt content for a specific domain
 * @param domain Domain to fetch ads.txt for
 * @param appAdsTxt Whether to fetch app-ads.txt instead
 * @returns Fetch result with content and URL
 */
const fetchAdsTxtForDomain = async (
  domain: string,
  appAdsTxt: boolean
): Promise<{ content: string; finalUrl: string }> => {
  const urls = generateAdsTxtUrls(domain, appAdsTxt);
  return await fetchFromUrls(urls, DEFAULT_FETCH_OPTIONS);
};

/**
 * Create an error result object
 * @param error The error that occurred
 * @returns Empty FetchAdsTxtResult with error information
 */
const createErrorResult = (error: Error): FetchAdsTxtResult => {
  return {
    adsTxtUrl: '',
    adsTxtContent: '',
    fetchError: error.message,
    data: [],
    variables: {},
    errors: [],
    duplicates: [],
  };
};

/**
 * Generate URLs for ads.txt and app-ads.txt files
 * @param domain Domain name
 * @param appAdsTxt Whether to generate URLs for app-ads.txt
 * @returns Array of URLs
 */
const generateAdsTxtUrls = (domain: string, appAdsTxt: boolean = false): string[] => {
  const file = appAdsTxt ? 'app-ads.txt' : 'ads.txt';
  const protocols = ['https', 'http'];
  const subdomains = ['', 'www.'];

  return protocols.flatMap((protocol) =>
    subdomains.map((subdomain) => `${protocol}://${subdomain}${domain}/${file}`)
  );
};

/**
 * Add "#" to the beginning of the line for error entries to comment out
 * @param content ads.txt content
 * @param errors Array of error details
 * @returns Modified ads.txt content
 */
export const commentErrorAdsTxtLines = (content: string, errors: ErrorDetail[]): string => {
  const lines = content.split(/\r?\n/);

  // Set of line numbers for error entries
  const lineNumbers = new Set<number>(errors.map((d) => d.line));

  // For each line, add "#" to the beginning if it's an error entry
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
    if (processVariableLine(trimmedLine, line, lineNumber, variables, errors, VARIABLE_REGEXES)) {
      return;
    }

    // Process ads.txt entry lines
    processEntryLine(trimmedLine, line, lineNumber, entries, errors, duplicates);
  });

  // Return the entries sorted by domain name and publisher ID
  return {
    entries: sortEntries(entries),
    variables,
    errors,
    duplicates,
  };
};

/**
 * Process a variable declaration line
 * @returns true if the line was processed as a variable, false otherwise
 */
const processVariableLine = (
  trimmedLine: string,
  originalLine: string,
  lineNumber: number,
  variables: SupportedVariables,
  errors: ErrorDetail[],
  regexes: Record<string, RegExp>
): boolean => {
  for (const [key, regex] of Object.entries(regexes)) {
    if (regex.test(trimmedLine)) {
      const value = trimmedLine.split('=')[1]?.trim();
      if (value) {
        if (key === 'subDomain') {
          processSubDomainVariable(value, originalLine, lineNumber, variables, errors);
        } else if (key === 'managerDomain') {
          processManagerDomainVariable(value, originalLine, lineNumber, variables, errors);
        } else {
          (variables as any)[key] = value;
        }
      }
      return true;
    }
  }
  return false;
};

/**
 * Process a SUBDOMAIN variable declaration
 */
const processSubDomainVariable = (
  value: string,
  originalLine: string,
  lineNumber: number,
  variables: SupportedVariables,
  errors: ErrorDetail[]
): void => {
  if (!isValidDomain(value)) {
    errors.push({
      line: lineNumber,
      content: originalLine,
      message: chrome.i18n.getMessage('invalid_domain', [value]),
    });
    return;
  }

  variables.subDomains = variables.subDomains || [];
  if (!variables.subDomains.includes(value)) {
    variables.subDomains.push(value);
  }
};

/**
 * Process a MANAGERDOMAIN variable declaration
 */
const processManagerDomainVariable = (
  value: string,
  originalLine: string,
  lineNumber: number,
  variables: SupportedVariables,
  errors: ErrorDetail[]
): void => {
  variables.managerDomains = variables.managerDomains || [];
  const [managerDomain, countryCode] = value.split(',').map((s) => s.trim());

  if (!isValidDomain(managerDomain)) {
    errors.push({
      line: lineNumber,
      content: originalLine,
      message: chrome.i18n.getMessage('invalid_domain', [managerDomain]),
    });
    return;
  }

  const managerDomainCount = Object.entries(variables).filter(
    ([k, v]) => k === 'managerDomains' && v.some((entry: string) => entry.includes(countryCode))
  ).length;

  if (managerDomainCount > 1) {
    errors.push({
      line: lineNumber,
      content: originalLine,
      message: chrome.i18n.getMessage('multiple_manager_domain_declarations', [countryCode]),
    });
  } else {
    variables.managerDomains.push(value);
  }
};

/**
 * Process an ads.txt entry line
 */
const processEntryLine = (
  trimmedLine: string,
  originalLine: string,
  lineNumber: number,
  entries: AdsTxt[],
  errors: ErrorDetail[],
  duplicates: ErrorDetail[]
): void => {
  const fields = trimmedLine.split(/,|\s+/).filter((field) => field !== '');

  if (fields.length < 3) {
    errors.push({
      line: lineNumber,
      content: originalLine,
      message: chrome.i18n.getMessage('insufficient_fields'),
    });
    return;
  }

  const [domainField, publisherId, relationshipField, certificationAuthorityId] = fields;
  const relationship = relationshipField.toUpperCase();

  // Validate the relationship type. Only 'DIRECT' and 'RESELLER' are allowed.
  if (relationship !== 'DIRECT' && relationship !== 'RESELLER') {
    errors.push({
      line: lineNumber,
      content: originalLine,
      message: chrome.i18n.getMessage('invalid_relationship_type', [relationshipField]),
    });
    return;
  }

  // Validate the domain name
  if (!isValidDomain(domainField)) {
    errors.push({
      line: lineNumber,
      content: originalLine,
      message: chrome.i18n.getMessage('invalid_domain', [domainField]),
    });
    return;
  }

  // Validate the publisher ID
  if (!isValidPublisherId(publisherId)) {
    errors.push({
      line: lineNumber,
      content: originalLine,
      message: chrome.i18n.getMessage('invalid_publisher_id', [publisherId]),
    });
    return;
  }

  // Validate the certification authority ID
  if (certificationAuthorityId && !isValidCertificationAuthorityId(certificationAuthorityId)) {
    errors.push({
      line: lineNumber,
      content: originalLine,
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

  const isDuplicate = checkForDuplicate(entry, entries);

  if (isDuplicate) {
    duplicates.push({
      line: lineNumber,
      content: originalLine,
      message: chrome.i18n.getMessage('duplicate_entries'),
    });
  } else {
    entries.push(entry);
  }
};

/**
 * Check if an entry is a duplicate
 */
const checkForDuplicate = (entry: AdsTxt, entries: AdsTxt[]): boolean => {
  return entries.some(
    (e) =>
      e.domain === entry.domain &&
      e.publisherId === entry.publisherId &&
      e.relationship === entry.relationship
  );
};

/**
 * Sort entries by domain, publisher ID, and relationship
 */
const sortEntries = (entries: AdsTxt[]): AdsTxt[] => {
  return [...entries].sort(
    (a, b) =>
      a.domain.localeCompare(b.domain) ||
      a.publisherId.length - b.publisherId.length ||
      a.publisherId.localeCompare(b.publisherId) ||
      a.relationship.localeCompare(b.relationship)
  );
};

/**
 * Validate a publisher ID
 */
const isValidPublisherId = (publisherId: string): boolean => {
  return !!publisherId.match(/^[a-zA-Z0-9.\-_=]+$/);
};

/**
 * Validate a certification authority ID
 */
const isValidCertificationAuthorityId = (certificationAuthorityId: string): boolean => {
  return !!certificationAuthorityId.match(/^[a-zA-Z0-9.\-_]+$/);
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
 * Whether the domain string is valid or not
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
