import type {
  SellersJsonProvider,
  BatchSellersResult,
  SellersJsonMetadata,
  CacheInfo,
  SellerResult,
  Seller,
} from '@miyaichi/ads-txt-validator';
import { SellersJsonFetcher } from './fetchSellersJson';

/**
 * SellersJsonProvider implementation for adstxt-Inspector
 * This class adapts the existing SellersJsonFetcher to the ads-txt-validator interface
 */
export class AdsTxtInspectorSellersProvider implements SellersJsonProvider {
  private readonly fetchOptions: { timeout: number; retries: number };
  private readonly metadataCache = new Map<string, SellersJsonMetadata>();

  constructor(options: { timeout?: number; retries?: number } = {}) {
    this.fetchOptions = {
      timeout: options.timeout || 5000,
      retries: options.retries || 1,
    };
  }

  /**
   * Get specific sellers by seller IDs for a domain
   */
  async batchGetSellers(domain: string, sellerIds: string[]): Promise<BatchSellersResult> {
    const requests = sellerIds.map((sellerId) => ({ domain, sellerId }));

    try {
      const sellersResults = await SellersJsonFetcher.fetchSellers(requests, this.fetchOptions);

      const results: SellerResult[] = sellersResults.map((result) => ({
        sellerId: result.sellerId,
        seller: result.seller ? this.convertToValidatorSeller(result.seller) : null,
        found: !!result.seller,
        source: 'cache' as const, // SellersJsonFetcher uses cache
        error: result.error,
      }));

      const foundCount = results.filter((r) => r.found).length;

      return {
        domain,
        requested_count: sellerIds.length,
        found_count: foundCount,
        results,
        metadata: await this.getMetadata(domain),
        cache: await this.getCacheInfo(domain),
      };
    } catch (error) {
      // Enhanced error handling with specific error type detection
      let errorMessage = 'Unknown error';
      let shouldRetry = false;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check for specific error types that might warrant retry
        if (error.name === 'NetworkError' || 
            error.message.includes('timeout') || 
            error.message.includes('ECONNRESET') ||
            error.message.includes('ENOTFOUND')) {
          shouldRetry = true;
          errorMessage = `Network error: ${error.message}`;
        } else if (error.message.includes('JSON')) {
          errorMessage = `JSON parsing error: ${error.message}`;
        } else if (error.message.includes('HTTP')) {
          errorMessage = `HTTP error: ${error.message}`;
        }
      }
      
      // Log the error with context
      console.error(`[AdsTxtInspectorSellersProvider] batchGetSellers failed for domain ${domain}:`, {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage,
        sellerCount: sellerIds.length,
        shouldRetry
      });
      
      // Return empty result on error with enhanced error information
      return {
        domain,
        requested_count: sellerIds.length,
        found_count: 0,
        results: sellerIds.map((sellerId) => ({
          sellerId,
          seller: null,
          found: false,
          source: 'cache' as const,
          error: errorMessage,
        })),
        metadata: { error: errorMessage, shouldRetry },
        cache: { is_cached: false, status: 'error' as const },
      };
    }
  }

  /**
   * Get metadata for a domain's sellers.json
   */
  async getMetadata(domain: string): Promise<SellersJsonMetadata> {
    // Check cache first
    if (this.metadataCache.has(domain)) {
      return this.metadataCache.get(domain)!;
    }

    try {
      // Use the SellersJsonFetcher.fetch method to get full sellers.json
      const fetchResult = await SellersJsonFetcher.fetch(domain, this.fetchOptions);

      const metadata: SellersJsonMetadata = {};

      if (fetchResult.data) {
        // Extract metadata from sellers.json response
        metadata.version = fetchResult.data.version;
        metadata.contact_email = fetchResult.data.contact_email;
        metadata.contact_address = fetchResult.data.contact_address;
        metadata.seller_count = fetchResult.data.sellers?.length || 0;
        metadata.identifiers = fetchResult.data.identifiers;
      }

      // Cache the result
      this.metadataCache.set(domain, metadata);

      return metadata;
    } catch {
      const emptyMetadata = {};
      this.metadataCache.set(domain, emptyMetadata);
      return emptyMetadata;
    }
  }


  /**
   * Get cache information for a domain
   */
  async getCacheInfo(domain: string): Promise<CacheInfo> {
    // SellersJsonFetcher uses cache, so we assume it's cached
    return {
      is_cached: true,
      status: 'success' as const,
      last_updated: new Date().toISOString(),
    };
  }

  /**
   * Check if a domain has a sellers.json file
   */
  async hasSellerJson(domain: string): Promise<boolean> {
    try {
      // Use the SellersJsonFetcher.fetch method to check existence
      const fetchResult = await SellersJsonFetcher.fetch(domain, this.fetchOptions);
      return !fetchResult.error && fetchResult.data !== null;
    } catch {
      return false;
    }
  }

  /**
   * Convert SellersJsonFetcher seller format to ads-txt-validator format
   */
  private convertToValidatorSeller(seller: any): Seller {
    return {
      seller_id: seller.seller_id,
      name: seller.name,
      domain: seller.domain,
      seller_type: seller.seller_type === 'RESELLER' ? undefined : seller.seller_type,
      is_confidential: seller.is_confidential,
      is_passthrough: seller.is_passthrough,
      comment: seller.comment,
      ext: seller.ext,
    };
  }
}
