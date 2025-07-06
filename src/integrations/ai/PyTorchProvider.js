"use strict";
/**
 * PyTorch Provider Implementation
 *
 * Implements the unified AIProvider interface for PyTorch/Hugging Face models
 * via a Python microservice. This enables direct access to any HF model while
 * maintaining the same interface as other providers.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PyTorchProvider = void 0;
const AIProvider_1 = require("./AIProvider");
const logger_1 = __importDefault(require("../../utils/logger"));
const axios_1 = __importDefault(require("axios"));
class PyTorchProvider extends AIProvider_1.BaseAIProvider {
    constructor(config) {
        super(config);
        this.isServiceHealthy = false;
        this.pytorchConfig = config;
        this.client = axios_1.default.create({
            baseURL: `${config.serviceUrl}:${config.servicePort}`,
            timeout: config.requestTimeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        logger_1.default.info('PyTorchProvider initialized', {
            name: this.name,
            serviceUrl: config.serviceUrl,
            servicePort: config.servicePort,
            defaultModel: config.defaultModel
        });
    }
    get name() {
        return 'pytorch';
    }
    get capabilities() {
        return {
            textGeneration: true,
            embedding: true,
            multiModal: false, // Can be extended for vision models
            streaming: false, // Can be implemented with SSE
            functionCalling: false, // Can be added for specific models
            localExecution: true,
            supportedModels: this.config.models.text
        };
    }
    async generateText(request) {
        const startTime = Date.now();
        try {
            logger_1.default.debug('Generating text with PyTorch service', {
                model: request.model || this.config.defaultModel,
                messageCount: request.messages.length
            });
            // Convert unified format to PyTorch service format
            const pytorchMessages = request.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
            // Add system prompt as first message if provided
            if (request.systemPrompt) {
                pytorchMessages.unshift({
                    role: 'system',
                    content: request.systemPrompt
                });
            }
            const pytorchRequest = {
                model: request.model || this.config.defaultModel,
                messages: pytorchMessages,
                max_tokens: request.maxTokens || 500,
                temperature: request.temperature || 0.7,
                top_p: 0.9
            };
            const response = await this.client.post('/generate', pytorchRequest);
            const processingTime = Date.now() - startTime;
            this.updateMetrics(true, processingTime, response.data.usage.total_tokens);
            return {
                content: response.data.content,
                model: response.data.model,
                usage: {
                    inputTokens: response.data.usage.input_tokens,
                    outputTokens: response.data.usage.output_tokens,
                    totalTokens: response.data.usage.total_tokens
                },
                finishReason: response.data.finish_reason,
                metadata: {
                    processingTime,
                    serviceProvider: 'pytorch'
                }
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updateMetrics(false, processingTime);
            logger_1.default.error('PyTorch text generation failed', {
                error: error instanceof Error ? error.message : String(error),
                model: request.model || this.config.defaultModel,
                processingTime
            });
            if (axios_1.default.isAxiosError(error)) {
                const status = error.response?.status;
                const message = error.response?.data?.detail || error.message;
                throw new Error(`PyTorch service error (${status}): ${message}`);
            }
            throw new Error(`PyTorch text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async generateEmbedding(request) {
        const startTime = Date.now();
        try {
            logger_1.default.debug('Generating embeddings with PyTorch service', {
                model: request.model || this.pytorchConfig.defaultEmbeddingModel,
                textCount: request.texts.length
            });
            const pytorchRequest = {
                model: request.model || this.pytorchConfig.defaultEmbeddingModel,
                texts: request.texts,
                normalize: true
            };
            const response = await this.client.post('/embeddings', pytorchRequest);
            const processingTime = Date.now() - startTime;
            this.updateMetrics(true, processingTime, response.data.usage.total_tokens);
            return {
                embeddings: response.data.embeddings,
                model: response.data.model,
                usage: {
                    inputTokens: response.data.usage.input_tokens,
                    outputTokens: 0,
                    totalTokens: response.data.usage.total_tokens
                },
                metadata: {
                    processingTime,
                    serviceProvider: 'pytorch'
                }
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updateMetrics(false, processingTime);
            logger_1.default.error('PyTorch embedding generation failed', {
                error: error instanceof Error ? error.message : String(error),
                model: request.model || this.pytorchConfig.defaultEmbeddingModel,
                processingTime
            });
            if (axios_1.default.isAxiosError(error)) {
                const status = error.response?.status;
                const message = error.response?.data?.detail || error.message;
                throw new Error(`PyTorch service error (${status}): ${message}`);
            }
            throw new Error(`PyTorch embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async healthCheck() {
        const startTime = Date.now();
        try {
            const response = await this.client.get('/health');
            this.isServiceHealthy = response.data.status === 'healthy';
            this.lastHealthCheck = new Date();
            return {
                healthy: this.isServiceHealthy,
                latencyMs: Date.now() - startTime,
                timestamp: new Date(),
                metadata: {
                    pytorchVersion: response.data.pytorch_version,
                    cudaAvailable: response.data.cuda_available,
                    loadedModels: response.data.loaded_models
                }
            };
        }
        catch (error) {
            this.isServiceHealthy = false;
            return {
                healthy: false,
                error: error instanceof Error ? error.message : 'PyTorch service unreachable',
                timestamp: new Date()
            };
        }
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            logger_1.default.info('Initializing PyTorch provider', { name: this.name });
            // Test connection to PyTorch service
            const health = await this.healthCheck();
            if (!health.healthy) {
                throw new Error(`PyTorch service health check failed: ${health.error}`);
            }
            // Optionally preload default models
            if (this.config.defaultModel) {
                await this.preloadModel(this.config.defaultModel, 'text-generation');
            }
            if (this.pytorchConfig.defaultEmbeddingModel) {
                await this.preloadModel(this.pytorchConfig.defaultEmbeddingModel, 'embedding');
            }
            this.initialized = true;
            logger_1.default.info('PyTorch provider initialized successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to initialize PyTorch provider', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async shutdown() {
        logger_1.default.info('Shutting down PyTorch provider');
        this.initialized = false;
    }
    // PyTorch-specific methods
    async preloadModel(modelId, modelType = 'text-generation') {
        try {
            logger_1.default.info('Preloading PyTorch model', { model: modelId, type: modelType });
            await this.client.post('/models/load', null, {
                params: {
                    model_id: modelId,
                    model_type: modelType
                }
            });
            logger_1.default.info('Model preloaded successfully', { model: modelId });
        }
        catch (error) {
            logger_1.default.warn('Failed to preload model', {
                model: modelId,
                error: error instanceof Error ? error.message : String(error)
            });
            // Don't throw - preloading is optional
        }
    }
    async unloadModel(modelId) {
        try {
            await this.client.post('/models/unload', null, {
                params: { model_id: modelId }
            });
            logger_1.default.info('Model unloaded', { model: modelId });
        }
        catch (error) {
            logger_1.default.error('Failed to unload model', {
                model: modelId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async listLoadedModels() {
        try {
            const response = await this.client.get('/models');
            return response.data;
        }
        catch (error) {
            logger_1.default.error('Failed to list models', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async deleteModelCache(modelId) {
        try {
            await this.client.delete(`/models/${modelId}`);
            logger_1.default.info('Model cache deleted', { model: modelId });
        }
        catch (error) {
            logger_1.default.error('Failed to delete model cache', {
                model: modelId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    // Service management
    isServiceAvailable() {
        return this.isServiceHealthy;
    }
    getLastHealthCheck() {
        return this.lastHealthCheck;
    }
    getServiceUrl() {
        return `${this.pytorchConfig.serviceUrl}:${this.pytorchConfig.servicePort}`;
    }
}
exports.PyTorchProvider = PyTorchProvider;
exports.default = PyTorchProvider;
