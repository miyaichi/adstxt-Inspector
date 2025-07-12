import { useState, useCallback } from 'react';
import { AdsTxt, fetchAdsTxt, FetchAdsTxtResult, getUniqueDomains } from '../utils/fetchAdsTxt';
import { SellersJsonFetcher, type Seller } from '../utils/fetchSellersJson';
import { Logger } from '../utils/logger';
import { ValidationManager } from '../utils/ValidationManager';

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
  isVerifiedEntryAsync: (domain: string, entry: AdsTxt) => Promise<ValidityResult>;
}

// Use ValidationManager for optimized caching and validation
const validationManager = ValidationManager.getInstance();

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
   * Simple fallback validation function when ValidationManager is not available
   * Uses basic validation without ads-txt-validator package
   */
  const simpleFallbackValidation = useCallback((domain: string, entry: AdsTxt): ValidityResult => {
    const currentAnalysis = sellerAnalysis.find((a) => a.domain === domain);

    // Basic check: Does the advertising system have a sellers.json file?
    if (!currentAnalysis) {
      const code = entry.relationship === 'DIRECT' ? '12010' : '13010';
      return {
        isVerified: false,
        reasons: [{ key: `alert_${code}_missing_sellers_json`, placeholders: [domain] }],
      };
    }

    // Basic check: Does the sellers.json file have the publisher account ID?
    const seller = currentAnalysis?.sellersJson?.data.find(
      (s) => String(s.seller_id) === String(entry.publisherId)
    );

    if (!seller) {
      const code = entry.relationship === 'DIRECT' ? '12020' : '13020';
      return {
        isVerified: false,
        reasons: [
          { key: `error_${code}_publisher_id_not_listed`, placeholders: [entry.publisherId] },
        ],
      };
    }

    // If we have the seller, consider it verified for basic validation
    return { isVerified: true, reasons: [] };
  }, [sellerAnalysis]);

  /**
   * Validate whether the specified ads.txt/app-ads.txt entry is valid
   * Enhanced async version using ads-txt-validator
   * @param domain
   * @param entry
   * @returns ValidityResult
   */
  const isVerifiedEntryAsync = useCallback(async (domain: string, entry: AdsTxt): Promise<ValidityResult> => {
    if (!adsTxtData) {
      return simpleFallbackValidation(domain, entry);
    }

    try {
      return await validationManager.validateEntry(
        domain,
        entry,
        adsTxtData,
        simpleFallbackValidation // Fallback function
      );
    } catch (error) {
      logger.error('Error in isVerifiedEntryAsync:', error);
      return simpleFallbackValidation(domain, entry);
    }
  }, [adsTxtData?.adsTxtUrl, adsTxtData?.adsTxtContent, simpleFallbackValidation]); // Optimized dependencies

  return {
    analyzing,
    adsTxtData,
    sellerAnalysis,
    analyze,
    isVerifiedEntry: simpleFallbackValidation,
    isVerifiedEntryAsync,
  };
};
