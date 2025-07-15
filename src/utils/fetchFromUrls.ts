/**
 * Fetch data from multiple URLs
 * @param urls - Array of URLs to fetch from
 * @param options - Configuration options
 * @returns The fetched data and the final URL
 * @throws Error if data cannot be fetched
 */

interface FetchResult {
  content: string;
  finalUrl: string;
}

export async function fetchFromUrls(
  urls: string[],
  options: {
    responseType?: 'json' | 'text/plain';
    timeout?: number;
    maxRedirects?: number;
  } = {}
): Promise<FetchResult> {
  // Setting default values
  const { responseType = undefined, timeout = 10000, maxRedirects = 5 } = options;

  // Check the available URLs
  const checkResults = await Promise.allSettled(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(timeout / 2),
        });
        return response.ok ? url : null;
      } catch {
        return null;
      }
    })
  );

  const availableUrls = checkResults
    .filter((result) => result.status === 'fulfilled' && result.value !== null)
    .map((result) => (result as PromiseFulfilledResult<string>).value);

  // Error if no available URLs
  if (availableUrls.length === 0) {
    throw new Error('error_10010_file_not_found');
  }

  // Track error information
  const errors = {
    timeout: false,
    redirect: false,
    contentType: false,
  };

  // Attempt to fetch data from available URLs
  for (const url of availableUrls) {
    try {
      // Counter to track the number of redirects
      let redirectCount = 0;
      let currentUrl = url;
      let response: Response | null = null;

      while (redirectCount <= maxRedirects) {
        try {
          response = await fetch(currentUrl, {
            method: 'GET',
            redirect: 'manual',
            signal: AbortSignal.timeout(timeout),
          });

          // Redirect if the response is a redirect
          if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
            redirectCount++;
            if (redirectCount > maxRedirects) {
              errors.redirect = true;
              throw new Error('error_10040_too_many_redirects');
            }
            currentUrl = new URL(response.headers.get('location')!, currentUrl).toString();
            continue;
          }

          break;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            errors.timeout = true;
            throw new Error('error_10030_connection_timeout');
          }
          throw error;
        }
      }

      if (!response) {
        continue;
      }

      // Check the content type of the response
      const contentType = response.headers.get('content-type') || '';
      if (responseType && !contentType.includes(responseType)) {
        errors.contentType = true;
        throw new Error('error_10020_invalid_content_type');
      }

      const content = await response.text();
      return { content, finalUrl: currentUrl };
    } catch (error) {
      // Log the error but try the next URL
      console.error(`Failed to fetch data from URL ${url}: ${error}`);
      continue;
    }
  }

  // If all URLs fail, throw an appropriate error
  if (errors.timeout) {
    throw new Error('error_10030_connection_timeout');
  } else if (errors.redirect) {
    throw new Error('error_10040_too_many_redirects');
  } else if (errors.contentType) {
    throw new Error('error_10020_invalid_content_type');
  } else {
    throw new Error('error_unknown_error');
  }
}
