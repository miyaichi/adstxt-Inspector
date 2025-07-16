import { useDevApiKey } from '../config/devConfig';
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
    sellers: Array<{
      seller_id: string;
      seller_type: string | null;
      name: string | null;
      domain: string;
      found: boolean;
    }>;
    metadata?: {
      version?: string;
      contact_email?: string;
      contact_address?: string;
      identifiers?: any;
      seller_count?: number;
      status?: string;
      error_message?: string;
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
  private static readonly MAX_BATCH_SIZE = 30; // Maximum seller IDs per batch request

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

      const apiKey = await useDevApiKey();
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch(finalUrl, {
        method: 'GET',
        headers,
        // Set a reasonable timeout
        signal: AbortSignal.timeout(30000),
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

        if (batchResponse.success && batchResponse.data?.sellers) {
          // Create a map for quick lookup of results by sellerId
          const resultMap = new Map(
            batchResponse.data.sellers.map((seller) => [seller.seller_id, seller])
          );

          // Place results in correct positions
          for (const { index, sellerId } of sellerData) {
            const seller = resultMap.get(sellerId);
            if (seller) {
              results[index] = {
                success: seller.found,
                data: seller.found
                  ? {
                      domain,
                      seller: {
                        seller_id: seller.seller_id,
                        seller_type: seller.seller_type as "PUBLISHER" | "INTERMEDIARY" | "BOTH" | undefined,
                        name: seller.name || undefined,
                        domain: seller.domain
                      },
                      found: seller.found,
                      metadata: batchResponse.data.metadata ? {
                        version: batchResponse.data.metadata.version || '',
                        contact_email: batchResponse.data.metadata.contact_email,
                        contact_address: batchResponse.data.metadata.contact_address,
                        identifiers: batchResponse.data.metadata.identifiers,
                        seller_count: batchResponse.data.metadata.seller_count,
                      } : undefined,
                      cache: batchResponse.data.cache,
                    }
                  : undefined,
                error: seller.found ? undefined : `Seller ${sellerId} not found`,
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
   * Fetches multiple sellers from a single domain using the batch API with chunking
   * @param domain - The domain to fetch from
   * @param sellerIds - Array of seller IDs to fetch
   * @param force - Whether to force refresh cache
   * @returns Batch API response with combined results
   */
  async fetchSellersBatch(
    domain: string,
    sellerIds: string[],
    force: boolean = false
  ): Promise<SellersJsonBatchApiResponse> {
    // If sellerIds is within the limit, use single batch request
    if (sellerIds.length <= SellersJsonApi.MAX_BATCH_SIZE) {
      return this.fetchSellersBatchSingle(domain, sellerIds, force);
    }

    // Split into chunks and process them
    const chunks: string[][] = [];
    for (let i = 0; i < sellerIds.length; i += SellersJsonApi.MAX_BATCH_SIZE) {
      chunks.push(sellerIds.slice(i, i + SellersJsonApi.MAX_BATCH_SIZE));
    }

    try {
      // Process all chunks in parallel
      const chunkPromises = chunks.map(chunk => 
        this.fetchSellersBatchSingle(domain, chunk, force)
      );
      
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      // Combine results
      const combinedSellers: Array<{
        seller_id: string;
        seller_type: string | null;
        name: string | null;
        domain: string;
        found: boolean;
      }> = [];
      
      let totalRequested = 0;
      let totalFound = 0;
      let combinedMetadata: any = null;
      let combinedCache: any = null;
      const errors: string[] = [];

      for (const result of chunkResults) {
        if (result.status === 'fulfilled' && result.value.success && result.value.data) {
          combinedSellers.push(...result.value.data.sellers);
          totalRequested += result.value.data.requested_count;
          totalFound += result.value.data.found_count;
          
          // Use metadata and cache from the first successful response
          if (!combinedMetadata && result.value.data.metadata) {
            combinedMetadata = result.value.data.metadata;
          }
          if (!combinedCache && result.value.data.cache) {
            combinedCache = result.value.data.cache;
          }
        } else if (result.status === 'fulfilled' && !result.value.success) {
          errors.push(result.value.error || 'Unknown error');
        } else if (result.status === 'rejected') {
          errors.push(result.reason?.message || 'Request failed');
        }
      }

      // Return combined result
      if (combinedSellers.length > 0 || errors.length === 0) {
        return {
          success: true,
          data: {
            domain,
            requested_count: totalRequested,
            found_count: totalFound,
            sellers: combinedSellers,
            metadata: combinedMetadata,
            cache: combinedCache,
          }
        };
      } else {
        return {
          success: false,
          error: `All batch requests failed: ${errors.join(', ')}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown batch API error',
      };
    }
  }

  /**
   * Fetches multiple sellers from a single domain using a single batch API call
   * @param domain - The domain to fetch from
   * @param sellerIds - Array of seller IDs to fetch (should be <= MAX_BATCH_SIZE)
   * @param force - Whether to force refresh cache
   * @returns Batch API response
   */
  private async fetchSellersBatchSingle(
    domain: string,
    sellerIds: string[],
    force: boolean = false
  ): Promise<SellersJsonBatchApiResponse> {
    try {
      const url = `${this.config.baseUrl}/sellersjson/${domain}/sellers/batch`;

      const apiKey = await useDevApiKey();
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sellerIds,
          force,
        }),
        // Set a reasonable timeout - shorter for smaller batches
        signal: AbortSignal.timeout(60000),
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
