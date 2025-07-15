import type { Seller } from '../types/types';

export interface SellersJsonApiConfig {
  baseUrl: string;
}

export interface SellersJsonApiResponse {
  success: boolean;
  data?: {
    domain: string;
    seller?: Seller;
    found: boolean;
    key?: string | null;
    params?: any;
    metadata?: {
      version: string;
      contact_email?: string;
      contact_address?: string;
      identifiers?: any;
      seller_count?: number;
    };
    cache?: {
      is_cached: boolean;
      last_updated: string;
      status: string;
      expires_at: string;
    };
  };
  error?: string;
}

export interface SellersJsonBatchApiResponse {
  success: boolean;
  data?: {
    domain: string;
    requested_count: number;
    found_count: number;
    results: Array<{
      sellerId: string;
      seller?: Seller;
      found: boolean;
      source?: 'cache' | 'fresh';
      error?: string;
    }>;
    metadata?: {
      version: string;
      contact_email?: string;
      contact_address?: string;
      identifiers?: any;
      seller_count?: number;
    };
    cache?: {
      is_cached: boolean;
      last_updated: string;
      status: string;
      expires_at: string;
    };
    processing_time_ms?: number;
  };
  error?: string;
}

export class SellersJsonApi {
  private config: SellersJsonApiConfig;

  constructor(config: SellersJsonApiConfig) {
    this.config = config;
  }

  /**
   * Fetches a specific seller from the external API
   * @param domain - The domain to fetch from
   * @param sellerId - The seller ID to fetch
   * @param force - Whether to force refresh cache
   * @returns The API response
   */
  async fetchSeller(
    domain: string,
    sellerId: string,
    force: boolean = false
  ): Promise<SellersJsonApiResponse> {
    try {
      const url = `${this.config.baseUrl}/sellersjson/${domain}/seller/${sellerId}`;
      const params = new URLSearchParams();

      if (force) {
        params.append('force', 'true');
      }

      const finalUrl = params.toString() ? `${url}?${params.toString()}` : url;

      const response = await fetch(finalUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        // Set a reasonable timeout
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown API error',
      };
    }
  }

  /**
   * Fetches multiple sellers from the external API using batch endpoint
   * @param requests - Array of {domain, sellerId} objects
   * @param force - Whether to force refresh cache
   * @returns Array of API responses in the same order as requests
   */
  async fetchSellers(
    requests: Array<{ domain: string; sellerId: string }>,
    force: boolean = false
  ): Promise<SellersJsonApiResponse[]> {
    // Group requests by domain to use batch API efficiently
    const domainGroups = new Map<string, Array<{ index: number; sellerId: string }>>();

    for (let i = 0; i < requests.length; i++) {
      const { domain, sellerId } = requests[i];
      if (!domainGroups.has(domain)) {
        domainGroups.set(domain, []);
      }
      domainGroups.get(domain)!.push({ index: i, sellerId });
    }

    // Initialize results array with correct length
    const results: SellersJsonApiResponse[] = new Array(requests.length);

    // Process each domain group with batch API
    const promises = Array.from(domainGroups.entries()).map(async ([domain, sellerData]) => {
      const sellerIds = sellerData.map((item) => item.sellerId);

      try {
        const batchResponse = await this.fetchSellersBatch(domain, sellerIds, force);

        if (batchResponse.success && batchResponse.data?.results) {
          // Create a map for quick lookup of results by sellerId
          const resultMap = new Map(
            batchResponse.data.results.map((result) => [result.sellerId, result])
          );

          // Place results in correct positions
          for (const { index, sellerId } of sellerData) {
            const result = resultMap.get(sellerId);
            if (result) {
              results[index] = {
                success: result.found,
                data: result.found
                  ? {
                      domain,
                      seller: result.seller,
                      found: result.found,
                      metadata: batchResponse.data.metadata,
                      cache: batchResponse.data.cache,
                    }
                  : undefined,
                error: result.found ? undefined : result.error || 'Seller not found',
              };
            } else {
              results[index] = {
                success: false,
                error: 'Seller not found in batch response',
              };
            }
          }
        } else {
          // If batch API fails, add error responses for all sellers in this domain
          for (const { index } of sellerData) {
            results[index] = {
              success: false,
              error: batchResponse.error || 'Batch API request failed',
            };
          }
        }
      } catch (error) {
        // If batch request fails, add error responses for all sellers in this domain
        for (const { index } of sellerData) {
          results[index] = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown batch API error',
          };
        }
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Fetches multiple sellers from a single domain using the batch API
   * @param domain - The domain to fetch from
   * @param sellerIds - Array of seller IDs to fetch
   * @param force - Whether to force refresh cache
   * @returns Batch API response
   */
  async fetchSellersBatch(
    domain: string,
    sellerIds: string[],
    force: boolean = false
  ): Promise<SellersJsonBatchApiResponse> {
    try {
      const url = `${this.config.baseUrl}/sellersjson/${domain}/sellers/batch`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sellerIds,
          force,
        }),
        // Set a reasonable timeout
        signal: AbortSignal.timeout(15000), // Longer timeout for batch requests
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown batch API error',
      };
    }
  }
}
