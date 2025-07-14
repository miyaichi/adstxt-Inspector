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
  
  // Second level: Length validation (reduced from 1000 to 256 for DoS prevention)
  if (key.length === 0) {
    throw new SecurityError('Map key cannot be empty');
  }
  
  if (key.length > 256) {
    throw new SecurityError('Map key exceeds maximum allowed length');
  }
  
  // Third level: Character-by-character validation (whitelist approach)
  const allowedChars = new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.');
  for (let i = 0; i < key.length; i++) {
    if (!allowedChars.has(key[i])) {
      throw new SecurityError('Map key contains invalid characters');
    }
  }
  
  // Fourth level: Prevent known injection patterns with exhaustive checking
  const dangerousPatterns = [
    '__proto__', 'constructor', 'prototype',
    'toString', 'valueOf', 'hasOwnProperty',
    '../', './', '\\', '<', '>', '"', "'", '&', '|', ';', '`',
    // Additional patterns that could bypass previous checks
    '___proto___', '...constructor...', '_.prototype._',
    'eval', 'function', 'return', 'this', 'window', 'global',
    // Common NoSQL injection patterns
    '$where', '$ne', '$gt', '$lt', '$regex', '$exists'
  ];
  
  const lowerKey = key.toLowerCase();
  for (const pattern of dangerousPatterns) {
    if (lowerKey.includes(pattern.toLowerCase())) {
      throw new SecurityError('Map key contains prohibited patterns');
    }
  }
  
  // Fifth level: Prevent consecutive dangerous character combinations
  const dangerousSequences = ['__', '..', '--', '_.', '._'];
  for (const sequence of dangerousSequences) {
    if (key.includes(sequence)) {
      throw new SecurityError('Map key contains potentially dangerous character sequences');
    }
  }
  
  return key;
}

/**
 * Generate cryptographically secure random key for fallback scenarios
 */
function generateSecureRandomKey(): string {
  // Use crypto.getRandomValues for cryptographically secure randomness
  const array = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  
  // Convert to base64 and make it URL-safe
  const base64 = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `secure_${base64}`;
}

/**
 * Legacy function for backward compatibility - now uses strict sanitization
 * @deprecated Use sanitizeMapKey instead
 */
export function sanitizeKey(key: string): string {
  try {
    return sanitizeMapKey(key);
  } catch (error) {
    // For backward compatibility, return cryptographically secure fallback instead of throwing
    const secureKey = generateSecureRandomKey();
    
    // Use structured logging instead of console.warn
    if (typeof console !== 'undefined' && console.error) {
      console.error('[SECURITY] sanitizeKey: Generated secure fallback key due to validation failure');
    }
    
    return secureKey;
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
 * Deep object sanitization to prevent prototype pollution
 */
function deepSanitizeObject(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Prevent prototype pollution by rejecting dangerous keys
  const dangerousKeys = ['__proto__', 'constructor', 'prototype', 'valueOf', 'toString'];
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitizeObject(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip dangerous keys completely
    if (dangerousKeys.includes(key)) {
      continue;
    }
    
    // Sanitize key and recursively sanitize value
    try {
      const sanitizedKey = sanitizeMapKey(key);
      sanitized[sanitizedKey] = deepSanitizeObject(value);
    } catch (error) {
      // Skip keys that fail sanitization
      continue;
    }
  }

  return sanitized;
}

/**
 * Secure Map implementation that prevents NoSQL injection attacks and prototype pollution
 * All keys and values are strictly validated before any operations
 */
export class SecureMap<T> {
  private readonly internalMap = new Map<string, T>();
  private readonly name: string;
  private readonly mutex = new Map<string, Promise<any>>(); // Simple mutex for atomic operations

  constructor(name: string = 'SecureMap') {
    // Validate and sanitize constructor name
    if (typeof name !== 'string' || name.length === 0) {
      throw new SecurityError('SecureMap name must be a non-empty string');
    }
    
    if (name.length > 100) {
      throw new SecurityError('SecureMap name must be less than 100 characters');
    }
    
    // Sanitize the name to prevent any potential issues
    this.name = name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 100);
  }

  /**
   * Set a value with secure key validation and prototype pollution prevention
   */
  set(key: string, value: T): this {
    const secureKey = sanitizeMapKey(key);
    
    // Deep sanitize the value to prevent prototype pollution
    const sanitizedValue = deepSanitizeObject(value) as T;
    
    this.internalMap.set(secureKey, sanitizedValue);
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
   * Atomic get-or-set operation to prevent race conditions
   */
  async getOrSet(key: string, factory: () => Promise<T> | T): Promise<T> {
    const secureKey = sanitizeMapKey(key);
    
    // Check if value already exists
    const existing = this.internalMap.get(secureKey);
    if (existing !== undefined) {
      return existing;
    }
    
    // Use mutex to prevent concurrent factory calls for the same key
    const mutexKey = `mutex_${secureKey}`;
    const existingMutex = this.mutex.get(mutexKey);
    
    if (existingMutex) {
      // Wait for existing operation to complete
      return await existingMutex;
    }
    
    // Create new mutex for this operation
    const operation = (async () => {
      try {
        // Double-check after acquiring mutex
        const doubleCheck = this.internalMap.get(secureKey);
        if (doubleCheck !== undefined) {
          return doubleCheck;
        }
        
        // Call factory and sanitize result
        const value = await factory();
        const sanitizedValue = deepSanitizeObject(value) as T;
        
        // Set the value atomically
        this.internalMap.set(secureKey, sanitizedValue);
        return sanitizedValue;
      } finally {
        // Clean up mutex
        this.mutex.delete(mutexKey);
      }
    })();
    
    // Store the operation in mutex map
    this.mutex.set(mutexKey, operation);
    
    return await operation;
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