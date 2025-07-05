import type { SellersJsonApiConfig } from '../utils/sellersJsonApi';

/**
 * Default API configuration
 */
const DEFAULT_API_CONFIG: SellersJsonApiConfig = {
  baseUrl: 'https://adstxt-manager.jp/api/v1',
  apiKey: 'test-api-key-1',
};

/**
 * Get API configuration from Chrome storage or use defaults
 * @returns Promise of API configuration
 */
export const getApiConfig = async (): Promise<SellersJsonApiConfig> => {
  try {
    const result = await chrome.storage.sync.get(['apiBaseUrl', 'apiKey']);
    return {
      baseUrl: result.apiBaseUrl || DEFAULT_API_CONFIG.baseUrl,
      apiKey: result.apiKey || DEFAULT_API_CONFIG.apiKey,
    };
  } catch (error) {
    // Fallback to default config if storage access fails
    return DEFAULT_API_CONFIG;
  }
};

/**
 * Set API configuration in Chrome storage
 * @param config - API configuration to save
 */
export const setApiConfig = async (config: SellersJsonApiConfig): Promise<void> => {
  try {
    await chrome.storage.sync.set({
      apiBaseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
  } catch (error) {
    console.error('Failed to save API configuration:', error);
  }
};

/**
 * Synchronous API configuration for backwards compatibility
 * This will use default values, use getApiConfig() for storage-based config
 */
export const API_CONFIG: SellersJsonApiConfig = DEFAULT_API_CONFIG;

/**
 * Check if the API is configured
 * @param config - Optional config to check, uses default if not provided
 * @returns Whether the API configuration is valid
 */
export const isApiConfigured = (config: SellersJsonApiConfig = API_CONFIG): boolean => {
  return !!(config.baseUrl && config.apiKey);
};
