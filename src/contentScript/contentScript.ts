import { MessageHandler, MessagePayloads } from '../types/messages';
import { ConnectionManager } from '../utils/connectionManager';
import { Logger } from '../utils/logger';

class ContentScript {
  private connectionManager: ConnectionManager | null = null;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('content-script');
    this.initialize();
  }

  private async initialize() {
    try {
      // Listen for PING and SIDEPANEL_CLOSED messages
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'PING') {
          sendResponse({ status: 'alive' });
          return false;
        }
        if (message.type === 'SIDEPANEL_CLOSED') {
          this.logger.info('Sidepanel closed, performing cleanup');
          this.performCleanup();
          sendResponse({ status: 'cleaned' });
          return false;
        }
      });

      // Listen for page show events
      window.addEventListener('pageshow', async (event) => {
        const e = event as PageTransitionEvent;
        if (e.persisted) {
          this.logger.info('Page restored from BFCache');

          // Reset connection and cleanup
          this.connectionManager = null;
          this.performCleanup();
        }
      });

      // Get activeTabInfo from storage
      const { activeTabInfo } = await chrome.storage.local.get('activeTabInfo');

      if (activeTabInfo?.isScriptInjectionAllowed) {
        this.setupConnection(activeTabInfo.tabId);
      } else {
        this.logger.debug('Script injection not allowed for this tab');
      }

      // Listen for storage changes
      chrome.storage.local.onChanged.addListener((changes) => {
        const { oldValue, newValue } = changes.activeTabInfo || {};
        const newTabId = newValue?.tabId;
        const isAllowed = newValue?.isScriptInjectionAllowed;

        // Setup connection if allowed and connection doesn't exist or tabId has changed
        if (newTabId && isAllowed && (!this.connectionManager || newTabId !== oldValue?.tabId)) {
          this.setupConnection(newTabId);
        }
      });
    } catch (error) {
      this.logger.error('Failed to initialize content script:', error);
    }
  }

  private setupConnection(tabId: number) {
    if (this.connectionManager) {
      this.logger.debug('Connection already established');
      return;
    }

    try {
      this.connectionManager = new ConnectionManager(`content-${tabId}`, this.handleMessage);
      this.connectionManager.connect();
      this.logger.debug('Connection established', { tabId });

      // Monitor connection status, perform cleanup on disconnect
      const intervalId = setInterval(() => {
        const connectionStatus = this.connectionManager?.getStatus() || 'disconnected';
        if (connectionStatus !== 'connected') {
          this.logger.info('Connection lost, performing cleanup');
          this.performCleanup();
          clearInterval(intervalId);
        }
      }, 5000);
    } catch (error) {
      this.logger.error('Failed to setup connection:', error);
    }
  }

  private handleMessage: MessageHandler = (message) => {
    this.logger.debug('Message received', { type: message.type });

    // Implement other message handling here ...
    switch (message.type) {
      case 'TEST_MESSAGE_FOR_CONTENTSCRIPT':
        const payload = message.payload as MessagePayloads['TEST_MESSAGE_FOR_CONTENTSCRIPT'];
        this.logger.debug('Received message:', payload.message);
        break;
      default:
        this.logger.debug('Unknown message type:', message.type);
        break;
    }
  };

  // Cleanup existing state
  private performCleanup() {
    this.logger.info('Performing cleanup');
    // Implement cleanup logic here ...
  }
}

// Initialize content script
new ContentScript();
