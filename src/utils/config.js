"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.loadPrivateConfig = loadPrivateConfig;
const dotenv = __importStar(require("dotenv"));
const fs_1 = require("fs");
const path_1 = require("path");
// Load environment variables
dotenv.config();
function getEnvVar(name, defaultValue) {
    const value = process.env[name] || defaultValue;
    if (!value) {
        throw new Error(`Environment variable ${name} is required`);
    }
    return value;
}
function getEnvNumber(name, defaultValue) {
    const value = process.env[name];
    if (!value) {
        if (defaultValue !== undefined)
            return defaultValue;
        throw new Error(`Environment variable ${name} is required`);
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new Error(`Environment variable ${name} must be a valid number`);
    }
    return parsed;
}
exports.config = {
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
        ollama: {
            host: getEnvVar('OLLAMA_HOST', 'localhost'),
            port: getEnvNumber('OLLAMA_PORT', 11434),
            defaultModel: getEnvVar('OLLAMA_DEFAULT_MODEL', 'qwen3:8b'),
            embeddingModel: getEnvVar('OLLAMA_EMBEDDING_MODEL', 'all-minilm'),
            timeout: getEnvNumber('OLLAMA_TIMEOUT', 120000), // Increased for larger models
            maxRetries: getEnvNumber('OLLAMA_MAX_RETRIES', 3),
            availableModels: {
                reasoning: ['qwen3:8b', 'llama3.2', 'mistral'],
                coding: ['qwen3:8b', 'deepseek-coder', 'codellama'],
                embedding: ['all-minilm', 'nomic-embed-text']
            }
        },
        pytorch: {
            serviceUrl: getEnvVar('PYTORCH_SERVICE_URL', 'http://localhost'),
            servicePort: getEnvNumber('PYTORCH_SERVICE_PORT', 8001),
            defaultModel: getEnvVar('PYTORCH_DEFAULT_MODEL', 'Qwen/Qwen2.5-Coder-7B-Instruct'),
            defaultEmbeddingModel: getEnvVar('PYTORCH_EMBEDDING_MODEL', 'sentence-transformers/all-MiniLM-L6-v2'),
            healthCheckInterval: getEnvNumber('PYTORCH_HEALTH_CHECK_INTERVAL', 30000),
            requestTimeout: getEnvNumber('PYTORCH_REQUEST_TIMEOUT', 60000),
            autoStart: process.env.PYTORCH_AUTO_START === 'true',
            availableModels: {
                reasoning: ['Qwen/Qwen2.5-Coder-7B-Instruct', 'microsoft/DialoGPT-medium'],
                coding: ['Qwen/Qwen2.5-Coder-7B-Instruct', 'microsoft/CodeBERT-base'],
                embedding: ['sentence-transformers/all-MiniLM-L6-v2', 'BAAI/bge-large-en-v1.5']
            }
        },
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
function loadPrivateConfig(userId) {
    try {
        const configPath = userId
            ? (0, path_1.join)(process.cwd(), 'config', `private.${userId}.json`)
            : (0, path_1.join)(process.cwd(), 'config', 'private.json');
        const configData = (0, fs_1.readFileSync)(configPath, 'utf8');
        return JSON.parse(configData);
    }
    catch (error) {
        console.warn('Private config not found, using defaults');
        return null;
    }
}
exports.default = exports.config;
