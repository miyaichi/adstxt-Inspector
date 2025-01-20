import React from 'react';
import type { AdsTxt, FetchAdsTxtResult } from '../../utils/fetchAdsTxt';

interface AdsTxtPanelProps {
  analyzing: boolean;
  adsTxtData: FetchAdsTxtResult | null;
  isValidEntry: (domain: string, publisherId: string) => boolean;
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
        <div className="bg-blue-50 text-blue-700 p-4 rounded-lg">Analyzing Ads.txt...</div>
      </div>
    );
  }

  if (!adsTxtData) {
    return (
      <div className="p-4">
        <div className="bg-gray-50 text-gray-600 p-4 rounded-lg">No Ads.txt data available</div>
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

  return (
    <div className="p-4 space-y-4">
      {/* Errors Section */}
      {adsTxtData.errors.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="border-b border-gray-200 p-4">
            <h3 className="text-lg font-medium text-red-600">
              Errors Found ({adsTxtData.errors.length})
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {adsTxtData.errors.map((error, index) => (
              <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-red-700">
                  Line {error.line}: {error.message}
                </div>
                {error.content && (
                  <div className="mt-2 font-mono text-sm bg-red-900 text-white p-2 rounded">
                    {error.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entries Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-200 p-4">
          <h3 className="text-lg font-medium text-gray-900">
            Entries by Domain ({sortedDomains.length} domains, {adsTxtData.data.length} entries)
          </h3>
        </div>
        <div className="p-4 space-y-4">
          {sortedDomains.map((domain) => (
            <div key={domain} className="space-y-2">
              <div className="font-medium text-gray-900 px-3 py-2 bg-gray-50 rounded-lg">
                {domain} ({groupedEntries[domain].length} entries)
              </div>
              <div className="space-y-2 ml-4">
                {groupedEntries[domain].map((entry, index) => {
                  const isValid = isValidEntry(domain, entry.publisherId);
                  return (
                    <div
                      key={`${domain}-${index}`}
                      className={`p-3 rounded-lg border ${
                        isValid ? 'border-green-200 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
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
                            className={`px-2 py-1 rounded ${
                              entry.relationship === 'DIRECT'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {entry.relationship}
                          </span>
                          {isValid && (
                            <svg
                              className="w-5 h-5 text-green-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
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
