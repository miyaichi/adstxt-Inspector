import { AlertTriangle, Check, ExternalLink } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import type { ValidityResult } from '../../hooks/useAdsSellers';
import type { AdsTxt, FetchAdsTxtResult } from '../../utils/fetchAdsTxt';
import { SearchAndFilter } from './SearchAndFilter';
import { Tooltip } from './Tooltip';

interface AdsTxtPanelProps {
  analyzing: boolean;
  adsTxtData: FetchAdsTxtResult | null;
  isValidEntry: (domain: string, entry: AdsTxt) => ValidityResult;
}

export const AdsTxtPanel: React.FC<AdsTxtPanelProps> = ({
  analyzing,
  adsTxtData,
  isValidEntry,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    relationship: '',
    validity: '',
  });

  // Filter options definition
  const filters = {
    relationship: {
      label: 'Relationship',
      options: [
        { value: 'DIRECT', label: 'DIRECT' },
        { value: 'RESELLER', label: 'RESELLER' },
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

  // Entry memoized processed
  const { filteredEntries, domains, totalEntries, filteredCount } = useMemo(() => {
    if (!adsTxtData) {
      return {
        filteredEntries: {},
        domains: [],
        totalEntries: 0,
        filteredCount: 0,
      };
    }

    const totalEntries = adsTxtData.data.length;

    // Group by domain
    const grouped = adsTxtData.data.reduce(
      (acc, entry) => {
        if (!acc[entry.domain]) {
          acc[entry.domain] = [];
        }
        acc[entry.domain].push(entry);
        return acc;
      },
      {} as Record<string, AdsTxt[]>
    );

    // Filter and apply search
    const filtered = Object.entries(grouped).reduce(
      (acc, [domain, entries]) => {
        // Domain filter
        if (selectedDomain && domain !== selectedDomain) {
          return acc;
        }

        // Entry filtering
        const filteredEntries = entries.filter((entry) => {
          // Search filter
          const matchesSearch = searchTerm
            ? entry.publisherId.toLowerCase().includes(searchTerm.toLowerCase()) ||
              entry.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (entry.certificationAuthorityId || '')
                .toLowerCase()
                .includes(searchTerm.toLowerCase())
            : true;

          // Relationship filter
          const matchesRelationship = selectedFilters.relationship
            ? entry.relationship === selectedFilters.relationship
            : true;

          // Validity filter
          const validity = isValidEntry(domain, entry);
          const matchesValidity = selectedFilters.validity
            ? (selectedFilters.validity === 'valid') === validity.isValid
            : true;

          return matchesSearch && matchesRelationship && matchesValidity;
        });

        if (filteredEntries.length > 0) {
          acc[domain] = filteredEntries;
        }

        return acc;
      },
      {} as Record<string, AdsTxt[]>
    );

    const filteredCount = Object.values(filtered).reduce((sum, entries) => sum + entries.length, 0);

    return {
      filteredEntries: filtered,
      domains: Object.keys(grouped).sort(),
      totalEntries,
      filteredCount,
    };
  }, [adsTxtData, searchTerm, selectedDomain, selectedFilters, isValidEntry]);

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
          {chrome.i18n.getMessage('analyzing_ads_txt')}
        </div>
      </div>
    );
  }

  if (!adsTxtData) {
    return (
      <div className="p-4">
        <div className="bg-gray-50 text-gray-600 p-4 rounded-lg">
          {chrome.i18n.getMessage('no_ads_txt_data')}
        </div>
      </div>
    );
  }

  return (
    <div className="panel-container">
      {/* Errors Section */}
      {adsTxtData.errors.length > 0 && (
        <div className="panel-section">
          <div className="panel-header">
            <h3 className="panel-header-title text-red-600">
              Errors Found ({adsTxtData.errors.length})
            </h3>
          </div>
          <div className="panel-content">
            {adsTxtData.errors.map((error, index) => (
              <div key={index} className="alert alert-error">
                <div>
                  Line {error.line}: {error.message}
                </div>
                {error.content && (
                  <div className="mt-2 font-mono bg-red-900 text-white p-2 rounded">
                    {error.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ads.txt Header */}
      <div className="panel-section">
        <div className="panel-header flex items-center justify-between">
          <div className="info-item">
            {adsTxtData.adsTxtUrl} ({domains.length} domains, {adsTxtData.data.length} entries)
          </div>
          <a
            href={adsTxtData.adsTxtUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            <span>View Raw</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Supported Variables Section */}
        {adsTxtData.variables &&
          Object.values(adsTxtData.variables).some((value) => value !== undefined) && (
            <div className="info-grid p-4">
              <div className="flex flex-col space-y-2">
                {adsTxtData.variables.contact && (
                  <Tooltip content={chrome.i18n.getMessage('contact')}>
                    <span className="font-medium">Contact: {adsTxtData.variables.contact}</span>
                  </Tooltip>
                )}
                {adsTxtData.variables.inventoryPartnerdomain && (
                  <Tooltip content={chrome.i18n.getMessage('inventorypartnerdomain')}>
                    <span className="font-medium">
                      Inventory Partner Domain: {adsTxtData.variables.inventoryPartnerdomain}
                    </span>
                  </Tooltip>
                )}
                {adsTxtData.variables.managerDomain && (
                  <Tooltip content={chrome.i18n.getMessage('managerdomain')}>
                    <span className="font-medium">
                      Manager Domain: {adsTxtData.variables.managerDomain}
                    </span>
                  </Tooltip>
                )}
                {adsTxtData.variables.ownerDomain && (
                  <Tooltip content={chrome.i18n.getMessage('ownerdomain')}>
                    <span className="font-medium">
                      Owner Domain: {adsTxtData.variables.ownerDomain}
                    </span>
                  </Tooltip>
                )}
                {adsTxtData.variables.subDomain && (
                  <Tooltip content={chrome.i18n.getMessage('subdomain')}>
                    <span className="font-medium">
                      Sub Domain: {adsTxtData.variables.subDomain}
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
          )}
      </div>

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
        placeholder="Search by Publisher ID, Domain, or TAG-ID..."
        showResultCount={true}
        totalResults={totalEntries}
        filteredResults={filteredCount}
      />

      {/* Entries Display */}
      <div className="panel-section space-y-4">
        {Object.entries(filteredEntries).map(([domain, entries]) => (
          <div key={domain} className="space-y-2">
            <div className="info-item flex items-center justify-between">
              <div>
                {domain} ({entries.length} entries)
              </div>
              <div className="text-sm text-gray-500">
                {((entries.length / totalEntries) * 100).toFixed(1)}% of total
              </div>
            </div>
            <div className="space-y-2 ml-4">
              {entries.map((entry, index) => {
                const validity = isValidEntry(domain, entry);
                return (
                  <div
                    key={`${domain}-${index}`}
                    className={`entry-card ${
                      validity.isValid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="entry-card-content">
                      <div className="entry-card-header">
                        <div>
                          <div className="text-gray-600">Publisher ID: {entry.publisherId}</div>
                          {entry.certificationAuthorityId && (
                            <div className="text-gray-500">
                              TAG-ID: {entry.certificationAuthorityId}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Tooltip
                            content={
                              entry.relationship === 'DIRECT'
                                ? chrome.i18n.getMessage('direct')
                                : chrome.i18n.getMessage('reseller')
                            }
                          >
                            <span
                              className={`tag ${
                                entry.relationship === 'DIRECT' ? 'tag-blue' : 'tag-gray'
                              }`}
                            >
                              {entry.relationship}
                            </span>
                          </Tooltip>

                          {validity.isValid ? (
                            <Check className="w-5 h-5 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      </div>
                      {!validity.isValid && validity.reasons.length > 0 && (
                        <div className="flex flex-col text-red-600 space-y-1">
                          {validity.reasons.map((reason, idx) => (
                            <span key={idx}>{reason}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
