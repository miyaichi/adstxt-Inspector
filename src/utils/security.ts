/**
 * Security utility functions for sanitizing inputs and preventing injection attacks
 */

/**
 * Sanitize log input to prevent log injection attacks
 * Removes newline characters and control characters that could be used for log injection
 */
export function sanitizeLogInput(input: string): string {
  if (input === null || input === undefined || typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/[\r\n]/g, ' ') // Replace newlines with spaces
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

/**
 * Sanitize key for database operations to prevent NoSQL injection
 * Ensures the key contains only safe characters
 */
export function sanitizeKey(key: string): string {
  if (key === null || key === undefined || typeof key !== 'string') {
    return '';
  }
  
  // Allow only alphanumeric, hyphens, underscores, and dots
  return key.replace(/[^a-zA-Z0-9\-_\.]/g, '');
}

/**
 * Validate domain name format
 */
export function validateDomain(domain: string): boolean {
  if (domain === null || domain === undefined || typeof domain !== 'string' || domain.length === 0) {
    return false;
  }
  
  // Basic domain validation regex
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain) && domain.length <= 253;
}

/**
 * Sanitize URL for safe logging and processing
 */
export function sanitizeUrl(url: string): string {
  if (url === null || url === undefined || typeof url !== 'string') {
    return '';
  }
  
  try {
    const urlObj = new URL(url);
    return urlObj.toString();
  } catch {
    return sanitizeLogInput(url);
  }
}

/**
 * Validate and sanitize publisher ID
 */
export function validatePublisherId(publisherId: string): string {
  if (publisherId === null || publisherId === undefined || typeof publisherId !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous characters while preserving valid publisher ID formats
  return publisherId.replace(/[<>\"'&]/g, '').trim();
}