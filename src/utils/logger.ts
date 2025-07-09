import * as winston from 'winston';
const DailyRotateFile = require('winston-daily-rotate-file');
import { config } from './config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors defined above to the severity levels
winston.addColors(colors);

// Check if we're in a test environment to avoid file operations
const isTestEnvironment = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;

// Lazy logger initialization to avoid file system operations during import
let _logger: winston.Logger | null = null;

function createLoggerInstance(): winston.Logger {
  // Define which transports the logger must use
  const transports: winston.transport[] = [];

  // Console transport for development and test environments
  if (config.nodeEnv === 'development' || isTestEnvironment) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
          winston.format.colorize({ all: true }),
          winston.format.printf(
            (info) => `${info.timestamp} ${info.level}: ${info.message}`
          )
        ),
        silent: isTestEnvironment, // Suppress console output during tests
      })
    );
  }

  // Only add file transports in non-test environments to avoid FS conflicts
  if (!isTestEnvironment) {
    // File transport for all environments
    transports.push(
      new DailyRotateFile({
        filename: 'logs/claudate-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
      })
    );

    // Error file transport
    transports.push(
      new DailyRotateFile({
        filename: 'logs/claudate-error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
      })
    );
  }

  // Create the logger instance
  return winston.createLogger({
    level: config.logLevel,
    levels,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports,
    exitOnError: false,
  });
}

// Lazy initialization function
function getLogger(): winston.Logger {
  if (!_logger) {
    _logger = createLoggerInstance();
  }
  return _logger;
}

// Lazy logger proxy that implements the winston Logger interface
const logger = {
  error: (message: any, ...meta: any[]) => getLogger().error(message, ...meta),
  warn: (message: any, ...meta: any[]) => getLogger().warn(message, ...meta),
  info: (message: any, ...meta: any[]) => getLogger().info(message, ...meta),
  http: (message: any, ...meta: any[]) => getLogger().http(message, ...meta),
  debug: (message: any, ...meta: any[]) => getLogger().debug(message, ...meta),
  child: (defaultMeta: any) => getLogger().child(defaultMeta),
} as winston.Logger;

// Create specialized loggers for different components (lazy initialization)
export const agentLogger = {
  error: (message: any, ...meta: any[]) => getLogger().child({ component: 'agent' }).error(message, ...meta),
  warn: (message: any, ...meta: any[]) => getLogger().child({ component: 'agent' }).warn(message, ...meta),
  info: (message: any, ...meta: any[]) => getLogger().child({ component: 'agent' }).info(message, ...meta),
  debug: (message: any, ...meta: any[]) => getLogger().child({ component: 'agent' }).debug(message, ...meta),
};

export const communicationLogger = {
  error: (message: any, ...meta: any[]) => getLogger().child({ component: 'communication' }).error(message, ...meta),
  warn: (message: any, ...meta: any[]) => getLogger().child({ component: 'communication' }).warn(message, ...meta),
  info: (message: any, ...meta: any[]) => getLogger().child({ component: 'communication' }).info(message, ...meta),
  debug: (message: any, ...meta: any[]) => getLogger().child({ component: 'communication' }).debug(message, ...meta),
};

export const knowledgeLogger = {
  error: (message: any, ...meta: any[]) => getLogger().child({ component: 'knowledge' }).error(message, ...meta),
  warn: (message: any, ...meta: any[]) => getLogger().child({ component: 'knowledge' }).warn(message, ...meta),
  info: (message: any, ...meta: any[]) => getLogger().child({ component: 'knowledge' }).info(message, ...meta),
  debug: (message: any, ...meta: any[]) => getLogger().child({ component: 'knowledge' }).debug(message, ...meta),
};

export const contextLogger = {
  error: (message: any, ...meta: any[]) => getLogger().child({ component: 'context' }).error(message, ...meta),
  warn: (message: any, ...meta: any[]) => getLogger().child({ component: 'context' }).warn(message, ...meta),
  info: (message: any, ...meta: any[]) => getLogger().child({ component: 'context' }).info(message, ...meta),
  debug: (message: any, ...meta: any[]) => getLogger().child({ component: 'context' }).debug(message, ...meta),
};

export const visualLogger = {
  error: (message: any, ...meta: any[]) => getLogger().child({ component: 'visual' }).error(message, ...meta),
  warn: (message: any, ...meta: any[]) => getLogger().child({ component: 'visual' }).warn(message, ...meta),
  info: (message: any, ...meta: any[]) => getLogger().child({ component: 'visual' }).info(message, ...meta),
  debug: (message: any, ...meta: any[]) => getLogger().child({ component: 'visual' }).debug(message, ...meta),
};

export const apiLogger = {
  error: (message: any, ...meta: any[]) => getLogger().child({ component: 'api' }).error(message, ...meta),
  warn: (message: any, ...meta: any[]) => getLogger().child({ component: 'api' }).warn(message, ...meta),
  info: (message: any, ...meta: any[]) => getLogger().child({ component: 'api' }).info(message, ...meta),
  debug: (message: any, ...meta: any[]) => getLogger().child({ component: 'api' }).debug(message, ...meta),
};

// Helper functions for structured logging
export const logAgentAction = (agentId: string, action: string, metadata?: any) => {
  agentLogger.info(`Agent ${agentId} performed action: ${action}`, {
    agentId,
    action,
    ...metadata,
  });
};

export const logCommunication = (
  channel: string,
  direction: 'incoming' | 'outgoing',
  message: string,
  metadata?: any
) => {
  communicationLogger.info(`${direction} message via ${channel}`, {
    channel,
    direction,
    message: message.substring(0, 100), // Truncate for privacy
    ...metadata,
  });
};

export const logError = (error: Error, context?: string, metadata?: any) => {
  logger.error(`Error${context ? ` in ${context}` : ''}: ${error.message}`, {
    error: error.stack,
    context,
    ...metadata,
  });
};

export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  logger.info(`Performance: ${operation} took ${duration}ms`, {
    operation,
    duration,
    ...metadata,
  });
};

export default logger;