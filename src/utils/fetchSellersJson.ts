import type {
  FetchSellersJsonOptions,
  FetchSellersJsonResult,
  Seller,
  SellersJson,
} from '../types/types';
import { FetchTimeoutError, fetchWithTimeout } from './fetchWithTimeout';
import { SellersJsonCache } from './sellersJsonCache';

const SPECIAL_DOMAINS = {
  'google.com': 'http://realtimebidding.google.com/sellers.json',
  'advertising.com': 'https://dragon-advertising.com/sellers.json',
} as const;

export class SellersJsonFetcher {
  static async fetch(
    domain: string,
    options: FetchSellersJsonOptions = {}
  ): Promise<FetchSellersJsonResult> {
    const { timeout = 5000, retries = 2, retryDelay = 1000, bypassCache = false } = options;

    // Check cache first unless bypass is requested
    if (!bypassCache) {
      const cached = await SellersJsonCache.get(domain);
      if (cached) {
        return { data: cached.data, cached: true };
      }
    }

    // Determine the correct URL
    const url =
      SPECIAL_DOMAINS[domain as keyof typeof SPECIAL_DOMAINS] || `https://${domain}/sellers.json`;

    let lastError: Error | null = null;

    // Retry logic
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }

        const response = await fetchWithTimeout(url, {
          timeout,
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!this.isValidSellersJson(data)) {
          return { error: 'Invalid sellers.json format' };
        }

        // Cache the valid response
        await SellersJsonCache.set(domain, data);

        return { data };
      } catch (error) {
        lastError = error as Error;

        if (error instanceof SyntaxError) {
          return { error: 'Invalid JSON format' };
        }

        if (!(error instanceof FetchTimeoutError) && !(error instanceof TypeError)) {
          break;
        }

        if (attempt === retries) {
          break;
        }
      }
    }

    return {
      error: `Error fetching sellers.json: ${lastError?.message || 'Unknown error'}`,
    };
  }

  private static isValidSellersJson(data: any): data is SellersJson {
    return data && data.version && typeof data === 'object' && Array.isArray(data.sellers);
  }

  static filterSellersByIds(sellers: Seller[], sellerIds: string[]): Seller[] {
    return sellers.filter((seller) => sellerIds.includes(seller.seller_id));
  }

  static async invalidateCache(domain: string): Promise<void> {
    await SellersJsonCache.delete(domain);
  }
}

export { type FetchSellersJsonOptions, type FetchSellersJsonResult, type Seller, type SellersJson };
