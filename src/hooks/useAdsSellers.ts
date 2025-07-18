import {
  BatchSellersResult,
  CacheInfo,
  createValidationMessage,
  crossCheckAdsTxtRecords,
  isAdsTxtRecord,
  SellersJsonMetadata,
  SellersJsonProvider,
} from '@miyaichi/ads-txt-validator';
import { useState, useCallback } from 'react';
import { AdsTxt, fetchAdsTxt, FetchAdsTxtResult, getUniqueDomains } from '../utils/fetchAdsTxt';
import { SellersJsonFetcher, type Seller } from '../utils/fetchSellersJson';
import { Logger } from '../utils/logger';
import { SellersJsonApi } from '../utils/sellersJsonApi';
import { getApiConfig } from '../config/api';

const logger = new Logger('useAdsSellers');

export interface SellerAnalysis {
  domain: string;
  sellersJson?: {
    data: Seller[];
    error?: string;
  };
  adsTxtEntries: AdsTxt[];
}

export interface ValidityResult {
  isVerified: boolean;
  reasons: { key: string; placeholders: string[] }[];
}

interface UseAdsSellersReturn {
  analyzing: boolean;
  adsTxtData: FetchAdsTxtResult | null;
  sellerAnalysis: SellerAnalysis[];
  analyze: (url: string, appAdsTxt: boolean) => void;
  isVerifiedEntry: (domain: string, entry: AdsTxt) => ValidityResult;
}

const FETCH_OPTIONS = { timeout: 5000, retries: 1 };

/**
 * Retrive the sellers.json for the specified domain and narrow down the ssearch using the corresponding ads.txt entries.
 * @param domain
 * @param adsTxtEntries
 * @returns SellerAnalysis
 */
/**
 * Extract seller analysis from validated entries (crossCheckAdsTxtRecords results)
 * @param domains
 * @param adsTxtResult
 * @returns SellerAnalysis[]
 */
const extractSellerAnalysisFromValidatedEntries = async (
  domains: string[],
  adsTxtResult: FetchAdsTxtResult,
  sellersJsonProvider: SellersJsonProvider
): Promise<SellerAnalysis[]> => {
  const { data: adsTxtEntriesAll } = adsTxtResult;

  const analysisResults = await Promise.all(
    domains.map(async (domain) => {
      const entries = adsTxtEntriesAll.filter((entry) => entry.domain === domain);

      try {
        // Get seller IDs for this domain from ads.txt entries
        const sellerIds = entries.map((entry) => entry.publisherId);

        if (sellerIds.length === 0) {
          return {
            domain,
            sellersJson: { data: [], error: undefined },
            adsTxtEntries: entries,
          };
        }

        // Fetch sellers using the provider
        const batchResult = await sellersJsonProvider.batchGetSellers(domain, sellerIds);

        // Extract sellers from the batch result
        // NOTE: Include ALL results, not just found ones, to match test program logic
        const sellers: Seller[] = (batchResult.results || []).map((result) => {
          const sellerData = result.seller;
          return {
            seller_id: result.sellerId,
            seller_type: sellerData?.seller_type,
            name: sellerData?.name,
            domain: sellerData?.domain,
            is_confidential: (sellerData?.is_confidential || 0) as 0 | 1,
            found: result.found,
          };
        });

        return {
          domain,
          sellersJson: { data: sellers, error: undefined },
          adsTxtEntries: entries,
        };
      } catch (error) {
        return {
          domain,
          sellersJson: {
            data: [],
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          adsTxtEntries: entries,
        };
      }
    })
  );

  return analysisResults;
};

export const useAdsSellers = (): UseAdsSellersReturn => {
  const [analyzing, setAnalyzing] = useState(false);
  const [adsTxtData, setAdsTxtData] = useState<FetchAdsTxtResult | null>(null);
  const [sellerAnalysis, setSellerAnalysis] = useState<SellerAnalysis[]>([]);

  /**
   * Retrive and analyze the ads.txt/app-ads.txt and sellers.json based on the specified URL.
   * @param url
   */
  const analyze = async (url: string, appAdsTxt: boolean) => {
    if (analyzing) return;

    setAnalyzing(true);
    setAdsTxtData(null);
    setSellerAnalysis([]);

    try {
      const domain = new URL(url).hostname;
      const adsTxtResult = await fetchAdsTxt(domain, appAdsTxt);

      // Create SellersJsonProvider using the robust SellersJsonApi
      const apiConfig = await getApiConfig();
      const sellersJsonApi = new SellersJsonApi(apiConfig);
      const sellersJsonProvider: SellersJsonProvider = {
        async batchGetSellers(domain: string, sellerIds: string[]): Promise<BatchSellersResult> {
          const response = await sellersJsonApi.fetchSellersBatch(domain, sellerIds);

          if (response.success && response.data) {
            // Transform the API response to the BatchSellersResult format
            return {
              domain: response.data.domain,
              requested_count: response.data.requested_count,
              found_count: response.data.found_count,
              results: response.data.sellers.map((seller) => ({
                sellerId: seller.seller_id,
                seller: seller.found
                  ? {
                      seller_id: seller.seller_id,
                      seller_type: seller.seller_type,
                      name: seller.name,
                      domain: seller.domain,
                      is_confidential: seller.is_confidential ? 1 : 0,
                    }
                  : null,
                found: seller.found,
                source: 'fresh', // Or determine based on cache status
              })),
              metadata: response.data.metadata || {},
              cache: response.data.cache
                ? {
                    ...response.data.cache,
                    status: response.data.cache.status as 'error' | 'success' | 'stale',
                  }
                : { is_cached: false, status: 'success' },
            };
          } else {
            // If the API call fails, return a result that indicates failure for all sellers
            return {
              domain,
              requested_count: sellerIds.length,
              found_count: 0,
              results: sellerIds.map((id) => ({
                sellerId: id,
                seller: null,
                found: false,
                source: 'fresh',
                error: response.error || 'API call failed without specific error',
              })),
              metadata: {},
              cache: { is_cached: false, status: 'error' },
            };
          }
        },
        hasSellerJson: async (domain: string) => {
          // This can be simplified as fetchSellersBatch will indicate existence
          return true;
        },
        getMetadata: async (domain: string) => {
          // Metadata is now part of the batch response, this could be deprecated
          return {};
        },
        getCacheInfo: async (domain: string) => {
          // Cache info is also in the batch response
          return { is_cached: false, status: 'success' };
        },
      };

      // Perform cross-checking with ads-txt-validator if we have parsed entries
      if (adsTxtResult.parsedEntries) {
        // Perform cross-checking
        const validatedEntries = await crossCheckAdsTxtRecords(
          domain,
          adsTxtResult.parsedEntries,
          null, // No cached content for now
          sellersJsonProvider
        );

        // Update the result with validated entries
        adsTxtResult.parsedEntries = validatedEntries;
      }

      setAdsTxtData(adsTxtResult);
      logger.debug(appAdsTxt ? 'App-ads.txt' : 'Ads.txt', adsTxtResult);

      // Extract seller analysis from crossCheckAdsTxtRecords results
      const sellerDomains = getUniqueDomains(adsTxtResult.data);
      const analysis = await extractSellerAnalysisFromValidatedEntries(
        sellerDomains,
        adsTxtResult,
        sellersJsonProvider
      );
      setSellerAnalysis(analysis);
      logger.debug('Seller analysis:', analysis);
    } catch (error) {
      logger.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * Validate whether the specified ads.txt/app-ads.txt entry is valid using ads-txt-validator
   * @param domain
   * @param entry
   * @returns ValidityResult
   */
  const isVerifiedEntry = useCallback(
    (domain: string, entry: AdsTxt): ValidityResult => {
      // Find the corresponding parsed entry from ads-txt-validator
      const parsedEntries = adsTxtData?.parsedEntries || [];
      const matchingEntry = parsedEntries.find((parsed) => {
        if (!isAdsTxtRecord(parsed)) return false;
        return (
          parsed.domain === entry.domain &&
          parsed.account_id === entry.publisherId &&
          parsed.relationship === entry.relationship
        );
      });

      if (!matchingEntry || !isAdsTxtRecord(matchingEntry)) {
        return {
          isVerified: false,
          reasons: [{ key: 'error_entry_not_found', placeholders: [entry.publisherId] }],
        };
      }

      const reasons: { key: string; placeholders: string[] }[] = [];

      // Check if there are validation warnings or errors
      if (matchingEntry.has_warning && matchingEntry.all_warnings) {
        // Process all validation warnings from ads-txt-validator
        matchingEntry.all_warnings.forEach((warning) => {
          // Extract placeholders array from params object
          let placeholders: string[] = [];
          if (warning.params) {
            const paramKeys = [
              'domain',
              'account_id',
              'publisher_domain',
              'seller_domain',
              'seller_type',
            ];
            placeholders = paramKeys
              .filter((key) => warning.params![key] !== undefined)
              .map((key) => String(warning.params![key]));

            // If no specific keys found, use all values
            if (placeholders.length === 0) {
              placeholders = Object.values(warning.params).map(String);
            }
          }

          reasons.push({
            key: warning.key,
            placeholders: placeholders,
          });
        });
      } else if (matchingEntry.validation_key && matchingEntry.has_warning) {
        // Handle single warning case
        let placeholders: string[] = [];
        if (matchingEntry.warning_params) {
          const paramKeys = [
            'domain',
            'account_id',
            'publisher_domain',
            'seller_domain',
            'seller_type',
          ];
          placeholders = paramKeys
            .filter((key) => matchingEntry.warning_params![key] !== undefined)
            .map((key) => String(matchingEntry.warning_params![key]));

          // If no specific keys found, use all values
          if (placeholders.length === 0) {
            placeholders = Object.values(matchingEntry.warning_params).map(String);
          }
        }

        reasons.push({
          key: matchingEntry.validation_key,
          placeholders: placeholders,
        });
      }

      // An entry is verified if it has seller information (indicating successful sellers.json lookup)
      // and doesn't have any error-type warnings

      // Check if corresponding seller exists in seller analysis data
      const domainAnalysis = sellerAnalysis.find((analysis) => analysis.domain === domain);
      const sellerData = domainAnalysis?.sellersJson?.data?.find(
        (seller) => seller.seller_id === entry.publisherId
      );
      // Use found flag to determine if seller exists in sellers.json
      const sellerExists = sellerData?.found === true;

      const hasErrorWarnings = reasons.some((reason) => reason.key.startsWith('error_'));

      // Clarified verification logic
      let isFullyVerified = false;

      if (sellerExists && !hasErrorWarnings) {
        // Default to verified if seller exists and no error-level warnings
        isFullyVerified = true;

        // Check for confidential status (this makes it not fully verified but still no errors)
        if (sellerData && sellerData.is_confidential === 1) {
          isFullyVerified = false;
          // Add warning for confidential seller if not already present
          if (!reasons.some((r) => r.key === 'warning_confidential_seller')) {
            reasons.push({
              key: 'warning_confidential_seller',
              placeholders: [entry.publisherId],
            });
          }
        }
      }

      return {
        isVerified: isFullyVerified,
        reasons,
      };
    },
    [adsTxtData, sellerAnalysis]
  );

  return {
    analyzing,
    adsTxtData,
    sellerAnalysis,
    analyze,
    isVerifiedEntry,
  };
};
