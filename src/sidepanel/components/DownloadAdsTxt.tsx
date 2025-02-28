import React from 'react';
import type { AdsTxt } from '../../utils/fetchAdsTxt';

interface DownloadPlainAdsTxtProps {
  appAdsTxt: boolean;
  content: string;
  children: React.ReactNode;
}

export const DownloadPlainAdsTxt: React.FC<DownloadPlainAdsTxtProps> = ({
  appAdsTxt,
  content,
  children,
}) => {
  const downloadFile = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);

    // Create a temporary link and trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = appAdsTxt ? 'app-ads.txt' : 'ads.txt';
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
  appAdsTxt: boolean;
  adsTxt: AdsTxt[];
  children: React.ReactNode;
}

export const DownloadCsvAdsTxt: React.FC<DownloadCsvAdsTxtVProps> = ({
  domain,
  appAdsTxt,
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
    const csvContent = [
      headers.map((field) => `"${field}"`).join(','),
      ...rows.map((value) => value.map((field) => `"${field}"`).join(',')),
    ].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);

    // Create a temporary link and trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = appAdsTxt ? `${domain}_app-ads.txt.csv` : `${domain}_ads.txt.csv`;
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
