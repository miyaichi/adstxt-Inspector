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
 * Fully client-side implementation replacing the previous API-based approach.
 * Includes global concurrency control to prevent browser network congestion.
 */
export class SellersJsonFetcher {
  private static readonly MAX_CONCURRENT_REQUESTS = 5;
  private static activeRequests = 0;
  private static requestQueue: (() => void)[] = [];

  // Deduplication map for pending requests
  private static pendingRequests = new Map<string, Promise<FetchSellersJsonResult>>();

  /**
   * Fetches a sellers.json file from a domain with concurrency control and deduplication
   * @param domain - The domain to fetch the sellers.json from
   * @param options - Fetch options
   * @returns The fetch result including the sellers.json data or an error
   */
  static async fetch(
    domain: string,
    options: FetchSellersJsonOptions = {}
  ): Promise<FetchSellersJsonResult> {
    const { timeout = 10000, retries = 2, retryDelay = 1000, bypassCache = false } = options;

    // Check cache first
    if (!bypassCache) {
      const cached = await this.getFromCache(domain);
      if (cached) {
        return cached;
      }
    }

    // Check if there's already a pending request for this domain
    if (this.pendingRequests.has(domain)) {
      return this.pendingRequests.get(domain)!;
    }

    // Determine the URL
    const url = this.getSellersJsonUrl(domain);

    // Create the fetch task
    const fetchTask = async (): Promise<FetchSellersJsonResult> => {
      return await this.executeWithConcurrencyControl(async () => {
        return await this.attemptFetch(domain, url, { timeout, retries, retryDelay });
      });
    };

    const promise = fetchTask().finally(() => {
      this.pendingRequests.delete(domain);
    });

    this.pendingRequests.set(domain, promise);
    return promise;
  }

  /**
   * Executes a task with global concurrency control
   */
  private static executeWithConcurrencyControl<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        this.activeRequests++;
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          this.processNextInQueue();
        }
      };

      if (this.activeRequests < this.MAX_CONCURRENT_REQUESTS) {
        execute();
      } else {
        this.requestQueue.push(execute);
      }
    });
  }

  /**
   * Processes the next task in the queue
   */
  private static processNextInQueue() {
    if (this.requestQueue.length > 0 && this.activeRequests < this.MAX_CONCURRENT_REQUESTS) {
      const nextTask = this.requestQueue.shift();
      if (nextTask) {
        nextTask();
      }
    }
  }

  /**
   * Gets a sellers.json from cache if available
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
   */
  private static getSellersJsonUrl(domain: string): string {
    return SPECIAL_DOMAINS[domain] || `https://${domain}/sellers.json`;
  }

  /**
   * Attempts to fetch a sellers.json with retry logic
   */
  private static async attemptFetch(
    domain: string,
    url: string,
    options: { timeout: number; retries: number; retryDelay: number }
  ): Promise<FetchSellersJsonResult> {
    const { timeout, retries, retryDelay } = options;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          const backoffDelay = retryDelay * Math.pow(2, attempt - 1);
          await this.delay(Math.min(backoffDelay, 5000));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
            },
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const text = await response.text();
          let data: any;
          try {
            data = JSON.parse(text);
          } catch (e) {
            return { domain, error: 'Invalid JSON format' };
          }

          if (!this.isValidSellersJson(data)) {
            return { domain, error: 'Invalid sellers.json format' };
          }

          // Cache the valid response
          await SellersJsonCache.set(domain, data);

          return { domain, data };
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      } catch (error) {
        lastError = error as Error;

        if (
          error instanceof SyntaxError ||
          (error instanceof Error && error.message.includes('Invalid'))
        ) {
          break;
        }

        if (attempt === retries) break;
      }
    }

    return {
      domain,
      error: `Failed to fetch after ${retries + 1} attempts: ${lastError?.message || 'Unknown error'}`,
    };
  }

  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private static isValidSellersJson(data: any): data is SellersJson {
    return data && typeof data === 'object' && Array.isArray(data.sellers);
  }

  /**
   * Filters a list of sellers by their IDs
   */
  static filterSellersByIds(sellers: Seller[], sellerIds: string[]): Seller[] {
    const sellerIdSet = new Set(sellerIds);
    return sellers.filter((seller) => sellerIdSet.has(seller.seller_id));
  }

  /**
   * Fetches multiple sellers from multiple domains using parallel processing.
   * Uses global concurrency control implicitly via `fetch`.
   */
  static async fetchSellersParallel(
    requests: Array<{ domain: string; sellerId: string }>,
    options: FetchSellersJsonOptions = {}
  ): Promise<
    Array<{
      domain: string;
      sellerId: string;
      seller: Seller | null;
      source: 'api-parallel' | 'api' | 'fallback';
      error?: string;
    }>
  > {
    // 1. Group requests by domain
    const domainGroups = new Map<string, Set<string>>();
    for (const req of requests) {
      if (!domainGroups.has(req.domain)) {
        domainGroups.set(req.domain, new Set());
      }
      domainGroups.get(req.domain)!.add(req.sellerId);
    }

    const results: Array<{
      domain: string;
      sellerId: string;
      seller: Seller | null;
      source: 'fallback';
      error?: string;
    }> = [];

    const domains = Array.from(domainGroups.keys());

    // 2. Fetch all domains (concurrency is handled by fetch method)
    const fetchPromises = domains.map(async (domain) => {
      const result = await this.fetch(domain, options);
      const sellerIds = domainGroups.get(domain)!;

      if (result.error || !result.data) {
        sellerIds.forEach(id => {
          results.push({
            domain,
            sellerId: id,
            seller: null,
            source: 'fallback',
            error: result.error || 'No data',
          });
        });
        return;
      }

      const sellerMap = new Map<string, Seller>();
      result.data.sellers.forEach(s => sellerMap.set(s.seller_id, s));

      sellerIds.forEach(id => {
        results.push({
          domain,
          sellerId: id,
          seller: sellerMap.get(id) || null,
          source: 'fallback',
        });
      });
    });

    await Promise.all(fetchPromises);
    return results;
  }

  /**
   * Invalidates the cache entry for a domain
   */
  static async invalidateCache(domain: string): Promise<void> {
    await SellersJsonCache.delete(domain);
  }
}

export { type FetchSellersJsonOptions, type FetchSellersJsonResult, type Seller, type SellersJson };
