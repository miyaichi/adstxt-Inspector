// Context type
export type Context = 'background' | 'sidepanel' | `content-${number}` | 'undefined';

// Connection status type
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Seller type
export interface Seller {
  seller_id: string;
  is_confidential?: 0 | 1;
  seller_type: 'PUBLISHER' | 'INTERMEDIARY' | 'RESELLER' | 'BOTH';
  is_passthrough?: 0 | 1;
  name: string;
  domain: string;
  comment?: string;
  ext?: any;
}

// Sellers JSON type
export interface SellersJson {
  identifiers?: any;
  contact_email?: string;
  contact_address?: string;
  version: string;
  ext?: any;
  sellers: Seller[];
}

// Types for fetchSellersJson function
export interface FetchSellersJsonResult {
  data?: SellersJson;
  error?: string;
  cached?: boolean;
}

export interface FetchSellersJsonOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  bypassCache?: boolean;
}
