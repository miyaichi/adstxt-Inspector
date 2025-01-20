import React from 'react';

type AlertType = 'info' | 'error' | 'success';

interface AlertProps {
  children: React.ReactNode;
  type?: AlertType;
}

export const Alert: React.FC<AlertProps> = ({ children, type = 'info' }) => {
  const styles = {
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    success: 'bg-green-50 text-green-700 border-green-200',
  };

  return <div className={`p-4 rounded-lg border ${styles[type]}`}>{children}</div>;
};
