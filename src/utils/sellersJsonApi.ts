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

      // 開発環境でのx-api-keyを使用、本番環境ではoriginで認証
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      // Set domain-specific timeout based on known performance issues
      let timeoutMs = 60000; // Default 60 seconds
      if (domain === 'google.com') {
        timeoutMs = 10000; // 10 seconds for Google due to known performance issues
      } else if (domain.includes('amazon') || domain.includes('microsoft')) {
        timeoutMs = 15000; // 15 seconds for other known slow domains
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sellerIds: sellerIds,
          force: force,
        }),
        signal: AbortSignal.timeout(timeoutMs),
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

  /**
   * Fetches sellers from multiple domains using the parallel batch API
   * @param requests - Array of domain/sellerIds requests
   * @param options - Parallel processing options
   * @returns Parallel batch API response
   */
  async fetchSellersParallel(
    requests: Array<{ domain: string; sellerIds: string[] }>,
    options: {
      max_concurrent?: number;
      fail_fast?: boolean;
      return_partial?: boolean;
      force?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    data?: {
      parallel_processing: {
        total_domains: number;
        completed_domains: number;
        failed_domains: number;
        max_concurrent: number;
        total_requested_sellers: number;
        total_found_sellers: number;
      };
      results: Array<{
        domain: string;
        requested_count: number;
        found_count: number;
        results: Array<{
          seller_id: string;
          found: boolean;
          seller?: {
            seller_id: string;
            name?: string;
            domain?: string;
            seller_type?: string;
            is_confidential?: boolean;
          };
        }>;
        processing_time_ms: number;
        processing_method: string;
      }>;
      processing_time_ms: number;
    };
    error?: string;
  }> {
    try {
      const url = `${this.config.baseUrl}/sellersjson/batch/parallel`;

      const apiKey = await useDevApiKey();
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const requestBody = {
        requests: requests.map(req => ({
          domain: req.domain,
          sellerIds: req.sellerIds,
        })),
        max_concurrent: options.max_concurrent || 5,
        fail_fast: options.fail_fast || false,
        return_partial: options.return_partial !== false, // Default to true
        force: options.force || false,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(120000), // 2-minute timeout for parallel processing
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error:
            errorData.message ||
            `Parallel API request failed with status ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      if (data && data.success) {
        return {
          success: true,
          data: data.data,
        };
      } else {
        return {
          success: false,
          error: data?.error || 'Invalid parallel API response format.',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parallel API error',
      };
    }
  }
}

/**
 * Health Check API Client for monitoring system status
 */
export class HealthCheckApi {
  private config: SellersJsonApiConfig;

  constructor(config: SellersJsonApiConfig) {
    this.config = config;
  }

  /**
   * Checks the health status of the sellers.json API
   * @returns Health status information
   */
  async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    response_time_ms: number;
    metrics: {
      response_time_avg: number;
      load: 'low' | 'medium' | 'high';
      recommended_batch_size: number;
      suggested_delay_ms: number;
    };
    checks: {
      database: 'pass' | 'fail';
      cache: 'pass' | 'fail';
      response_time: 'pass' | 'fail';
      avg_performance: 'pass' | 'fail';
    };
  }> {
    try {
      const startTime = Date.now();
      const url = `${this.config.baseUrl}/sellersjson/health`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5-second timeout for health check
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          status: 'unhealthy',
          response_time_ms: responseTime,
          metrics: {
            response_time_avg: responseTime,
            load: 'high',
            recommended_batch_size: 10,
            suggested_delay_ms: 1000,
          },
          checks: {
            database: 'fail',
            cache: 'fail',
            response_time: 'fail',
            avg_performance: 'fail',
          },
        };
      }

      const data = await response.json();
      return {
        status: data.status || 'unhealthy',
        response_time_ms: responseTime,
        metrics: data.metrics || {
          response_time_avg: responseTime,
          load: 'medium',
          recommended_batch_size: 20,
          suggested_delay_ms: 500,
        },
        checks: data.checks || {
          database: 'fail',
          cache: 'fail',
          response_time: 'fail',
          avg_performance: 'fail',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        response_time_ms: 5000,
        metrics: {
          response_time_avg: 5000,
          load: 'high',
          recommended_batch_size: 5,
          suggested_delay_ms: 2000,
        },
        checks: {
          database: 'fail',
          cache: 'fail',
          response_time: 'fail',
          avg_performance: 'fail',
        },
      };
    }
  }

  /**
   * Gets performance statistics from the API
   * @returns Performance statistics and recommendations
   */
  async getStats(): Promise<{
    performance: {
      avg_response_time_ms: number;
      current_load: 'low' | 'medium' | 'high';
      suggested_batch_size: number;
      suggested_delay_ms: number;
    };
    recommendations: {
      optimal_batch_size: number;
      request_delay_ms: number;
      use_streaming: boolean;
      use_parallel: boolean;
    };
  }> {
    try {
      const url = `${this.config.baseUrl}/sellersjson/stats`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5-second timeout for stats
      });

      if (!response.ok) {
        // Return default recommendations on failure
        return {
          performance: {
            avg_response_time_ms: 2000,
            current_load: 'medium',
            suggested_batch_size: 20,
            suggested_delay_ms: 500,
          },
          recommendations: {
            optimal_batch_size: 20,
            request_delay_ms: 500,
            use_streaming: false,
            use_parallel: true,
          },
        };
      }

      const data = await response.json();
      return {
        performance: data.performance || {
          avg_response_time_ms: 2000,
          current_load: 'medium',
          suggested_batch_size: 20,
          suggested_delay_ms: 500,
        },
        recommendations: data.recommendations || {
          optimal_batch_size: 20,
          request_delay_ms: 500,
          use_streaming: false,
          use_parallel: true,
        },
      };
    } catch (error) {
      // Return safe defaults on error
      return {
        performance: {
          avg_response_time_ms: 3000,
          current_load: 'high',
          suggested_batch_size: 10,
          suggested_delay_ms: 1000,
        },
        recommendations: {
          optimal_batch_size: 10,
          request_delay_ms: 1000,
          use_streaming: false,
          use_parallel: false,
        },
      };
    }
  }
}
