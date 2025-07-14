/**
 * Security utility functions for sanitizing inputs and preventing injection attacks
 */

/**
 * Strict input validation and sanitization for all security-critical operations
 */

/**
 * Sanitize log input to prevent log injection attacks
 * Removes newline characters and control characters that could be used for log injection
 * @param input - The input string to sanitize
 * @returns Sanitized string safe for logging
 * @throws TypeError if input is not a string, null, or undefined
 */
export function sanitizeLogInput(input: string): string {
  if (input === null || input === undefined) {
    return '';
  }
  
  if (typeof input !== 'string') {
    throw new TypeError(`Expected string for log input, received ${typeof input}`);
  }
  
  return input
    .replace(/[\r\n]/g, ' ') // Replace newlines with spaces
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

/**
 * Ultra-strict key sanitization for Map/database operations to prevent NoSQL injection
 * This function provides the highest level of security by enforcing strict validation
 * @param key - The key to sanitize
 * @returns Sanitized key safe for Map operations
 * @throws SecurityError if key is potentially dangerous
 */
export function sanitizeMapKey(key: string): string {
  // First level: Type validation
  if (key === null || key === undefined) {
    throw new SecurityError('Map key cannot be null or undefined');
  }
  
  if (typeof key !== 'string') {
    throw new SecurityError(`Map key must be a string, received ${typeof key}`);
  }
  
  // Second level: Length validation 
  if (key.length === 0) {
    throw new SecurityError('Map key cannot be empty');
  }
  
  if (key.length > 1000) {
    throw new SecurityError('Map key exceeds maximum length of 1000 characters');
  }
  
  // Third level: Character validation - only allow very safe characters
  const safeKeyPattern = /^[a-zA-Z0-9\-_\.]+$/;
  if (!safeKeyPattern.test(key)) {
    throw new SecurityError(`Map key contains unsafe characters: ${key}`);
  }
  
  // Fourth level: Prevent known injection patterns
  const dangerousPatterns = [
    '__proto__', 'constructor', 'prototype',
    'toString', 'valueOf', 'hasOwnProperty',
    '../', './', '\\', '<', '>', '"', "'", '&', '|', ';', '`'
  ];
  
  const lowerKey = key.toLowerCase();
  for (const pattern of dangerousPatterns) {
    if (lowerKey.includes(pattern)) {
      throw new SecurityError(`Map key contains dangerous pattern: ${pattern}`);
    }
  }
  
  return key;
}

/**
 * Legacy function for backward compatibility - now uses strict sanitization
 * @deprecated Use sanitizeMapKey instead
 */
export function sanitizeKey(key: string): string {
  try {
    return sanitizeMapKey(key);
  } catch (error) {
    // For backward compatibility, return safe fallback instead of throwing
    console.warn('sanitizeKey: Falling back to safe default due to security issue:', error);
    return `safe_key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Custom security error class
 */
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Secure Map implementation that prevents NoSQL injection attacks
 * All keys are strictly validated before any operations
 */
export class SecureMap<T> {
  private readonly internalMap = new Map<string, T>();
  private readonly name: string;

  constructor(name: string = 'SecureMap') {
    this.name = name;
  }

  /**
   * Set a value with secure key validation
   */
  set(key: string, value: T): this {
    const secureKey = sanitizeMapKey(key);
    this.internalMap.set(secureKey, value);
    return this;
  }

  /**
   * Get a value with secure key validation
   */
  get(key: string): T | undefined {
    const secureKey = sanitizeMapKey(key);
    return this.internalMap.get(secureKey);
  }

  /**
   * Check if key exists with secure validation
   */
  has(key: string): boolean {
    const secureKey = sanitizeMapKey(key);
    return this.internalMap.has(secureKey);
  }

  /**
   * Delete a key with secure validation
   */
  delete(key: string): boolean {
    const secureKey = sanitizeMapKey(key);
    return this.internalMap.delete(secureKey);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.internalMap.clear();
  }

  /**
   * Get the size of the map
   */
  get size(): number {
    return this.internalMap.size;
  }

  /**
   * Get all keys (already sanitized)
   */
  keys(): IterableIterator<string> {
    return this.internalMap.keys();
  }

  /**
   * Get all values
   */
  values(): IterableIterator<T> {
    return this.internalMap.values();
  }

  /**
   * Get all entries
   */
  entries(): IterableIterator<[string, T]> {
    return this.internalMap.entries();
  }

  /**
   * For debugging - get map name
   */
  getName(): string {
    return this.name;
  }
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
    
    // Validate protocol - only allow safe protocols
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(urlObj.protocol)) {
      // If protocol is unsafe, return sanitized original string
      return sanitizeLogInput(url).substring(0, 256);
    }
    
    // Additional sanitization of the URL components
    const sanitizedUrl = urlObj.toString();
    // Remove potentially dangerous characters and limit length
    return sanitizeLogInput(sanitizedUrl).substring(0, 2048);
  } catch {
    // If URL parsing fails, apply aggressive sanitization
    return sanitizeLogInput(url).substring(0, 256);
  }
}

/**
 * Sanitize publisher ID by removing dangerous characters
 * @param publisherId - The publisher ID to sanitize
 * @returns Sanitized publisher ID
 * @throws TypeError if input is not a string
 */
export function sanitizePublisherId(publisherId: string): string {
  if (publisherId === null || publisherId === undefined) {
    throw new TypeError('Publisher ID cannot be null or undefined');
  }
  
  if (typeof publisherId !== 'string') {
    throw new TypeError('Publisher ID must be a string');
  }
  
  // Remove potentially dangerous characters while preserving valid publisher ID formats
  const sanitized = publisherId.replace(/[<>\"'&]/g, '').trim();
  
  // Validate that we still have a meaningful publisher ID
  if (sanitized.length === 0) {
    throw new Error('Publisher ID cannot be empty after sanitization');
  }
  
  return sanitized;
}

/**
 * Legacy function name for backward compatibility
 * @deprecated Use sanitizePublisherId instead
 */
export function validatePublisherId(publisherId: string): string {
  try {
    return sanitizePublisherId(publisherId);
  } catch (error) {
    // For backward compatibility, return empty string instead of throwing
    return '';
  }
}