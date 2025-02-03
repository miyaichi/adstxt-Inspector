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
  isValid: boolean;
  reasons: string[];
}

interface UseAdsSellersReturn {
  analyzing: boolean;
  adsTxtData: FetchAdsTxtResult | null;
  sellerAnalysis: SellerAnalysis[];
  analyze: (url: string, duplicateCheck: boolean) => Promise<void>;
  isValidEntry: (domain: string, entry: AdsTxt) => ValidityResult;
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

/**
 * Get the sellers.json when MANAGERDOMAIN is specified.
 * @param managerDomain
 * @returns SellerAnalysis
 */
const fetchManagerSellerAnalysis = async (managerDomain: string): Promise<SellerAnalysis> => {
  const sellersJsonResult = await SellersJsonFetcher.fetch(managerDomain, FETCH_OPTIONS);
  return {
    domain: managerDomain,
    sellersJson: {
      data: sellersJsonResult.data ? sellersJsonResult.data.sellers : [],
      error: sellersJsonResult.error,
    },
    adsTxtEntries: [],
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

    // If MANAGERDOMAIN is specified, get it additionally
    if (variables?.managerDomain) {
      const managerDomain = variables.managerDomain.split(',')[0].trim();
      analysisPromises.push(fetchManagerSellerAnalysis(managerDomain));
    }

    const results = await Promise.allSettled(analysisPromises);
    return results
      .filter(
        (result): result is PromiseFulfilledResult<SellerAnalysis> => result.status === 'fulfilled'
      )
      .map((result) => result.value);
  };

  /**
   * Retrive and analyze the ads.txt and sellers.json based on the specified URL.
   * @param url
   * @param duplicateCheck
   */
  const analyze = async (url: string, duplicateCheck = false) => {
    if (analyzing) return;

    setAnalyzing(true);
    setAdsTxtData(null);
    setSellerAnalysis([]);

    try {
      const domain = new URL(url).hostname;
      const adsTxtResult = await fetchAdsTxt(domain, duplicateCheck);
      setAdsTxtData(adsTxtResult);
      logger.debug('Ads.txt:', adsTxtResult);

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
   * Validate whether the specified ads.txt entry is valid
   * @param domain
   * @param entry
   * @returns ValidityResult
   */
  const isValidEntry = (domain: string, entry: AdsTxt): ValidityResult => {
    const reasons: string[] = [];
    const currentAnalysis = sellerAnalysis.find((a) => a.domain === domain);
    const seller = currentAnalysis?.sellersJson?.data.find(
      (s) => String(s.seller_id) === String(entry.publisherId)
    );

    if (!seller) {
      return {
        isValid: false,
        reasons: [chrome.i18n.getMessage('seller_not_found')],
      };
    }

    // SELLER_TYPE and relationship validation
    const relationshipMapping: Record<string, string> = {
      PUBLISHER: 'DIRECT',
      INTERMEDIARY: 'RESELLER',
    };
    const expectedRelationship = relationshipMapping[seller.seller_type];
    if (expectedRelationship && entry.relationship !== expectedRelationship) {
      reasons.push(
        chrome.i18n.getMessage('seller_type_mismatch', [seller.seller_type, expectedRelationship])
      );
    }

    // OWNERDOMAIN validation
    const ownerDomain = adsTxtData?.variables?.ownerDomain;
    if (ownerDomain && (seller.seller_type === 'PUBLISHER' || seller.seller_type === 'BOTH')) {
      if (seller.domain !== ownerDomain) {
        reasons.push(chrome.i18n.getMessage('owner_domain_mismatch', [ownerDomain, seller.domain]));
      }
    }

    // MANAGERDOMAIN validation
    if (adsTxtData?.variables?.managerDomain) {
      const [managerDomain, countryCode] = adsTxtData.variables.managerDomain
        .split(',')
        .map((s) => s.trim());

      // Whether there are multiple MANAGERDOMAIN declarations for the same country code
      const managerDomainCount = Object.entries(adsTxtData.variables).filter(
        ([key, value]) => key === 'managerDomain' && value.includes(countryCode)
      ).length;

      if (managerDomainCount > 1) {
        reasons.push(chrome.i18n.getMessage('multiple_manager_domain_declarations', [countryCode]));
      }

      // Whether inventory is provided from both the owner and the seller
      if (seller.domain === ownerDomain && seller.seller_type !== 'RESELLER') {
        reasons.push(chrome.i18n.getMessage('inventory_from_both_domains'));
      }
    }

    return {
      isValid: reasons.length === 0,
      reasons,
    };
  };

  return {
    analyzing,
    adsTxtData,
    sellerAnalysis,
    analyze,
    isValidEntry,
  };
};
