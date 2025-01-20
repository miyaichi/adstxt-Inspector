import React, { useEffect, useState } from 'react';
import { BaseMessage, MessagePayloads, TabInfo } from '../types/messages';
import { Context } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { Logger } from '../utils/logger';

const logger = new Logger('sidepanel');

// Only for display purpose
interface DisplayInfo {
  url: string;
  windowId: number;
}

export default function App() {
  const [tabId, setTabId] = useState<number | null>(null);
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo | null>(null);
  const [connectionManager, setConnectionManager] = useState<ConnectionManager | null>(null);
  const [contentScriptContext, setContentScriptContext] = useState<Context>('undefined');
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
          setDisplayInfo({
            windowId: tab.windowId,
            url: tab.url || '',
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
      setDisplayInfo({
        windowId: newTab?.windowId ?? -1,
        url: newTab?.url ?? '',
      });
    });
  }, []);

  useEffect(() => {
    // Update content script context
    setContentScriptContext(tabId ? `content-${tabId}` : 'undefined');
  }, [tabId, displayInfo]);

  const handleMessage = (message: BaseMessage) => {
    logger.debug('Message received', { type: message.type });

    // Implement other message handling here ...
    switch (message.type) {
      case 'TEST_MESSAGE_FOR_SIDEPANEL':
        const payload = message.payload as MessagePayloads['TEST_MESSAGE_FOR_SIDEPANEL'];
        logger.debug('Received message:', payload.message);
        break;
      default:
        logger.debug('Unknown message type:', message.type);
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h1 className="text-xl font-bold mb-4">Side Panel</h1>
        {tabId && displayInfo ? (
          <div>
            <p>Window ID: {displayInfo.windowId}</p>
            <p>Active Tab ID: {tabId}</p>
            <p>URL: {displayInfo.url}</p>
          </div>
        ) : (
          <p>No active tab</p>
        )}
      </div>
    </div>
  );
}
