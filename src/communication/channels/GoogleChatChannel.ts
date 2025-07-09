import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { 
  CommunicationChannel, 
  MessageRequest, 
  MessageResponse, 
  MediaAttachment,
  InteractiveElement
} from '../../types/Communication';
import { ExecutiveBrief } from '../../types/Agent';
import logger from '../../utils/logger';

export interface GoogleChatConfig {
  id?: string;
  name?: string;
  serviceAccountKey: string; // Path to service account key file
  space: string; // Google Chat space ID
  botUserId: string; // Bot user ID for authentication
}

export interface GoogleChatCard {
  header?: {
    title: string;
    subtitle?: string;
    imageUrl?: string;
  };
  sections: Array<{
    widgets: Array<{
      textParagraph?: { text: string };
      keyValue?: { topLabel: string; content: string };
      image?: { imageUrl: string };
      buttons?: Array<{
        textButton: {
          text: string;
          onClick: {
            action: {
              actionMethodName: string;
              parameters?: Record<string, string>;
            };
          };
        };
      }>;
    }>;
  }>;
}

export interface GoogleChatMessage {
  text?: string;
  cards?: GoogleChatCard[];
  attachments?: Array<{
    name: string;
    contentType: string;
    source: {
      driveFile?: {
        id: string;
        name: string;
      };
    };
  }>;
  thread?: {
    name: string;
  };
}

export class GoogleChatChannel implements CommunicationChannel {
  public readonly id: string;
  public readonly name: string;
  public readonly type = 'google_chat';
  public readonly isActive: boolean = true;
  public readonly capabilities: import('../../types/Communication').ChannelCapability[] = [
    'text_messaging',
    'media_messaging',
    'file_sharing',
    'rich_formatting',
    'interactive_elements'
  ];
  public readonly rateLimits: import('../../types/Communication').RateLimit = {
    maxPerMinute: 60,
    maxPerHour: 3600,
    maxPerDay: 86400,
    burstLimit: 10
  };
  public readonly configuration: Record<string, any> = {};

  private chatApi: any;
  private jwtClient: JWT;

  constructor(private config: GoogleChatConfig) {
    this.id = config.id || `google_chat_${Date.now()}`;
    this.name = config.name || 'Google Chat Channel';
    
    this.jwtClient = new JWT({
      keyFile: config.serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/chat.bot'],
    });

    this.chatApi = google.chat({
      version: 'v1',
      auth: this.jwtClient,
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.jwtClient.authorize();
      logger.info('Google Chat channel initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Google Chat channel', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async sendMessage(request: MessageRequest): Promise<MessageResponse> {
    try {
      const chatMessage = await this.buildChatMessage(request);
      
      const response = await this.chatApi.spaces.messages.create({
        parent: this.config.space,
        requestBody: chatMessage,
      });

      return {
        success: true,
        messageId: response.data.name,
        timestamp: new Date(),
        deliveryStatus: 'delivered',
        metadata: {
          channelType: 'google_chat',
          spaceId: this.config.space,
          threadName: chatMessage.thread?.name,
        },
      };
    } catch (error) {
      logger.error('Failed to send Google Chat message', {
        error: error instanceof Error ? error.message : String(error),
        recipient: request.recipient,
      });

      return {
        messageId: `error_${Date.now()}`,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        deliveryStatus: 'failed',
      };
    }
  }

  async sendExecutiveBrief(brief: ExecutiveBrief): Promise<MessageResponse> {
    try {
      const card = this.buildExecutiveBriefCard(brief);
      
      const chatMessage: GoogleChatMessage = {
        cards: [card],
        thread: brief.threadId ? { name: brief.threadId } : undefined,
      };

      const response = await this.chatApi.spaces.messages.create({
        parent: this.config.space,
        requestBody: chatMessage,
      });

      return {
        success: true,
        messageId: response.data.name,
        timestamp: new Date(),
        deliveryStatus: 'delivered',
        metadata: {
          channelType: 'google_chat',
          briefType: 'executive',
          sections: brief.sections.length,
        },
      };
    } catch (error) {
      logger.error('Failed to send executive brief to Google Chat', {
        error: error instanceof Error ? error.message : String(error),
        briefId: brief.id,
      });

      return {
        messageId: `error_${Date.now()}`,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        deliveryStatus: 'failed',
      };
    }
  }

  async sendInteractiveMessage(
    content: string,
    elements: InteractiveElement[],
    recipient: string,
    threadId?: string
  ): Promise<MessageResponse> {
    try {
      const card = this.buildInteractiveCard(content, elements);
      
      const chatMessage: GoogleChatMessage = {
        cards: [card],
        thread: threadId ? { name: threadId } : undefined,
      };

      const response = await this.chatApi.spaces.messages.create({
        parent: this.config.space,
        requestBody: chatMessage,
      });

      return {
        success: true,
        messageId: response.data.name,
        timestamp: new Date(),
        deliveryStatus: 'delivered',
        metadata: {
          channelType: 'google_chat',
          interactiveElements: elements.length,
          threadName: threadId,
        },
      };
    } catch (error) {
      logger.error('Failed to send interactive Google Chat message', {
        error: error instanceof Error ? error.message : String(error),
        recipient,
        elementsCount: elements.length,
      });

      return {
        messageId: `error_${Date.now()}`,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        deliveryStatus: 'failed',
      };
    }
  }

  private async buildChatMessage(request: MessageRequest): Promise<GoogleChatMessage> {
    const message: GoogleChatMessage = {};

    // Add text content
    if (request.content) {
      message.text = request.content;
    }

    // Add attachments as cards or file attachments
    if (request.attachments && request.attachments.length > 0) {
      const cards: GoogleChatCard[] = [];
      const attachments: any[] = [];

      for (const attachment of request.attachments) {
        if (attachment.type === 'chart' || attachment.type === 'image') {
          // Convert visual attachments to cards with images
          cards.push({
            sections: [{
              widgets: [{
                image: {
                  imageUrl: attachment.url,
                },
              }, {
                textParagraph: {
                  text: attachment.metadata?.description || `${attachment.type} attachment`,
                },
              }],
            }],
          });
        } else {
          // Handle file attachments
          attachments.push({
            name: attachment.filename,
            contentType: attachment.mimeType,
            source: {
              // Note: Would need to upload to Google Drive first
              driveFile: {
                id: attachment.id,
                name: attachment.filename,
              },
            },
          });
        }
      }

      if (cards.length > 0) {
        message.cards = cards;
      }
      if (attachments.length > 0) {
        message.attachments = attachments;
      }
    }

    // Add threading support
    if (request.threadId) {
      message.thread = { name: request.threadId };
    }

    return message;
  }

  private buildExecutiveBriefCard(brief: ExecutiveBrief): GoogleChatCard {
    const card: GoogleChatCard = {
      header: {
        title: brief.title,
        subtitle: `${brief.priority.toUpperCase()} Priority • ${brief.timestamp.toLocaleString()}`,
      },
      sections: [],
    };

    // Add each section as a card section
    for (const section of brief.sections) {
      const widgets: any[] = [];

      // Add section title
      if (section.title) {
        widgets.push({
          textParagraph: {
            text: `<b>${section.title}</b>`,
          },
        });
      }

      // Add section content
      if (section.content) {
        widgets.push({
          textParagraph: {
            text: section.content,
          },
        });
      }

      // Add key metrics as key-value pairs
      if (section.metrics) {
        for (const [key, value] of Object.entries(section.metrics)) {
          widgets.push({
            keyValue: {
              topLabel: key,
              content: String(value),
            },
          });
        }
      }

      // Add chart if present
      if (section.chart) {
        widgets.push({
          image: {
            imageUrl: section.chart.url,
          },
        });
      }

      card.sections.push({ widgets });
    }

    // Add action buttons if present
    if (brief.actions && brief.actions.length > 0) {
      const actionWidgets = brief.actions.map(action => ({
        textButton: {
          text: action.label || action.title,
          onClick: {
            action: {
              actionMethodName: action.actionId || action.id,
              parameters: action.parameters || {},
            },
          },
        },
      }));

      card.sections.push({
        widgets: [{
          buttons: actionWidgets,
        }],
      });
    }

    return card;
  }

  private buildInteractiveCard(content: string, elements: InteractiveElement[]): GoogleChatCard {
    const card: GoogleChatCard = {
      sections: [{
        widgets: [{
          textParagraph: {
            text: content,
          },
        }],
      }],
    };

    // Add interactive elements
    if (elements.length > 0) {
      const interactiveWidgets: any[] = [];

      for (const element of elements) {
        switch (element.type) {
          case 'button':
            interactiveWidgets.push({
              textButton: {
                text: element.label,
                onClick: {
                  action: {
                    actionMethodName: element.actionId,
                    parameters: element.parameters || {},
                  },
                },
              },
            });
            break;

          case 'dropdown':
            // Google Chat doesn't have native dropdowns, convert to buttons
            if (element.options) {
              for (const option of element.options) {
                interactiveWidgets.push({
                  textButton: {
                    text: option.label,
                    onClick: {
                      action: {
                        actionMethodName: element.actionId,
                        parameters: {
                          ...element.parameters,
                          selected: option.value,
                        },
                      },
                    },
                  },
                });
              }
            }
            break;

          case 'input':
            // Google Chat doesn't support input fields in cards
            // Add instructions for users to reply in chat
            interactiveWidgets.push({
              textParagraph: {
                text: `💬 Please reply with your ${element.label.toLowerCase()}`,
              },
            });
            break;
        }
      }

      if (interactiveWidgets.length > 0) {
        card.sections.push({
          widgets: interactiveWidgets,
        });
      }
    }

    return card;
  }

  async uploadAttachmentToDrive(attachment: MediaAttachment): Promise<string> {
    // This would implement uploading attachments to Google Drive
    // for inclusion in Google Chat messages
    try {
      // const drive = google.drive({
      //   version: 'v3',
      //   auth: this.jwtClient,
      // }); // Unused for now

      // Implementation would upload file and return Drive file ID
      // This is a placeholder for the actual implementation
      logger.info('Uploading attachment to Google Drive', {
        filename: attachment.filename,
        size: attachment.size,
      });

      return 'drive-file-id'; // Placeholder
    } catch (error) {
      logger.error('Failed to upload attachment to Google Drive', {
        error: error instanceof Error ? error.message : String(error),
        filename: attachment.filename,
      });
      throw error;
    }
  }

  async createThread(title: string): Promise<string> {
    try {
      // Google Chat threads are created automatically when replying
      // This method would set up thread metadata if needed
      const threadId = `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info('Creating Google Chat thread', {
        threadId,
        title,
      });

      return threadId;
    } catch (error) {
      logger.error('Failed to create Google Chat thread', {
        error: error instanceof Error ? error.message : String(error),
        title,
      });
      throw error;
    }
  }

  async handleIncomingMessage(message: any): Promise<void> {
    // Handle incoming messages from Google Chat webhooks
    try {
      logger.info('Received Google Chat message', {
        messageId: message.name,
        senderId: message.sender?.name,
        text: message.text?.substring(0, 100),
      });

      // Process incoming message
      // This would trigger the personal assistant agent
      // Implementation depends on message routing architecture
    } catch (error) {
      logger.error('Failed to handle incoming Google Chat message', {
        error: error instanceof Error ? error.message : String(error),
        messageId: message.name,
      });
    }
  }

  async getChannelInfo(): Promise<any> {
    return {
      type: this.type,
      capabilities: this.capabilities,
      space: this.config.space,
      botUserId: this.config.botUserId,
    };
  }

  async shutdown(): Promise<void> {
    // Cleanup resources if needed
    logger.info('Google Chat channel shutting down');
  }
}

export default GoogleChatChannel;