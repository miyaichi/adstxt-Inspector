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
  analyze: (url: string) => Promise<void>;
  isValidEntry: (domain: string, publisherId: string) => ValidityResult;
}

export const useAdsSellers = (): UseAdsSellersReturn => {
  const [analyzing, setAnalyzing] = useState(false);
  const [adsTxtData, setAdsTxtData] = useState<FetchAdsTxtResult | null>(null);
  const [sellerAnalysis, setSellerAnalysis] = useState<SellerAnalysis[]>([]);

  const analyzeSellersJson = async (
    domains: string[],
    adsTxtResult: FetchAdsTxtResult
  ): Promise<SellerAnalysis[]> => {
    const analysis: SellerAnalysis[] = [];

    const promises = domains.map(async (domain) => {
      const sellersJsonResult = await SellersJsonFetcher.fetch(domain, {
        timeout: 5000,
        retries: 1,
      });
      const adsTxtEntries = adsTxtResult.data.filter((entry) => entry.domain === domain);

      return {
        domain,
        sellersJson: sellersJsonResult.data
          ? {
              data: sellersJsonResult.data.sellers.filter((seller) =>
                adsTxtEntries.some(
                  (entry) => String(entry.publisherId) === String(seller.seller_id)
                )
              ),
              error: sellersJsonResult.error,
            }
          : { data: [], error: sellersJsonResult.error },
        adsTxtEntries,
      };
    });

    // If MANAGERDOMAIN is specified, fetch its sellers.json as well
    if (adsTxtResult.variables?.managerDomain) {
      const managerDomain = adsTxtResult.variables.managerDomain.split(',')[0].trim();
      const managerPromise = SellersJsonFetcher.fetch(managerDomain, {
        timeout: 5000,
        retries: 1,
      });
      promises.push(
        managerPromise.then((sellersJsonResult) => ({
          domain: managerDomain,
          sellersJson: sellersJsonResult.data
            ? { data: sellersJsonResult.data.sellers, error: sellersJsonResult.error }
            : { data: [], error: sellersJsonResult.error },
          adsTxtEntries: [],
        }))
      );
    }

    const results = await Promise.allSettled(promises);

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        analysis.push(result.value);
      }
    });

    return analysis;
  };

  const analyze = async (url: string) => {
    if (analyzing) return;

    setAnalyzing(true);
    setAdsTxtData(null);
    setSellerAnalysis([]);

    try {
      const domain = new URL(url).hostname;
      const adsTxtResult = await fetchAdsTxt(domain);
      setAdsTxtData(adsTxtResult);
      logger.info('Ads.txt:', adsTxtResult);

      const sellerDomains = getUniqueDomains(adsTxtResult.data);
      const analysis = await analyzeSellersJson(sellerDomains, adsTxtResult);
      setSellerAnalysis(analysis);

      logger.info('Seller analysis:', analysis);
    } catch (error) {
      logger.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const isValidEntry = (domain: string, publisherId: string): ValidityResult => {
    const reasons: string[] = [];

    const currentSellerAnalysis = sellerAnalysis.find((analysis) => analysis.domain === domain);
    const seller = currentSellerAnalysis?.sellersJson?.data.find(
      (s) => String(s.seller_id) === String(publisherId)
    );

    if (!seller) {
      return {
        isValid: false,
        reasons: [chrome.i18n.getMessage('seller_not_found')],
      };
    }

    // Varidate OWNERDOMAIN
    if (adsTxtData?.variables?.ownerDomain) {
      const ownerDomain = adsTxtData.variables.ownerDomain;

      if (seller.seller_type === 'PUBLISHER' || seller.seller_type === 'BOTH') {
        if (seller.domain !== ownerDomain) {
          reasons.push(
            chrome.i18n.getMessage('owner_domain_mismatch', [ownerDomain, seller.domain])
          );
        }
      }
    }

    // Varidate MANAGERDOMAIN
    if (adsTxtData?.variables?.managerDomain) {
      const [managerDomain, countryCode] = adsTxtData.variables.managerDomain
        .split(',')
        .map((s) => s.trim());

      // Check for multiple MANAGERDOMAIN declarations for the same country
      const managerDomains = Object.entries(adsTxtData.variables).filter(
        ([key, value]) => key === 'managerDomain' && value.includes(countryCode)
      ).length;

      if (managerDomains > 1) {
        reasons.push(chrome.i18n.getMessage('multiple_manager_domain_declarations', [countryCode]));
      }

      // Check if inventory is available from both
      const sellerDomain = seller.domain;
      if (
        sellerDomain === adsTxtData.variables.ownerDomain &&
        !['RESELLER'].includes(seller.seller_type)
      ) {
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
