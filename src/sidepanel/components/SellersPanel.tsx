import { Check, CircleAlert, Download, ExternalLink } from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';
import type { SellerAnalysis, ValidityResult } from '../../hooks/useAdsSellers';
import type { FetchAdsTxtResult } from '../../utils/fetchAdsTxt';
import { ValidationManager, type ValidationProgress } from '../../utils/ValidationManager';
import { DownloadCsvSellersJson } from './DownloadSellersJson';
import { SearchAndFilter } from './SearchAndFilter';
import { Tooltip } from './Tooltip';

interface SellersPanelProps {
  analyzing: boolean;
  sellerAnalysis: SellerAnalysis[];
  adsTxtData: FetchAdsTxtResult | null;
  isVerifiedEntry: (domain: string, entry: any) => ValidityResult;
}

export const SellersPanel: React.FC<SellersPanelProps> = ({
  analyzing,
  sellerAnalysis,
  adsTxtData,
  isVerifiedEntry,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    sellerType: '',
    confidential: '',
    passthrough: '',
    validity: '',
  });

  // State for async validation
  const [validationResults, setValidationResults] = useState<Map<string, ValidityResult>>(new Map());
  const [validationProgress, setValidationProgress] = useState<ValidationProgress | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Filter options definition
  const filters = {
    sellerType: {
      label: 'Seller Type',
      options: [
        { value: 'PUBLISHER', label: 'Publisher' },
        { value: 'INTERMEDIARY', label: 'Intermediary' },
        { value: 'BOTH', label: 'Both' },
      ],
    },
    confidential: {
      label: 'Confidential',
      options: [
        { value: '1', label: 'Yes' },
        { value: '0', label: 'No' },
      ],
    },
    passthrough: {
      label: 'Passthrough',
      options: [
        { value: '1', label: 'Yes' },
        { value: '0', label: 'No' },
      ],
    },
    validity: {
      label: 'Validity',
      options: [
        { value: 'valid', label: 'VALID' },
        { value: 'invalid', label: 'INVALID' },
      ],
    },
  };

  // Effect to handle async validation for sellers
  useEffect(() => {
    if (!adsTxtData?.data || sellerAnalysis.length === 0) {
      setValidationResults(new Map());
      setValidationProgress(null);
      setIsValidating(false);
      return;
    }

    const performValidation = async () => {
      setIsValidating(true);
      
      // Create validation requests for sellers that have matching ads.txt entries
      const requests: Array<{ domain: string; entry: any; requestId: string }> = [];
      
      sellerAnalysis.forEach((analysis) => {
        if (analysis.sellersJson?.data) {
          analysis.sellersJson.data.forEach((seller, index) => {
            // Find matching ads.txt entries for this seller
            const matchingAdsTxtEntries = adsTxtData.data.filter(
              (adsTxtEntry) => 
                adsTxtEntry.domain === analysis.domain && 
                String(adsTxtEntry.publisherId) === String(seller.seller_id)
            );
            
            // If we found matching ads.txt entries, create validation requests
            matchingAdsTxtEntries.forEach((adsTxtEntry, adsTxtIndex) => {
              requests.push({
                domain: analysis.domain,
                entry: adsTxtEntry,
                requestId: `${analysis.domain}-${seller.seller_id}-${index}-${adsTxtIndex}`
              });
            });
          });
        }
      });

      if (requests.length === 0) {
        setIsValidating(false);
        setValidationProgress(null);
        return;
      }

      setValidationProgress({ total: requests.length, completed: 0, inProgress: 0, failed: 0 });
      
      try {
        const validationManager = ValidationManager.getInstance();
        
        // Perform batch validation with progress updates
        const validationResults = await validationManager.validateEntries(
          requests,
          adsTxtData,
          isVerifiedEntry, // Fallback function
          (progress) => {
            setValidationProgress(progress);
          }
        );
        
        // Convert results to map for fast lookup
        const resultsMap = new Map<string, ValidityResult>();
        validationResults.forEach((result) => {
          const key = `${result.domain}-${result.entry.publisherId}`;
          resultsMap.set(key, result.result);
        });
        
        setValidationResults(resultsMap);
        
      } catch (error) {
        console.error('SellersPanel: Validation failed, falling back to sync:', error);
        
        // Fallback to sync validation
        const resultsMap = new Map<string, ValidityResult>();
        requests.forEach(({ domain, entry }) => {
          const key = `${domain}-${entry.publisherId}`;
          const result = isVerifiedEntry(domain, entry);
          resultsMap.set(key, result);
        });
        setValidationResults(resultsMap);
      } finally {
        setIsValidating(false);
        setValidationProgress(null);
      }
    };

    performValidation();
  }, [adsTxtData?.adsTxtUrl, adsTxtData?.data?.length, sellerAnalysis]);

  // Smart validation result getter for sellers
  const getSellerValidationResult = (domain: string, sellerId: string): ValidityResult | null => {
    const key = `${domain}-${sellerId}`;
    const result = validationResults.get(key);
    
    if (result) {
      return result;
    }
    
    // If validation is in progress, show loading state
    if (isValidating) {
      return { isVerified: false, reasons: [{ key: 'validating', placeholders: [] }] };
    }
    
    // No validation result available (seller doesn't have matching ads.txt entry)
    return null;
  };

  // Process and filter sellers data
  const { filteredSellers, domains, totalEntries, filteredCount } = useMemo(() => {
    if (sellerAnalysis.length === 0) {
      return {
        filteredSellers: [],
        domains: [],
        totalEntries: 0,
        filteredCount: 0,
      };
    }

    const domains = sellerAnalysis.map((analysis) => analysis.domain);
    const totalEntries = sellerAnalysis.reduce(
      (sum, analysis) => sum + (analysis.sellersJson?.data?.length || 0),
      0
    );

    const filtered = sellerAnalysis
      .filter((analysis) => !selectedDomain || analysis.domain === selectedDomain)
      .map((analysis) => ({
        ...analysis,
        sellersJson: {
          ...analysis.sellersJson,
          data:
            analysis.sellersJson?.data.filter((seller) => {
              // Search filter
              const matchesSearch = searchTerm
                ? seller.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  String(seller.seller_id)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  seller.domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  seller.comment?.toLowerCase().includes(searchTerm.toLowerCase())
                : true;

              // Seller type filter
              const matchesType = selectedFilters.sellerType
                ? seller.seller_type?.toUpperCase() === selectedFilters.sellerType
                : true;

              // Confidential filter
              const matchesConfidential = selectedFilters.confidential
                ? seller.is_confidential?.toString() === selectedFilters.confidential
                : true;

              // Passthrough filter
              const matchesPassthrough = selectedFilters.passthrough
                ? seller.is_passthrough?.toString() === selectedFilters.passthrough
                : true;

              // Validity filter (based on ads.txt cross-check validation)
              const validationResult = getSellerValidationResult(analysis.domain, String(seller.seller_id));
              const matchesValidity = selectedFilters.validity
                ? validationResult 
                  ? (selectedFilters.validity === 'valid') === validationResult.isVerified
                  : selectedFilters.validity === 'valid' // No validation = considered valid
                : true;

              return matchesSearch && matchesType && matchesConfidential && matchesPassthrough && matchesValidity;
            }) || [],
        },
      }))
      .filter((analysis) => analysis.sellersJson?.data.length > 0);

    const filteredCount = filtered.reduce(
      (sum, analysis) => sum + analysis.sellersJson.data.length,
      0
    );

    return {
      filteredSellers: filtered,
      domains,
      totalEntries,
      filteredCount,
    };
  }, [sellerAnalysis, searchTerm, selectedDomain, selectedFilters, validationResults, isValidating]);

  const handleFilterChange = (filterKey: string, value: string) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [filterKey]: value,
    }));
  };

  if (analyzing) {
    return (
      <div className="p-4">
        <div className="bg-blue-50 text-blue-700 p-4 rounded-lg">
          {chrome.i18n.getMessage('analyzing_file', ['Sellers.json'])}
        </div>
      </div>
    );
  }

  if (adsTxtData?.fetchError) {
    return (
      <div className="p-4">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          <div className="font-semibold mb-2">
            {chrome.i18n.getMessage('error_fetching_file', ['Ads.txt'])}:
          </div>
          <div>{chrome.i18n.getMessage(adsTxtData.fetchError) || adsTxtData.fetchError}</div>
        </div>
      </div>
    );
  }

  if (sellerAnalysis.length === 0) {
    return (
      <div className="p-4">
        <div className="bg-gray-50 text-gray-600 p-4 rounded-lg">
          {chrome.i18n.getMessage('no_seller_json_data')}
        </div>
      </div>
    );
  }

  return (
    <div className="panel-container">
      {/* Validation Progress */}
      {isValidating && validationProgress && (
        <div className="panel-section">
          <div className="panel-header">
            <h3 className="panel-header-title">Cross-Check Validation Progress</h3>
          </div>
          <div className="panel-content">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Validating sellers with ads.txt entries...</span>
                <span>{validationProgress.completed} / {validationProgress.total} ({Math.round((validationProgress.completed / validationProgress.total) * 100)}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500 flex items-center justify-center text-xs text-white font-medium"
                  style={{ 
                    width: `${Math.max(5, (validationProgress.completed / validationProgress.total) * 100)}%`,
                    minWidth: validationProgress.completed > 0 ? '20px' : '0'
                  }}
                >
                  {validationProgress.completed > 0 && Math.round((validationProgress.completed / validationProgress.total) * 100) + '%'}
                </div>
              </div>
              {validationProgress.failed > 0 && (
                <div className="text-sm text-red-600">
                  {validationProgress.failed} validations failed
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="panel-section">
        <div className="panel-header">
          <div className="flex justify-end">
            <DownloadCsvSellersJson
              domain={adsTxtData?.variables?.ownerDomain || ''}
              sellerAnalysis={sellerAnalysis}
            >
              <span>Download CSV</span>
              <Download className="w-4 h-4" />
            </DownloadCsvSellersJson>
          </div>
        </div>
        <div className="panel-container">
        {/* Search and Filter Component */}
        <SearchAndFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedDomain={selectedDomain}
          onDomainChange={setSelectedDomain}
          domains={domains}
          filters={filters}
          selectedFilters={selectedFilters}
          onFilterChange={handleFilterChange}
          placeholder="Search by Name, Seller ID, Domain, or Comment..."
          showResultCount={true}
          totalResults={totalEntries}
          filteredResults={filteredCount}
        />

        <div className="space-y-4">
          {filteredSellers.map((analysis) => (
            <div key={analysis.domain} className="panel-section">
              <div className="panel-header flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="info-item">
                    {analysis.domain} ({analysis.sellersJson?.data.length || 0} entries)
                  </div>
                  {analysis.domain === adsTxtData?.variables?.ownerDomain && (
                    <span className="tag tag-blue">Owner Domain</span>
                  )}
                  {adsTxtData?.variables?.managerDomains?.includes(analysis.domain) && (
                    <span className="tag tag-blue">Manager Domain</span>
                  )}
                </div>
                <a
                  href={`https://${analysis.domain}/sellers.json`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  <span>View Raw</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="panel-content">
                {analysis.sellersJson?.error ? (
                  <div className="alert alert-error">
                    <CircleAlert className="w-5 h-5" />
                    <span>{analysis.sellersJson.error}</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {analysis.sellersJson?.data.map((seller, index) => {
                      const validationResult = getSellerValidationResult(analysis.domain, String(seller.seller_id));
                      const isSellerValidating = isValidating && validationResult?.reasons.some(r => r.key === 'validating');
                      
                      return (
                        <div 
                          key={`${seller.seller_id}-${index}`} 
                          className={`entry-card ${
                            validationResult 
                              ? isSellerValidating
                                ? 'border-blue-200 bg-blue-50'
                                : validationResult.isVerified
                                  ? 'border-green-200 bg-green-50'
                                  : validationResult.reasons.some((reason) => reason.key.startsWith('error_'))
                                    ? 'border-red-200 bg-red-50'
                                    : 'border-yellow-200 bg-yellow-50'
                              : ''
                          }`}
                        >
                          <div className="entry-card-content">
                            <div className="entry-card-header">
                              <div>
                                <div className="font-medium text-gray-900">{seller.name}</div>
                                <div className="text-gray-600">Seller ID: {seller.seller_id}</div>
                                {seller.domain && (
                                  <div className="text-gray-500">Domain: {seller.domain}</div>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                {seller.seller_type && (
                                  <Tooltip
                                    content={
                                      seller.seller_type === 'PUBLISHER'
                                        ? chrome.i18n.getMessage('publisher')
                                        : seller.seller_type === 'INTERMEDIARY'
                                          ? chrome.i18n.getMessage('intermediary')
                                          : chrome.i18n.getMessage('both')
                                    }
                                  >
                                    <span
                                      className={`tag ${
                                        ['PUBLISHER', 'BOTH'].includes(
                                          seller.seller_type.toUpperCase()
                                        )
                                          ? 'tag-blue'
                                          : 'tag-gray'
                                      }`}
                                    >
                                      {seller.seller_type.toUpperCase()}
                                    </span>
                                  </Tooltip>
                                )}
                                {seller.is_confidential === 1 && (
                                  <Tooltip content={chrome.i18n.getMessage('confidential')}>
                                    <span className="tag tag-yellow">Confidential</span>
                                  </Tooltip>
                                )}
                                {seller.is_passthrough === 1 && (
                                  <Tooltip content={chrome.i18n.getMessage('passthrough')}>
                                    <span className="tag tag-purple">Passthrough</span>
                                  </Tooltip>
                                )}
                                
                                {/* Cross-check validation status */}
                                {validationResult ? (
                                  isSellerValidating ? (
                                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                  ) : validationResult.isVerified ? (
                                    <Tooltip content="Cross-check validation passed">
                                      <Check className="w-5 h-5 text-green-500" />
                                    </Tooltip>
                                  ) : (
                                    <Tooltip content="Cross-check validation failed">
                                      <CircleAlert className="w-5 h-5 text-red-500" />
                                    </Tooltip>
                                  )
                                ) : (
                                  <Tooltip content="No matching ads.txt entry found">
                                    <span className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 text-xs">?</span>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                            
                            {/* Cross-check validation results */}
                            {validationResult && !validationResult.isVerified && validationResult.reasons.length > 0 && (
                              <div className={`flex flex-col space-y-1 mt-2 ${
                                isSellerValidating ? 'text-blue-600' : 'text-red-600'
                              }`}>
                                {validationResult.reasons.map((reason, idx) => (
                                  <span key={idx} className="text-sm">
                                    {reason.key === 'validating' 
                                      ? 'Validating cross-check...'
                                      : chrome.i18n.getMessage(reason.key, reason.placeholders)
                                        ? chrome.i18n.getMessage(reason.key, reason.placeholders)
                                        : reason.key
                                    }
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            {seller.comment && <div className="text-gray-500 mt-2">{seller.comment}</div>}
                            {seller.domain != null &&
                              seller.domain === adsTxtData?.variables?.ownerDomain &&
                              (seller.seller_type?.toUpperCase() === 'PUBLISHER' ||
                                seller.seller_type?.toUpperCase() === 'BOTH') && (
                                <div className="flex items-center space-x-1 text-green-600 mt-2">
                                  <Check className="w-4 h-4" />
                                  <span>{chrome.i18n.getMessage('matches_owner_domain')}</span>
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
};
