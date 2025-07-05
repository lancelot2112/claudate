import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';

import { config } from '@/utils/config';
import logger, { apiLogger } from '@/utils/logger';

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: config.logLevel,
    transport: config.nodeEnv === 'development' ? {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
});

// Register plugins
async function registerPlugins() {
  // Security
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable for development
  });

  // CORS
  await fastify.register(cors, {
    origin: config.nodeEnv === 'development' ? true : [config.publicUrl],
    credentials: true,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: config.rateLimit.maxRequests,
    timeWindow: config.rateLimit.windowMs,
  });

  // JWT
  await fastify.register(jwt, {
    secret: config.security.jwtSecret,
  });

  // WebSocket support for real-time communication
  await fastify.register(websocket);
}

// Register routes
async function registerRoutes() {
  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    apiLogger.info('Health check requested');
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.nodeEnv,
      uptime: process.uptime(),
    };
  });

  // API info endpoint
  fastify.get('/api/info', async (request, reply) => {
    return {
      name: 'Claudate API',
      description: 'Agentic team framework API',
      version: process.env.npm_package_version || '1.0.0',
      documentation: `${config.apiBaseUrl}/docs`,
    };
  });

  // Root endpoint
  fastify.get('/', async (request, reply) => {
    return {
      message: 'Welcome to Claudate - Agentic Team Framework',
      documentation: `${config.apiBaseUrl}/docs`,
      health: `${config.apiBaseUrl}/health`,
    };
  });

  // Webhook endpoints placeholder
  fastify.register(async function webhooks(fastify) {
    fastify.addHook('preHandler', async (request, reply) => {
      apiLogger.info(`Webhook received: ${request.method} ${request.url}`);
    });

    // Twilio webhook placeholder
    fastify.post('/webhooks/twilio/sms', async (request, reply) => {
      apiLogger.info('Twilio SMS webhook received', { body: request.body });
      return { received: true };
    });

    // Google Chat webhook placeholder
    fastify.post('/webhooks/google-chat', async (request, reply) => {
      apiLogger.info('Google Chat webhook received', { body: request.body });
      return { received: true };
    });
  });
}

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  apiLogger.error(`Request error: ${error.message}`, {
    url: request.url,
    method: request.method,
    stack: error.stack,
  });

  const statusCode = error.statusCode || 500;
  const response: any = {
    error: true,
    message: statusCode === 500 ? 'Internal Server Error' : error.message,
    statusCode,
  };

  if (config.nodeEnv === 'development') {
    response.stack = error.stack;
  }

  reply.status(statusCode).send(response);
});

// Not found handler
fastify.setNotFoundHandler((request, reply) => {
  apiLogger.warn(`404 Not Found: ${request.method} ${request.url}`);
  reply.status(404).send({
    error: true,
    message: 'Route not found',
    statusCode: 404,
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  
  try {
    await fastify.close();
    logger.info('Server closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function start() {
  try {
    // Register plugins and routes
    await registerPlugins();
    await registerRoutes();

    // Start listening
    await fastify.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    logger.info(`Claudate API server started successfully`, {
      port: config.port,
      environment: config.nodeEnv,
      logLevel: config.logLevel,
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Initialize server for testing
async function initializeForTesting() {
  try {
    await registerPlugins();
    await registerRoutes();
    return fastify;
  } catch (error) {
    logger.error('Failed to initialize server for testing:', error);
    throw error;
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  start();
}

export default fastify;
export { initializeForTesting };