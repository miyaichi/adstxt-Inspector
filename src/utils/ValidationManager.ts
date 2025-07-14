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
import { sanitizeKey, validateDomain, validatePublisherId } from './security';

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

  // Cache for parsed and validated entries per ads.txt URL
  private readonly validatedEntriesCache = new Map<string, ParsedAdsTxtEntry[]>();

  // Cache for validation results per request
  private readonly resultsCache = new Map<string, ValidityResult>();

  // Track ongoing validations to prevent duplicates
  private readonly ongoingValidations = new Map<string, Promise<ParsedAdsTxtEntry[]>>();

  // Sellers provider cache
  private readonly sellersProviderCache = new Map<string, AdsTxtInspectorSellersProvider>();

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
   * Generate cache key for ads.txt validation
   */
  private getAdsTxtCacheKey(adsTxtData: FetchAdsTxtResult): string {
    const sanitizedUrl = sanitizeKey(adsTxtData.adsTxtUrl);
    const contentLength = adsTxtData.adsTxtContent.length;
    return `${sanitizedUrl}-${contentLength}`;
  }

  /**
   * Generate cache key for individual entry validation
   */
  private getEntryKey(domain: string, entry: AdsTxt): string {
    // Validate and sanitize inputs to prevent injection attacks
    if (!validateDomain(domain)) {
      throw new Error('Invalid domain format');
    }
    
    const sanitizedDomain = sanitizeKey(domain);
    const sanitizedPublisherId = sanitizeKey(validatePublisherId(entry.publisherId));
    const sanitizedRelationship = sanitizeKey(entry.relationship);
    
    return `${sanitizedDomain}-${sanitizedPublisherId}-${sanitizedRelationship}`;
  }

  /**
   * Get or create sellers provider
   */
  private getSellersProvider(): AdsTxtInspectorSellersProvider {
    const providerKey = `${this.fetchOptions.timeout}-${this.fetchOptions.retries}`;
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

    // Check if validation is already in progress
    const ongoing = this.ongoingValidations.get(cacheKey);
    if (ongoing) {
      logger.debug('Validation already in progress for:', cacheKey);
      return ongoing;
    }

    // Check cache first
    const cached = this.validatedEntriesCache.get(cacheKey);
    if (cached) {
      logger.debug('Using cached validation for:', cacheKey);
      return cached;
    }

    // Start new validation
    logger.debug('Starting full validation for:', cacheKey);
    const validationPromise = this.doFullValidation(adsTxtData, cacheKey);

    // Track ongoing validation
    this.ongoingValidations.set(cacheKey, validationPromise);

    try {
      const result = await validationPromise;

      // Cache the result
      this.validatedEntriesCache.set(cacheKey, result);
      logger.debug('Cached validation results for:', cacheKey, 'entries:', result.length);

      return result;
    } finally {
      // Remove from ongoing validations
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

    // Parse ads.txt content
    const parsedEntries = parseAdsTxtContent(adsTxtData.adsTxtContent, ownerDomain);
    logger.debug('Parsed', parsedEntries.length, 'entries for', cacheKey);

    // Get sellers provider
    const sellersProvider = this.getSellersProvider();

    // Cross-check with sellers.json
    const crossCheckResult = await crossCheckAdsTxtRecords(
      ownerDomain || new URL(adsTxtData.adsTxtUrl).hostname,
      parsedEntries,
      null, // No cached content for duplicate check yet
      sellersProvider
    );

    logger.debug('Cross-check completed for', cacheKey, 'results:', crossCheckResult.length);

    return crossCheckResult;
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

    // Check entry cache first
    const cached = this.resultsCache.get(entryKey);
    if (cached) {
      return cached;
    }

    try {
      // Get validated entries for this ads.txt
      const validatedEntries = await this.performFullValidation(adsTxtData);

      // Filter only record entries
      const recordEntries = validatedEntries.filter(isAdsTxtRecord) as ParsedAdsTxtRecord[];

      // Find matching entry
      const matchingEntry = recordEntries.find((validatedEntry) => {
        return (
          validatedEntry.domain === domain &&
          validatedEntry.account_id === entry.publisherId &&
          validatedEntry.relationship === entry.relationship
        );
      });

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

      // Cache the result
      this.resultsCache.set(entryKey, result);

      return result;
    } catch (error) {
      logger.error('Validation failed for entry:', entryKey, error);

      // Use fallback if available
      if (fallbackFunction) {
        const fallbackResult = fallbackFunction(domain, entry);
        this.resultsCache.set(entryKey, fallbackResult);
        return fallbackResult;
      }

      // Return error result
      const errorResult: ValidityResult = {
        isVerified: false,
        reasons: [],
        validationMessages: [
          {
            key: 'validationError',
            severity: 'error' as const,
            message: 'Validation failed',
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

    logger.debug('Starting batch validation for', requests.length, 'entries');

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
          logger.error('Batch validation failed:', batchResult.reason);
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

      // Add small delay to make progress visible
      await new Promise((resolve) => setTimeout(resolve, 100));
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
   * Get validation statistics
   */
  getStats() {
    return {
      cachedAdsTxtValidations: this.validatedEntriesCache.size,
      cachedEntryResults: this.resultsCache.size,
      ongoingValidations: this.ongoingValidations.size,
      sellersProviders: this.sellersProviderCache.size,
    };
  }
}
