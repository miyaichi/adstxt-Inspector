import {
  BatchSellersResult,
  CacheInfo,
  createValidationMessage,
  crossCheckAdsTxtRecords,
  isAdsTxtRecord,
  SellersJsonMetadata,
  SellersJsonProvider,
} from '@miyaichi/ads-txt-validator';
import { useState } from 'react';
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
  adsTxtResult: FetchAdsTxtResult
): Promise<SellerAnalysis[]> => {
  const { data: adsTxtEntriesAll, parsedEntries } = adsTxtResult;

  return domains.map((domain) => {
    const entries = adsTxtEntriesAll.filter((entry) => entry.domain === domain);
    
    // Extract sellers from validated entries
    const sellers: Seller[] = [];
    if (parsedEntries) {
      for (const parsedEntry of parsedEntries) {
        if (isAdsTxtRecord(parsedEntry) && parsedEntry.domain === domain) {
          // Check if this entry has seller information from crossCheckAdsTxtRecords
          const sellerInfo = (parsedEntry as any).seller;
          if (sellerInfo) {
            sellers.push(sellerInfo);
          }
        }
      }
    }

    return {
      domain,
      sellersJson: { data: sellers, error: undefined },
      adsTxtEntries: entries,
    };
  });
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

      // Create SellersJsonProvider using SellersJsonApi
      const sellersJsonProvider: SellersJsonProvider = {
        async batchGetSellers(domain: string, sellerIds: string[]): Promise<BatchSellersResult> {
          try {
            // Use the batch API from SellersJsonApi
            const apiConfig = await getApiConfig();
            const sellersJsonApi = new SellersJsonApi(apiConfig);
            const response = await sellersJsonApi.fetchSellersBatch(domain, sellerIds);

            if (response.success && response.data) {
              return {
                domain: response.data.domain,
                requested_count: response.data.requested_count,
                found_count: response.data.found_count,
                results: response.data.sellers.map((seller: any) => ({
                  sellerId: seller.seller_id,
                  seller: seller.found ? {
                    seller_id: seller.seller_id,
                    seller_type: seller.seller_type as "PUBLISHER" | "INTERMEDIARY" | "BOTH" | undefined,
                    name: seller.name || undefined,
                    domain: seller.domain
                  } : null,
                  found: seller.found,
                  source: 'fresh' as const,
                  error: seller.found ? undefined : `Seller ${seller.seller_id} not found`
                })),
                metadata: response.data.metadata || {},
                cache: response.data.cache
                  ? {
                      ...response.data.cache,
                      status: response.data.cache.status as 'error' | 'success' | 'stale',
                    }
                  : { is_cached: false, status: 'success' as const },
              };
            } else {
              throw new Error(response.error || 'Unknown API error');
            }
          } catch (error) {
            // Re-throw the error to let fetchSellerAnalysisForDomain handle the fallback
            throw error;
          }
        },

        async hasSellerJson(domain: string): Promise<boolean> {
          // Always return true since we'll check existence through batch API
          // If sellers.json doesn't exist, batch API will indicate it in metadata
          return true;
        },

        async getMetadata(domain: string): Promise<SellersJsonMetadata> {
          return {};
        },

        async getCacheInfo(domain: string): Promise<CacheInfo> {
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
      const analysis = await extractSellerAnalysisFromValidatedEntries(sellerDomains, adsTxtResult);
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
  const isVerifiedEntry = (domain: string, entry: AdsTxt): ValidityResult => {
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

    return {
      isVerified: reasons.length === 0,
      reasons,
    };
  };

  return {
    analyzing,
    adsTxtData,
    sellerAnalysis,
    analyze,
    isVerifiedEntry,
  };
};
