import { AlertTriangle } from 'lucide-react';
import React, { useMemo } from 'react';
import type { SellerAnalysis, ValidityResult } from '../../hooks/useAdsSellers';
import type { AdsTxt, FetchAdsTxtResult } from '../../utils/fetchAdsTxt';
import { Tooltip } from './Tooltip';

interface SummaryPanelProps {
  analyzing: boolean;
  checksAppAdsTxt: boolean;
  adsTxtData: FetchAdsTxtResult | null;
  sellerAnalysis: SellerAnalysis[];
  isVerifiedEntry: (domain: string, entry: AdsTxt) => ValidityResult;
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({
  analyzing,
  checksAppAdsTxt,
  adsTxtData,
  sellerAnalysis,
  isVerifiedEntry,
}) => {
  const analysis = useMemo(() => {
    if (!adsTxtData || sellerAnalysis.length === 0) return null;

    const ownerDomain = adsTxtData.variables?.ownerDomain;
    const managerDomains =
      adsTxtData.variables?.managerDomains
        ?.map((domain) => {
          const match = domain.match(/^([\w.-]+)\b/);
          return match ? match[1] : '';
        })
        .filter((domain) => domain !== '') || [];

    // 1. Supply Chain Compliance Check
    const hasOwnerDomain = !!ownerDomain;
    const hasManagerDomain = managerDomains?.length > 0;
    const hasContact = !!adsTxtData.variables?.contact;

    // 2. Relationship Analysis
    const directEntries = adsTxtData.data.filter((entry) => entry.relationship === 'DIRECT');
    const resellerEntries = adsTxtData.data.filter((entry) => entry.relationship === 'RESELLER');

    // 3. Seller.json Coverage Analysis
    const adsTxtDomains = new Set(adsTxtData.data.map((entry) => entry.domain));
    const sellersJsonDomains = new Set(sellerAnalysis.map((analysis) => analysis.domain));
    const missingSellersDomains = [...adsTxtDomains].filter(
      (domain) => !sellersJsonDomains.has(domain)
    );

    // 4. Publisher-Seller Relationship Check
    const ownerDomainSellers = sellerAnalysis
      .flatMap((seller) => (seller.sellersJson && seller.sellersJson.data) || [])
      .filter((entry) => entry.domain === ownerDomain || managerDomains.includes(entry.domain));
    const hasOwnerAsPublisher = ownerDomainSellers.some(
      (seller) =>
        seller.seller_type?.toUpperCase() === 'PUBLISHER' ||
        seller.seller_type?.toUpperCase() === 'BOTH'
    );

    // 5. Seller Type Check
    const sellerTypes = sellerAnalysis.reduce(
      (acc, analysis) => {
        (analysis.sellersJson?.data || []).forEach((seller) => {
          acc[seller.seller_type.toUpperCase()] = (acc[seller.seller_type.toUpperCase()] || 0) + 1;
        });
        return acc;
      },
      {} as Record<string, number>
    );

    // 6. Confidential Seller Check
    const confidentialSellers = sellerAnalysis.reduce(
      (acc, analysis) =>
        acc +
        (analysis.sellersJson?.data || []).filter(
          (seller) => String(seller.is_confidential) === '1'
        ).length,
      0
    );

    // 7. Risk Assessment
    const riskFactors = [];
    if (!hasOwnerDomain) riskFactors.push('owner_domain_not_specified');
    if (hasManagerDomain && adsTxtData.data.some((entry) => managerDomains.includes(entry.domain)))
      riskFactors.push('managerdomain_is_registered_as_a_seller');
    if (!hasContact) riskFactors.push('contact_information_missing');
    if (missingSellersDomains.length > 0) riskFactors.push('missing_sellers_json_for_some_domains');
    if (ownerDomain && !hasOwnerAsPublisher)
      riskFactors.push('owner_domain_not_listed_as_publisher_in_sellers_json');
    if (confidentialSellers > 0) riskFactors.push('some_sellers_does_not_disclose_information');

    return {
      ownerDomain,
      managerDomains,
      directCount: directEntries.length,
      resellerCount: resellerEntries.length,
      missingSellersDomains,
      sellerTypes,
      riskFactors,
      totalDomains: adsTxtDomains.size,
      coveragePercent: (sellersJsonDomains.size / adsTxtDomains.size) * 100,
    };
  }, [adsTxtData, sellerAnalysis]);

  const syntaxErrorCount = adsTxtData?.errors?.length || 0;
  const duplicateEntryCount = adsTxtData?.duplicates?.length || 0;
  const totalAdsTxtEntries = adsTxtData?.data.length || 0;
  const existingSellerCoun = sellerAnalysis.reduce(
    (acc, analysis) => acc + (analysis.sellersJson?.data.length || 0),
    0
  );
  const verifiedSellerCount =
    adsTxtData?.data.reduce(
      (acc, entry) => acc + (isVerifiedEntry(entry.domain, entry).isVerified ? 1 : 0),
      0
    ) || 0;
  const SellerExistingRate =
    totalAdsTxtEntries === 0 ? 0 : (existingSellerCoun / totalAdsTxtEntries) * 100;
  const sellerVerificationRate =
    totalAdsTxtEntries === 0 ? 0 : (verifiedSellerCount / totalAdsTxtEntries) * 100;

  if (analyzing) {
    return (
      <div className="p-4">
        <div className="bg-blue-50 text-blue-700 p-4 rounded-lg">
          {chrome.i18n.getMessage('analyzing')}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-4">
        <div className="bg-gray-50 text-gray-600 p-4 rounded-lg">
          {chrome.i18n.getMessage('no_data_available')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Supply Chain Overview */}
      <div className="rounded-lg border p-4">
        <h3 className="text-lg font-semibold mb-4">Supply Chain Overview</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Owner Domain</div>
            <div className="bg-gray-50 p-2 rounded">{analysis.ownerDomain || 'Not Specified'}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Manager Domain</div>
            <div className="bg-gray-50 p-2 rounded">
              {analysis.managerDomains.join(', ') || 'Not Specified'}
            </div>
          </div>
        </div>
      </div>

      {/* Ads.txt/App-ads.txt Analysis */}
      <div className="rounded-lg border p-4">
        <h3 className="text-lg font-semibold mb-4">
          {checksAppAdsTxt ? 'App-ads.txt' : 'Ads.txt'} Analyze
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 p-3 rounded-lg flex flex-col items-center justify-center">
            <div className="text-sm font-medium text-red-800">Errors</div>
            <div className="text-2xl font-bold text-red-600">{syntaxErrorCount}</div>
          </div>
          <div className="bg-amber-50 p-3 rounded-lg flex flex-col items-center justify-center">
            <div className="text-sm font-medium text-amber-800">Duplicate</div>
            <div className="text-2xl font-bold text-amber-600">{duplicateEntryCount}</div>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg flex flex-col items-center justify-center">
            <div className="text-sm font-medium text-blue-800">Total</div>
            <div className="text-2xl font-bold text-blue-600">{totalAdsTxtEntries}</div>
          </div>
        </div>
      </div>

      {/* Relationship Distribution */}
      <div className="rounded-lg border p-4">
        <h3 className="text-lg font-semibold mb-4">Relationship Distribution</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 p-3 rounded-lg flex flex-col items-center justify-center">
            <div className="text-sm font-medium text-green-800">
              <Tooltip content={chrome.i18n.getMessage('direct')}>DIRECT</Tooltip>
            </div>
            <div className="text-2xl font-bold text-green-600">{analysis.directCount}</div>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg flex flex-col items-center justify-center">
            <div className="text-sm font-medium text-purple-800">
              <Tooltip content={chrome.i18n.getMessage('reseller')}>RESELLER</Tooltip>
            </div>
            <div className="text-2xl font-bold text-purple-600">{analysis.resellerCount}</div>
          </div>
        </div>
      </div>

      {/* Seller Verification */}
      <div className="rounded-lg border p-4">
        <h3 className="text-lg font-semibold mb-4">Seller Verification</h3>
        <div className="space-y-6">
          {/* Verified Sellers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Verified Sellers</span>
              <span className="text-sm font-bold">{sellerVerificationRate.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${sellerVerificationRate}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Verified: {verifiedSellerCount}</span>
              <span>Total: {totalAdsTxtEntries}</span>
            </div>
          </div>
          {/* Existing Sellers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Existing Sellers</span>
              <span className="text-sm font-bold">{SellerExistingRate.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${SellerExistingRate}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Existing: {existingSellerCoun}</span>
              <span>Total: {totalAdsTxtEntries}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Seller Type Distribution */}
      <div className="rounded-lg border p-4">
        <h3 className="text-lg font-semibold mb-4">Seller Type Distribution</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 p-3 rounded-lg flex flex-col items-center justify-center">
            <div className="text-sm font-medium text-green-800">
              <Tooltip content={chrome.i18n.getMessage('publisher')}>Pub</Tooltip>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {analysis.sellerTypes['PUBLISHER'] || 0}
            </div>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg flex flex-col items-center justify-center">
            <div className="text-sm font-medium text-blue-800">
              <Tooltip content={chrome.i18n.getMessage('intermediary')}>Int</Tooltip>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {analysis.sellerTypes['INTERMEDIARY'] || 0}
            </div>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg flex flex-col items-center justify-center">
            <div className="text-sm font-medium text-purple-800">
              <Tooltip content={chrome.i18n.getMessage('both')}>Both</Tooltip>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {analysis.sellerTypes['BOTH'] || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Risk Assessment */}
      {analysis.riskFactors.length > 0 && (
        <div className="rounded-lg border border-red-200 p-4 bg-red-50">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Risk Factors
          </h3>
          <ul className="space-y-2">
            {analysis.riskFactors.map((risk, index) => (
              <li key={index} className="flex items-center gap-2 text-red-600">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                {chrome.i18n.getMessage(risk)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SummaryPanel;
