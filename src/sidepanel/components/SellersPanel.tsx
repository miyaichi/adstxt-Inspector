import { Check, CircleAlert, Download, ExternalLink } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import type { SellerAnalysis } from '../../hooks/useAdsSellers';
import type { FetchAdsTxtResult } from '../../utils/fetchAdsTxt';
import { DownloadCsvSellersJson } from './DownloadSellersJson';
import { SearchAndFilter } from './SearchAndFilter';
import { Tooltip } from './Tooltip';

interface SellersPanelProps {
  analyzing: boolean;
  sellerAnalysis: SellerAnalysis[];
  adsTxtData: FetchAdsTxtResult | null;
}

export const SellersPanel: React.FC<SellersPanelProps> = ({
  analyzing,
  sellerAnalysis,
  adsTxtData,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    sellerType: '',
    confidential: '',
    passthrough: '',
  });

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

              return matchesSearch && matchesType && matchesConfidential && matchesPassthrough;
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
  }, [sellerAnalysis, searchTerm, selectedDomain, selectedFilters]);

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
                    {analysis.sellersJson?.data.map((seller, index) => (
                      <div key={`${seller.seller_id}-${index}`} className="entry-card">
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
                            </div>
                          </div>
                          {seller.comment && <div className="text-gray-500">{seller.comment}</div>}
                          {seller.domain != null &&
                            seller.domain === adsTxtData?.variables?.ownerDomain &&
                            (seller.seller_type?.toUpperCase() === 'PUBLISHER' ||
                              seller.seller_type?.toUpperCase() === 'BOTH') && (
                              <div className="flex items-center space-x-1 text-green-600">
                                <Check className="w-4 h-4" />
                                <span>{chrome.i18n.getMessage('matches_owner_domain')}</span>
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
