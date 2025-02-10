import { TabInfo } from '../types/messages';
import { Logger } from '../utils/logger';

class BackgroundService {
  private logger: Logger;
  private activeTabInfo: TabInfo | null = null;
  private readonly RESTRICTED_PATTERNS = [
    'chrome://',
    'chrome-extension://',
    'devtools://',
    'edge://',
    'about:',
  ];

  constructor() {
    this.logger = new Logger('background');
    this.setupChromeListeners();
    this.setupSidepanel();
  }

  private isScriptInjectionAllowed(url: string): boolean {
    if (!url) return false;
    return !this.RESTRICTED_PATTERNS.some((pattern) => url.startsWith(pattern));
  }

  private setupChromeListeners() {
    // Monitor tab activation
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        await this.handleTabActivation(tab);
      } catch (error) {
        this.logger.error('Failed to handle tab activation:', error);
      }
    });

    // Monitor tab URL change
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      try {
        if (changeInfo.status === 'complete' && tab.active) {
          await this.handleTabActivation(tab);
        }
      } catch (error) {
        this.logger.error('Failed to handle tab update:', error);
      }
    });

    // Monitor window focus
    chrome.windows.onFocusChanged.addListener(async (windowId) => {
      try {
        if (windowId === chrome.windows.WINDOW_ID_NONE) return;

        const [tab] = await chrome.tabs.query({ active: true, windowId });
        if (tab) {
          await this.handleTabActivation(tab);
        }
      } catch (error) {
        this.logger.error('Failed to handle window focus change:', error);
      }
    });
  }

  private async handleTabActivation(tab: chrome.tabs.Tab) {
    if (!tab.id || !tab.url) return;

    const isAllowed = this.isScriptInjectionAllowed(tab.url);
    this.activeTabInfo = {
      windowId: tab.windowId,
      tabId: tab.id,
      url: tab.url,
      isScriptInjectionAllowed: isAllowed,
    } as TabInfo;

    // Store the active tab info
    await chrome.storage.local.set({ activeTabInfo: this.activeTabInfo });

    if (!isAllowed) {
      this.logger.info('Script injection not allowed for this URL:', tab.url);
      return;
    }
  }

  private async setupSidepanel(): Promise<void> {
    try {
      // Open the side panel on action clicks
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (error) {
      this.logger.error('Failed to set panel behavior:', error);
    }
  }
}

// Initialize the background service
new BackgroundService();
