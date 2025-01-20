/**
 * Custom error class for fetch timeout
 */
export class FetchTimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'FetchTimeoutError';
  }
}

/**
 * Fetches a resource with a timeout
 * @param url - The URL to fetch
 * @param options - Fetch options including timeout
 * @returns Promise that resolves with the fetch response
 */
export const fetchWithTimeout = async (
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> => {
  const { timeout = 5000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new FetchTimeoutError(`Request to ${url} timed out after ${timeout}ms`);
      }
    }
    throw error;
  }
};
