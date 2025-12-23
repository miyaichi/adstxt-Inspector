import { CacheEntry, SellersJson } from '../types/types';

export type CachedSellersData = SellersJson | { error: string; isInvalid: true };

export class SellersJsonCache {
  private static readonly TTL = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly CACHE_KEY_PREFIX = 'sellers_json_';

  static async get(domain: string): Promise<CacheEntry<CachedSellersData> | null> {
    try {
      const key = this.getCacheKey(domain);
      const result = await chrome.storage.local.get(key);
      const cached = result[key] as CacheEntry<CachedSellersData> | undefined;

      if (!cached) return null;

      // Check if cache is expired
      if (Date.now() - cached.timestamp > this.TTL) {
        await this.delete(domain);
        return null;
      }

      return cached;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  static async set(domain: string, data: CachedSellersData): Promise<void> {
    try {
      const key = this.getCacheKey(domain);
      const entry: CacheEntry<CachedSellersData> = {
        data,
        timestamp: Date.now(),
      };
      await chrome.storage.local.set({ [key]: entry });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  static async delete(domain: string): Promise<void> {
    try {
      const key = this.getCacheKey(domain);
      await chrome.storage.local.remove(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  private static getCacheKey(domain: string): string {
    return `${this.CACHE_KEY_PREFIX}${domain}`;
  }
}
