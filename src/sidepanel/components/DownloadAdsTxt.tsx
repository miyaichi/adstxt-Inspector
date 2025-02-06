import React from 'react';

interface DownloadAdsTxtProps {
  content: string;
  children: React.ReactNode;
}

const DownloadAdsTxt: React.FC<DownloadAdsTxtProps> = ({ content, children }) => {
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

export default DownloadAdsTxt;
