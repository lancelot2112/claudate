import { BaseMessage, UrgencyLevel, CommunicationChannel as CommunicationChannelType } from './common';

export interface CommunicationChannel {
  id: string;
  name: string;
  type: ChannelType;
  isActive: boolean;
  capabilities: ChannelCapability[];
  rateLimits: RateLimit;
  configuration: Record<string, any>;
}

export type ChannelType = 'sms' | 'mms' | 'email' | 'google_chat' | 'webhook' | 'websocket';

export type ChannelCapability = 
  | 'text_messaging'
  | 'media_messaging'
  | 'file_sharing'
  | 'rich_formatting'
  | 'real_time'
  | 'voice_calling'
  | 'video_calling'
  | 'screen_sharing'
  | 'interactive_elements';

export interface RateLimit {
  maxPerMinute: number;
  maxPerHour: number;
  maxPerDay: number;
  burstLimit: number;
}

export interface ChannelMessage extends BaseMessage {
  channel: CommunicationChannelType;
  recipient?: string;
  attachments?: MediaAttachment[];
  channelSpecificData?: Record<string, any>;
  deliveryStatus?: DeliveryStatus;
  deliveryAttempts?: number;
  lastDeliveryAttempt?: Date;
  scheduledDelivery?: Date;
}

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'retrying';

export interface MessageDeliveryResult {
  success: boolean;
  messageId: string;
  channelMessageId?: string;
  deliveryStatus: DeliveryStatus;
  error?: string;
  retryAfter?: number;
  deliveredAt?: Date;
  metadata?: Record<string, any>;
}

export interface ChannelConfig {
  enabled: boolean;
  priority: number;
  supportedUrgencies: UrgencyLevel[];
  formatPreferences: MessageFormatPreferences;
  authentication: Record<string, any>;
  webhookEndpoint?: string;
  retryPolicy: RetryPolicy;
}

export interface MessageFormatPreferences {
  maxLength: number;
  supportsBulletPoints: boolean;
  supportsMarkdown: boolean;
  supportsMedia: boolean;
  supportsInteractiveElements: boolean;
  mobileOptimized: boolean;
}

export interface RetryPolicy {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryOnStatuses: DeliveryStatus[];
}

export interface CommunicationPreference {
  channel: string;
  urgency: UrgencyLevel[];
  timeWindows: TimeWindow[];
  formatPreferences: {
    maxBulletPoints: number;
    includeVisuals: boolean;
    includeActionItems: boolean;
  };
}

export interface TimeWindow {
  start: string; // HH:MM format
  end: string;   // HH:MM format
  timezone: string;
  days?: string[]; // ['monday', 'tuesday', etc.]
}

export interface MediaAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'chart';
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  metadata?: Record<string, any>;
}

export interface ExecutiveBrief {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  urgency: UrgencyLevel;
  actionItems: string[];
  visualAttachments?: MediaAttachment[];
  metadata?: Record<string, any>;
}

export interface ChannelRouter {
  selectChannel(
    message: BaseMessage,
    preferences: CommunicationPreference[],
    availableChannels: CommunicationChannel[]
  ): Promise<CommunicationChannel | null>;
  
  routeMessage(
    message: ChannelMessage,
    targetChannel: CommunicationChannel
  ): Promise<MessageDeliveryResult>;
  
  handleDeliveryFailure(
    message: ChannelMessage,
    failure: MessageDeliveryResult
  ): Promise<MessageDeliveryResult>;
}

export interface IChannelProvider {
  readonly id: string;
  readonly name: string;
  
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  
  sendMessage(message: ChannelMessage): Promise<MessageDeliveryResult>;
  receiveMessage(): Promise<ChannelMessage | null>;
  
  getCapabilities(): ChannelCapability[];
  isHealthy(): Promise<boolean>;
  
  // Event emitter methods
  on(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
  
  // Event handlers
  onMessageReceived?: (message: ChannelMessage) => Promise<void>;
  onDeliveryStatusUpdate?: (messageId: string, status: DeliveryStatus) => Promise<void>;
  onError?: (error: Error) => Promise<void>;
}

export interface CommunicationMetrics {
  totalMessages: number;
  messagesByChannel: Record<string, number>;
  messagesByUrgency: Record<UrgencyLevel, number>;
  deliverySuccessRate: number;
  averageDeliveryTime: number;
  failedDeliveries: number;
  retryRate: number;
  channelUtilization: Record<string, number>;
}

export interface BulkMessageJob {
  id: string;
  messages: ChannelMessage[];
  targetChannels: string[];
  priority: number;
  scheduledFor?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: {
    total: number;
    sent: number;
    failed: number;
  };
}

// Missing types needed by GoogleChatChannel and other components
export interface MessageRequest {
  content: string;
  recipient: string;
  channelId: string;
  metadata?: Record<string, any>;
  attachments?: MediaAttachment[];
  urgency?: UrgencyLevel;
  scheduledDelivery?: Date;
  threadId?: string;
  interactiveElements?: InteractiveElement[];
}

export interface MessageResponse {
  messageId: string;
  success: boolean;
  deliveryStatus: DeliveryStatus;
  channelMessageId?: string;
  error?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface InteractiveElement {
  type: 'button' | 'select' | 'input' | 'card' | 'carousel' | 'dropdown';
  id: string;
  label: string;
  action: InteractiveAction;
  actionId?: string;
  parameters?: Record<string, any>;
  options?: InteractiveOption[];
  style?: InteractiveStyle;
  metadata?: Record<string, any>;
}

export interface InteractiveOption {
  label: string;
  value: string;
  selected?: boolean;
}

export interface InteractiveAction {
  type: 'postback' | 'url' | 'quick_reply' | 'submit';
  value: string;
  url?: string;
  parameters?: Record<string, any>;
}

export interface InteractiveStyle {
  color?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'small' | 'medium' | 'large';
  icon?: string;
}