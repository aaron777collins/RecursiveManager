/**
 * Prometheus Metrics HTTP Server
 *
 * Exposes a /metrics endpoint for Prometheus scraping.
 * Serves metrics collected by the RecursiveManager execution orchestrator.
 */

import express, { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { getMetrics } from '../execution/metrics';

export interface MetricsServerConfig {
  port: number;
  host?: string;
}

export class MetricsServer {
  private app: express.Application;
  private server: Server | null = null;
  private config: Required<MetricsServerConfig>;

  constructor(config: MetricsServerConfig) {
    this.config = {
      port: config.port,
      host: config.host || '0.0.0.0',
    };
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Basic request logging
    this.app.use((_req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[MetricsServer] ${_req.method} ${_req.path} ${res.statusCode} - ${duration}ms`);
      });
      next();
    });

    // Disable X-Powered-By header for security
    this.app.disable('x-powered-by');
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Prometheus metrics endpoint
    this.app.get('/metrics', async (_req: Request, res: Response) => {
      try {
        const metrics = await getMetrics();
        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.status(200).send(metrics);
      } catch (error) {
        console.error('[MetricsServer] Error generating metrics:', error);
        res.status(500).json({
          error: 'Failed to generate metrics',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Root endpoint
    this.app.get('/', (_req: Request, res: Response) => {
      res.status(200).json({
        name: 'RecursiveManager Metrics Server',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          metrics: '/metrics',
        },
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
      });
    });

    // Error handler
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('[MetricsServer] Unhandled error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
      });
    });
  }

  /**
   * Start the metrics server
   * @returns Promise that resolves when server is listening
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          console.log(`[MetricsServer] Listening on http://${this.config.host}:${this.config.port}`);
          console.log(`[MetricsServer] Metrics available at http://${this.config.host}:${this.config.port}/metrics`);
          resolve();
        });

        this.server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            console.error(`[MetricsServer] Port ${this.config.port} is already in use`);
            reject(new Error(`Port ${this.config.port} is already in use`));
          } else {
            console.error('[MetricsServer] Server error:', error);
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the metrics server
   * @returns Promise that resolves when server is closed
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          console.error('[MetricsServer] Error stopping server:', error);
          reject(error);
        } else {
          console.log('[MetricsServer] Server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Check if server is running
   */
  public isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  /**
   * Get the Express app instance (useful for testing)
   */
  public getApp(): express.Application {
    return this.app;
  }
}

/**
 * Create and start a metrics server with the given configuration
 * @param config Server configuration
 * @returns Running MetricsServer instance
 */
export async function startMetricsServer(config: MetricsServerConfig): Promise<MetricsServer> {
  const server = new MetricsServer(config);
  await server.start();
  return server;
}
