/**
 * Tests for MetricsServer
 */

import { MetricsServer, startMetricsServer } from '../metrics-server';
import { getMetrics } from '../../execution/metrics';
import request from 'supertest';

// Mock the getMetrics function
jest.mock('../../execution/metrics', () => ({
  getMetrics: jest.fn(),
}));

const mockedGetMetrics = getMetrics as jest.MockedFunction<typeof getMetrics>;

describe('MetricsServer', () => {
  let server: MetricsServer;
  const testPort = 13000; // Use a high port to avoid conflicts

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetMetrics.mockResolvedValue('# HELP test_metric Test metric\n# TYPE test_metric counter\ntest_metric 42\n');
  });

  afterEach(async () => {
    if (server && server.isRunning()) {
      await server.stop();
    }
  });

  describe('constructor', () => {
    it('should create server with default host', () => {
      server = new MetricsServer({ port: testPort });
      expect(server).toBeInstanceOf(MetricsServer);
    });

    it('should create server with custom host', () => {
      server = new MetricsServer({ port: testPort, host: '127.0.0.1' });
      expect(server).toBeInstanceOf(MetricsServer);
    });
  });

  describe('start/stop', () => {
    it('should start and stop server successfully', async () => {
      server = new MetricsServer({ port: testPort });

      expect(server.isRunning()).toBe(false);

      await server.start();
      expect(server.isRunning()).toBe(true);

      await server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it('should reject when port is already in use', async () => {
      const server1 = new MetricsServer({ port: testPort });
      await server1.start();

      const server2 = new MetricsServer({ port: testPort });
      await expect(server2.start()).rejects.toThrow('already in use');

      await server1.stop();
    });

    it('should handle stop when server not running', async () => {
      server = new MetricsServer({ port: testPort });
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });

  describe('endpoints', () => {
    beforeEach(async () => {
      server = new MetricsServer({ port: testPort });
      await server.start();
    });

    describe('GET /', () => {
      it('should return server information', async () => {
        const response = await request(server.getApp())
          .get('/')
          .expect(200)
          .expect('Content-Type', /json/);

        expect(response.body).toMatchObject({
          name: 'RecursiveManager Metrics Server',
          version: '1.0.0',
          endpoints: {
            health: '/health',
            metrics: '/metrics',
          },
        });
      });
    });

    describe('GET /health', () => {
      it('should return health status', async () => {
        const response = await request(server.getApp())
          .get('/health')
          .expect(200)
          .expect('Content-Type', /json/);

        expect(response.body).toMatchObject({
          status: 'healthy',
          timestamp: expect.any(String),
          uptime: expect.any(Number),
        });
      });

      it('should return valid ISO timestamp', async () => {
        const response = await request(server.getApp())
          .get('/health')
          .expect(200);

        const timestamp = new Date(response.body.timestamp);
        expect(timestamp.toISOString()).toBe(response.body.timestamp);
      });
    });

    describe('GET /metrics', () => {
      it('should return Prometheus metrics', async () => {
        const response = await request(server.getApp())
          .get('/metrics')
          .expect(200)
          .expect('Content-Type', /text\/plain/);

        expect(response.text).toContain('test_metric 42');
        expect(mockedGetMetrics).toHaveBeenCalledTimes(1);
      });

      it('should set correct Prometheus content type', async () => {
        const response = await request(server.getApp())
          .get('/metrics')
          .expect(200);

        expect(response.header['content-type']).toContain('text/plain; version=0.0.4');
      });

      it('should handle metrics generation error', async () => {
        mockedGetMetrics.mockRejectedValueOnce(new Error('Metrics error'));

        const response = await request(server.getApp())
          .get('/metrics')
          .expect(500)
          .expect('Content-Type', /json/);

        expect(response.body).toMatchObject({
          error: 'Failed to generate metrics',
          message: 'Metrics error',
        });
      });

      it('should handle non-Error exceptions', async () => {
        mockedGetMetrics.mockRejectedValueOnce('String error');

        const response = await request(server.getApp())
          .get('/metrics')
          .expect(500)
          .expect('Content-Type', /json/);

        expect(response.body).toMatchObject({
          error: 'Failed to generate metrics',
          message: 'String error',
        });
      });
    });

    describe('404 handling', () => {
      it('should return 404 for unknown routes', async () => {
        const response = await request(server.getApp())
          .get('/unknown')
          .expect(404)
          .expect('Content-Type', /json/);

        expect(response.body).toMatchObject({
          error: 'Not Found',
          path: '/unknown',
        });
      });
    });

    describe('security', () => {
      it('should not expose X-Powered-By header', async () => {
        const response = await request(server.getApp())
          .get('/')
          .expect(200);

        expect(response.header['x-powered-by']).toBeUndefined();
      });
    });
  });

  describe('startMetricsServer helper', () => {
    it('should create and start server', async () => {
      const runningServer = await startMetricsServer({ port: testPort });

      expect(runningServer).toBeInstanceOf(MetricsServer);
      expect(runningServer.isRunning()).toBe(true);

      await runningServer.stop();
    });

    it('should reject on start error', async () => {
      const server1 = await startMetricsServer({ port: testPort });

      await expect(
        startMetricsServer({ port: testPort })
      ).rejects.toThrow('already in use');

      await server1.stop();
    });
  });

  describe('getApp', () => {
    it('should return Express application instance', () => {
      server = new MetricsServer({ port: testPort });
      const app = server.getApp();

      expect(app).toBeDefined();
      expect(typeof app.use).toBe('function');
      expect(typeof app.get).toBe('function');
    });
  });
});
