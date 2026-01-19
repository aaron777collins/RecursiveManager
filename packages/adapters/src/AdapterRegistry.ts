/**
 * AdapterRegistry - Manages registration and lookup of framework adapters
 *
 * Responsibilities:
 * - Register framework adapters
 * - Look up adapters by name
 * - Detect framework versions
 * - Negotiate capabilities
 * - Health check frameworks
 */

import type { FrameworkAdapter, Capability } from './types';

export interface AdapterRegistryConfig {
  /** Default adapter to use when none specified */
  defaultAdapter?: string;
  /** Enable automatic health checks */
  autoHealthCheck?: boolean;
  /** Health check interval in milliseconds */
  healthCheckInterval?: number;
}

export interface AdapterInfo {
  adapter: FrameworkAdapter;
  registeredAt: Date;
  lastHealthCheck?: Date;
  healthy?: boolean;
}

/**
 * Registry for managing framework adapters
 */
export class AdapterRegistry {
  private adapters: Map<string, AdapterInfo> = new Map();
  private config: Required<AdapterRegistryConfig>;
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: AdapterRegistryConfig = {}) {
    this.config = {
      defaultAdapter: config.defaultAdapter ?? '',
      autoHealthCheck: config.autoHealthCheck ?? false,
      healthCheckInterval: config.healthCheckInterval ?? 60000, // 1 minute default
    };
  }

  /**
   * Register a framework adapter
   * @throws Error if adapter with same name already registered
   */
  register(adapter: FrameworkAdapter): void {
    if (this.adapters.has(adapter.name)) {
      throw new Error(`Adapter '${adapter.name}' is already registered. Use unregister() first.`);
    }

    const info: AdapterInfo = {
      adapter,
      registeredAt: new Date(),
    };

    this.adapters.set(adapter.name, info);

    // Set as default if it's the first adapter or explicitly configured
    if (this.adapters.size === 1 && !this.config.defaultAdapter) {
      this.config.defaultAdapter = adapter.name;
    }

    // Start health checks if enabled
    if (this.config.autoHealthCheck) {
      this.startHealthCheck(adapter.name);
    }
  }

  /**
   * Unregister a framework adapter
   */
  unregister(name: string): boolean {
    const info = this.adapters.get(name);
    if (!info) {
      return false;
    }

    // Stop health checks
    this.stopHealthCheck(name);

    // Remove from registry
    this.adapters.delete(name);

    // Update default if needed
    if (this.config.defaultAdapter === name) {
      const remaining = Array.from(this.adapters.keys());
      this.config.defaultAdapter = remaining[0] ?? '';
    }

    return true;
  }

  /**
   * Get an adapter by name
   * @returns Adapter or undefined if not found
   */
  get(name: string): FrameworkAdapter | undefined {
    return this.adapters.get(name)?.adapter;
  }

  /**
   * Get the default adapter
   * @throws Error if no default adapter configured
   */
  getDefault(): FrameworkAdapter {
    if (!this.config.defaultAdapter) {
      throw new Error('No default adapter configured. Register at least one adapter.');
    }

    const adapter = this.get(this.config.defaultAdapter);
    if (!adapter) {
      throw new Error(`Default adapter '${this.config.defaultAdapter}' not found in registry.`);
    }

    return adapter;
  }

  /**
   * Get an adapter by name, or the default if name not provided
   */
  getOrDefault(name?: string): FrameworkAdapter {
    if (name) {
      const adapter = this.get(name);
      if (!adapter) {
        throw new Error(`Adapter '${name}' not found in registry.`);
      }
      return adapter;
    }
    return this.getDefault();
  }

  /**
   * Check if an adapter is registered
   */
  has(name: string): boolean {
    return this.adapters.has(name);
  }

  /**
   * List all registered adapter names
   */
  list(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get all registered adapters with their info
   */
  listAll(): Array<{ name: string; info: AdapterInfo }> {
    return Array.from(this.adapters.entries()).map(([name, info]) => ({
      name,
      info,
    }));
  }

  /**
   * Get the name of the default adapter
   */
  getDefaultName(): string | undefined {
    return this.config.defaultAdapter || undefined;
  }

  /**
   * Set the default adapter
   * @throws Error if adapter not registered
   */
  setDefault(name: string): void {
    if (!this.adapters.has(name)) {
      throw new Error(`Cannot set default: adapter '${name}' not registered.`);
    }
    this.config.defaultAdapter = name;
  }

  /**
   * Detect framework version for a registered adapter
   */
  getVersion(name: string): string | undefined {
    return this.adapters.get(name)?.adapter.version;
  }

  /**
   * Get capabilities for a registered adapter
   */
  getCapabilities(name: string): Capability[] | undefined {
    return this.adapters.get(name)?.adapter.getCapabilities();
  }

  /**
   * Check if an adapter supports a specific feature
   */
  supportsFeature(name: string, feature: string): boolean {
    const adapter = this.adapters.get(name)?.adapter;
    return adapter?.supportsFeature(feature) ?? false;
  }

  /**
   * Find adapters that support a specific feature
   */
  findByFeature(feature: string): FrameworkAdapter[] {
    return Array.from(this.adapters.values())
      .filter((info) => info.adapter.supportsFeature(feature))
      .map((info) => info.adapter);
  }

  /**
   * Find adapters that have a specific capability
   */
  findByCapability(capabilityName: string): FrameworkAdapter[] {
    return Array.from(this.adapters.values())
      .filter((info) => info.adapter.getCapabilities().some((cap) => cap.name === capabilityName))
      .map((info) => info.adapter);
  }

  /**
   * Perform health check on a specific adapter
   */
  async healthCheck(name: string): Promise<boolean> {
    const info = this.adapters.get(name);
    if (!info) {
      throw new Error(`Adapter '${name}' not found in registry.`);
    }

    try {
      const healthy = await info.adapter.healthCheck();
      info.healthy = healthy;
      info.lastHealthCheck = new Date();
      return healthy;
    } catch (error) {
      info.healthy = false;
      info.lastHealthCheck = new Date();
      return false;
    }
  }

  /**
   * Perform health check on all registered adapters
   */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const name of this.adapters.keys()) {
      try {
        const healthy = await this.healthCheck(name);
        results.set(name, healthy);
      } catch (error) {
        results.set(name, false);
      }
    }

    return results;
  }

  /**
   * Get health status for a specific adapter
   */
  getHealthStatus(name: string): {
    healthy?: boolean;
    lastCheck?: Date;
  } {
    const info = this.adapters.get(name);
    if (!info) {
      return {};
    }

    return {
      healthy: info.healthy,
      lastCheck: info.lastHealthCheck,
    };
  }

  /**
   * Get health status for all adapters
   */
  getHealthStatusAll(): Map<string, { healthy?: boolean; lastCheck?: Date }> {
    const results = new Map<string, { healthy?: boolean; lastCheck?: Date }>();

    for (const [name, info] of this.adapters.entries()) {
      results.set(name, {
        healthy: info.healthy,
        lastCheck: info.lastHealthCheck,
      });
    }

    return results;
  }

  /**
   * Start automatic health checks for an adapter
   */
  private startHealthCheck(name: string): void {
    // Clear any existing timer
    this.stopHealthCheck(name);

    // Start periodic health checks
    const timer = setInterval(() => {
      void this.healthCheck(name).catch(() => {
        // Ignore errors in automatic health checks
      });
    }, this.config.healthCheckInterval);

    this.healthCheckTimers.set(name, timer);

    // Perform initial health check
    this.healthCheck(name).catch(() => {
      // Ignore errors in initial health check
    });
  }

  /**
   * Stop automatic health checks for an adapter
   */
  private stopHealthCheck(name: string): void {
    const timer = this.healthCheckTimers.get(name);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(name);
    }
  }

  /**
   * Enable automatic health checks for all adapters
   */
  enableAutoHealthCheck(interval?: number): void {
    if (interval !== undefined) {
      this.config.healthCheckInterval = interval;
    }
    this.config.autoHealthCheck = true;

    // Start health checks for all registered adapters
    for (const name of this.adapters.keys()) {
      this.startHealthCheck(name);
    }
  }

  /**
   * Disable automatic health checks for all adapters
   */
  disableAutoHealthCheck(): void {
    this.config.autoHealthCheck = false;

    // Stop all health checks
    for (const name of this.adapters.keys()) {
      this.stopHealthCheck(name);
    }
  }

  /**
   * Clear all registered adapters and cleanup
   */
  clear(): void {
    // Stop all health checks
    for (const name of this.adapters.keys()) {
      this.stopHealthCheck(name);
    }

    // Clear adapters
    this.adapters.clear();
    this.config.defaultAdapter = '';
  }

  /**
   * Get the number of registered adapters
   */
  size(): number {
    return this.adapters.size;
  }

  /**
   * Check if registry is empty
   */
  isEmpty(): boolean {
    return this.adapters.size === 0;
  }

  /**
   * Get a healthy adapter, with fallback support if primary is unavailable
   *
   * This method implements EC-6.1: Framework unavailability handling
   *
   * @param primaryName - Name of primary adapter to try first
   * @param fallbackName - Optional fallback adapter to try if primary is unhealthy
   * @returns Healthy adapter or undefined if none available
   *
   * @example
   * ```typescript
   * const adapter = await registry.getHealthyAdapter('claude-code', 'opencode');
   * if (!adapter) {
   *   throw new Error('No healthy adapters available');
   * }
   * ```
   */
  async getHealthyAdapter(
    primaryName: string,
    fallbackName?: string
  ): Promise<{ adapter: FrameworkAdapter; usedFallback: boolean } | undefined> {
    // Try primary adapter first
    if (this.has(primaryName)) {
      const isPrimaryHealthy = await this.healthCheck(primaryName);
      if (isPrimaryHealthy) {
        const adapter = this.get(primaryName);
        if (adapter) {
          return { adapter, usedFallback: false };
        }
      }
    }

    // Try fallback adapter if primary failed
    if (fallbackName && this.has(fallbackName)) {
      const isFallbackHealthy = await this.healthCheck(fallbackName);
      if (isFallbackHealthy) {
        const adapter = this.get(fallbackName);
        if (adapter) {
          return { adapter, usedFallback: true };
        }
      }
    }

    // No healthy adapter found
    return undefined;
  }

  /**
   * Find any healthy adapter from the registry
   *
   * @returns First healthy adapter found, or undefined if none are healthy
   */
  async findHealthyAdapter(): Promise<FrameworkAdapter | undefined> {
    for (const name of this.adapters.keys()) {
      const isHealthy = await this.healthCheck(name);
      if (isHealthy) {
        return this.get(name);
      }
    }
    return undefined;
  }
}
