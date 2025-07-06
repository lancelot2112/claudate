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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPerformance = exports.logError = exports.logCommunication = exports.logAgentAction = exports.apiLogger = exports.visualLogger = exports.contextLogger = exports.knowledgeLogger = exports.communicationLogger = exports.agentLogger = void 0;
const winston = __importStar(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const config_1 = require("./config");
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
let _logger = null;
function createLoggerInstance() {
    // Define which transports the logger must use
    const transports = [];
    // Console transport for development and test environments
    if (config_1.config.nodeEnv === 'development' || isTestEnvironment) {
        transports.push(new winston.transports.Console({
            format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston.format.colorize({ all: true }), winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)),
            silent: isTestEnvironment, // Suppress console output during tests
        }));
    }
    // Only add file transports in non-test environments to avoid FS conflicts
    if (!isTestEnvironment) {
        // File transport for all environments
        transports.push(new winston_daily_rotate_file_1.default({
            filename: 'logs/claudate-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
        }));
        // Error file transport
        transports.push(new winston_daily_rotate_file_1.default({
            filename: 'logs/claudate-error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d',
            level: 'error',
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
        }));
    }
    // Create the logger instance
    return winston.createLogger({
        level: config_1.config.logLevel,
        levels,
        format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
        transports,
        exitOnError: false,
    });
}
// Lazy initialization function
function getLogger() {
    if (!_logger) {
        _logger = createLoggerInstance();
    }
    return _logger;
}
// Lazy logger proxy that implements the winston Logger interface
const logger = {
    error: (message, ...meta) => getLogger().error(message, ...meta),
    warn: (message, ...meta) => getLogger().warn(message, ...meta),
    info: (message, ...meta) => getLogger().info(message, ...meta),
    http: (message, ...meta) => getLogger().http(message, ...meta),
    debug: (message, ...meta) => getLogger().debug(message, ...meta),
    child: (defaultMeta) => getLogger().child(defaultMeta),
};
// Create specialized loggers for different components (lazy initialization)
exports.agentLogger = {
    error: (message, ...meta) => getLogger().child({ component: 'agent' }).error(message, ...meta),
    warn: (message, ...meta) => getLogger().child({ component: 'agent' }).warn(message, ...meta),
    info: (message, ...meta) => getLogger().child({ component: 'agent' }).info(message, ...meta),
    debug: (message, ...meta) => getLogger().child({ component: 'agent' }).debug(message, ...meta),
};
exports.communicationLogger = {
    error: (message, ...meta) => getLogger().child({ component: 'communication' }).error(message, ...meta),
    warn: (message, ...meta) => getLogger().child({ component: 'communication' }).warn(message, ...meta),
    info: (message, ...meta) => getLogger().child({ component: 'communication' }).info(message, ...meta),
    debug: (message, ...meta) => getLogger().child({ component: 'communication' }).debug(message, ...meta),
};
exports.knowledgeLogger = {
    error: (message, ...meta) => getLogger().child({ component: 'knowledge' }).error(message, ...meta),
    warn: (message, ...meta) => getLogger().child({ component: 'knowledge' }).warn(message, ...meta),
    info: (message, ...meta) => getLogger().child({ component: 'knowledge' }).info(message, ...meta),
    debug: (message, ...meta) => getLogger().child({ component: 'knowledge' }).debug(message, ...meta),
};
exports.contextLogger = {
    error: (message, ...meta) => getLogger().child({ component: 'context' }).error(message, ...meta),
    warn: (message, ...meta) => getLogger().child({ component: 'context' }).warn(message, ...meta),
    info: (message, ...meta) => getLogger().child({ component: 'context' }).info(message, ...meta),
    debug: (message, ...meta) => getLogger().child({ component: 'context' }).debug(message, ...meta),
};
exports.visualLogger = {
    error: (message, ...meta) => getLogger().child({ component: 'visual' }).error(message, ...meta),
    warn: (message, ...meta) => getLogger().child({ component: 'visual' }).warn(message, ...meta),
    info: (message, ...meta) => getLogger().child({ component: 'visual' }).info(message, ...meta),
    debug: (message, ...meta) => getLogger().child({ component: 'visual' }).debug(message, ...meta),
};
exports.apiLogger = {
    error: (message, ...meta) => getLogger().child({ component: 'api' }).error(message, ...meta),
    warn: (message, ...meta) => getLogger().child({ component: 'api' }).warn(message, ...meta),
    info: (message, ...meta) => getLogger().child({ component: 'api' }).info(message, ...meta),
    debug: (message, ...meta) => getLogger().child({ component: 'api' }).debug(message, ...meta),
};
// Helper functions for structured logging
const logAgentAction = (agentId, action, metadata) => {
    exports.agentLogger.info(`Agent ${agentId} performed action: ${action}`, {
        agentId,
        action,
        ...metadata,
    });
};
exports.logAgentAction = logAgentAction;
const logCommunication = (channel, direction, message, metadata) => {
    exports.communicationLogger.info(`${direction} message via ${channel}`, {
        channel,
        direction,
        message: message.substring(0, 100), // Truncate for privacy
        ...metadata,
    });
};
exports.logCommunication = logCommunication;
const logError = (error, context, metadata) => {
    logger.error(`Error${context ? ` in ${context}` : ''}: ${error.message}`, {
        error: error.stack,
        context,
        ...metadata,
    });
};
exports.logError = logError;
const logPerformance = (operation, duration, metadata) => {
    logger.info(`Performance: ${operation} took ${duration}ms`, {
        operation,
        duration,
        ...metadata,
    });
};
exports.logPerformance = logPerformance;
exports.default = logger;
