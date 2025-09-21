declare const __DEV_BUILD__: boolean;

// Cache for dev config to avoid repeated fetches
let devConfigCache: any = null;
let devConfigPromise: Promise<any> | null = null;

// 開発環境設定の読み込み処理
export const loadDevConfig = async () => {
  // Return cached result if available
  if (devConfigCache !== null) {
    return devConfigCache;
  }

  // Return existing promise if already loading
  if (devConfigPromise !== null) {
    return devConfigPromise;
  }
  const isDevExtension = !('update_url' in chrome.runtime.getManifest());

  if (!isDevExtension || !__DEV_BUILD__) {
    devConfigCache = null;
    return null;
  }

  // Create and cache the promise
  devConfigPromise = (async () => {
    try {
      // Fetch the config file from the extension's config directory
      const response = await fetch(chrome.runtime.getURL('config/dev.json'));
      if (!response.ok) {
        throw new Error(`Failed to fetch dev config: ${response.status}`);
      }

      // Parse JSON directly and cache the result
      const result = await response.json();
      devConfigCache = result;
      return result;
    } catch (error) {
      console.warn('開発設定ファイルが見つかりません:', error);
      devConfigCache = null;
      return null;
    } finally {
      // Clear the promise once resolved
      devConfigPromise = null;
    }
  })();

  return devConfigPromise;
};

// 使用例
export const useDevApiKey = async () => {
  const config = await loadDevConfig();
  return config?.API_KEY || null;
};
