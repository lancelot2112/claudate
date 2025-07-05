import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config();

export interface DatabaseConfig {
  url: string;
  host: string;
  port: number;
  name: string;
  user: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface RedisConfig {
  url: string;
  host: string;
  port: number;
  password: string;
}

export interface AIConfig {
  anthropic: {
    apiKey: string;
  };
  google: {
    apiKey: string;
    projectId: string;
  };
  openai?: {
    apiKey: string;
  };
}

export interface CommunicationConfig {
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
  sendgrid: {
    apiKey: string;
    fromEmail: string;
  };
  googleChat: {
    credentialsPath: string;
    webhookUrl: string;
  };
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
  apiBaseUrl: string;
  publicUrl: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  chroma: {
    url: string;
    host: string;
    port: number;
  };
  ai: AIConfig;
  communication: CommunicationConfig;
  knowledge: {
    vectorStore: {
      provider: string;
      collectionName: string;
      embeddingProvider: string;
      url: string;
    };
    ingestion: {
      maxFileSize: number;
      supportedFormats: string[];
    };
  };
  security: {
    jwtSecret: string;
    jwtExpiresIn: string;
    encryptionKey: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  agents: {
    defaultTimeout: number;
    maxRetries: number;
    contextWindowSize: number;
  };
  costs: {
    dailyLimit: number;
    alertThreshold: number;
  };
  visual: {
    chartMaxWidth: number;
    chartMaxHeight: number;
    chartQuality: number;
    imageCompressionQuality: number;
    imageMaxSizeMB: number;
  };
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function getEnvNumber(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (!value) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Environment variable ${name} is required`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid number`);
  }
  return parsed;
}

export const config: AppConfig = {
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  port: getEnvNumber('PORT', 3000),
  logLevel: getEnvVar('LOG_LEVEL', 'info'),
  apiBaseUrl: getEnvVar('API_BASE_URL', 'http://localhost:3000'),
  publicUrl: getEnvVar('PUBLIC_URL', 'http://localhost:3000'),

  database: {
    url: getEnvVar('DATABASE_URL'),
    host: getEnvVar('DATABASE_HOST', 'localhost'),
    port: getEnvNumber('DATABASE_PORT', 5432),
    name: getEnvVar('DATABASE_NAME', 'claudate'),
    user: getEnvVar('DATABASE_USER', 'claudate'),
    username: getEnvVar('DATABASE_USER', 'claudate'),
    password: getEnvVar('DATABASE_PASSWORD'),
    ssl: process.env.DATABASE_SSL === 'true',
  },

  redis: {
    url: getEnvVar('REDIS_URL'),
    host: getEnvVar('REDIS_HOST', 'localhost'),
    port: getEnvNumber('REDIS_PORT', 6379),
    password: getEnvVar('REDIS_PASSWORD'),
  },

  chroma: {
    url: getEnvVar('CHROMA_URL', 'http://localhost:8000'),
    host: getEnvVar('CHROMA_HOST', 'localhost'),
    port: getEnvNumber('CHROMA_PORT', 8000),
  },

  ai: {
    anthropic: {
      apiKey: getEnvVar('ANTHROPIC_API_KEY'),
    },
    google: {
      apiKey: getEnvVar('GOOGLE_AI_API_KEY'),
      projectId: getEnvVar('GOOGLE_PROJECT_ID'),
    },
    openai: process.env.OPENAI_API_KEY ? {
      apiKey: getEnvVar('OPENAI_API_KEY'),
    } : undefined,
  },

  communication: {
    twilio: {
      accountSid: getEnvVar('TWILIO_ACCOUNT_SID'),
      authToken: getEnvVar('TWILIO_AUTH_TOKEN'),
      phoneNumber: getEnvVar('TWILIO_PHONE_NUMBER'),
    },
    sendgrid: {
      apiKey: getEnvVar('SENDGRID_API_KEY'),
      fromEmail: getEnvVar('SENDGRID_FROM_EMAIL'),
    },
    googleChat: {
      credentialsPath: getEnvVar('GOOGLE_CHAT_CREDENTIALS_PATH'),
      webhookUrl: getEnvVar('GOOGLE_CHAT_WEBHOOK_URL'),
    },
  },

  knowledge: {
    vectorStore: {
      provider: getEnvVar('VECTOR_STORE_PROVIDER', 'chromadb'),
      collectionName: getEnvVar('VECTOR_COLLECTION_NAME', 'claudate-knowledge'),
      embeddingProvider: getEnvVar('EMBEDDING_PROVIDER', 'openai'),
      url: getEnvVar('CHROMA_URL', 'http://localhost:8000'),
    },
    ingestion: {
      maxFileSize: getEnvNumber('KNOWLEDGE_MAX_FILE_SIZE', 10485760), // 10MB
      supportedFormats: getEnvVar('KNOWLEDGE_SUPPORTED_FORMATS', 'pdf,txt,md,json,js,ts,py').split(','),
    },
  },

  security: {
    jwtSecret: getEnvVar('JWT_SECRET'),
    jwtExpiresIn: getEnvVar('JWT_EXPIRES_IN', '24h'),
    encryptionKey: getEnvVar('ENCRYPTION_KEY'),
  },

  rateLimit: {
    windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
    maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
  },

  agents: {
    defaultTimeout: getEnvNumber('AGENT_DEFAULT_TIMEOUT', 30000),
    maxRetries: getEnvNumber('AGENT_MAX_RETRIES', 3),
    contextWindowSize: getEnvNumber('AGENT_CONTEXT_WINDOW_SIZE', 50),
  },

  costs: {
    dailyLimit: parseFloat(getEnvVar('AI_COST_LIMIT_DAILY', '100.00')),
    alertThreshold: parseFloat(getEnvVar('AI_COST_ALERT_THRESHOLD', '80.00')),
  },

  visual: {
    chartMaxWidth: getEnvNumber('CHART_MAX_WIDTH', 800),
    chartMaxHeight: getEnvNumber('CHART_MAX_HEIGHT', 600),
    chartQuality: getEnvNumber('CHART_QUALITY', 90),
    imageCompressionQuality: getEnvNumber('IMAGE_COMPRESSION_QUALITY', 85),
    imageMaxSizeMB: getEnvNumber('IMAGE_MAX_SIZE_MB', 10),
  },
};

// Load private configuration if it exists
export function loadPrivateConfig(userId?: string): any {
  try {
    const configPath = userId 
      ? join(process.cwd(), 'config', `private.${userId}.json`)
      : join(process.cwd(), 'config', 'private.json');
    
    const configData = readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.warn('Private config not found, using defaults');
    return null;
  }
}

export default config;