// 開発環境設定の読み込み処理
export const loadDevConfig = async () => {
  // 開発環境判定
  const isDev = !('update_url' in chrome.runtime.getManifest());

  if (!isDev) {
    return null;
  }

  try {
    // 開発設定ファイルを動的にインポート（TypeScriptの静的解析を回避）
    const devPath = './dev';
    const devModule = await import(devPath);
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
