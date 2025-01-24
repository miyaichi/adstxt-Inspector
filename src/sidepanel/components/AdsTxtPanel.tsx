import { AlertTriangle, Check, ExternalLink } from 'lucide-react';
import React from 'react';
import { ValidityResult } from '../../hooks/useAdsSellers';
import type { AdsTxt, FetchAdsTxtResult } from '../../utils/fetchAdsTxt';

interface AdsTxtPanelProps {
  analyzing: boolean;
  adsTxtData: FetchAdsTxtResult | null;
  isValidEntry: (domain: string, entry: AdsTxt) => ValidityResult;
}

interface GroupedEntries {
  [domain: string]: AdsTxt[];
}

export const AdsTxtPanel: React.FC<AdsTxtPanelProps> = ({
  analyzing,
  adsTxtData,
  isValidEntry,
}) => {
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

  // Group entries by domain
  const groupedEntries = adsTxtData.data.reduce<GroupedEntries>((acc, entry) => {
    if (!acc[entry.domain]) {
      acc[entry.domain] = [];
    }
    acc[entry.domain].push(entry);
    return acc;
  }, {});

  // Sort domains alphabetically
  const sortedDomains = Object.keys(groupedEntries).sort();

  // Check if any supported variables exist
  const hasVariables =
    adsTxtData.variables &&
    Object.values(adsTxtData.variables).some((value) => value !== undefined);

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

      {/* Ads.txt Section */}
      <div className="panel-section">
        <div className="panel-header flex items-center justify-between">
          <div className="info-item">
            {adsTxtData.adsTxtUrl} ({sortedDomains.length} domains, {adsTxtData.data.length}{' '}
            entries)
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
        {hasVariables && (
          <div className="info-grid p-4">
            {adsTxtData.variables.contact && (
              <div className="info-item">
                <span className="font-medium">Contact:</span> {adsTxtData.variables.contact}
              </div>
            )}
            {adsTxtData.variables.inventoryPartnerdomain && (
              <div className="info-item">
                <span className="font-medium">Inventory Partner Domain:</span>{' '}
                {adsTxtData.variables.inventoryPartnerdomain}
              </div>
            )}
            {adsTxtData.variables.managerDomain && (
              <div className="info-item">
                <span className="font-medium">Manager Domain:</span>{' '}
                {adsTxtData.variables.managerDomain}
              </div>
            )}
            {adsTxtData.variables.ownerDomain && (
              <div className="info-item">
                <span className="font-medium">Owner Domain:</span>{' '}
                {adsTxtData.variables.ownerDomain}
              </div>
            )}
            {adsTxtData.variables.subDomain && (
              <div className="info-item">
                <span className="font-medium">Sub Domain:</span> {adsTxtData.variables.subDomain}
              </div>
            )}
          </div>
        )}

        {/* Entries Section */}
        <div className="panel-content">
          {sortedDomains.map((domain) => (
            <div key={domain} className="space-y-2">
              <div className="info-item">
                {domain} ({groupedEntries[domain].length} entries)
              </div>
              <div className="space-y-2 ml-4">
                {groupedEntries[domain].map((entry, index) => {
                  const validity = isValidEntry(domain, entry);
                  return (
                    <div
                      key={`${domain}-${index}`}
                      className={`entry-card ${
                        validity.isValid
                          ? 'border-green-200 bg-green-50'
                          : 'border-red-200 bg-red-50'
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
                            <span
                              className={`tag ${entry.relationship === 'DIRECT' ? 'tag-blue' : 'tag-gray'}`}
                            >
                              {entry.relationship}
                            </span>
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
    </div>
  );
};
