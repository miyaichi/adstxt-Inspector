
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

  const targetDomain = 'asahi.com';
  console.log(`Target: ${targetDomain}`);

  // Fetch Ads.txt First (Common for both passes)
  const adsTxtResult = await fetchAdsTxt(targetDomain, false);
  if (adsTxtResult.data.length === 0) {
    console.error('No ads.txt entries found. Exiting test.');
    return;
  }
  const uniqueDomains = getUniqueDomains(adsTxtResult.data);
  console.log(`Identified ${uniqueDomains.length} unique seller domains.`);

  // Define run pass function
  const runPass = async (passName: string) => {
    console.log(`\n=== ${passName} ===`);
    const start = performance.now();

    // Simulate parallel fetching logic
    const promises = uniqueDomains.map(async (domain) => {
      const entry = adsTxtResult.data.find(e => e.domain === domain);
      if (!entry) return;
      const request = { domain: domain, sellerId: entry.publisherId };
      return SellersJsonFetcher.fetchSellersParallel([request]);
    });

    await Promise.all(promises);
    const end = performance.now();
    const duration = end - start;
    console.log(`Completed in ${duration.toFixed(2)}ms`);
    return duration;
  };

  // Pass 1: Cold Start
  const time1 = await runPass('Pass 1: Cold Start (Initial Fetch)');

  // Pass 2: Warm Cache
  const time2 = await runPass('Pass 2: Warm Cache (With Negative Caching)');

  console.log('\n=== Summary ===');
  console.log(`Cold Start: ${time1.toFixed(2)}ms`);
  console.log(`Warm Cache: ${time2.toFixed(2)}ms`);
  console.log(`Speedup: ${(time1 / time2).toFixed(1)}x`);
}

runPerfTest().catch(console.error);
