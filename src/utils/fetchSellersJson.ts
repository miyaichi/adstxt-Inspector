import type {
  FetchSellersJsonOptions,
  FetchSellersJsonResult,
  Seller,
  SellersJson,
} from '../types/types';
import { SellersJsonCache } from './sellersJsonCache';

/**
 * Special domains with non-standard sellers.json URLs
 */
const SPECIAL_DOMAINS: Record<string, string> = {
  'google.com': 'http://realtimebidding.google.com/sellers.json',
  'advertising.com': 'https://dragon-advertising.com/sellers.json',
};

/**
 * Class responsible for fetching and processing sellers.json files
 */
export class SellersJsonFetcher {
  /**
   * Fetches a sellers.json file from a domain
   * @param domain - The domain to fetch the sellers.json from
   * @param options - Fetch options
   * @returns The fetch result including the sellers.json data or an error
   */
  static async fetch(
    domain: string,
    options: FetchSellersJsonOptions = {}
  ): Promise<FetchSellersJsonResult> {
    const { 
      timeout = 5000, 
      retries = 2, 
      retryDelay = 1000, 
      bypassCache = false 
    } = options;

    // Check cache first unless bypassing is requested
    if (!bypassCache) {
      const cached = await this.getFromCache(domain);
      if (cached) {
        return cached;
      }
    }

    // Determine the URL for the sellers.json
    const url = this.getSellersJsonUrl(domain);
    
    return await this.attemptFetch(domain, url, { timeout, retries, retryDelay });
  }

  /**
   * Gets a sellers.json from cache if available
   * @param domain - The domain to check
   * @returns Cached result or null if not in cache
   */
  private static async getFromCache(domain: string): Promise<FetchSellersJsonResult | null> {
    const cached = await SellersJsonCache.get(domain);
    if (cached) {
      return { domain, data: cached.data, cached: true };
    }
    return null;
  }

  /**
   * Gets the appropriate URL for a domain's sellers.json
   * @param domain - The domain to get the URL for
   * @returns The URL for the sellers.json
   */
  private static getSellersJsonUrl(domain: string): string {
    return SPECIAL_DOMAINS[domain] || `https://${domain}/sellers.json`;
  }

  /**
   * Attempts to fetch a sellers.json with retry logic
   * @param domain - The domain being fetched
   * @param url - The URL to fetch from
   * @param options - Fetch options including retries
   * @returns The fetch result
   */
  private static async attemptFetch(
    domain: string,
    url: string,
    options: { timeout: number; retries: number; retryDelay: number }
  ): Promise<FetchSellersJsonResult> {
    const { timeout, retries, retryDelay } = options;
    let lastError: Error | null = null;

    // Retry logic
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Wait before retrying
        if (attempt > 0) {
          await this.delay(retryDelay);
        }

        const data = await this.performFetch(url, timeout);
        
        if (!this.isValidSellersJson(data)) {
          return { domain, error: 'Invalid sellers.json format' };
        }

        // Cache the valid response
        await SellersJsonCache.set(domain, data);

        return { domain, data };
      } catch (error) {
        lastError = error as Error;

        if (error instanceof SyntaxError) {
          return { domain, error: 'Invalid JSON format' };
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          lastError = new Error(`Request timed out after ${timeout}ms`);
          // Continue retrying for timeouts unless we're at the last attempt
          if (attempt === retries) {
            break;
          }
          continue;
        }

        // For network errors (TypeError), continue retrying
        if (!(error instanceof TypeError)) {
          break; // Other errors - stop retrying
        }

        if (attempt === retries) {
          break;
        }
      }
    }

    return {
      domain,
      error: `Error fetching sellers.json: ${lastError?.message || 'Unknown error'}`,
    };
  }

  /**
   * Performs the actual fetch operation
   * @param url - The URL to fetch
   * @param timeout - The timeout in milliseconds
   * @returns The parsed JSON data
   */
  private static async performFetch(url: string, timeout: number): Promise<any> {
    const signal = AbortSignal.timeout(timeout);
    
    const response = await fetch(url, {
      signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Creates a delay using a promise
   * @param ms - Milliseconds to delay
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validates whether an object is a proper sellers.json structure
   * @param data - The data to validate
   * @returns Whether the data is a valid sellers.json
   */
  private static isValidSellersJson(data: any): data is SellersJson {
    return (
      data && 
      typeof data === 'object' && 
      'version' in data && 
      Array.isArray(data.sellers)
    );
  }

  /**
   * Filters a list of sellers by their IDs
   * @param sellers - Array of sellers to filter
   * @param sellerIds - IDs to filter by
   * @returns Filtered array of sellers
   */
  static filterSellersByIds(sellers: Seller[], sellerIds: string[]): Seller[] {
    return sellers.filter((seller) => sellerIds.includes(seller.seller_id));
  }

  /**
   * Invalidates the cache entry for a domain
   * @param domain - The domain to invalidate
   */
  static async invalidateCache(domain: string): Promise<void> {
    await SellersJsonCache.delete(domain);
  }
}

export { type FetchSellersJsonOptions, type FetchSellersJsonResult, type Seller, type SellersJson };