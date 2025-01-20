import { BaseMessage, MessageHandler } from '../types/messages';
import { ConnectionStatus, Context } from '../types/types';
import { Logger } from './logger';

export class ConnectionManager {
  private port: chrome.runtime.Port | null = null;
  private status: ConnectionStatus = 'disconnected';
  private readonly maxReconnectAttempts = 3;
  private reconnectAttempts = 0;
  private readonly logger: Logger;
  private readonly messageHandler: MessageHandler | null = null;
  private isReconnecting = false;
  private lastConnectTime: number = 0;
  private disconnectListener: ((port: chrome.runtime.Port) => void) | null = null;

  constructor(
    private readonly context: Context,
    private readonly onMessage?: MessageHandler,
    logger?: Logger
  ) {
    this.logger = logger ?? new Logger(context);
    this.messageHandler = onMessage ?? null;
    this.disconnectListener = this.createDisconnectListener();
  }

  private createDisconnectListener(): (port: chrome.runtime.Port) => void {
    return (port: chrome.runtime.Port) => {
      const error = chrome.runtime.lastError;

      // Ignore early disconnect events
      if (this.status === 'connected' && Date.now() - this.lastConnectTime < 1000) {
        this.logger.debug('Ignoring early disconnect event');
        return;
      }

      this.handleDisconnection(error);
    };
  }

  private setupConnectionHandlers(): void {
    if (!this.port) return;

    // Disconnect event listener if it exists
    if (this.disconnectListener) {
      this.port.onDisconnect.removeListener(this.disconnectListener);
    }

    // Add disconnect listener
    this.disconnectListener = this.createDisconnectListener();
    this.port.onDisconnect.addListener(this.disconnectListener);

    // Message handler
    this.port.onMessage.addListener((message: BaseMessage) => {
      this.handleMessage(message);
    });
  }

  connect(): chrome.runtime.Port {
    try {
      // Ignore if already connected
      if (this.status === 'connected' && this.port) {
        return this.port;
      }

      this.status = 'connecting';
      this.disconnectExisting();

      this.port = chrome.runtime.connect({ name: this.context });
      this.lastConnectTime = Date.now();
      this.setupConnectionHandlers();

      this.status = 'connected';
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.logger.debug('Connected successfully');

      return this.port;
    } catch (error) {
      this.handleConnectionError(error);
      throw error;
    }
  }

  private handleDisconnection(error: chrome.runtime.LastError | undefined): void {
    this.logger.debug('Disconnect event received', {
      status: this.status,
      isReconnecting: this.isReconnecting,
      timeSinceConnect: Date.now() - this.lastConnectTime,
      error: error?.message,
    });

    if (this.isReconnecting) {
      return;
    }

    const wasConnected = this.status === 'connected';
    this.status = 'disconnected';
    this.port = null;

    if (this.isExtensionContextInvalidated(error)) {
      this.logger.warn('Extension context invalidated');
      return;
    }

    if (
      wasConnected &&
      this.shouldAttemptReconnection() &&
      Date.now() - this.lastConnectTime >= 1000
    ) {
      this.isReconnecting = true;
      this.reconnectWithBackoff().finally(() => {
        this.isReconnecting = false;
      });
    }
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  async sendMessage<T extends BaseMessage>(
    target: Context,
    messageData: Omit<T, 'source' | 'target' | 'timestamp'>
  ): Promise<void> {
    if (!this.port || this.status !== 'connected') {
      return;
    }

    try {
      const message = {
        ...messageData,
        source: this.context,
        target,
        timestamp: Date.now(),
      } as T;

      this.port.postMessage(message);
      this.logger.debug('Message sent', { target, type: message.type });
    } catch (error) {
      this.handleMessageError(error);
      throw error;
    }
  }

  disconnect(): void {
    this.disconnectExisting();
  }

  private disconnectExisting(): void {
    if (this.port) {
      try {
        this.port.disconnect();
      } catch (error) {
        this.logger.warn('Error during disconnection:', error);
      }
      this.port = null;
      this.status = 'disconnected';
    }
  }

  private async reconnectWithBackoff(): Promise<void> {
    try {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.logger.error('Max reconnection attempts reached');
        return;
      }

      const baseDelay = 1000;
      const maxDelay = 5000;
      const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), maxDelay);

      this.reconnectAttempts++;
      this.logger.debug('Attempting reconnection', {
        attempt: this.reconnectAttempts,
        delay,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));

      // Check if the connection was re-established by another reconnection attempt
      if (this.status === 'connected' || !this.isReconnecting) {
        return;
      }

      this.connect();
    } catch (error) {
      this.handleConnectionError(error);
    }
  }

  private handleConnectionError(error: unknown): void {
    this.status = 'disconnected';
    this.logger.error('Connection error:', error);
  }

  private handleMessageError(error: unknown): void {
    this.logger.error('Message sending failed:', error);

    if (this.isConnectionError(error)) {
      this.handleDisconnection(undefined);
    }
  }

  private shouldAttemptReconnection(): boolean {
    return (
      this.context !== 'background' &&
      this.reconnectAttempts < this.maxReconnectAttempts &&
      this.status === 'disconnected' &&
      !this.isReconnecting
    );
  }

  private isConnectionError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('Could not establish connection');
  }

  private isExtensionContextInvalidated(error: unknown): boolean {
    return (
      error &&
      'message' in (error as any) &&
      (error as any).message.includes('Extension context invalidated')
    );
  }

  private handleMessage(message: BaseMessage): void {
    // Check message target
    if (message.target !== this.context) {
      return;
    }

    this.logger.debug('Message received', {
      from: message.source,
      type: message.type,
    });

    // Process the message with the registered handler
    if (this.messageHandler) {
      try {
        this.messageHandler(message);
      } catch (error) {
        this.logger.error('Error in message handler:', error);
      }
    }
  }
}

export const createConnectionManager = (context: Context): ConnectionManager => {
  return new ConnectionManager(context);
};
