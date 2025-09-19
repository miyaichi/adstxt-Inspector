declare const __DEV_BUILD__: boolean;

// 開発環境設定の読み込み処理
export const loadDevConfig = async () => {
  const isDevExtension = !('update_url' in chrome.runtime.getManifest());

  if (!isDevExtension || !__DEV_BUILD__) {
    return null;
  }

  try {
    const devModule = await import(/* webpackChunkName: "dev-config" */ './dev');
    return devModule.devConfig;
  } catch (error) {
    console.warn('開発設定ファイルが見つかりません:', error);
    return null;
  }
};

// 使用例
export const useDevApiKey = async () => {
  const config = await loadDevConfig();
  return config?.API_KEY || null;
};
