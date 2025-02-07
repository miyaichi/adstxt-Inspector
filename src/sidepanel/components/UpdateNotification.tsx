import React from 'react';
import { Alert } from './ui/Alert';

interface UpdateNotificationProps {
  currentVersion: string;
  latestVersion: string;
  storeUrl: string;
}

/**
 * Compares two version strings and returns:
 * - 1 if v1 is greater than v2
 * - -1 if v1 is less than v2
 * - 0 if v1 is equal to v2
 * @param v1 - The first version string
 * @param v2 - The second version string
 * @returns A number indicating the comparison result
 **/
export const compareVersions = (v1: string, v2: string) => {
  const v1Parts = v1.split('.').map((part) => parseInt(part, 10));
  const v2Parts = v2.split('.').map((part) => parseInt(part, 10));

  for (let i = 0; i < v1Parts.length; i++) {
    if (v2Parts.length === i) return 1;
    if (v1Parts[i] > v2Parts[i]) return 1;
    if (v1Parts[i] < v2Parts[i]) return -1;
  }

  if (v1Parts.length < v2Parts.length) return -1;
  return 0;
};

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  currentVersion,
  latestVersion,
  storeUrl,
}) => {
  if (!latestVersion || currentVersion === latestVersion) return null;

  return (
    <Alert type="info">
      <div className="flex items-center justify-between">
        <div>
          {chrome.i18n.getMessage('new_version_available', [latestVersion, currentVersion])}
        </div>
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {chrome.i18n.getMessage('update_now')}
        </a>
      </div>
    </Alert>
  );
};
