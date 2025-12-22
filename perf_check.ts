
// Mock Chrome API
const storageMock = new Map<string, any>();
const chromeMock = {
  i18n: {
    getUILanguage: () => 'en-US',
  },
  storage: {
    local: {
      get: async (key: string | string[]) => {
        if (typeof key === 'string') {
          return { [key]: storageMock.get(key) };
        }
        return {};
      },
      set: async (items: Record<string, any>) => {
        Object.entries(items).forEach(([k, v]) => storageMock.set(k, v));
      },
      remove: async (key: string) => {
        storageMock.delete(key);
      },
    },
    sync: {
      get: async () => ({}),
      set: async () => { }
    }
  },
  runtime: {
    getManifest: () => ({ update_url: 'http://example.com' })
  }
};

(global as any).chrome = chromeMock;

import { performance } from 'perf_hooks';

async function runPerfTest() {
  // Dynamic imports to ensure global mocks are set before modules load
  const { SellersJsonFetcher } = await import('./src/utils/fetchSellersJson');
  const { fetchAdsTxt, getUniqueDomains } = await import('./src/utils/fetchAdsTxt');

  console.log('Starting legacy vs new performance check simulation...');

  const targetDomain = 'asahi.com';

  // 1. Fetch Ads.txt
  console.log(`\nFetching ads.txt for ${targetDomain}...`);
  const startAdsTxt = performance.now();
  const adsTxtResult = await fetchAdsTxt(targetDomain, false);
  const endAdsTxt = performance.now();

  console.log(`Ads.txt fetch completed in ${(endAdsTxt - startAdsTxt).toFixed(2)}ms`);
  console.log(`Found ${adsTxtResult.data.length} entries.`);

  if (adsTxtResult.data.length === 0) {
    console.error('No ads.txt entries found. Exiting test.');
    return;
  }

  // 2. Extract unique seller domains
  const uniqueDomains = getUniqueDomains(adsTxtResult.data);
  console.log(`\nIdentified ${uniqueDomains.length} unique seller domains to check.`);

  // 3. Fetch Sellers.json (Parallel)
  console.log(`Fetching sellers.json for all domains (limit 5 concurrent)...`);
  const startSellers = performance.now();

  const promises = uniqueDomains.map(async (domain) => {
    // We just want to ensure the sellers.json is fetched.
    const entry = adsTxtResult.data.find(e => e.domain === domain);
    if (!entry) return;

    // Create a request. Note we don't mock fetch so it will make real requests.
    const request = { domain: domain, sellerId: entry.publisherId };
    return SellersJsonFetcher.fetchSellersParallel([request]);
  });

  await Promise.all(promises);

  const endSellers = performance.now();
  console.log(`Sellers.json fetch phase completed in ${(endSellers - startSellers).toFixed(2)}ms`);

  console.log('\n--- Performance Summary ---');
  console.log(`Ads.txt Parsing: ${(endAdsTxt - startAdsTxt).toFixed(2)}ms`);
  console.log(`Sellers.json Processing (${uniqueDomains.length} domains): ${(endSellers - startSellers).toFixed(2)}ms`);
  console.log(`Total Time: ${(endSellers - startAdsTxt).toFixed(2)}ms`);
}

runPerfTest().catch(console.error);
