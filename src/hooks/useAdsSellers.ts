import { useState, useCallback, useMemo } from 'react';
import { AdsTxt, fetchAdsTxt, FetchAdsTxtResult, getUniqueDomains } from '../utils/fetchAdsTxt';
import { SellersJsonFetcher, type Seller } from '../utils/fetchSellersJson';
import { Logger } from '../utils/logger';
import { parseAdsTxtContent, crossCheckAdsTxtRecords, type ParsedAdsTxtRecord, type ParsedAdsTxtEntry, isAdsTxtRecord } from '@miyaichi/ads-txt-validator';
import { AdsTxtInspectorSellersProvider } from '../utils/AdsTxtInspectorSellersProvider';
import { convertToValidityResult } from '../utils/validationConverter';

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

// Cache for validated entries to avoid re-validation
const validatedEntriesCache = new Map<string, ParsedAdsTxtEntry[]>();
// Cache for sellers providers to avoid recreating
const sellersProviderCache = new Map<string, AdsTxtInspectorSellersProvider>();

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
   * Validate whether the specified ads.txt/app-ads.txt entry is valid
   * Enhanced async version using ads-txt-validator
   * @param domain
   * @param entry
   * @returns ValidityResult
   */
  const isVerifiedEntryAsync = useCallback(async (domain: string, entry: AdsTxt): Promise<ValidityResult> => {
    try {
      const ownerDomain = adsTxtData?.variables?.ownerDomain;
      const managerDomains = adsTxtData?.variables?.managerDomains;
      
      // Create cache key for this validation session
      const cacheKey = `${adsTxtData?.adsTxtUrl || 'unknown'}`;
      
      // Check if we have cached validated entries for this ads.txt
      let validatedEntries = validatedEntriesCache.get(cacheKey);
      
      if (!validatedEntries && adsTxtData) {
        console.log('Cache miss - performing full validation for:', cacheKey);
        // Parse and validate ads.txt content using ads-txt-validator
        const parsedEntries = parseAdsTxtContent(adsTxtData.adsTxtContent, ownerDomain);
        
        // Get or create sellers provider (cached)
        const providerKey = `${FETCH_OPTIONS.timeout}-${FETCH_OPTIONS.retries}`;
        let sellersProvider = sellersProviderCache.get(providerKey);
        if (!sellersProvider) {
          sellersProvider = new AdsTxtInspectorSellersProvider(FETCH_OPTIONS);
          sellersProviderCache.set(providerKey, sellersProvider);
        }
        
        // Cross-check with sellers.json
        const crossCheckResult = await crossCheckAdsTxtRecords(
          ownerDomain || new URL(adsTxtData.adsTxtUrl).hostname,
          parsedEntries,
          null, // No cached content for duplicate check yet
          sellersProvider
        );
        
        // Filter only record entries for validation
        validatedEntries = crossCheckResult.filter(isAdsTxtRecord);
        
        // Cache the results
        validatedEntriesCache.set(cacheKey, validatedEntries);
        console.log('Cached validation results for:', cacheKey, 'entries:', validatedEntries.length);
      } else if (validatedEntries) {
        console.log('Cache hit - using cached validation for:', cacheKey, 'entries:', validatedEntries.length);
      }
      
      if (!validatedEntries) {
        // Fallback to legacy validation if ads-txt-validator fails
        return isVerifiedEntryLegacy(domain, entry);
      }
      
      // Find the matching validated entry
      const matchingEntry = validatedEntries.find(
        (validatedEntry) => {
          if (validatedEntry.is_variable) return false;
          const record = validatedEntry as ParsedAdsTxtRecord;
          return (
            record.domain === domain &&
            record.account_id === entry.publisherId &&
            record.relationship === entry.relationship
          );
        }
      ) as ParsedAdsTxtRecord | undefined;
      
      if (!matchingEntry) {
        // Entry not found in validated results, use legacy validation
        return isVerifiedEntryLegacy(domain, entry);
      }
      
      // Convert ads-txt-validator result to ValidityResult format
      return convertToValidityResult(matchingEntry, ownerDomain, managerDomains);
      
    } catch (error) {
      logger.error('Error in isVerifiedEntryAsync:', error);
      // Fallback to legacy validation
      return isVerifiedEntryLegacy(domain, entry);
    }
  }, [adsTxtData?.adsTxtUrl, adsTxtData?.adsTxtContent]); // Only depend on stable data

  /**
   * Legacy validation function (synchronous)
   * Kept for backward compatibility during migration
   */
  const isVerifiedEntryLegacy = useCallback((domain: string, entry: AdsTxt): ValidityResult => {
    const reasons: { key: string; placeholders: string[] }[] = [];
    const currentAnalysis = sellerAnalysis.find((a) => a.domain === domain);
    const ownerDomain = adsTxtData?.variables?.ownerDomain || '';
    const managerDomains = adsTxtData?.variables?.managerDomains || [];

    // Test Case 11 & 16: Does the advertising system have a sellers.json file?
    if (!currentAnalysis) {
      const code = entry.relationship === 'DIRECT' ? '12010' : '13010';
      return {
        isVerified: false,
        reasons: [{ key: `alert_${code}_missing_sellers.json`, placeholders: [domain] }],
      };
    }

    // Test Case 12 & 17: Does the sellers.json file have the publisher account ID?
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

    // Now we have a valid seller, continue with other checks
    if (entry.relationship === 'DIRECT') {
      // Test Case 13: Check domain relationship for DIRECT entries
      if (
        seller.domain &&
        seller.domain !== ownerDomain &&
        (seller.seller_type === 'PUBLISHER' || seller.seller_type === 'BOTH')
      ) {
        reasons.push({
          key: 'alert_12030_domain_mismatch',
          placeholders: [seller.domain],
        });
      }

      // Test Case 14: Check seller type for DIRECT entries
      if (seller.seller_type === 'BOTH') {
        reasons.push({ key: 'alert_12040_relationship_type_both', placeholders: [] });
      } else if (seller.seller_type === 'INTERMEDIARY') {
        reasons.push({ key: 'alert_12050_relationship_mismatch', placeholders: [] });
      }
    } else if (entry.relationship === 'RESELLER') {
      // Test Case 18: Check domain for RESELLER entries
      if (
        seller.domain &&
        seller.domain !== ownerDomain &&
        !managerDomains.includes(seller.domain)
      ) {
        reasons.push({
          key: 'alert_13030_domain_mismatch',
          placeholders: [seller.domain],
        });
      }

      // Test Case 19: Check seller type for RESELLER entries
      if (seller.seller_type === 'BOTH') {
        reasons.push({ key: 'alert_13040_relationship_type_both', placeholders: [] });
      } else if (seller.seller_type === 'PUBLISHER') {
        reasons.push({ key: 'error_13050_relationship_mismatch', placeholders: [] });
      }
    }

    // Test Case 15 & 20: Is the seller_id used only once?
    const sellersWithSameId = currentAnalysis.sellersJson?.data.filter(
      (s) => String(s.seller_id) === String(entry.publisherId)
    );

    if (sellersWithSameId && sellersWithSameId.length > 1) {
      const code = entry.relationship === 'DIRECT' ? '12060' : '13060';
      const severity = entry.relationship === 'DIRECT' ? 'error' : 'alert';
      reasons.push({
        key: `${severity}_${code}_duplicate_seller_id`,
        placeholders: [entry.publisherId],
      });
    }

    // OWNERDOMAIN and MANAGERDOMAIN checks
    const managerDomain = managerDomains.find((d) => d.split(',')[0] === seller.domain);
    if (managerDomain && ownerDomain && seller.domain === ownerDomain) {
      reasons.push({
        key: 'alert_inventory_from_both_domains',
        placeholders: [],
      });
    }

    return {
      isVerified: reasons.length === 0,
      reasons,
    };
  }, [adsTxtData?.variables, sellerAnalysis]); // Stable dependencies

  return {
    analyzing,
    adsTxtData,
    sellerAnalysis,
    analyze,
    isVerifiedEntry: isVerifiedEntryLegacy,
    isVerifiedEntryAsync,
  };
};
