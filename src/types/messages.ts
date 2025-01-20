import { Context } from './types';

// Tab information type
export interface TabInfo {
  tabId: number;
  windowId: number;
  url: string;
  isScriptInjectionAllowed: boolean;
}

// Message payloads type
export interface MessagePayloads {
  TEST_MESSAGE_FOR_SIDEPANEL: { message: string };
  TEST_MESSAGE_FOR_CONTENTSCRIPT: { message: string };
  // Add new message types here
}

// Base message structure
export interface BaseMessage {
  type: keyof MessagePayloads;
  payload: unknown;
  source: Context;
  target: Context;
  timestamp: number;
}

// Message handler type
export type MessageHandler<T extends BaseMessage = BaseMessage> = (message: T) => void;

// Message type
export type Message<T extends keyof MessagePayloads> = BaseMessage & {
  type: T;
  payload: MessagePayloads[T];
};

// Union of all message types
export type ExtensionMessage = {
  [K in keyof MessagePayloads]: Message<K>;
}[keyof MessagePayloads];
