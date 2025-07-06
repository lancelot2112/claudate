"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaClient = void 0;
const ollama_1 = require("ollama");
const config_1 = require("../../utils/config");
const logger_1 = __importDefault(require("../../utils/logger"));
class OllamaClient {
    constructor(customConfig) {
        this.costTracker = new Map();
        this.config = {
            host: config_1.config.ai?.ollama?.host || 'localhost',
            port: config_1.config.ai?.ollama?.port || 11434,
            defaultModel: config_1.config.ai?.ollama?.defaultModel || 'llama3.2',
            embeddingModel: config_1.config.ai?.ollama?.embeddingModel || 'qwen2.5',
            timeout: config_1.config.ai?.ollama?.timeout || 30000,
            maxRetries: config_1.config.ai?.ollama?.maxRetries || 3,
            ...customConfig
        };
        this.client = new ollama_1.Ollama({
            host: `http://${this.config.host}:${this.config.port}`
        });
        logger_1.default.info('OllamaClient initialized', {
            host: this.config.host,
            port: this.config.port,
            defaultModel: this.config.defaultModel,
            embeddingModel: this.config.embeddingModel
        });
    }
    async sendMessage(request) {
        try {
            const startTime = Date.now();
            const model = request.model || this.config.defaultModel;
            logger_1.default.debug('Sending message to Ollama', {
                model,
                messageCount: request.messages?.length || 0,
                hasPrompt: !!request.prompt
            });
            let response;
            if (request.messages) {
                // Chat completion format
                response = await this.client.chat({
                    model,
                    messages: request.messages,
                    stream: false,
                    options: request.options
                });
            }
            else if (request.prompt) {
                // Direct prompt format
                response = await this.client.generate({
                    model,
                    prompt: request.prompt,
                    stream: false,
                    options: request.options
                });
            }
            else {
                throw new Error('Either messages or prompt must be provided');
            }
            const duration = Date.now() - startTime;
            // Track costs (Ollama is free but track usage)
            this.updateCosts('local', 0);
            logger_1.default.debug('Ollama response received', {
                model,
                duration,
                responseLength: ('message' in response ? response.message?.content?.length : response.response?.length) || 0
            });
            return {
                content: ('message' in response ? response.message?.content : response.response) || '',
                model: response.model,
                done: response.done || true,
                total_duration: response.total_duration,
                load_duration: response.load_duration,
                prompt_eval_count: response.prompt_eval_count,
                eval_count: response.eval_count
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger_1.default.error('Ollama message failed', {
                error: errorMessage,
                model: request.model || this.config.defaultModel
            });
            throw new Error(`Ollama request failed: ${errorMessage}`);
        }
    }
    async generateEmbedding(text, model) {
        try {
            const startTime = Date.now();
            const embeddingModel = model || this.config.embeddingModel;
            logger_1.default.debug('Generating embedding with Ollama', {
                model: embeddingModel,
                textLength: text.length
            });
            const response = await this.client.embeddings({
                model: embeddingModel,
                prompt: text
            });
            const duration = Date.now() - startTime;
            // Track costs (free for local)
            this.updateCosts('embedding', 0);
            logger_1.default.debug('Ollama embedding generated', {
                model: embeddingModel,
                duration,
                dimensions: response.embedding?.length || 0
            });
            if (!response.embedding || response.embedding.length === 0) {
                throw new Error('No embedding returned from Ollama');
            }
            return {
                embedding: response.embedding,
                model: embeddingModel
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger_1.default.error('Ollama embedding failed', {
                error: errorMessage,
                model: model || this.config.embeddingModel
            });
            throw new Error(`Ollama embedding failed: ${errorMessage}`);
        }
    }
    async generateEmbeddings(texts, model) {
        try {
            const embeddings = [];
            for (const text of texts) {
                const response = await this.generateEmbedding(text, model);
                embeddings.push(response.embedding);
            }
            return embeddings;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger_1.default.error('Ollama batch embeddings failed', { error: errorMessage });
            throw new Error(`Ollama batch embeddings failed: ${errorMessage}`);
        }
    }
    async listModels() {
        try {
            const response = await this.client.list();
            return response.models?.map(model => model.name) || [];
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger_1.default.error('Failed to list Ollama models', { error: errorMessage });
            throw new Error(`Failed to list models: ${errorMessage}`);
        }
    }
    async pullModel(model) {
        try {
            logger_1.default.info('Pulling Ollama model', { model });
            await this.client.pull({ model });
            logger_1.default.info('Model pulled successfully', { model });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger_1.default.error('Failed to pull Ollama model', { error: errorMessage, model });
            throw new Error(`Failed to pull model ${model}: ${errorMessage}`);
        }
    }
    async healthCheck() {
        try {
            const models = await this.listModels();
            return models.length >= 0; // Even empty list means service is running
        }
        catch (error) {
            logger_1.default.error('Ollama health check failed', { error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    getCosts() {
        return new Map(this.costTracker);
    }
    updateCosts(type, cost) {
        const today = new Date().toISOString().split('T')[0];
        const key = `${today}-${type}`;
        const current = this.costTracker.get(key) || 0;
        this.costTracker.set(key, current + cost);
    }
}
exports.OllamaClient = OllamaClient;
