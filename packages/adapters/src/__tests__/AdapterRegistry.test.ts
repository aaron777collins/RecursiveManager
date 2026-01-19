/**
 * Unit tests for AdapterRegistry
 */

import { AdapterRegistry } from '../AdapterRegistry';
import type { FrameworkAdapter, Capability, ExecutionResult } from '../types';

// Mock adapter implementation
class MockAdapter implements FrameworkAdapter {
  constructor(
    public readonly name: string,
    public readonly version: string,
    private capabilities: Capability[] = [],
    private features: Set<string> = new Set(),
    private healthy: boolean = true
  ) {}

  executeAgent(): Promise<ExecutionResult> {
    return Promise.resolve({
      success: true,
      duration: 1000,
      tasksCompleted: 1,
      messagesProcessed: 0,
      errors: [],
    });
  }

  supportsFeature(feature: string): boolean {
    return this.features.has(feature);
  }

  getCapabilities(): Capability[] {
    return this.capabilities;
  }

  healthCheck(): Promise<boolean> {
    return Promise.resolve(this.healthy);
  }

  setHealthy(healthy: boolean): void {
    this.healthy = healthy;
  }

  addFeature(feature: string): void {
    this.features.add(feature);
  }

  addCapability(capability: Capability): void {
    this.capabilities.push(capability);
  }
}

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;
  let mockAdapter1: MockAdapter;
  let mockAdapter2: MockAdapter;

  beforeEach(() => {
    registry = new AdapterRegistry();
    mockAdapter1 = new MockAdapter('adapter1', '1.0.0');
    mockAdapter2 = new MockAdapter('adapter2', '2.0.0');
  });

  describe('register()', () => {
    it('should register an adapter', () => {
      registry.register(mockAdapter1);
      expect(registry.has('adapter1')).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it('should set first adapter as default', () => {
      registry.register(mockAdapter1);
      expect(registry.getDefaultName()).toBe('adapter1');
    });

    it('should not override default when registering second adapter', () => {
      registry.register(mockAdapter1);
      registry.register(mockAdapter2);
      expect(registry.getDefaultName()).toBe('adapter1');
    });

    it('should throw error if adapter already registered', () => {
      registry.register(mockAdapter1);
      expect(() => registry.register(mockAdapter1)).toThrow(
        "Adapter 'adapter1' is already registered"
      );
    });

    it('should start health checks if autoHealthCheck enabled', async () => {
      const registryWithHealthCheck = new AdapterRegistry({
        autoHealthCheck: true,
        healthCheckInterval: 100,
      });

      registryWithHealthCheck.register(mockAdapter1);

      // Wait for initial health check
      await new Promise((resolve) => setTimeout(resolve, 50));

      const status = registryWithHealthCheck.getHealthStatus('adapter1');
      expect(status.healthy).toBe(true);
      expect(status.lastCheck).toBeInstanceOf(Date);

      registryWithHealthCheck.clear();
    });
  });

  describe('unregister()', () => {
    beforeEach(() => {
      registry.register(mockAdapter1);
      registry.register(mockAdapter2);
    });

    it('should unregister an adapter', () => {
      const result = registry.unregister('adapter1');
      expect(result).toBe(true);
      expect(registry.has('adapter1')).toBe(false);
      expect(registry.size()).toBe(1);
    });

    it('should return false for non-existent adapter', () => {
      const result = registry.unregister('nonexistent');
      expect(result).toBe(false);
    });

    it('should update default when unregistering default adapter', () => {
      expect(registry.getDefaultName()).toBe('adapter1');
      registry.unregister('adapter1');
      expect(registry.getDefaultName()).toBe('adapter2');
    });

    it('should clear default when unregistering last adapter', () => {
      registry.unregister('adapter1');
      registry.unregister('adapter2');
      expect(registry.getDefaultName()).toBeUndefined();
    });
  });

  describe('get()', () => {
    beforeEach(() => {
      registry.register(mockAdapter1);
    });

    it('should return adapter by name', () => {
      const adapter = registry.get('adapter1');
      expect(adapter).toBe(mockAdapter1);
    });

    it('should return undefined for non-existent adapter', () => {
      const adapter = registry.get('nonexistent');
      expect(adapter).toBeUndefined();
    });
  });

  describe('getDefault()', () => {
    it('should throw error if no default configured', () => {
      expect(() => registry.getDefault()).toThrow('No default adapter configured');
    });

    it('should return default adapter', () => {
      registry.register(mockAdapter1);
      const adapter = registry.getDefault();
      expect(adapter).toBe(mockAdapter1);
    });

    it('should throw error if default adapter not found', () => {
      registry.register(mockAdapter1);
      registry['config'].defaultAdapter = 'nonexistent';
      expect(() => registry.getDefault()).toThrow("Default adapter 'nonexistent' not found");
    });
  });

  describe('getOrDefault()', () => {
    beforeEach(() => {
      registry.register(mockAdapter1);
      registry.register(mockAdapter2);
    });

    it('should return named adapter when name provided', () => {
      const adapter = registry.getOrDefault('adapter2');
      expect(adapter).toBe(mockAdapter2);
    });

    it('should return default adapter when name not provided', () => {
      const adapter = registry.getOrDefault();
      expect(adapter).toBe(mockAdapter1);
    });

    it('should throw error for non-existent named adapter', () => {
      expect(() => registry.getOrDefault('nonexistent')).toThrow("Adapter 'nonexistent' not found");
    });
  });

  describe('list()', () => {
    it('should return empty array when no adapters', () => {
      expect(registry.list()).toEqual([]);
    });

    it('should return all adapter names', () => {
      registry.register(mockAdapter1);
      registry.register(mockAdapter2);
      const names = registry.list();
      expect(names).toContain('adapter1');
      expect(names).toContain('adapter2');
      expect(names.length).toBe(2);
    });
  });

  describe('listAll()', () => {
    it('should return empty array when no adapters', () => {
      expect(registry.listAll()).toEqual([]);
    });

    it('should return all adapters with info', () => {
      registry.register(mockAdapter1);
      registry.register(mockAdapter2);
      const all = registry.listAll();

      expect(all.length).toBe(2);
      expect(all[0]!.name).toBe('adapter1');
      expect(all[0]!.info.adapter).toBe(mockAdapter1);
      expect(all[0]!.info.registeredAt).toBeInstanceOf(Date);
      expect(all[1]!.name).toBe('adapter2');
      expect(all[1]!.info.adapter).toBe(mockAdapter2);
    });
  });

  describe('setDefault()', () => {
    beforeEach(() => {
      registry.register(mockAdapter1);
      registry.register(mockAdapter2);
    });

    it('should set default adapter', () => {
      registry.setDefault('adapter2');
      expect(registry.getDefaultName()).toBe('adapter2');
      expect(registry.getDefault()).toBe(mockAdapter2);
    });

    it('should throw error for non-existent adapter', () => {
      expect(() => registry.setDefault('nonexistent')).toThrow(
        "Cannot set default: adapter 'nonexistent' not registered"
      );
    });
  });

  describe('getVersion()', () => {
    beforeEach(() => {
      registry.register(mockAdapter1);
    });

    it('should return adapter version', () => {
      expect(registry.getVersion('adapter1')).toBe('1.0.0');
    });

    it('should return undefined for non-existent adapter', () => {
      expect(registry.getVersion('nonexistent')).toBeUndefined();
    });
  });

  describe('getCapabilities()', () => {
    beforeEach(() => {
      const cap: Capability = {
        name: 'test-capability',
        description: 'Test capability',
        available: true,
      };
      mockAdapter1.addCapability(cap);
      registry.register(mockAdapter1);
    });

    it('should return adapter capabilities', () => {
      const caps = registry.getCapabilities('adapter1');
      expect(caps).toHaveLength(1);
      expect(caps?.[0]?.name).toBe('test-capability');
    });

    it('should return undefined for non-existent adapter', () => {
      expect(registry.getCapabilities('nonexistent')).toBeUndefined();
    });
  });

  describe('supportsFeature()', () => {
    beforeEach(() => {
      mockAdapter1.addFeature('feature1');
      registry.register(mockAdapter1);
    });

    it('should return true if adapter supports feature', () => {
      expect(registry.supportsFeature('adapter1', 'feature1')).toBe(true);
    });

    it('should return false if adapter does not support feature', () => {
      expect(registry.supportsFeature('adapter1', 'feature2')).toBe(false);
    });

    it('should return false for non-existent adapter', () => {
      expect(registry.supportsFeature('nonexistent', 'feature1')).toBe(false);
    });
  });

  describe('findByFeature()', () => {
    beforeEach(() => {
      mockAdapter1.addFeature('feature1');
      mockAdapter2.addFeature('feature1');
      mockAdapter2.addFeature('feature2');
      registry.register(mockAdapter1);
      registry.register(mockAdapter2);
    });

    it('should find all adapters with feature', () => {
      const adapters = registry.findByFeature('feature1');
      expect(adapters).toHaveLength(2);
      expect(adapters).toContain(mockAdapter1);
      expect(adapters).toContain(mockAdapter2);
    });

    it('should find single adapter with feature', () => {
      const adapters = registry.findByFeature('feature2');
      expect(adapters).toHaveLength(1);
      expect(adapters[0]).toBe(mockAdapter2);
    });

    it('should return empty array if no adapters have feature', () => {
      const adapters = registry.findByFeature('nonexistent');
      expect(adapters).toEqual([]);
    });
  });

  describe('findByCapability()', () => {
    beforeEach(() => {
      mockAdapter1.addCapability({
        name: 'cap1',
        description: 'Capability 1',
        available: true,
      });
      mockAdapter2.addCapability({
        name: 'cap1',
        description: 'Capability 1',
        available: true,
      });
      mockAdapter2.addCapability({
        name: 'cap2',
        description: 'Capability 2',
        available: true,
      });
      registry.register(mockAdapter1);
      registry.register(mockAdapter2);
    });

    it('should find all adapters with capability', () => {
      const adapters = registry.findByCapability('cap1');
      expect(adapters).toHaveLength(2);
      expect(adapters).toContain(mockAdapter1);
      expect(adapters).toContain(mockAdapter2);
    });

    it('should find single adapter with capability', () => {
      const adapters = registry.findByCapability('cap2');
      expect(adapters).toHaveLength(1);
      expect(adapters[0]).toBe(mockAdapter2);
    });

    it('should return empty array if no adapters have capability', () => {
      const adapters = registry.findByCapability('nonexistent');
      expect(adapters).toEqual([]);
    });
  });

  describe('healthCheck()', () => {
    beforeEach(() => {
      registry.register(mockAdapter1);
    });

    it('should perform health check and update status', async () => {
      const healthy = await registry.healthCheck('adapter1');
      expect(healthy).toBe(true);

      const status = registry.getHealthStatus('adapter1');
      expect(status.healthy).toBe(true);
      expect(status.lastCheck).toBeInstanceOf(Date);
    });

    it('should handle unhealthy adapter', async () => {
      mockAdapter1.setHealthy(false);
      const healthy = await registry.healthCheck('adapter1');
      expect(healthy).toBe(false);

      const status = registry.getHealthStatus('adapter1');
      expect(status.healthy).toBe(false);
    });

    it('should handle health check errors', async () => {
      // Create adapter that throws error on health check
      const errorAdapter = new MockAdapter('error-adapter', '1.0.0');
      errorAdapter.healthCheck = () => {
        throw new Error('Health check failed');
      };
      registry.register(errorAdapter);

      const healthy = await registry.healthCheck('error-adapter');
      expect(healthy).toBe(false);

      const status = registry.getHealthStatus('error-adapter');
      expect(status.healthy).toBe(false);
    });

    it('should throw error for non-existent adapter', async () => {
      await expect(registry.healthCheck('nonexistent')).rejects.toThrow(
        "Adapter 'nonexistent' not found"
      );
    });
  });

  describe('healthCheckAll()', () => {
    beforeEach(() => {
      registry.register(mockAdapter1);
      registry.register(mockAdapter2);
    });

    it('should check health of all adapters', async () => {
      const results = await registry.healthCheckAll();
      expect(results.size).toBe(2);
      expect(results.get('adapter1')).toBe(true);
      expect(results.get('adapter2')).toBe(true);
    });

    it('should handle mixed health statuses', async () => {
      mockAdapter1.setHealthy(false);
      const results = await registry.healthCheckAll();
      expect(results.get('adapter1')).toBe(false);
      expect(results.get('adapter2')).toBe(true);
    });
  });

  describe('getHealthStatus()', () => {
    it('should return empty object for non-existent adapter', () => {
      const status = registry.getHealthStatus('nonexistent');
      expect(status).toEqual({});
    });

    it('should return health status after check', async () => {
      registry.register(mockAdapter1);
      await registry.healthCheck('adapter1');

      const status = registry.getHealthStatus('adapter1');
      expect(status.healthy).toBe(true);
      expect(status.lastCheck).toBeInstanceOf(Date);
    });
  });

  describe('getHealthStatusAll()', () => {
    it('should return empty map when no adapters', () => {
      const statuses = registry.getHealthStatusAll();
      expect(statuses.size).toBe(0);
    });

    it('should return all health statuses', async () => {
      registry.register(mockAdapter1);
      registry.register(mockAdapter2);
      await registry.healthCheckAll();

      const statuses = registry.getHealthStatusAll();
      expect(statuses.size).toBe(2);
      expect(statuses.get('adapter1')?.healthy).toBe(true);
      expect(statuses.get('adapter2')?.healthy).toBe(true);
    });
  });

  describe('enableAutoHealthCheck()', () => {
    it('should enable automatic health checks', async () => {
      registry.register(mockAdapter1);
      registry.enableAutoHealthCheck(100);

      // Wait for first health check
      await new Promise((resolve) => setTimeout(resolve, 150));

      const status = registry.getHealthStatus('adapter1');
      expect(status.healthy).toBe(true);
      expect(status.lastCheck).toBeInstanceOf(Date);

      registry.disableAutoHealthCheck();
    });

    it('should use custom interval', async () => {
      registry.register(mockAdapter1);
      registry.enableAutoHealthCheck(50);

      await new Promise((resolve) => setTimeout(resolve, 75));
      const status1 = registry.getHealthStatus('adapter1');
      const check1 = status1.lastCheck!;

      await new Promise((resolve) => setTimeout(resolve, 75));
      const status2 = registry.getHealthStatus('adapter1');
      const check2 = status2.lastCheck!;

      expect(check2.getTime()).toBeGreaterThan(check1.getTime());

      registry.disableAutoHealthCheck();
    });
  });

  describe('disableAutoHealthCheck()', () => {
    it('should stop automatic health checks', async () => {
      registry.register(mockAdapter1);
      registry.enableAutoHealthCheck(50);

      await new Promise((resolve) => setTimeout(resolve, 75));
      const status1 = registry.getHealthStatus('adapter1');
      const check1 = status1.lastCheck!;

      registry.disableAutoHealthCheck();

      await new Promise((resolve) => setTimeout(resolve, 100));
      const status2 = registry.getHealthStatus('adapter1');
      const check2 = status2.lastCheck!;

      // Check time should not have changed
      expect(check2.getTime()).toBe(check1.getTime());
    });
  });

  describe('clear()', () => {
    beforeEach(() => {
      registry.register(mockAdapter1);
      registry.register(mockAdapter2);
    });

    it('should clear all adapters', () => {
      registry.clear();
      expect(registry.size()).toBe(0);
      expect(registry.isEmpty()).toBe(true);
      expect(registry.getDefaultName()).toBeUndefined();
    });

    it('should stop health checks when clearing', async () => {
      registry.enableAutoHealthCheck(50);
      await new Promise((resolve) => setTimeout(resolve, 75));

      registry.clear();

      // Verify no errors thrown after clearing
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  describe('size() and isEmpty()', () => {
    it('should return 0 and true for empty registry', () => {
      expect(registry.size()).toBe(0);
      expect(registry.isEmpty()).toBe(true);
    });

    it('should return correct size and false when not empty', () => {
      registry.register(mockAdapter1);
      registry.register(mockAdapter2);
      expect(registry.size()).toBe(2);
      expect(registry.isEmpty()).toBe(false);
    });
  });

  describe('has()', () => {
    it('should return false for non-existent adapter', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });

    it('should return true for registered adapter', () => {
      registry.register(mockAdapter1);
      expect(registry.has('adapter1')).toBe(true);
    });
  });

  describe('getHealthyAdapter() - EC-6.1: Framework Unavailability with Fallback', () => {
    it('should return primary adapter when healthy', async () => {
      const primary = new MockAdapter('claude-code', '1.0.0', [], new Set(), true);
      const fallback = new MockAdapter('opencode', '1.0.0', [], new Set(), true);

      registry.register(primary);
      registry.register(fallback);

      const result = await registry.getHealthyAdapter('claude-code', 'opencode');

      expect(result).toBeDefined();
      expect(result?.adapter.name).toBe('claude-code');
      expect(result?.usedFallback).toBe(false);
    });

    it('should return fallback adapter when primary unhealthy', async () => {
      const primary = new MockAdapter('claude-code', '1.0.0', [], new Set(), false);
      const fallback = new MockAdapter('opencode', '1.0.0', [], new Set(), true);

      registry.register(primary);
      registry.register(fallback);

      const result = await registry.getHealthyAdapter('claude-code', 'opencode');

      expect(result).toBeDefined();
      expect(result?.adapter.name).toBe('opencode');
      expect(result?.usedFallback).toBe(true);
    });

    it('should return undefined when both primary and fallback are unhealthy', async () => {
      const primary = new MockAdapter('claude-code', '1.0.0', [], new Set(), false);
      const fallback = new MockAdapter('opencode', '1.0.0', [], new Set(), false);

      registry.register(primary);
      registry.register(fallback);

      const result = await registry.getHealthyAdapter('claude-code', 'opencode');

      expect(result).toBeUndefined();
    });

    it('should return undefined when primary not registered and no fallback', async () => {
      const result = await registry.getHealthyAdapter('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should return primary when healthy and no fallback specified', async () => {
      const primary = new MockAdapter('claude-code', '1.0.0', [], new Set(), true);
      registry.register(primary);

      const result = await registry.getHealthyAdapter('claude-code');

      expect(result).toBeDefined();
      expect(result?.adapter.name).toBe('claude-code');
      expect(result?.usedFallback).toBe(false);
    });

    it('should return undefined when primary unhealthy and no fallback specified', async () => {
      const primary = new MockAdapter('claude-code', '1.0.0', [], new Set(), false);
      registry.register(primary);

      const result = await registry.getHealthyAdapter('claude-code');

      expect(result).toBeUndefined();
    });

    it('should return undefined when fallback not registered', async () => {
      const primary = new MockAdapter('claude-code', '1.0.0', [], new Set(), false);
      registry.register(primary);

      const result = await registry.getHealthyAdapter('claude-code', 'nonexistent');

      expect(result).toBeUndefined();
    });

    it('should handle primary not registered but fallback is healthy', async () => {
      const fallback = new MockAdapter('opencode', '1.0.0', [], new Set(), true);
      registry.register(fallback);

      const result = await registry.getHealthyAdapter('nonexistent', 'opencode');

      expect(result).toBeDefined();
      expect(result?.adapter.name).toBe('opencode');
      expect(result?.usedFallback).toBe(true);
    });
  });

  describe('findHealthyAdapter()', () => {
    it('should return first healthy adapter', async () => {
      const unhealthy = new MockAdapter('adapter1', '1.0.0', [], new Set(), false);
      const healthy = new MockAdapter('adapter2', '1.0.0', [], new Set(), true);

      registry.register(unhealthy);
      registry.register(healthy);

      const result = await registry.findHealthyAdapter();

      expect(result).toBeDefined();
      expect(result?.name).toBe('adapter2');
    });

    it('should return undefined when no adapters are healthy', async () => {
      const unhealthy1 = new MockAdapter('adapter1', '1.0.0', [], new Set(), false);
      const unhealthy2 = new MockAdapter('adapter2', '1.0.0', [], new Set(), false);

      registry.register(unhealthy1);
      registry.register(unhealthy2);

      const result = await registry.findHealthyAdapter();

      expect(result).toBeUndefined();
    });

    it('should return undefined when registry is empty', async () => {
      const result = await registry.findHealthyAdapter();

      expect(result).toBeUndefined();
    });

    it('should return first adapter when all are healthy', async () => {
      const healthy1 = new MockAdapter('adapter1', '1.0.0', [], new Set(), true);
      const healthy2 = new MockAdapter('adapter2', '1.0.0', [], new Set(), true);

      registry.register(healthy1);
      registry.register(healthy2);

      const result = await registry.findHealthyAdapter();

      expect(result).toBeDefined();
      expect(result?.name).toBe('adapter1');
    });
  });
});
