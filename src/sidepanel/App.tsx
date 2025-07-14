import React, { useEffect, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { useAdsSellers } from '../hooks/useAdsSellers';
import { TabInfo } from '../types/messages';
import { Logger } from '../utils/logger';
import { ValidationManager, type ValidationProgress } from '../utils/ValidationManager';
import type { ValidityResult } from '../hooks/useAdsSellers';
import { AdsTxtPanel } from './components/AdsTxtPanel';
import { SellersPanel } from './components/SellersPanel';
import { SummaryPanel } from './components/SummaryPanel';
import { Button } from './components/ui/Button';
import { compareVersions, UpdateNotification } from './components/UpdateNotification';

const logger = new Logger('sidepanel');

const updateUrl = 'https://miyaichi.github.io/adstxt-Inspector/version.json';
interface UpdateInfo {
  version: string;
  store_url: string;
}

export default function App() {
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);
  const { analyzing, adsTxtData, sellerAnalysis, analyze, isVerifiedEntry } = useAdsSellers();
  const [checksAppAdsTxt, setChecksAppAdsTxt] = useState<boolean>(false);
  const [duplicateCheck, setDuplicateCheck] = useState<boolean>(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [storeUrl, setStoreUrl] = useState<string | null>(null);
  const currentVersion = chrome.runtime.getManifest().version;
  const initialized = React.useRef(false);

  // Centralized validation state
  const [globalValidationResults, setGlobalValidationResults] = useState<Map<string, ValidityResult>>(
    new Map()
  );
  const [globalValidationProgress, setGlobalValidationProgress] = useState<ValidationProgress | null>(null);
  const [isGlobalValidating, setIsGlobalValidating] = useState(false);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const response = await fetch(updateUrl);
        const data: UpdateInfo = await response.json();
        if (compareVersions(data.version, currentVersion) <= 0) return;
        setLatestVersion(data.version);
        setStoreUrl(data.store_url);
      } catch (error) {
        logger.error('Failed to check for updates:', error);
      }
    };

    checkForUpdates();
    const interval = setInterval(checkForUpdates, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentVersion]);

  useEffect(() => {
    if (initialized.current) {
      logger.debug('App already initialized, skipping...');
      return;
    }

    const initializeTab = async () => {
      if (initialized.current) return;

      try {
        // Initialize active tab
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab?.id) {
          setTabInfo({
            tabId: tab.id,
            windowId: tab.windowId,
            url: tab.url || '',
            isScriptInjectionAllowed: tab.url ? tab.url.startsWith('http') : false,
          });
          initialized.current = true;
        }

        logger.debug('Initialized', { tab });
      } catch (error) {
        logger.error('Tab initialization failed:', error);
      }
    };

    initializeTab();

    // Monitor storage changes
    chrome.storage.local.onChanged.addListener((changes) => {
      const { activeTabInfo } = changes;
      const newTab = activeTabInfo?.newValue as TabInfo | undefined;
      if (!newTab) return;

      logger.debug('Tab info change detected from storage:', newTab);
      setTabInfo(newTab);
    });
  }, []);

  // Centralized validation effect
  useEffect(() => {
    if (!adsTxtData?.data) {
      setGlobalValidationResults(new Map());
      setGlobalValidationProgress(null);
      setIsGlobalValidating(false);
      return;
    }

    const performGlobalValidation = async () => {
      setIsGlobalValidating(true);
      setGlobalValidationProgress({
        total: adsTxtData.data.length,
        completed: 0,
        inProgress: 0,
        failed: 0,
      });

      try {
        const validationManager = ValidationManager.getInstance();

        // Create validation requests
        const requests = adsTxtData.data.map((entry, index) => ({
          domain: entry.domain,
          entry,
          requestId: `${entry.domain}-${entry.publisherId}-${index}`,
        }));

        // Perform batch validation with progress updates
        const validationResults = await validationManager.validateEntries(
          requests,
          adsTxtData,
          isVerifiedEntry, // Fallback function
          (progress) => {
            setGlobalValidationProgress(progress);
          }
        );

        // Convert results to map for fast lookup
        const resultsMap = new Map<string, ValidityResult>();
        validationResults.forEach((result) => {
          const key = `${result.domain}-${result.entry.publisherId}-${result.entry.relationship}`;
          resultsMap.set(key, result.result);
        });

        setGlobalValidationResults(resultsMap);
      } catch (error) {
        console.error('Global validation failed, falling back to sync:', error);

        // Set empty results on validation failure
        const resultsMap = new Map<string, ValidityResult>();
        adsTxtData.data.forEach((entry) => {
          const key = `${entry.domain}-${entry.publisherId}-${entry.relationship}`;
          resultsMap.set(key, {
            isVerified: false,
            reasons: [],
            validationMessages: [
              {
                key: 'validationError',
                severity: 'error' as const,
                message: 'Validation could not be completed',
                description: 'An error occurred during validation. Please try again.',
                placeholders: [],
              },
            ],
          });
        });
        setGlobalValidationResults(resultsMap);
      } finally {
        setIsGlobalValidating(false);
        setGlobalValidationProgress(null);
      }
    };

    performGlobalValidation();
  }, [adsTxtData?.adsTxtUrl, adsTxtData?.data?.length]);

  const handleAnalyze = async () => {
    if (!tabInfo || !tabInfo.isScriptInjectionAllowed || analyzing) return;

    try {
      await analyze(tabInfo.url, checksAppAdsTxt);
    } catch (error) {
      logger.error('Analysis failed:', error);
    }
  };

  const domain = tabInfo?.url ? new URL(tabInfo.url).hostname : 'N/A';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="panel-container">
        {/* Header and Analyze Button */}
        {latestVersion && storeUrl && (
          <UpdateNotification
            currentVersion={currentVersion}
            latestVersion={latestVersion}
            storeUrl={storeUrl}
          />
        )}

        <div className="panel-section">
          <div className="panel-content">
            {/* Domain and Analyze Button */}
            <div className="entry-card-header">
              <div className="flex flex-col space-y-2">
                <div>
                  Domain: <span className="font-semibold">{domain}</span>
                </div>
                <label className="flex items-center space-x-1">
                  <input
                    type="checkbox"
                    checked={checksAppAdsTxt}
                    onChange={(e) => setChecksAppAdsTxt(e.target.checked)}
                  />
                  <span>{chrome.i18n.getMessage('checks_app_ads_txt')}</span>
                </label>
                <label className="flex items-center space-x-1">
                  <input
                    type="checkbox"
                    checked={duplicateCheck}
                    onChange={(e) => setDuplicateCheck(e.target.checked)}
                  />
                  <span>{chrome.i18n.getMessage('duplicate_check')}</span>
                </label>
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={!tabInfo?.tabId || analyzing}
                className="ml-auto"
              >
                {analyzing
                  ? chrome.i18n.getMessage('analyzing')
                  : chrome.i18n.getMessage('analyze')}
              </Button>
            </div>

            {/* Explanation Message */}
            <div className="text-sm text-gray-500">
              {chrome.i18n.getMessage('analyse_button_description', [
                checksAppAdsTxt ? 'App-ads.txt' : 'Ads.txt',
              ])}
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="panel-section">
          <Tabs>
            <TabList>
              <Tab>Summary View</Tab>
              <Tab>{checksAppAdsTxt ? 'App-ads.txt' : 'Ads.txt'} Analysis</Tab>
              <Tab>Sellers Analysis</Tab>
            </TabList>

            <TabPanel>
              <SummaryPanel
                analyzing={analyzing}
                checksAppAdsTxt={checksAppAdsTxt}
                adsTxtData={adsTxtData}
                sellerAnalysis={sellerAnalysis}
                isVerifiedEntry={isVerifiedEntry}
                globalValidationResults={globalValidationResults}
                globalValidationProgress={globalValidationProgress}
                isGlobalValidating={isGlobalValidating}
              />
            </TabPanel>

            <TabPanel>
              <AdsTxtPanel
                analyzing={analyzing}
                adsTxtData={adsTxtData}
                checkAppAdsTxt={checksAppAdsTxt}
                isVerifiedEntry={isVerifiedEntry}
                duplicateCheck={duplicateCheck}
                globalValidationResults={globalValidationResults}
                globalValidationProgress={globalValidationProgress}
                isGlobalValidating={isGlobalValidating}
              />
            </TabPanel>

            <TabPanel>
              <SellersPanel
                analyzing={analyzing}
                sellerAnalysis={sellerAnalysis}
                adsTxtData={adsTxtData}
                isVerifiedEntry={isVerifiedEntry}
                globalValidationResults={globalValidationResults}
                globalValidationProgress={globalValidationProgress}
                isGlobalValidating={isGlobalValidating}
              />
            </TabPanel>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
