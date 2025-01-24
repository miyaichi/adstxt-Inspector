import React from 'react';
import type { SellerAnalysis } from '../../hooks/useAdsSellers';
import type { FetchAdsTxtResult } from '../../utils/fetchAdsTxt';

interface SummaryPanelProps {
  analyzing: boolean;
  adsTxtData: FetchAdsTxtResult | null;
  sellerAnalysis: SellerAnalysis[];
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({
  analyzing,
  adsTxtData,
  sellerAnalysis,
}) => {
  if (analyzing) {
    return (
      <div className="p-4">
        <div className="bg-blue-50 text-blue-700 p-4 rounded-lg">
          {chrome.i18n.getMessage('analyzing')}
        </div>
      </div>
    );
  }

  if (!adsTxtData || sellerAnalysis.length === 0) {
    return (
      <div className="p-4">
        <div className="bg-gray-50 text-gray-600 p-4 rounded-lg">
          {chrome.i18n.getMessage('no_data_available')}
        </div>
      </div>
    );
  }

  const totalAdsTxtEntries = adsTxtData.data.length;
  const totalSellersEntries = sellerAnalysis.reduce(
    (sum, analysis) => sum + (analysis.sellersJson?.data.length || 0),
    0
  );

  const ownerDomain = adsTxtData.variables?.ownerDomain || 'Not specified';
  const managerDomain = adsTxtData.variables?.managerDomain?.split(',')[0] || 'Not specified';

  const directEntries = adsTxtData.data.filter((entry) => entry.relationship === 'DIRECT');
  const resellerEntries = adsTxtData.data.filter((entry) => entry.relationship === 'RESELLER');

  const transactionPatterns = {
    ownerDirect: directEntries.filter((e) => e.domain === ownerDomain).length,
    ownerReseller: resellerEntries.filter((e) => e.domain === ownerDomain).length,
    managerDirect: directEntries.filter((e) => e.domain === managerDomain).length,
    managerReseller: resellerEntries.filter((e) => e.domain === managerDomain).length,
    otherDirect: directEntries.filter((e) => e.domain !== ownerDomain && e.domain !== managerDomain)
      .length,
    otherReseller: resellerEntries.filter(
      (e) => e.domain !== ownerDomain && e.domain !== managerDomain
    ).length,
  };

  return (
    <div className="p-4 space-y-4">
      {/* Basic Info Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-200 p-4">
          <h3 className="text-lg font-medium text-gray-900">{chrome.i18n.getMessage('summary_overview')}</h3>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 p-2 rounded-lg">
            <span className="font-medium">Total Ads.txt Entries:</span> {totalAdsTxtEntries}
          </div>
          <div className="bg-gray-50 p-2 rounded-lg">
            <span className="font-medium">Total Sellers.json Entries:</span> {totalSellersEntries}
          </div>
          <div className="bg-gray-50 p-2 rounded-lg">
            <span className="font-medium">Owner Domain:</span> {ownerDomain}
          </div>
          <div className="bg-gray-50 p-2 rounded-lg">
            <span className="font-medium">Manager Domain:</span> {managerDomain}
          </div>
        </div>
      </div>

      {/* Transaction Summary Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-200 p-4">
          <h3 className="text-lg font-medium text-gray-900">
            {chrome.i18n.getMessage('transaction_summary')}
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <span className="font-medium">Direct Relationships:</span> {directEntries.length}
          </div>
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <span className="font-medium">Reseller Relationships:</span> {resellerEntries.length}
          </div>
        </div>
      </div>

      {/* Transaction Patterns Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-200 p-4">
          <h3 className="text-lg font-medium text-gray-900">
            {chrome.i18n.getMessage('transaction_patterns')}
          </h3>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium">Owner Domain Transactions</h4>
            <div className="bg-blue-50 p-2 rounded">Direct: {transactionPatterns.ownerDirect}</div>
            <div className="bg-blue-50 p-2 rounded">
              Reseller: {transactionPatterns.ownerReseller}
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Manager Domain Transactions</h4>
            <div className="bg-green-50 p-2 rounded">
              Direct: {transactionPatterns.managerDirect}
            </div>
            <div className="bg-green-50 p-2 rounded">
              Reseller: {transactionPatterns.managerReseller}
            </div>
          </div>
          <div className="col-span-2 space-y-2">
            <h4 className="font-medium">Other Domain Transactions</h4>
            <div className="bg-yellow-50 p-2 rounded">
              Direct: {transactionPatterns.otherDirect}
            </div>
            <div className="bg-yellow-50 p-2 rounded">
              Reseller: {transactionPatterns.otherReseller}
            </div>
          </div>
        </div>
      </div>

      {/* Seller Analysis Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-200 p-4">
          <h3 className="text-lg font-medium text-gray-900">{chrome.i18n.getMessage('seller_type_analytics')}</h3>
        </div>
        <div className="p-4 space-y-4">
          {sellerAnalysis.map((analysis) => {
            const sellers = analysis.sellersJson?.data || [];
            const publisherCount = sellers.filter(
              (s) => s.seller_type?.toUpperCase() === 'PUBLISHER'
            ).length;
            const intermediaryCount = sellers.filter(
              (s) => s.seller_type?.toUpperCase() === 'INTERMEDIARY'
            ).length;
            const bothCount = sellers.filter((s) => s.seller_type?.toUpperCase() === 'BOTH').length;

            return (
              <div key={analysis.domain} className="bg-gray-50 p-4 rounded-lg">
                <div className="font-medium">{analysis.domain}</div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="bg-blue-50 p-2 rounded">Publishers: {publisherCount}</div>
                  <div className="bg-yellow-50 p-2 rounded">
                    Intermediaries: {intermediaryCount}
                  </div>
                  <div className="bg-green-50 p-2 rounded">Both: {bothCount}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
