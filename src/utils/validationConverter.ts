import type { ParsedAdsTxtRecord } from '@miyaichi/ads-txt-validator';
import { createValidationMessage, configureMessages } from '@miyaichi/ads-txt-validator';
import type { ValidityResult, ValidationMessage } from '../hooks/useAdsSellers';

// Configure ads-txt-validator message system with baseURL for help links
configureMessages({
  defaultLocale: 'ja',
  baseUrl: 'https://adstxt-manager.jp',
});

/**
 * Create validation message from ads-txt-validator
 */
function createEnhancedValidationMessage(
  validationKey: string,
  placeholders: string[] = [],
  locale?: string
): ValidationMessage | null {
  const validationMessage = createValidationMessage(validationKey, placeholders, locale);

  if (validationMessage) {
    return {
      key: validationMessage.key,
      severity: validationMessage.severity as 'error' | 'warning' | 'info',
      message: validationMessage.message,
      description: validationMessage.description,
      helpUrl: validationMessage.helpUrl,
      placeholders: validationMessage.placeholders,
    };
  }

  return null;
}

/**
 * Get placeholders for ads-txt-validator validation keys
 * Maps validation keys to placeholder arrays in the order expected by ads-txt-validator:
 * ['domain', 'accountId', 'sellerDomain', 'accountType']
 */
function getPlaceholdersForValidationKey(
  validationKey: string,
  record: ParsedAdsTxtRecord,
  additionalParams?: Record<string, any>
): string[] {
  switch (validationKey) {
    case 'invalidDomain':
      // {{domain}} = placeholders[0]
      return [record.domain];
    case 'noSellersJson':
      // {{domain}} = placeholders[0]
      return [record.domain];
    case 'directAccountIdNotInSellersJson':
    case 'resellerAccountIdNotInSellersJson':
      // {{accountId}} = placeholders[1]
      return ['', record.account_id];
    case 'sellerIdNotUnique':
      // {{accountId}} = placeholders[1]
      return ['', record.account_id];
    case 'domainMismatch':
      // {{sellerDomain}} = placeholders[2]
      return ['', '', additionalParams?.sellerDomain || 'unknown'];
    case 'directNotPublisher':
    case 'resellerNotIntermediary':
      // {{accountType}} = placeholders[3] (if needed)
      return ['', record.account_id, '', additionalParams?.seller_type || 'unknown'];
    default:
      return [];
  }
}

/**
 * Convert ads-txt-validator parsed record to ValidityResult format
 * Handles both parsing errors and cross-check validation warnings
 */
export function convertToValidityResult(record: ParsedAdsTxtRecord): ValidityResult {
  const validationMessages: ValidationMessage[] = [];

  // Handle parsing errors first (these don't have validation_results)
  if (!record.is_valid && record.validation_key) {
    // Add enhanced validation message
    const enhancedMessage = createEnhancedValidationMessage(
      record.validation_key,
      getPlaceholdersForValidationKey(record.validation_key, record)
    );
    if (enhancedMessage) {
      validationMessages.push(enhancedMessage);
    }

    return {
      isVerified: false,
      reasons: [], // Keep empty for backward compatibility
      validationMessages,
    };
  }

  // Handle warnings (includes both parsing errors and cross-check validation results)
  if (record.has_warning && record.all_warnings) {
    // Add enhanced validation messages for all warnings
    record.all_warnings.forEach((warning) => {
      const enhancedMessage = createEnhancedValidationMessage(
        warning.key,
        getPlaceholdersForValidationKey(warning.key, record, warning.params)
      );
      if (enhancedMessage) {
        validationMessages.push(enhancedMessage);
      }
    });
  }

  return {
    isVerified: validationMessages.length === 0,
    reasons: [], // Keep empty for backward compatibility
    validationMessages: validationMessages.length > 0 ? validationMessages : undefined,
  };
}
