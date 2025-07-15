import {
  BatchSellersResult,
  CacheInfo,
  createValidationMessage,
  crossCheckAdsTxtRecords,
  isAdsTxtRecord,
  SellersJsonMetadata,
  SellersJsonProvider
} from '@miyaichi/ads-txt-validator';
import { useState } from 'react';
import { AdsTxt, fetchAdsTxt, FetchAdsTxtResult, getUniqueDomains } from '../utils/fetchAdsTxt';
import { SellersJsonFetcher, type Seller } from '../utils/fetchSellersJson';
import { Logger } from '../utils/logger';

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
const fetchSellerAnalysisForDomain = async (
  domain: string,
  adsTxtEntries: AdsTxt[]
): Promise<SellerAnalysis> => {
  // Extract seller IDs from ads.txt entries
  const sellerIds = adsTxtEntries.map((entry) => String(entry.publisherId));
  const requests = sellerIds.map((sellerId) => ({ domain, sellerId }));

  // Use the new fetchSellers method with API-first approach
  const sellersResults = await SellersJsonFetcher.fetchSellers(requests, FETCH_OPTIONS);

  // Extract successful sellers and any errors
  const filteredSellers = sellersResults
    .filter((result) => result.seller !== null)
    .map((result) => result.seller!);

  // Collect any errors from the results
  const errors = sellersResults.filter((result) => result.error).map((result) => result.error!);

  const error = errors.length > 0 ? errors.join('; ') : undefined;

  return {
    domain,
    sellersJson: { data: filteredSellers, error },
    adsTxtEntries,
  };
};

export const useAdsSellers = (): UseAdsSellersReturn => {
  const [analyzing, setAnalyzing] = useState(false);
  const [adsTxtData, setAdsTxtData] = useState<FetchAdsTxtResult | null>(null);
  const [sellerAnalysis, setSellerAnalysis] = useState<SellerAnalysis[]>([]);

  /**
   * Retrive and analyze sellers.json for the specified domain list.
   * @param domains
   * @param adsTxtResult
   * @returns SellerAnalysis[]
   */
  const analyzeSellersJson = async (
    domains: string[],
    adsTxtResult: FetchAdsTxtResult
  ): Promise<SellerAnalysis[]> => {
    const { data: adsTxtEntriesAll, variables } = adsTxtResult;

    const analysisPromises = domains.map((domain) => {
      const entries = adsTxtEntriesAll.filter((entry) => entry.domain === domain);
      return fetchSellerAnalysisForDomain(domain, entries);
    });

    const results = await Promise.allSettled(analysisPromises);
    return results
      .filter(
        (result): result is PromiseFulfilledResult<SellerAnalysis> => result.status === 'fulfilled'
      )
      .map((result) => result.value);
  };

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
      
      // Perform cross-checking with ads-txt-validator if we have parsed entries
      if (adsTxtResult.parsedEntries) {
        // Create SellersJsonProvider using SellersJsonApi
        const sellersJsonProvider: SellersJsonProvider = {
          async batchGetSellers(domain: string, sellerIds: string[]): Promise<BatchSellersResult> {
            try {
              // Use the batch API from SellersJsonApi
              const response = await fetch('/api/sellers/batch', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  domain,
                  sellerIds,
                }),
              });
              
              if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
              }
              
              const data = await response.json();
              
              if (data.success && data.data) {
                return {
                  domain: data.data.domain,
                  requested_count: data.data.requested_count,
                  found_count: data.data.found_count,
                  results: data.data.results.map((result: any) => ({
                    sellerId: result.sellerId,
                    seller: result.seller,
                    found: result.found,
                    source: result.source || 'fresh',
                    error: result.error,
                  })),
                  metadata: data.data.metadata || {},
                  cache: data.data.cache || { is_cached: false, status: 'success' },
                };
              } else {
                throw new Error(data.error || 'Unknown API error');
              }
            } catch (error) {
              // Fallback to existing fetcher if API fails
              logger.warn('API failed, falling back to direct fetch:', error);
              const requests = sellerIds.map((sellerId) => ({ domain, sellerId }));
              const results = await SellersJsonFetcher.fetchSellers(requests, FETCH_OPTIONS);
              
              const batchResults = results.map((result) => ({
                sellerId: result.sellerId,
                seller: result.seller,
                found: result.seller !== null,
                source: 'fresh' as const,
                error: result.error,
              }));
              
              return {
                domain,
                requested_count: sellerIds.length,
                found_count: batchResults.filter((r) => r.found).length,
                results: batchResults,
                metadata: {},
                cache: { is_cached: false, status: 'success' },
              };
            }
          },
          
          async hasSellerJson(domain: string): Promise<boolean> {
            try {
              const result = await SellersJsonFetcher.fetch(domain, FETCH_OPTIONS);
              return result.data !== null;
            } catch {
              return false;
            }
          },
          
          async getMetadata(domain: string): Promise<SellersJsonMetadata> {
            return {};
          },
          
          async getCacheInfo(domain: string): Promise<CacheInfo> {
            return { is_cached: false, status: 'success' };
          },
        };
        
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

      const sellerDomains = getUniqueDomains(adsTxtResult.data);
      const analysis = await analyzeSellersJson(sellerDomains, adsTxtResult);
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
          const paramKeys = ['domain', 'account_id', 'publisher_domain', 'seller_domain', 'seller_type'];
          placeholders = paramKeys
            .filter(key => warning.params![key] !== undefined)
            .map(key => String(warning.params![key]));
          
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
        const paramKeys = ['domain', 'account_id', 'publisher_domain', 'seller_domain', 'seller_type'];
        placeholders = paramKeys
          .filter(key => matchingEntry.warning_params![key] !== undefined)
          .map(key => String(matchingEntry.warning_params![key]));
        
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
