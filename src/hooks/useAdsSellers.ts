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

interface UseAdsSellersReturn {
  analyzing: boolean;
  adsTxtData: FetchAdsTxtResult | null;
  sellerAnalysis: SellerAnalysis[];
  analyze: (url: string) => Promise<void>;
  isValidEntry: (domain: string, publisherId: string) => boolean;
}

export const useAdsSellers = (): UseAdsSellersReturn => {
  const [analyzing, setAnalyzing] = useState(false);
  const [adsTxtData, setAdsTxtData] = useState<FetchAdsTxtResult | null>(null);
  const [sellerAnalysis, setSellerAnalysis] = useState<SellerAnalysis[]>([]);

  const analyzeSellersJson = async (domains: string[], adsTxtData: AdsTxt[]) => {
    const analysis: SellerAnalysis[] = [];

    const promises = domains.map(async (domain) => {
      const sellersJsonResult = await SellersJsonFetcher.fetch(domain, {
        timeout: 5000,
        retries: 1,
      });
      const adsTxtEntries = adsTxtData.filter((entry) => entry.domain === domain);

      return {
        domain,
        sellersJson: sellersJsonResult.data
          ? {
              data: sellersJsonResult.data.sellers.filter((seller) =>
                adsTxtEntries.some((entry) => entry.publisherId == seller.seller_id)
              ),
              error: sellersJsonResult.error,
            }
          : { data: [], error: sellersJsonResult.error },
        adsTxtEntries,
      };
    });

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
      // Fetch Ads.txt
      const domain = new URL(url).hostname;
      const adsTxtResult = await fetchAdsTxt(domain);
      setAdsTxtData(adsTxtResult);

      // Analyze Sellers.json
      const sellerDomains = getUniqueDomains(adsTxtResult.data);
      const analysis = await analyzeSellersJson(sellerDomains, adsTxtResult.data);
      setSellerAnalysis(analysis);

      logger.info('Seller analysis:', analysis);
    } catch (error) {
      logger.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const isValidEntry = (domain: string, publisherId: string): boolean => {
    const sellerJson = sellerAnalysis.find((analysis) => analysis.domain === domain)?.sellersJson
      ?.data;
    if (!sellerJson) return false;
    if (!sellerJson.some((seller) => seller.seller_id == publisherId)) return false;
    return true;
  };

  return {
    analyzing,
    adsTxtData,
    sellerAnalysis,
    analyze,
    isValidEntry,
  };
};
