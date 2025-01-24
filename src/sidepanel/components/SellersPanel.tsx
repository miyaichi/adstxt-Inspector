import { AlertTriangle, Check, ExternalLink } from 'lucide-react';
import React from 'react';
import type { SellerAnalysis } from '../../hooks/useAdsSellers';
import type { FetchAdsTxtResult } from '../../utils/fetchAdsTxt';

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
  if (analyzing) {
    return (
      <div className="p-4">
        <div className="bg-blue-50 text-blue-700 p-4 rounded-lg">
          {chrome.i18n.getMessage('analyzing_sellers_json')}
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
      <div className="space-y-4">
        {sellerAnalysis.map((analysis) => (
          <div key={analysis.domain} className="panel-section">
            <div className="panel-header flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="info-item">
                  {analysis.domain} ({analysis.sellersJson?.data.length || 0} entries)
                </div>
                {analysis.domain === adsTxtData?.variables?.ownerDomain && (
                  <span className="tag tag-blue">Owner Domain</span>
                )}
                {analysis.domain === adsTxtData?.variables?.managerDomain?.split(',')[0] && (
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
                  <AlertTriangle className="w-5 h-5" />
                  <span>{analysis.sellersJson.error}</span>
                </div>
              ) : analysis.sellersJson?.data.length === 0 ? (
                <div className="alert alert-warning">
                  <AlertTriangle className="w-5 h-5" />
                  <span>{chrome.i18n.getMessage('no_matching_entries_found')}</span>
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
                              <span
                                className={`tag ${
                                  ['PUBLISHER', 'BOTH'].includes(seller.seller_type.toUpperCase())
                                    ? 'tag-blue'
                                    : 'tag-gray'
                                }`}
                              >
                                {seller.seller_type.toUpperCase()}
                              </span>
                            )}
                            {seller.is_confidential === 1 && (
                              <span className="tag tag-yellow">Confidential</span>
                            )}
                            {seller.is_passthrough === 1 && (
                              <span className="tag tag-purple">Passthrough</span>
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
  );
};
