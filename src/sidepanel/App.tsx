import React, { useEffect, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { useAdsSellers } from '../hooks/useAdsSellers';
import { BaseMessage, TabInfo } from '../types/messages';
import { Context } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { Logger } from '../utils/logger';
import { AdsTxtPanel } from './components/AdsTxtPanel';
import { SellersPanel } from './components/SellersPanel';
import { Button } from './components/ui/Button';

const logger = new Logger('sidepanel');

export default function App() {
  const [tabId, setTabId] = useState<number | null>(null);
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);
  const [connectionManager, setConnectionManager] = useState<ConnectionManager | null>(null);
  const [contentScriptContext, setContentScriptContext] = useState<Context>('undefined');
  const { analyzing, adsTxtData, sellerAnalysis, analyze, isValidEntry } = useAdsSellers();
  const initialized = React.useRef(false);

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
      <div className="p-4 space-y-4">
        {/* Header and Analyze Button */}
        <div className="flex items-center justify-between bg-white rounded-lg shadow p-4">
          <div className="flex items-center space-x-2">
            Domain: <span className="font-semibold">{domain}</span>
          </div>
          <Button onClick={handleAnalyze} disabled={!tabId || analyzing}>
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>

        {/* Tabs Section */}
        <div className="bg-white rounded-lg shadow">
          <Tabs>
            <TabList>
              <Tab>Ads.txt</Tab>
              <Tab>Sellers</Tab>
            </TabList>

            <TabPanel>
              <AdsTxtPanel
                analyzing={analyzing}
                adsTxtData={adsTxtData}
                isValidEntry={isValidEntry}
              />
            </TabPanel>

            <TabPanel>
              <SellersPanel analyzing={analyzing} sellerAnalysis={sellerAnalysis} adsTxtData={adsTxtData} />
            </TabPanel>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
