import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
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

// Define which transports the logger must use
const transports: winston.transport[] = [];

// Console transport for development
if (config.nodeEnv === 'development') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
        winston.format.colorize({ all: true }),
        winston.format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`
        )
      ),
    })
  );
}

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

// Create the logger
const logger = winston.createLogger({
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

// Create specialized loggers for different components
export const agentLogger = logger.child({ component: 'agent' });
export const communicationLogger = logger.child({ component: 'communication' });
export const knowledgeLogger = logger.child({ component: 'knowledge' });
export const contextLogger = logger.child({ component: 'context' });
export const visualLogger = logger.child({ component: 'visual' });
export const apiLogger = logger.child({ component: 'api' });

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