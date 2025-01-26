import React, { useEffect, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { useAdsSellers } from '../hooks/useAdsSellers';
import { BaseMessage, TabInfo } from '../types/messages';
import { Context } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { Logger } from '../utils/logger';
import { AdsTxtPanel } from './components/AdsTxtPanel';
import { SellersPanel } from './components/SellersPanel';
import { SummaryPanel } from './components/SummaryPanel';
import { Alert } from './components/ui/Alert';
import { Button } from './components/ui/Button';

const logger = new Logger('sidepanel');

interface UpdateInfo {
  version: string;
  store_url: string;
}

const UpdateNotification: React.FC<{ currentVersion: string; latestVersion: string; storeUrl: string }> = ({
  currentVersion,
  latestVersion,
  storeUrl,
}) => (
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

export default function App() {
  const [tabId, setTabId] = useState<number | null>(null);
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);
  const [connectionManager, setConnectionManager] = useState<ConnectionManager | null>(null);
  const [contentScriptContext, setContentScriptContext] = useState<Context>('undefined');
  const { analyzing, adsTxtData, sellerAnalysis, analyze, isValidEntry } = useAdsSellers();
  const initialized = React.useRef(false);
  
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [storeUrl, setStoreUrl] = useState<string | null>(null);
  const currentVersion = chrome.runtime.getManifest().version;

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const response = await fetch('https://miyaichi.github.io/adstxt-Inspector/version.json');
        const data: UpdateInfo = await response.json();
        if (data.version > currentVersion) {
          setLatestVersion(data.version);
          setStoreUrl(data.store_url);
        }
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
        const manager = new ConnectionManager('sidepanel', handleMessage);
        manager.connect();
        setConnectionManager(manager);

        // Initialize active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          setTabId(tab.id);
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
      setTabId(newTab.tabId);
      setTabInfo(newTab);
    });
  }, []);

  useEffect(() => {
    // Update content script context
    setContentScriptContext(tabId ? `content-${tabId}` : 'undefined');
  }, [tabId, tabInfo]);

  const handleMessage = (message: BaseMessage) => {
    logger.debug('Message received', { type: message.type });

    // Implement other message handling here ...
    switch (message.type) {
      default:
        logger.debug('Unknown message type:', message.type);
        break;
    }
  };

  const handleAnalyze = async () => {
    if (!tabInfo || !tabInfo.isScriptInjectionAllowed || analyzing) return;

    try {
      await analyze(tabInfo.url);
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
              <div className="flex items-center space-x-2">
                Domain: <span className="font-semibold">{domain}</span>
              </div>
              <Button onClick={handleAnalyze} disabled={!tabId || analyzing}>
                {analyzing
                  ? chrome.i18n.getMessage('analyzing')
                  : chrome.i18n.getMessage('analyze')}
              </Button>
            </div>

            {/* Explanation Message */}
            <div className="text-sm text-gray-500">
              {chrome.i18n.getMessage('analyse_button_description')}
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="panel-section">
          <Tabs>
            <TabList>
              <Tab>Summary View</Tab>
              <Tab>Ads.txt Details</Tab>
              <Tab>Sellers Analysis</Tab>
            </TabList>

            <TabPanel>
              <SummaryPanel
                analyzing={analyzing}
                adsTxtData={adsTxtData}
                sellerAnalysis={sellerAnalysis}
              />
            </TabPanel>

            <TabPanel>
              <AdsTxtPanel
                analyzing={analyzing}
                adsTxtData={adsTxtData}
                isValidEntry={isValidEntry}
              />
            </TabPanel>

            <TabPanel>
              <SellersPanel
                analyzing={analyzing}
                sellerAnalysis={sellerAnalysis}
                adsTxtData={adsTxtData}
              />
            </TabPanel>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
