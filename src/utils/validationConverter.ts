import type {
  ParsedAdsTxtRecord,
  CrossCheckValidationResult,
  VALIDATION_KEYS,
} from '@miyaichi/ads-txt-validator';
import type { ValidityResult } from '../hooks/useAdsSellers';

/**
 * Convert ads-txt-validator results to adstxt-Inspector ValidityResult format
 * This maintains compatibility with existing UI and error code system
 */
export function convertToValidityResult(
  record: ParsedAdsTxtRecord,
  ownerDomain?: string,
  managerDomains?: string[]
): ValidityResult {
  const reasons: { key: string; placeholders: string[] }[] = [];

  // Handle parsing errors first (these don't have validation_results)
  if (!record.is_valid && record.validation_key) {
    const errorKey = convertValidationKeyToErrorCode(record.validation_key, record.relationship);
    if (errorKey) {
      reasons.push({
        key: errorKey,
        placeholders: getPlaceholdersForError(errorKey, record),
      });
    }
    return { isVerified: false, reasons };
  }

  // Handle cross-check validation results
  if (record.validation_results) {
    const validationReasons = convertValidationResults(
      record,
      record.validation_results,
      ownerDomain,
      managerDomains
    );
    reasons.push(...validationReasons);
  }

  // Handle warnings
  if (record.has_warning && record.all_warnings) {
    const warningReasons = record.all_warnings.map((warning) => {
      const errorKey = convertValidationKeyToErrorCode(warning.key, record.relationship);
      return {
        key: errorKey || warning.key,
        placeholders: getPlaceholdersForError(errorKey || warning.key, record, warning.params),
      };
    });
    reasons.push(...warningReasons);
  }

  return {
    isVerified: reasons.length === 0,
    reasons,
  };
}

/**
 * Convert validation results to error codes
 */
function convertValidationResults(
  record: ParsedAdsTxtRecord,
  validationResult: CrossCheckValidationResult,
  ownerDomain?: string,
  managerDomains?: string[]
): Array<{ key: string; placeholders: string[] }> {
  const reasons: Array<{ key: string; placeholders: string[] }> = [];

  // Test Case 11 & 16: Does the advertising system have a sellers.json file?
  if (!validationResult.hasSellerJson) {
    const code = record.relationship === 'DIRECT' ? '12010' : '13010';
    reasons.push({
      key: `alert_${code}_missing_sellers_json`,
      placeholders: [record.domain],
    });
    return reasons; // Return early if no sellers.json
  }

  // Test Case 12 & 17: Does the sellers.json file have the publisher account ID?
  if (record.relationship === 'DIRECT' && !validationResult.directAccountIdInSellersJson) {
    reasons.push({
      key: 'error_12020_publisher_id_not_listed',
      placeholders: [record.account_id],
    });
    return reasons; // Return early if account ID not found
  }

  if (record.relationship === 'RESELLER' && !validationResult.resellerAccountIdInSellersJson) {
    reasons.push({
      key: 'error_13020_publisher_id_not_listed',
      placeholders: [record.account_id],
    });
    return reasons; // Return early if account ID not found
  }

  // Test Case 13: For DIRECT entries, does the sellers.json entry domain match?
  if (
    record.relationship === 'DIRECT' &&
    validationResult.directDomainMatchesSellerJsonEntry === false
  ) {
    reasons.push({
      key: 'alert_12030_domain_mismatch',
      placeholders: [validationResult.sellerData?.domain || 'unknown'],
    });
  }

  // Test Case 14: For DIRECT entries, is the seller_type PUBLISHER?
  if (record.relationship === 'DIRECT') {
    const sellerType = validationResult.sellerData?.seller_type;
    if (sellerType === 'BOTH') {
      reasons.push({
        key: 'alert_12040_relationship_type_both',
        placeholders: [],
      });
    } else if (sellerType === 'INTERMEDIARY') {
      reasons.push({
        key: 'alert_12050_relationship_mismatch',
        placeholders: [],
      });
    }
  }

  // Test Case 15: For DIRECT entries, is the seller_id unique?
  if (
    record.relationship === 'DIRECT' &&
    validationResult.directSellerIdIsUnique === false
  ) {
    reasons.push({
      key: 'error_12060_duplicate_seller_id',
      placeholders: [record.account_id],
    });
  }

  // Test Case 18: For RESELLER entries, does the sellers.json entry domain match?
  if (
    record.relationship === 'RESELLER' &&
    validationResult.resellerDomainMatchesSellerJsonEntry === false
  ) {
    reasons.push({
      key: 'alert_13030_domain_mismatch',
      placeholders: [validationResult.sellerData?.domain || 'unknown'],
    });
  }

  // Test Case 19: For RESELLER entries, is the seller_type INTERMEDIARY?
  if (record.relationship === 'RESELLER') {
    const sellerType = validationResult.sellerData?.seller_type;
    if (sellerType === 'BOTH') {
      reasons.push({
        key: 'alert_13040_relationship_type_both',
        placeholders: [],
      });
    } else if (sellerType === 'PUBLISHER') {
      reasons.push({
        key: 'error_13050_relationship_mismatch',
        placeholders: [],
      });
    }
  }

  // Test Case 20: For RESELLER entries, is the seller_id unique?
  if (
    record.relationship === 'RESELLER' &&
    validationResult.resellerSellerIdIsUnique === false
  ) {
    reasons.push({
      key: 'alert_13060_duplicate_seller_id',
      placeholders: [record.account_id],
    });
  }

  // Additional checks for OWNERDOMAIN and MANAGERDOMAIN
  if (validationResult.sellerData?.domain && ownerDomain && managerDomains) {
    const sellerDomain = validationResult.sellerData.domain;
    const isOwnerDomain = sellerDomain === ownerDomain;
    const isManagerDomain = managerDomains.some(
      (domain) => domain.split(',')[0] === sellerDomain
    );

    if (isOwnerDomain && isManagerDomain) {
      reasons.push({
        key: 'alert_inventory_from_both_domains',
        placeholders: [],
      });
    }
  }

  return reasons;
}

/**
 * Convert ads-txt-validator validation keys to adstxt-Inspector error codes
 */
function convertValidationKeyToErrorCode(
  validationKey: string,
  relationship: 'DIRECT' | 'RESELLER'
): string | null {
  // This is a mapping from ads-txt-validator keys to existing error codes
  const keyMappings: Record<string, string> = {
    missingFields: 'error_11010_missing_required_fields',
    invalidFormat: 'error_11010_missing_required_fields',
    invalidRelationship: 'error_11020_invalid_relationship',
    invalidDomain: 'error_11030_invalid_domain',
    emptyAccountId: 'error_11010_missing_required_fields',
    emptyFile: 'error_11040_empty_file',
    invalidCharacters: 'error_11050_invalid_characters',
    noSellersJson: relationship === 'DIRECT' ? 'alert_12010_missing_sellers_json' : 'alert_13010_missing_sellers_json',
    directAccountIdNotInSellersJson: 'error_12020_publisher_id_not_listed',
    resellerAccountIdNotInSellersJson: 'error_13020_publisher_id_not_listed',
    domainMismatch: relationship === 'DIRECT' ? 'alert_12030_domain_mismatch' : 'alert_13030_domain_mismatch',
    directNotPublisher: 'alert_12050_relationship_mismatch',
    sellerIdNotUnique: relationship === 'DIRECT' ? 'error_12060_duplicate_seller_id' : 'alert_13060_duplicate_seller_id',
    resellerNotIntermediary: 'error_13050_relationship_mismatch',
    implimentedEntry: 'duplicate_entries', // For duplicate warnings
  };

  return keyMappings[validationKey] || null;
}

/**
 * Get placeholders for error messages
 */
function getPlaceholdersForError(
  errorKey: string,
  record: ParsedAdsTxtRecord,
  additionalParams?: Record<string, any>
): string[] {
  // Extract placeholders based on error key
  if (errorKey.includes('missing_sellers_json')) {
    return [record.domain];
  }
  
  if (errorKey.includes('publisher_id_not_listed') || errorKey.includes('duplicate_seller_id')) {
    return [record.account_id];
  }
  
  if (errorKey.includes('domain_mismatch')) {
    return [additionalParams?.seller_domain || record.domain];
  }
  
  if (errorKey.includes('invalid_domain')) {
    return [record.domain];
  }

  return [];
}