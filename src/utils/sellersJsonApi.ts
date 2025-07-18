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

export interface BatchSellerEntry {
  seller_id: string;
  seller_type?: 'PUBLISHER' | 'INTERMEDIARY' | 'BOTH';
  name?: string;
  domain?: string;
  found: boolean;
  is_confidential?: boolean;
}

export interface SellersJsonBatchApiResponse {
  success: boolean;
  data?: {
    domain: string;
    requested_count: number;
    found_count: number;
    sellers: BatchSellerEntry[];
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
   * Fetches multiple sellers from a single domain using the batch API with chunking.
   * This is the primary method for fetching sellers, ensuring that all requested
   * sellers are accounted for in the response, even if some API calls fail.
   * @param domain - The domain to fetch from
   * @param sellerIds - Array of seller IDs to fetch
   * @param force - Whether to force refresh cache
   * @returns A single, consolidated batch API response
   */
  async fetchSellersBatch(
    domain: string,
    sellerIds: string[],
    force: boolean = false
  ): Promise<SellersJsonBatchApiResponse> {
    // If no seller IDs are provided, return an empty successful response
    if (sellerIds.length === 0) {
      return {
        success: true,
        data: {
          domain,
          requested_count: 0,
          found_count: 0,
          sellers: [],
          metadata: {},
          cache: { is_cached: false, status: 'success', last_updated: '', expires_at: '' },
        },
      };
    }

    // Split seller IDs into chunks that respect the API's batch size limit
    const chunks: string[][] = [];
    for (let i = 0; i < sellerIds.length; i += SellersJsonApi.MAX_BATCH_SIZE) {
      chunks.push(sellerIds.slice(i, i + SellersJsonApi.MAX_BATCH_SIZE));
    }

    try {
      // Process all chunks in parallel
      const chunkPromises = chunks.map((chunk) =>
        this.fetchSellersBatchSingle(domain, chunk, force)
      );

      const chunkResults = await Promise.allSettled(chunkPromises);

      // Use a map to consolidate results and ensure each sellerId has an entry
      const combinedSellerMap = new Map<string, BatchSellerEntry>();

      let combinedMetadata: any = null;
      let combinedCache: any = null;
      const errors: string[] = [];

      // Process results from each chunk
      for (const result of chunkResults) {
        if (result.status === 'fulfilled' && result.value.success && result.value.data?.sellers) {
          // If a chunk is successful, update the map with the seller data
          for (const seller of result.value.data.sellers) {
            // Batch API returns all sellers (both found and not found)
            combinedSellerMap.set(seller.seller_id, seller);
          }

          // Capture metadata and cache info from the first successful response
          if (!combinedMetadata && result.value.data.metadata) {
            combinedMetadata = result.value.data.metadata;
          }
          if (!combinedCache && result.value.data.cache) {
            combinedCache = result.value.data.cache;
          }
        } else if (result.status === 'fulfilled' && !result.value.success) {
          // Collect errors from failed API calls
          errors.push(result.value.error || `A batch request for domain ${domain} failed.`);
        } else if (result.status === 'rejected') {
          // Collect errors from rejected promises
          errors.push(
            result.reason?.message || `A batch request for domain ${domain} was rejected.`
          );
        }
      }

      // Ensure all requested seller IDs have entries, even if some chunks failed
      sellerIds.forEach((id) => {
        if (!combinedSellerMap.has(id)) {
          combinedSellerMap.set(id, {
            seller_id: id,
            found: false,
            name: undefined,
            seller_type: undefined,
            domain: undefined,
            is_confidential: undefined,
          });
        }
      });

      // Convert the map back to an array, preserving the original order of sellerIds
      const combinedSellers = sellerIds.map((id) => combinedSellerMap.get(id)!);
      const foundCount = combinedSellers.filter((s) => s.found).length;

      // If there were errors but some data was still fetched, return success true with partial data.
      // The caller can inspect individual entries' `found` status.
      // Only return success: false if all chunks failed and we have no data.
      if (foundCount > 0 || errors.length < chunkResults.length) {
        return {
          success: true,
          data: {
            domain,
            requested_count: sellerIds.length,
            found_count: foundCount,
            sellers: combinedSellers,
            metadata: combinedMetadata,
            cache: combinedCache,
          },
          // Optionally include a partial error message if some chunks failed
          error: errors.length > 0 ? `Partial failure: ${errors.join('; ')}` : undefined,
        };
      } else {
        // All chunks failed
        return {
          success: false,
          error: `All batch requests for ${domain} failed: ${errors.join('; ')}`,
        };
      }
    } catch (error) {
      // Catch any unexpected errors during the chunking process
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in fetchSellersBatch',
      };
    }
  }

  /**
   * Fetches a single batch of sellers. This is a private helper method.
   * @param domain - The domain to fetch from
   * @param sellerIds - Array of seller IDs (must be within MAX_BATCH_SIZE)
   * @param force - Whether to force refresh cache
   * @returns A raw batch API response
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

      // 開発環境でのみx-api-keyを使用、本番環境ではoriginで認証
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sellerIds: sellerIds,
          force: force,
        }),
        signal: AbortSignal.timeout(60000), // 60-second timeout for API call
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Try to parse error, but don't fail if body is empty
        return {
          success: false,
          error:
            errorData.message ||
            `API request failed with status ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // Convert the batch API response to our expected format
      if (data && data.success && data.data && Array.isArray(data.data.results)) {
        return {
          success: true,
          data: {
            domain: domain,
            requested_count: data.data.requested_count,
            found_count: data.data.found_count,
            sellers: data.data.results.map((result: any) => ({
              seller_id: result.sellerId,
              seller_type: result.seller?.seller_type,
              name: result.seller?.name,
              domain: result.seller?.domain,
              found: result.found,
              is_confidential: result.seller?.is_confidential,
            })),
            metadata: data.data.metadata || {},
            cache: data.data.cache || {
              is_cached: false,
              status: 'success',
              last_updated: '',
              expires_at: '',
            },
          },
        };
      } else {
        return {
          success: false,
          error: data?.error || 'Invalid API response format.',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown batch API error',
      };
    }
  }
}
