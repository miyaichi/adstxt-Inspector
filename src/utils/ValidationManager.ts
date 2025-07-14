import type { AdsTxt, FetchAdsTxtResult } from './fetchAdsTxt';
import type { ValidityResult } from '../hooks/useAdsSellers';
import type { ParsedAdsTxtRecord, ParsedAdsTxtEntry } from '@miyaichi/ads-txt-validator';
import {
  parseAdsTxtContent,
  crossCheckAdsTxtRecords,
  isAdsTxtRecord,
} from '@miyaichi/ads-txt-validator';
import { AdsTxtInspectorSellersProvider } from './AdsTxtInspectorSellersProvider';
import { convertToValidityResult } from './validationConverter';
import { Logger } from './logger';
import { sanitizeKey, validateDomain, validatePublisherId, sanitizeLogInput, SecureMap, sanitizeMapKey } from './security';

const logger = new Logger('ValidationManager');

export interface ValidationRequest {
  domain: string;
  entry: AdsTxt;
  requestId: string;
}

export interface ValidationResult {
  requestId: string;
  domain: string;
  entry: AdsTxt;
  result: ValidityResult;
  timestamp: number;
}

export interface ValidationProgress {
  total: number;
  completed: number;
  inProgress: number;
  failed: number;
}

/**
 * Smart validation manager that optimizes async validation
 * - Groups requests by domain
 * - Caches results efficiently
 * - Provides progress updates
 * - Handles errors gracefully
 */
export class ValidationManager {
  private static instance: ValidationManager | null = null;

  // Secure cache for parsed and validated entries per ads.txt URL
  private readonly validatedEntriesCache = new SecureMap<ParsedAdsTxtEntry[]>('ValidatedEntriesCache');

  // Secure cache for validation results per request
  private readonly resultsCache = new SecureMap<ValidityResult>('ResultsCache');

  // Secure tracking of ongoing validations to prevent duplicates
  private readonly ongoingValidations = new SecureMap<Promise<ParsedAdsTxtEntry[]>>('OngoingValidations');

  // Secure sellers provider cache
  private readonly sellersProviderCache = new SecureMap<AdsTxtInspectorSellersProvider>('SellersProviderCache');

  private readonly fetchOptions = { timeout: 5000, retries: 1 };

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ValidationManager {
    if (!ValidationManager.instance) {
      ValidationManager.instance = new ValidationManager();
    }
    return ValidationManager.instance;
  }

  /**
   * Clear all caches (useful for testing or memory management)
   */
  clearCaches(): void {
    this.validatedEntriesCache.clear();
    this.resultsCache.clear();
    this.ongoingValidations.clear();
    // Keep sellers provider cache as it's expensive to recreate
  }

  /**
   * Generate secure cache key for ads.txt validation
   */
  private getAdsTxtCacheKey(adsTxtData: FetchAdsTxtResult): string {
    const sanitizedUrl = sanitizeMapKey(adsTxtData.adsTxtUrl);
    const sanitizedContentLength = sanitizeMapKey(String(adsTxtData.adsTxtContent.length));
    return sanitizeMapKey(`${sanitizedUrl}-${sanitizedContentLength}`);
  }

  /**
   * Generate secure cache key for individual entry validation
   */
  private getEntryKey(domain: string, entry: AdsTxt): string {
    // Validate and sanitize inputs to prevent injection attacks
    if (!validateDomain(domain)) {
      throw new Error('Invalid domain format');
    }
    
    const sanitizedDomain = sanitizeMapKey(domain);
    const sanitizedPublisherId = sanitizeMapKey(validatePublisherId(entry.publisherId));
    const sanitizedRelationship = sanitizeMapKey(entry.relationship);
    
    return sanitizeMapKey(`${sanitizedDomain}-${sanitizedPublisherId}-${sanitizedRelationship}`);
  }

  /**
   * Get or create sellers provider with secure caching
   */
  private getSellersProvider(): AdsTxtInspectorSellersProvider {
    const providerKey = sanitizeMapKey(`${this.fetchOptions.timeout}-${this.fetchOptions.retries}`);
    let provider = this.sellersProviderCache.get(providerKey);

    if (!provider) {
      provider = new AdsTxtInspectorSellersProvider(this.fetchOptions);
      this.sellersProviderCache.set(providerKey, provider);
    }

    return provider;
  }

  /**
   * Perform full validation for an ads.txt file
   * This is done once per ads.txt and cached
   */
  private async performFullValidation(adsTxtData: FetchAdsTxtResult): Promise<ParsedAdsTxtEntry[]> {
    const cacheKey = this.getAdsTxtCacheKey(adsTxtData);

    // Check if validation is already in progress - SecureMap handles key sanitization
    const ongoing = this.ongoingValidations.get(cacheKey);
    if (ongoing) {
      logger.debug('Validation already in progress for:', sanitizeLogInput(cacheKey));
      return ongoing;
    }

    // Check cache first - SecureMap handles key sanitization
    const cached = this.validatedEntriesCache.get(cacheKey);
    if (cached) {
      logger.debug('Using cached validation for:', sanitizeLogInput(cacheKey));
      return cached;
    }

    // Start new validation
    logger.debug('Starting full validation for:', sanitizeLogInput(cacheKey));
    const validationPromise = this.doFullValidation(adsTxtData, cacheKey);

    // Track ongoing validation - SecureMap handles key sanitization automatically
    this.ongoingValidations.set(cacheKey, validationPromise);

    try {
      const result = await validationPromise;

      // Cache the result - SecureMap handles key sanitization automatically
      this.validatedEntriesCache.set(cacheKey, result);
      logger.debug('Cached validation results for:', sanitizeLogInput(cacheKey), 'entries:', sanitizeLogInput(String(result.length)));

      return result;
    } finally {
      // Remove from ongoing validations - SecureMap provides injection-safe deletion
      this.ongoingValidations.delete(cacheKey);
    }
  }

  /**
   * Internal method to perform the actual validation
   */
  private async doFullValidation(
    adsTxtData: FetchAdsTxtResult,
    cacheKey: string
  ): Promise<ParsedAdsTxtEntry[]> {
    const ownerDomain = adsTxtData.variables?.ownerDomain;

    try {
      // Parse ads.txt content
      const parsedEntries = parseAdsTxtContent(adsTxtData.adsTxtContent, ownerDomain);
      logger.debug('Parsed', sanitizeLogInput(String(parsedEntries.length)), 'entries for', sanitizeLogInput(cacheKey));

      // Get sellers provider
      const sellersProvider = this.getSellersProvider();

      // Cross-check with sellers.json
      const crossCheckResult = await crossCheckAdsTxtRecords(
        ownerDomain || new URL(adsTxtData.adsTxtUrl).hostname,
        parsedEntries,
        null, // No cached content for duplicate check yet
        sellersProvider
      );

      logger.debug('Cross-check completed for', sanitizeLogInput(cacheKey), 'results:', sanitizeLogInput(String(crossCheckResult.length)));

      return crossCheckResult;
    } catch (error) {
      // Enhanced error logging with more context
      const errorDetails = {
        cacheKey: sanitizeLogInput(cacheKey),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: sanitizeLogInput(String(error)),
        stackTrace: error instanceof Error && error.stack ? sanitizeLogInput(error.stack.substring(0, 500)) : 'No stack trace available'
      };
      
      logger.error('Full validation failed for', errorDetails.cacheKey, 'Error type:', errorDetails.errorType, 'Message:', errorDetails.errorMessage);
      
      // Log stack trace separately for debugging
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Stack trace:', errorDetails.stackTrace);
      }
      
      // Return empty array on parse/validation failure
      return [];
    }
  }

  /**
   * Validate a single entry
   */
  async validateEntry(
    domain: string,
    entry: AdsTxt,
    adsTxtData: FetchAdsTxtResult,
    fallbackFunction?: (domain: string, entry: AdsTxt) => ValidityResult
  ): Promise<ValidityResult> {
    const entryKey = this.getEntryKey(domain, entry);

    // Check entry cache first - SecureMap handles key sanitization automatically
    const cached = this.resultsCache.get(entryKey);
    if (cached) {
      return cached;
    }

    try {
      // Get validated entries for this ads.txt
      const validatedEntries = await this.performFullValidation(adsTxtData);

      // Filter only record entries
      const recordEntries = validatedEntries.filter(isAdsTxtRecord) as ParsedAdsTxtRecord[];

      // Find matching entry using ultra-secure comparison to prevent NoSQL injection
      const sanitizedDomain = sanitizeMapKey(domain);
      const sanitizedPublisherId = sanitizeMapKey(validatePublisherId(entry.publisherId));
      const sanitizedRelationship = sanitizeMapKey(entry.relationship);
      
      // Create ultra-secure comparison function with comprehensive validation
      const createSecureComparison = (expectedDomain: string, expectedPublisherId: string, expectedRelationship: string) => {
        return (validatedEntry: any): boolean => {
          // First level: Object validation - ensure entry exists and has required properties
          if (!validatedEntry || typeof validatedEntry !== 'object') {
            return false;
          }
          
          // Second level: Property existence validation
          if (!validatedEntry.hasOwnProperty('domain') || 
              !validatedEntry.hasOwnProperty('account_id') || 
              !validatedEntry.hasOwnProperty('relationship')) {
            return false;
          }
          
          // Third level: Extract and sanitize entry values with ultra-strict validation
          let entryDomain: string;
          let entryAccountId: string;
          let entryRelationship: string;
          
          try {
            entryDomain = sanitizeMapKey(String(validatedEntry.domain || ''));
            entryAccountId = sanitizeMapKey(String(validatedEntry.account_id || ''));
            entryRelationship = sanitizeMapKey(String(validatedEntry.relationship || ''));
          } catch (error) {
            // If sanitization fails, this entry is potentially dangerous
            logger.warn('Entry sanitization failed, rejecting entry:', error);
            return false;
          }
          
          // Fourth level: Perform exact string comparison with sanitized values
          return (
            entryDomain === expectedDomain &&
            entryAccountId === expectedPublisherId &&
            entryRelationship === expectedRelationship
          );
        };
      };
      
      // Use ultra-secure comparison function
      const secureMatcher = createSecureComparison(sanitizedDomain, sanitizedPublisherId, sanitizedRelationship);
      const matchingEntry = recordEntries.find(secureMatcher);

      let result: ValidityResult;

      if (matchingEntry) {
        // Convert ads-txt-validator result
        result = convertToValidityResult(matchingEntry);
      } else {
        // Entry not found, use fallback or return error
        if (fallbackFunction) {
          result = fallbackFunction(domain, entry);
        } else {
          result = {
            isVerified: false,
            reasons: [],
            validationMessages: [
              {
                key: 'validationError',
                severity: 'error' as const,
                message: 'Entry not found in validation data',
                description: 'The specified entry could not be found for validation.',
                placeholders: [],
              },
            ],
          };
        }
      }

      // Cache the result - SecureMap handles key sanitization automatically
      this.resultsCache.set(entryKey, result);

      return result;
    } catch (error) {
      // Enhanced error logging for single entry validation
      const errorDetails = {
        entryKey: sanitizeLogInput(entryKey),
        domain: sanitizeLogInput(domain),
        publisherId: sanitizeLogInput(entry.publisherId),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: sanitizeLogInput(String(error)),
        stackTrace: error instanceof Error && error.stack ? sanitizeLogInput(error.stack.substring(0, 500)) : 'No stack trace available'
      };
      
      logger.error('Validation failed for entry:', errorDetails.entryKey, 'Domain:', errorDetails.domain, 'Publisher ID:', errorDetails.publisherId, 'Error:', errorDetails.errorMessage);
      
      // Log detailed error in development
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Validation error details:', errorDetails);
      }

      // Use fallback if available
      if (fallbackFunction) {
        try {
          const fallbackResult = fallbackFunction(domain, entry);
          this.resultsCache.set(entryKey, fallbackResult);
          return fallbackResult;
        } catch (fallbackError) {
          logger.error('Fallback function also failed:', sanitizeLogInput(String(fallbackError)));
        }
      }

      // Return error result with more specific error information
      const errorResult: ValidityResult = {
        isVerified: false,
        reasons: [],
        validationMessages: [
          {
            key: 'validationError',
            severity: 'error' as const,
            message: `Validation failed: ${errorDetails.errorType}`,
            description: 'An error occurred during validation. Please try again.',
            placeholders: [],
          },
        ],
      };

      this.resultsCache.set(entryKey, errorResult);
      return errorResult;
    }
  }

  /**
   * Validate multiple entries in batches with progress reporting
   */
  async validateEntries(
    requests: ValidationRequest[],
    adsTxtData: FetchAdsTxtResult,
    fallbackFunction?: (domain: string, entry: AdsTxt) => ValidityResult,
    progressCallback?: (progress: ValidationProgress) => void
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const batchSize = 10; // Process in smaller batches

    logger.debug('Starting batch validation for', sanitizeLogInput(String(requests.length)), 'entries');

    let completed = 0;
    let failed = 0;

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);

      // Update progress
      if (progressCallback) {
        progressCallback({
          total: requests.length,
          completed,
          inProgress: batch.length,
          failed,
        });
      }

      // Process batch
      const batchResults = await Promise.allSettled(
        batch.map(async (request) => {
          const result = await this.validateEntry(
            request.domain,
            request.entry,
            adsTxtData,
            fallbackFunction
          );

          return {
            requestId: request.requestId,
            domain: request.domain,
            entry: request.entry,
            result,
            timestamp: Date.now(),
          };
        })
      );

      // Collect results
      for (const batchResult of batchResults) {
        if (batchResult.status === 'fulfilled') {
          results.push(batchResult.value);
          completed++;
        } else {
          logger.error('Batch validation failed:', sanitizeLogInput(String(batchResult.reason)));
          failed++;
        }
      }

      // Update progress after each batch
      if (progressCallback) {
        progressCallback({
          total: requests.length,
          completed,
          inProgress: 0,
          failed,
        });
      }

      // Configurable delay for progress visibility - can be disabled for performance
      const progressDelay = process.env.NODE_ENV === 'development' ? 100 : 0;
      if (progressDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, progressDelay));
      }
    }

    // Final progress update
    if (progressCallback) {
      progressCallback({
        total: requests.length,
        completed,
        inProgress: 0,
        failed,
      });
    }

    logger.debug('Batch validation completed:', {
      total: requests.length,
      completed,
      failed,
    });

    return results;
  }

  /**
   * Get validation statistics with secure Map information
   */
  getStats() {
    return {
      cachedAdsTxtValidations: this.validatedEntriesCache.size,
      cachedEntryResults: this.resultsCache.size,
      ongoingValidations: this.ongoingValidations.size,
      sellersProviders: this.sellersProviderCache.size,
      securityInfo: {
        validatedEntriesCacheName: this.validatedEntriesCache.getName(),
        resultsCacheName: this.resultsCache.getName(),
        ongoingValidationsName: this.ongoingValidations.getName(),
        sellersProviderCacheName: this.sellersProviderCache.getName(),
      },
    };
  }
}
