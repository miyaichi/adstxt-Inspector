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

    // Retry logic with exponential backoff
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Wait before retrying with exponential backoff
        if (attempt > 0) {
          const backoffDelay = retryDelay * Math.pow(2, attempt - 1);
          await this.delay(Math.min(backoffDelay, 10000)); // Cap at 10 seconds
        }

        // Create timeout promise for better control
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Request timed out after ${timeout}ms`)), timeout);
        });

        const fetchPromise = this.performFetch(url, timeout);
        
        // Race between fetch and timeout
        const data = await Promise.race([fetchPromise, timeoutPromise]);

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

        // Handle timeout errors
        if ((error as Error).message.includes('timed out')) {
          console.warn(`Attempt ${attempt + 1}/${retries + 1} timed out for ${domain}`);
          if (attempt === retries) {
            break;
          }
          continue;
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          lastError = new Error(`Request timed out after ${timeout}ms`);
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
      error: `Error fetching sellers.json after ${retries + 1} attempts: ${lastError?.message || 'Unknown error'}`,
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

    // Check API health before processing if API client is available
    if (apiClient) {
      try {
        // Import HealthCheckApi dynamically to avoid circular dependencies
        const { HealthCheckApi } = await import('./sellersJsonApi');
        const healthApi = new HealthCheckApi(apiClient['config']);
        
        const healthStatus = await healthApi.checkHealth();
        
        // If API is unhealthy, use fallback immediately
        if (healthStatus.status === 'unhealthy') {
          console.warn('API health check failed, using fallback method');
          return await this.processFallbackRequests(requests, options);
        }
        
        // Adjust timeout based on health status
        const healthBasedTimeout = healthStatus.status === 'degraded' ? 
          Math.max(30000, healthStatus.metrics.response_time_avg * 2) : 15000;
        
        // Override timeout if health check suggests longer timeout
        const finalTimeout = Math.max(options.timeout || 5000, healthBasedTimeout);
        options = { ...options, timeout: finalTimeout };
        
        console.log(`[HealthCheck] API health: ${healthStatus.status}, response time: ${healthStatus.response_time_ms}ms, using timeout: ${finalTimeout}ms`);
      } catch (error) {
        console.warn('Health check failed, proceeding with default timeout:', error);
      }
    }

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
        
        // Process API requests with timeout handling
        const apiPromises = Array.from(domainGroups.entries()).map(async ([domain, sellerIds]) => {
          try {
            // Wrap API call with timeout
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('API request timeout')), options.timeout || 15000);
            });
            
            const response = await Promise.race([
              apiClient.fetchSellersBatch(domain, sellerIds, options.bypassCache || false),
              timeoutPromise
            ]);

            if (response.success && response.data?.sellers) {
              const sellerMap = new Map(response.data.sellers.map((s) => [s.seller_id, s]));
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
          } catch (error) {
            // API call failed (timeout or other error), add to fallback
            console.warn(`API call failed for domain ${domain}:`, error);
            for (const sellerId of sellerIds) {
              fallbackRequests.push({ domain, sellerId });
            }
          }
        });

        await Promise.allSettled(apiPromises);

        // Process fallback requests if any
        if (fallbackRequests.length > 0) {
          const fallbackResults = await this.processFallbackRequests(fallbackRequests, options);
          results.push(...fallbackResults);
        }

        return results;
      } catch (error) {
        console.warn('API processing failed completely, using fallback:', error);
        // API completely failed, fallback for all requests
      }
    }

    // Fallback for all requests
    return await this.processFallbackRequests(requests, options);
  }

  /**
   * Fetches multiple sellers from multiple domains using parallel processing
   * This method is optimized for handling large batches across multiple domains
   * @param requests - Array of {domain, sellerId} requests
   * @param options - Fetch options with parallel processing settings
   * @returns Array of seller results with improved performance
   */
  static async fetchSellersParallel(
    requests: Array<{ domain: string; sellerId: string }>,
    options: FetchSellersJsonOptions & {
      maxConcurrent?: number;
      failFast?: boolean;
      returnPartial?: boolean;
    } = {}
  ): Promise<
    Array<{
      domain: string;
      sellerId: string;
      seller: Seller | null;
      source: 'api-parallel' | 'api' | 'fallback';
      error?: string;
      processingTimeMs?: number;
    }>
  > {
    const apiClient = await this.getApiClient();
    
    if (!apiClient || requests.length === 0) {
      return await this.processFallbackRequests(requests, options);
    }

    // Check if parallel processing is recommended
    try {
      const { HealthCheckApi } = await import('./sellersJsonApi');
      const healthApi = new HealthCheckApi(apiClient['config']);
      const stats = await healthApi.getStats();
      
      // Use parallel processing only if recommended and we have multiple domains
      const domainCount = new Set(requests.map(r => r.domain)).size;
      const shouldUseParallel = stats.recommendations.use_parallel && domainCount > 1;
      
      if (!shouldUseParallel) {
        console.log('Parallel processing not recommended, using standard batch processing');
        return await this.fetchSellers(requests, options);
      }
    } catch (error) {
      console.warn('Failed to get recommendations, proceeding with parallel processing:', error);
    }

    try {
      // Group requests by domain
      const domainGroups = new Map<string, string[]>();
      for (const req of requests) {
        if (!domainGroups.has(req.domain)) {
          domainGroups.set(req.domain, []);
        }
        domainGroups.get(req.domain)!.push(req.sellerId);
      }

      // Convert to parallel API format
      const parallelRequests = Array.from(domainGroups.entries()).map(([domain, sellerIds]) => ({
        domain,
        sellerIds,
      }));

      // Use parallel API
      const { SellersJsonApi } = await import('./sellersJsonApi');
      const api = apiClient as any; // Type assertion since we know the structure
      
      if (typeof api.fetchSellersParallel === 'function') {
        const parallelResponse = await api.fetchSellersParallel(parallelRequests, {
          max_concurrent: options.maxConcurrent || 5,
          fail_fast: options.failFast || false,
          return_partial: options.returnPartial !== false,
          force: false, // Always use cache for better performance
        });

        if (parallelResponse.success && parallelResponse.data) {
          const results: Array<{
            domain: string;
            sellerId: string;
            seller: Seller | null;
            source: 'api-parallel' | 'api' | 'fallback';
            error?: string;
            processingTimeMs?: number;
          }> = [];

          // Process parallel results
          for (const domainResult of parallelResponse.data.results) {
            const domainProcessingTime = domainResult.processing_time_ms;
            
            for (const sellerResult of domainResult.results) {
              const seller = sellerResult.found && sellerResult.seller ? {
                seller_id: sellerResult.seller.seller_id,
                name: sellerResult.seller.name,
                domain: sellerResult.seller.domain,
                seller_type: sellerResult.seller.seller_type as 'PUBLISHER' | 'INTERMEDIARY' | 'BOTH' | undefined,
                is_confidential: sellerResult.seller.is_confidential ? (1 as const) : (0 as const),
              } : null;

              results.push({
                domain: domainResult.domain,
                sellerId: sellerResult.seller_id,
                seller,
                source: 'api-parallel',
                processingTimeMs: domainProcessingTime,
              });
            }
          }

          // Handle any missing requests (domains that failed)
          const processedSellerIds = new Set(results.map(r => `${r.domain}:${r.sellerId}`));
          const missingRequests = requests.filter(r => 
            !processedSellerIds.has(`${r.domain}:${r.sellerId}`)
          );

          if (missingRequests.length > 0) {
            const fallbackResults = await this.processFallbackRequests(missingRequests, options);
            results.push(...fallbackResults.map(r => ({ ...r, source: 'fallback' as const })));
          }

          return results;
        }
      }

      // Fallback to standard processing if parallel API is not available
      console.log('Parallel API not available, falling back to standard processing');
      return await this.fetchSellers(requests, options);

    } catch (error) {
      console.warn('Parallel processing failed, falling back to standard processing:', error);
      return await this.fetchSellers(requests, options);
    }
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
