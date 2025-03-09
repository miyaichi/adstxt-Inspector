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
  const sellersJsonResult = await SellersJsonFetcher.fetch(domain, FETCH_OPTIONS);
  const filteredSellers = sellersJsonResult.data
    ? sellersJsonResult.data.sellers.filter((seller) =>
        adsTxtEntries.some((entry) => String(entry.publisherId) === String(seller.seller_id))
      )
    : [];

  return {
    domain,
    sellersJson: { data: filteredSellers, error: sellersJsonResult.error },
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
   * @param domain
   * @param entry
   * @returns ValidityResult
   */
  const isVerifiedEntry = (domain: string, entry: AdsTxt): ValidityResult => {
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
        reasons.push({ key: 'alert_12050_relationship_mismat', placeholders: [] });
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
  };

  return {
    analyzing,
    adsTxtData,
    sellerAnalysis,
    analyze,
    isVerifiedEntry,
  };
};
