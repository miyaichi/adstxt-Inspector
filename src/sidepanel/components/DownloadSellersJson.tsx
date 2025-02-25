import type { SellerAnalysis } from '../../hooks/useAdsSellers';

interface DownloadCsvSellersJsonProps {
  domain: string;
  sellerAnalysis: SellerAnalysis[];
  children: React.ReactNode;
}

export const DownloadCsvSellersJson: React.FC<DownloadCsvSellersJsonProps> = ({
  domain,
  sellerAnalysis,
  children,
}) => {
  const downloadFile = () => {
    const headers = [
      'Domain',
      'Advertising System',
      'Seller ID',
      'Seller Type',
      'Confidential',
      'Passthrough',
      'Domain',
      'Name',
      'Comment',
    ];
    const rows = sellerAnalysis
      .flatMap((analysis) =>
        analysis.sellersJson?.data.map((seller) => [
          domain,
          analysis.domain,
          seller.seller_id,
          seller.seller_type,
          seller.is_confidential === 1 ? 'Yes' : '',
          seller.is_passthrough === 1 ? 'Yes' : '',
          seller.domain || '',
          seller.name || '',
          seller.comment || '',
        ])
      )
      .filter((row) => row);
    const csvContent = [headers, ...rows]
      .filter((row) => row !== undefined)
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);

    // Create a temporary link and trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = `${domain}_sellersJson.csv`;
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
