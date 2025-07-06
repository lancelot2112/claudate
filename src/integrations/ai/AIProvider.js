"use strict";
/**
 * Unified AI Provider Interface
 *
 * This interface defines a standard contract for all AI providers in the system.
 * It abstracts away provider-specific implementation details and provides a
 * consistent API for text generation, embeddings, and other AI operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIProviderFactory = exports.BaseAIProvider = void 0;
/**
 * Abstract base class for AI providers
 *
 * Provides common functionality and enforces the interface contract.
 */
class BaseAIProvider {
    constructor(config) {
        this.initialized = false;
        this.config = config;
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageLatencyMs: 0,
            totalTokensUsed: 0,
            uptime: 0
        };
    }
    async healthCheck() {
        const startTime = Date.now();
        try {
            // Simple health check with minimal request
            await this.generateText({
                messages: [{ role: 'user', content: 'Hello' }],
                maxTokens: 10
            });
            return {
                healthy: true,
                latencyMs: Date.now() - startTime,
                timestamp: new Date()
            };
        }
        catch (error) {
            return {
                healthy: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date()
            };
        }
    }
    async getMetrics() {
        return { ...this.metrics };
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
    async initialize() {
        if (this.initialized)
            return;
        // Base initialization logic
        this.initialized = true;
    }
    async shutdown() {
        // Base shutdown logic
        this.initialized = false;
    }
    updateMetrics(success, latency, tokens = 0) {
        this.metrics.totalRequests++;
        this.metrics.totalTokensUsed += tokens;
        this.metrics.lastRequestTime = new Date();
        if (success) {
            this.metrics.successfulRequests++;
        }
        else {
            this.metrics.failedRequests++;
        }
        // Update average latency
        const totalLatency = this.metrics.averageLatencyMs * (this.metrics.totalRequests - 1) + latency;
        this.metrics.averageLatencyMs = totalLatency / this.metrics.totalRequests;
    }
}
exports.BaseAIProvider = BaseAIProvider;
/**
 * Provider Factory for creating and managing AI providers
 */
class AIProviderFactory {
    constructor() {
        this.providers = new Map();
        this.instances = new Map();
    }
    static getInstance() {
        if (!AIProviderFactory.instance) {
            AIProviderFactory.instance = new AIProviderFactory();
        }
        return AIProviderFactory.instance;
    }
    /**
     * Register a new AI provider class
     */
    register(name, providerClass) {
        this.providers.set(name, providerClass);
    }
    /**
     * Create or get an AI provider instance
     */
    async create(name, config) {
        const cacheKey = `${name}-${JSON.stringify(config)}`;
        if (this.instances.has(cacheKey)) {
            return this.instances.get(cacheKey);
        }
        const ProviderClass = this.providers.get(name);
        if (!ProviderClass) {
            throw new Error(`Unknown AI provider: ${name}`);
        }
        const provider = new ProviderClass(config);
        await provider.initialize();
        this.instances.set(cacheKey, provider);
        return provider;
    }
    /**
     * List all registered providers
     */
    listProviders() {
        return Array.from(this.providers.keys());
    }
    /**
     * Get all active provider instances
     */
    getActiveProviders() {
        return Array.from(this.instances.values());
    }
    /**
     * Shutdown all providers
     */
    async shutdown() {
        await Promise.all(Array.from(this.instances.values()).map(provider => provider.shutdown()));
        this.instances.clear();
    }
}
exports.AIProviderFactory = AIProviderFactory;
exports.default = AIProviderFactory;
