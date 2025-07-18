import type {
  FetchSellersJsonOptions,
  FetchSellersJsonResult,
  Seller,
  SellersJson,
} from '../types/types';
import { SellersJsonCache } from './sellersJsonCache';
import { SellersJsonApi } from './sellersJsonApi';
import { getApiConfig, isApiConfigured } from '../config/api';

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
  private static apiClient: SellersJsonApi | null = null;

  /**
   * Gets or initializes the API client
   */
  private static async getApiClient(): Promise<SellersJsonApi | null> {
    try {
      const config = await getApiConfig();

      if (!isApiConfigured(config)) {
        return null;
      }

      // Always create a new client with the current config to ensure settings are up to date
      return new SellersJsonApi(config);
    } catch (error) {
      console.error('Failed to get API configuration:', error);
      return null;
    }
  }
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
    const { timeout = 5000, retries = 2, retryDelay = 1000, bypassCache = false } = options;

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
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validates whether an object is a proper sellers.json structure
   * @param data - The data to validate
   * @returns Whether the data is a valid sellers.json
   */
  private static isValidSellersJson(data: any): data is SellersJson {
    return data && typeof data === 'object' && 'version' in data && Array.isArray(data.sellers);
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
   * Fetches a specific seller from a domain, using API first, then fallback to full sellers.json
   * @param domain - The domain to fetch from
   * @param sellerId - The seller ID to fetch
   * @param options - Fetch options
   * @returns The seller data or null if not found
   * @deprecated Use fetchSellers() for better performance with batch API
   */
  static async fetchSeller(
    domain: string,
    sellerId: string,
    options: FetchSellersJsonOptions = {}
  ): Promise<{ seller: Seller | null; source: 'api' | 'fallback'; error?: string }> {
    // Use fetchSellers for consistency and better performance
    const results = await this.fetchSellers([{ domain, sellerId }], options);
    const result = results[0];

    if (result.seller) {
      return {
        seller: result.seller,
        source: result.source,
      };
    } else {
      return {
        seller: null,
        source: result.source,
        error: result.error,
      };
    }
  }

  /**
   * Fetches multiple sellers from multiple domains, using API first with fallback
   * @param requests - Array of {domain, sellerId} requests
   * @param options - Fetch options
   * @returns Array of seller results
   */
  static async fetchSellers(
    requests: Array<{ domain: string; sellerId: string }>,
    options: FetchSellersJsonOptions = {}
  ): Promise<
    Array<{
      domain: string;
      sellerId: string;
      seller: Seller | null;
      source: 'api' | 'fallback';
      error?: string;
    }>
  > {
    const apiClient = await this.getApiClient();
    const results: Array<{
      domain: string;
      sellerId: string;
      seller: Seller | null;
      source: 'api' | 'fallback';
      error?: string;
    }> = [];

    // Try API first if configured
    if (apiClient) {
      try {
        // Group requests by domain to make separate batch calls
        const domainGroups = new Map<string, string[]>();
        for (const req of requests) {
          if (!domainGroups.has(req.domain)) {
            domainGroups.set(req.domain, []);
          }
          domainGroups.get(req.domain)!.push(req.sellerId);
        }

        const fallbackRequests: Array<{ domain: string; sellerId: string }> = [];
        const apiPromises = Array.from(domainGroups.entries()).map(async ([domain, sellerIds]) => {
          const response = await apiClient.fetchSellersBatch(domain, sellerIds, options.bypassCache);

          if (response.success && response.data?.sellers) {
            const sellerMap = new Map(response.data.sellers.map(s => [s.seller_id, s]));
            for (const sellerId of sellerIds) {
              const seller = sellerMap.get(sellerId);
              if (seller?.found) {
                results.push({
                  domain,
                  sellerId,
                  seller: {
                    seller_id: seller.seller_id,
                    name: seller.name,
                    domain: seller.domain,
                    seller_type: seller.seller_type,
                    is_confidential: seller.is_confidential ? 1 : 0,
                  },
                  source: 'api',
                });
              } else {
                // API reported not found, add to fallback
                fallbackRequests.push({ domain, sellerId });
              }
            }
          } else {
            // Entire batch call failed, add all to fallback
            for (const sellerId of sellerIds) {
              fallbackRequests.push({ domain, sellerId });
            }
          }
        });

        await Promise.all(apiPromises);

        // Process fallback requests if any
        if (fallbackRequests.length > 0) {
          const fallbackResults = await this.processFallbackRequests(fallbackRequests, options);
          results.push(...fallbackResults);
        }

        return results;
      } catch (error) {
        // API completely failed, fallback for all requests
      }
    }

    // Fallback for all requests
    return await this.processFallbackRequests(requests, options);
  }

  /**
   * Processes requests using the traditional sellers.json method
   * @param requests - Array of requests to process
   * @param options - Fetch options
   * @returns Array of results
   */
  private static async processFallbackRequests(
    requests: Array<{ domain: string; sellerId: string }>,
    options: FetchSellersJsonOptions
  ): Promise<
    Array<{
      domain: string;
      sellerId: string;
      seller: Seller | null;
      source: 'fallback';
      error?: string;
    }>
  > {
    // Group requests by domain to minimize sellers.json fetches
    const domainGroups = new Map<string, string[]>();

    for (const { domain, sellerId } of requests) {
      if (!domainGroups.has(domain)) {
        domainGroups.set(domain, []);
      }
      domainGroups.get(domain)!.push(sellerId);
    }

    const results: Array<{
      domain: string;
      sellerId: string;
      seller: Seller | null;
      source: 'fallback';
      error?: string;
    }> = [];

    // Fetch sellers.json for each domain
    const domainPromises = Array.from(domainGroups.entries()).map(async ([domain, sellerIds]) => {
      const sellersJsonResult = await this.fetch(domain, options);

      if (sellersJsonResult.error) {
        // Add error results for all seller IDs in this domain
        for (const sellerId of sellerIds) {
          results.push({
            domain,
            sellerId,
            seller: null,
            source: 'fallback',
            error: sellersJsonResult.error,
          });
        }
        return;
      }

      if (sellersJsonResult.data) {
        const matchingSellers = this.filterSellersByIds(sellersJsonResult.data.sellers, sellerIds);
        const sellerMap = new Map(matchingSellers.map((seller) => [seller.seller_id, seller]));

        for (const sellerId of sellerIds) {
          results.push({
            domain,
            sellerId,
            seller: sellerMap.get(sellerId) || null,
            source: 'fallback',
          });
        }
      } else {
        // No data available
        for (const sellerId of sellerIds) {
          results.push({
            domain,
            sellerId,
            seller: null,
            source: 'fallback',
            error: 'No sellers.json data available',
          });
        }
      }
    });

    await Promise.allSettled(domainPromises);

    return results;
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
