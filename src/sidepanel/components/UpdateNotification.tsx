// UpdateNotification.tsx
import React from 'react';
import { Alert } from './ui/Alert';

interface UpdateNotificationProps {
  currentVersion: string;
  latestVersion: string;
  updateUrl: string;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  currentVersion,
  latestVersion,
  updateUrl,
}) => {
  if (!latestVersion || currentVersion === latestVersion) return null;

  return (
    <Alert type="info">
      <div className="flex items-center justify-between">
        <div>
          New version available: {latestVersion} (Current: {currentVersion})
        </div>
        <a
          href={updateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Update now
        </a>
      </div>
    </Alert>
  );
};