// Context type
export type Context = 'background' | 'sidepanel' | `content-${number}` | 'undefined';

// Connection status type
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Seller type - compatible with ads-txt-validator package
export interface Seller {
  seller_id: string;
  is_confidential?: 0 | 1;
  seller_type?: 'PUBLISHER' | 'INTERMEDIARY' | 'BOTH';
  is_passthrough?: 0 | 1;
  name?: string;
  domain?: string;
  comment?: string;
  ext?: any;
  found?: boolean; // Add found flag to track existence in sellers.json
}

// Sellers JSON type
export interface SellersJson {
  domain: string;
  identifiers?: any;
  contact_email?: string;
  contact_address?: string;
  version: string;
  ext?: any;
  sellers: Seller[];
}

// Types for fetchSellersJson function
export interface FetchSellersJsonResult {
  domain: string;
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
