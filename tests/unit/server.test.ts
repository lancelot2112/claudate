import fastify from '../../src/server';

describe('Server', () => {
  afterAll(async () => {
    await fastify.close();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      
      const payload = JSON.parse(response.payload);
      expect(payload.status).toBe('healthy');
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('version');
      expect(payload).toHaveProperty('environment');
      expect(payload).toHaveProperty('uptime');
    });
  });

  describe('API Info', () => {
    it('should return API information', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/info',
      });

      expect(response.statusCode).toBe(200);
      
      const payload = JSON.parse(response.payload);
      expect(payload.name).toBe('Claudate API');
      expect(payload.description).toBe('Agentic team framework API');
      expect(payload).toHaveProperty('version');
      expect(payload).toHaveProperty('documentation');
    });
  });

  describe('Root Endpoint', () => {
    it('should return welcome message', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      
      const payload = JSON.parse(response.payload);
      expect(payload.message).toContain('Welcome to Claudate');
      expect(payload).toHaveProperty('documentation');
      expect(payload).toHaveProperty('health');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/unknown-route',
      });

      expect(response.statusCode).toBe(404);
      
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe(true);
      expect(payload.message).toBe('Route not found');
      expect(payload.statusCode).toBe(404);
    });
  });
});