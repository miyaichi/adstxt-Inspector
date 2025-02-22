import React from 'react';
import type { AdsTxt } from '../../utils/fetchAdsTxt';

interface DownloadPlainAdsTxtProps {
  content: string;
  children: React.ReactNode;
}

export const DownloadPlainAdsTxt: React.FC<DownloadPlainAdsTxtProps> = ({ content, children }) => {
  const downloadFile = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);

    // Create a temporary link and trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ads.txt';
    document.body.appendChild(link);
    link.click();

    // Clean up after ourselves
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <button className="external-link" onClick={downloadFile}>
      {children}
    </button>
  );
};

interface DownloadCsvAdsTxtVProps {
  domain: string;
  adsTxt: AdsTxt[];
  children: React.ReactNode;
}

export const DownloadCsvAdsTxt: React.FC<DownloadCsvAdsTxtVProps> = ({
  domain,
  adsTxt,
  children,
}) => {
  const downloadFile = () => {
    const headers = [
      'Domain Name',
      'Advertising System',
      'Publisher Account ID',
      'Relationship',
      'CA ID',
    ];
    const rows = adsTxt.map((item) => [
      domain,
      item.domain,
      item.publisherId,
      item.relationship,
      item.certificationAuthorityId || '',
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    // Create a temporary link and trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = `${domain}_adsTxt.csv`;
    document.body.appendChild(link);
    link.click();

    // Clean up after ourselves
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <button className="external-link" onClick={downloadFile}>
      {children}
    </button>
  );
};
