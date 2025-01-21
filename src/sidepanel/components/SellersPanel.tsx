import { ExternalLink } from 'lucide-react';
import React from 'react';
import type { SellerAnalysis } from '../../hooks/useAdsSellers';

interface SellersPanelProps {
  analyzing: boolean;
  sellerAnalysis: SellerAnalysis[];
}

export const SellersPanel: React.FC<SellersPanelProps> = ({ analyzing, sellerAnalysis }) => {
  if (analyzing) {
    return (
      <div className="p-4">
        <div className="bg-blue-50 text-blue-700 p-4 rounded-lg">Analyzing Sellers.json...</div>
      </div>
    );
  }

  if (sellerAnalysis.length === 0) {
    return (
      <div className="p-4">
        <div className="bg-gray-50 text-gray-600 p-4 rounded-lg">
          No Sellers.json data available
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-4">
        {sellerAnalysis.map((analysis) => (
          <div key={analysis.domain} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="font-medium text-gray-900 px-3 py-2 bg-gray-50 rounded-lg">
                  {analysis.domain} ({analysis.sellersJson?.data.length || 0} entries)
                </div>
              </div>
              <a
                href={`https://${analysis.domain}/sellers.json`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              >
                <span>View Raw</span>
                <ExternalLink />
              </a>
            </div>
            <div className="p-4">
              {analysis.sellersJson?.error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                  {analysis.sellersJson.error}
                </div>
              ) : analysis.sellersJson?.data.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700">
                  No matching entries found in sellers.json
                </div>
              ) : (
                <div className="space-y-4">
                  {analysis.sellersJson?.data.map((seller, index) => (
                    <div
                      key={`${seller.seller_id}-${index}`}
                      className="p-3 rounded-lg border border-green-200 bg-green-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{seller.name}</div>
                          <div className="text-gray-600">Seller ID: {seller.seller_id}</div>
                          {seller.domain && (
                            <div className="text-gray-500">Domain: {seller.domain}</div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {seller.seller_type && (
                            <span className="px-2 py-1 rounded bg-gray-100 text-gray-800">
                              {seller.seller_type.toUpperCase()}
                            </span>
                          )}
                          {seller.is_confidential === 1 && (
                            <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                              Confidential
                            </span>
                          )}
                          {seller.is_passthrough === 1 && (
                            <span className="px-2 py-1 rounded bg-purple-100 text-purple-800">
                              Passthrough
                            </span>
                          )}
                        </div>
                      </div>
                      {seller.comment && <div className="mt-2 text-gray-500">{seller.comment}</div>}
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
