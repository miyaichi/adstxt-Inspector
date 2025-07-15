import {
  configureMessages,
  createValidationMessage,
  isAdsTxtRecord,
  isAdsTxtVariable,
  parseAdsTxtContent as parseAdsTxtContentLib,
  ParsedAdsTxtEntry,
  ParsedAdsTxtRecord,
  ParsedAdsTxtVariable,
  Severity
} from '@miyaichi/ads-txt-validator';
import * as psl from 'psl';
import { fetchFromUrls } from './fetchFromUrls';

// Initialize message configuration for ads-txt-validator
const initializeAdsTxtValidator = () => {
  // Detect Chrome extension locale
  const chromeLocale = chrome.i18n.getUILanguage();
  // Map Chrome locale to ads-txt-validator supported locales
  const supportedLocale = chromeLocale.startsWith('ja') ? 'ja' : 'en';
  
  // Configure base URL for help links
  configureMessages({
    defaultLocale: supportedLocale,
    baseUrl: 'https://adstxt-manager.jp',
  });
};

// Initialize on module load
initializeAdsTxtValidator();

// Type definitions compatible with ads-txt-validator
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
  severity?: Severity;
  helpUrl?: string;
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
  parsedEntries?: ParsedAdsTxtEntry[]; // Add parsed entries from ads-txt-validator
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

    // Parse the ads.txt content using ads-txt-validator
    // Version 1.2.3+ properly handles invalid characters and inline comments
    const parsedEntries = parseAdsTxtContentLib(adsTxtContent, rootDomain);
    const { entries, variables, errors, duplicates } = convertParsedEntriesToLegacyFormat(
      parsedEntries,
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
      parsedEntries, // Include parsed entries from validator
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
 * Convert parsed entries from ads-txt-validator to legacy format
 * @param parsedEntries Parsed entries from ads-txt-validator
 * @param rootDomain Root domain name
 * @returns ParseResult object in legacy format
 */
const convertParsedEntriesToLegacyFormat = (
  parsedEntries: ParsedAdsTxtEntry[],
  rootDomain: string
): ParseResult => {
  const entries: AdsTxt[] = [];
  const errors: ErrorDetail[] = [];
  const duplicates: ErrorDetail[] = [];
  const variables: SupportedVariables = { ownerDomain: rootDomain };

  // Process each parsed entry
  parsedEntries.forEach((entry) => {
    if (isAdsTxtVariable(entry)) {
      // Process variable entries
      processVariableEntry(entry, variables);
    } else if (isAdsTxtRecord(entry)) {
      // Process record entries
      
      // Add all warnings and errors (regardless of is_valid status)
      if (entry.has_warning && entry.all_warnings) {
        entry.all_warnings.forEach(warning => {
          if (warning.severity === Severity.INFO || warning.key.includes('duplicate') || warning.key.includes('DUPLICATE')) {
            duplicates.push({
              line: entry.line_number,
              content: entry.raw_line,
              message: getLocalizedMessage(warning.key, warning.params),
              severity: warning.severity,
              helpUrl: getHelpUrl(warning.key),
            });
          } else {
            errors.push({
              line: entry.line_number,
              content: entry.raw_line,
              message: getLocalizedMessage(warning.key, warning.params),
              severity: warning.severity,
              helpUrl: getHelpUrl(warning.key),
            });
          }
        });
      } else if (entry.has_warning && entry.validation_key) {
        // Handle single warning case
        if (entry.severity === Severity.INFO || entry.validation_key.includes('duplicate') || entry.validation_key.includes('DUPLICATE')) {
          duplicates.push({
            line: entry.line_number,
            content: entry.raw_line,
            message: getLocalizedMessage(entry.validation_key, entry.warning_params),
            severity: entry.severity,
            helpUrl: getHelpUrl(entry.validation_key),
          });
        } else {
          errors.push({
            line: entry.line_number,
            content: entry.raw_line,
            message: getLocalizedMessage(entry.validation_key, entry.warning_params),
            severity: entry.severity,
            helpUrl: getHelpUrl(entry.validation_key),
          });
        }
      }
      
      // Add validation errors for invalid entries
      if (!entry.is_valid) {
        errors.push({
          line: entry.line_number,
          content: entry.raw_line,
          message: getLocalizedMessage(entry.validation_key || entry.error, entry.warning_params),
          severity: entry.severity || Severity.ERROR,
          helpUrl: getHelpUrl(entry.validation_key || entry.error),
        });
      }
      
      // Add valid entries (both valid and invalid entries can have warnings)
      if (entry.is_valid) {
        entries.push({
          domain: entry.domain,
          publisherId: entry.account_id,
          relationship: entry.relationship,
          certificationAuthorityId: entry.certification_authority_id,
        });
      }
    }
  });

  // Manual duplicate detection for valid records
  const manualDuplicates = detectDuplicates(parsedEntries);
  duplicates.push(...manualDuplicates);

  return {
    entries: sortEntries(entries),
    variables,
    errors,
    duplicates,
  };
};

/**
 * Detect duplicate records manually since ads-txt-validator doesn't mark duplicates
 * @param parsedEntries Parsed entries from ads-txt-validator
 * @returns Array of duplicate errors
 */
const detectDuplicates = (parsedEntries: ParsedAdsTxtEntry[]): ErrorDetail[] => {
  const duplicates: ErrorDetail[] = [];
  const recordMap = new Map<string, ParsedAdsTxtRecord>();
  
  // Filter to only valid records (not variables)
  const validRecords = parsedEntries.filter(
    (entry): entry is ParsedAdsTxtRecord => 
      isAdsTxtRecord(entry) && entry.is_valid
  );

  validRecords.forEach(record => {
    // Create composite key: domain (case-insensitive) + account_id + relationship
    const key = `${record.domain.toLowerCase()}|${record.account_id}|${record.account_type}`;
    
    if (recordMap.has(key)) {
      // Found duplicate - create error for the duplicate line
      const originalRecord = recordMap.get(key)!;
      
      // Get localized duplicate message
      const chromeLocale = chrome.i18n.getUILanguage();
      const locale = chromeLocale.startsWith('ja') ? 'ja' : 'en';
      
      const duplicateMessage = locale === 'ja' 
        ? `重複レコード: ${record.domain}, ${record.account_id}, ${record.account_type} (元の行: ${originalRecord.line_number})`
        : `Duplicate record: ${record.domain}, ${record.account_id}, ${record.account_type} (original at line: ${originalRecord.line_number})`;
      
      duplicates.push({
        line: record.line_number,
        content: record.raw_line,
        message: duplicateMessage,
        severity: Severity.INFO,
        helpUrl: undefined,
      });
    } else {
      recordMap.set(key, record);
    }
  });

  return duplicates;
};

/**
 * Process a variable entry from ads-txt-validator
 */
const processVariableEntry = (
  entry: ParsedAdsTxtVariable,
  variables: SupportedVariables
): void => {
  switch (entry.variable_type) {
    case 'CONTACT':
      variables.contact = entry.value;
      break;
    case 'INVENTORYPARTNERDOMAIN':
      variables.inventoryPartnerdomain = entry.value;
      break;
    case 'MANAGERDOMAIN':
      variables.managerDomains = variables.managerDomains || [];
      variables.managerDomains.push(entry.value);
      break;
    case 'OWNERDOMAIN':
      variables.ownerDomain = entry.value;
      break;
    case 'SUBDOMAIN':
      variables.subDomains = variables.subDomains || [];
      variables.subDomains.push(entry.value);
      break;
  }
};

/**
 * Get localized message from validation key and parameters
 */
const getLocalizedMessage = (
  validationKey?: string,
  params?: Record<string, any>
): string => {
  if (!validationKey) return 'Unknown error';
  
  // Extract placeholders array from params object
  let placeholders: string[] = [];
  if (params) {
    // If params has specific keys, use them in order
    if (typeof params === 'object' && params !== null) {
      // Check for common parameter names and extract values
      const paramKeys = ['domain', 'account_id', 'publisher_domain', 'seller_domain', 'seller_type'];
      placeholders = paramKeys
        .filter(key => params[key] !== undefined)
        .map(key => String(params[key]));
      
      // If no specific keys found, use all values
      if (placeholders.length === 0) {
        placeholders = Object.values(params).map(String);
      }
    }
  }
  
  // Detect current locale
  const chromeLocale = chrome.i18n.getUILanguage();
  const locale = chromeLocale.startsWith('ja') ? 'ja' : 'en';
  
  const validationMessage = createValidationMessage(
    validationKey,
    placeholders.length > 0 ? placeholders : undefined,
    locale
  );
  
  return validationMessage?.message || validationKey;
};

/**
 * Get help URL from validation key
 */
const getHelpUrl = (validationKey?: string): string | undefined => {
  if (!validationKey) return undefined;
  
  // Detect current locale
  const chromeLocale = chrome.i18n.getUILanguage();
  const locale = chromeLocale.startsWith('ja') ? 'ja' : 'en';
  
  const validationMessage = createValidationMessage(validationKey, undefined, locale);
  return validationMessage?.helpUrl;
};

// Legacy functions removed - now handled by ads-txt-validator package

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

// Legacy validation functions removed - now handled by ads-txt-validator package

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
