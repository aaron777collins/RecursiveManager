/**
 * Tests for Analysis History Persistence
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as History from '../history.js';
import type { MultiPerspectiveResult } from '../multi-perspective.js';

describe('History - Directory Management', () => {
  const testAgentId = 'test-agent-history';

  afterEach(async () => {
    // Clean up test directory
    const dir = History.getAnalysesDirectory(testAgentId);
    try {
      await fs.rm(dir, { recursive: true });
    } catch {
      // Directory might not exist
    }
  });

  it('should generate correct analyses directory path', () => {
    const dir = History.getAnalysesDirectory(testAgentId);
    const homeDir = os.homedir();
    const expected = path.join(homeDir, '.recursivemanager', 'agents', testAgentId, 'analyses');
    expect(dir).toBe(expected);
  });

  it('should create analyses directory if it does not exist', async () => {
    const dir = await History.ensureAnalysesDirectory(testAgentId);
    const stats = await fs.stat(dir);
    expect(stats.isDirectory()).toBe(true);
  });

  it('should not fail if directory already exists', async () => {
    await History.ensureAnalysesDirectory(testAgentId);
    // Should not throw
    await expect(History.ensureAnalysesDirectory(testAgentId)).resolves.toBeDefined();
  });
});

describe('History - Filename Generation', () => {
  it('should generate filesystem-safe filenames from ISO timestamps', () => {
    const timestamp = '2026-01-20T12:34:56.789Z';
    const filename = History.generateAnalysisFilename(timestamp);
    expect(filename).toBe('2026-01-20T12-34-56-789Z.json');
    expect(filename).toMatch(/\.json$/);
  });

  it('should handle different timestamp formats', () => {
    const timestamps = [
      '2026-01-20T12:34:56.789Z',
      '2026-12-31T23:59:59.999Z',
      '2026-01-01T00:00:00.000Z'
    ];

    for (const timestamp of timestamps) {
      const filename = History.generateAnalysisFilename(timestamp);
      expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/);
    }
  });
});

describe('History - Save and Load', () => {
  const testAgentId = 'test-agent-save-load';

  const mockAnalysis: MultiPerspectiveResult = {
    perspectives: [
      {
        perspective: 'Security',
        analysis: 'Test security analysis',
        confidence: 0.85,
        reasoning: 'Test reasoning'
      },
      {
        perspective: 'Architecture',
        analysis: 'Test architecture analysis',
        confidence: 0.75
      }
    ],
    summary: 'Test summary',
    overallConfidence: 0.80,
    executionTime: 1234,
    timestamp: '2026-01-20T12:00:00.000Z'
  };

  afterEach(async () => {
    await History.clearHistory(testAgentId);
    const dir = History.getAnalysesDirectory(testAgentId);
    try {
      await fs.rm(dir, { recursive: true });
    } catch {
      // Directory might not exist
    }
  });

  it('should save analysis to disk', async () => {
    const filepath = await History.saveAnalysis(testAgentId, mockAnalysis);
    expect(filepath).toBeDefined();
    expect(filepath).toContain(testAgentId);
    expect(filepath).toContain('.json');

    // Verify file exists
    const stats = await fs.stat(filepath);
    expect(stats.isFile()).toBe(true);
  });

  it('should load saved analysis from disk', async () => {
    await History.saveAnalysis(testAgentId, mockAnalysis);
    const loaded = await History.loadAnalysis(testAgentId, mockAnalysis.timestamp);

    expect(loaded).not.toBeNull();
    expect(loaded!.timestamp).toBe(mockAnalysis.timestamp);
    expect(loaded!.overallConfidence).toBe(mockAnalysis.overallConfidence);
    expect(loaded!.perspectives).toHaveLength(2);
    expect(loaded!.perspectives[0]!.perspective).toBe('Security');
  });

  it('should return null when loading non-existent analysis', async () => {
    const loaded = await History.loadAnalysis(testAgentId, '2026-01-01T00:00:00.000Z');
    expect(loaded).toBeNull();
  });

  it('should save analysis as formatted JSON', async () => {
    const filepath = await History.saveAnalysis(testAgentId, mockAnalysis);
    const content = await fs.readFile(filepath, 'utf-8');

    // Should be formatted (contains newlines and indentation)
    expect(content).toContain('\n');
    expect(content).toContain('  ');

    // Should be valid JSON
    const parsed = JSON.parse(content);
    expect(parsed.timestamp).toBe(mockAnalysis.timestamp);
  });
});

describe('History - List and Filter', () => {
  const testAgentId = 'test-agent-list';

  const createMockAnalysis = (timestamp: string, confidence: number): MultiPerspectiveResult => ({
    perspectives: [],
    summary: `Analysis at ${timestamp}`,
    overallConfidence: confidence,
    executionTime: 1000,
    timestamp
  });

  beforeEach(async () => {
    // Create multiple analyses
    await History.saveAnalysis(testAgentId, createMockAnalysis('2026-01-20T10:00:00.000Z', 0.9));
    await History.saveAnalysis(testAgentId, createMockAnalysis('2026-01-20T11:00:00.000Z', 0.7));
    await History.saveAnalysis(testAgentId, createMockAnalysis('2026-01-20T12:00:00.000Z', 0.5));
    await History.saveAnalysis(testAgentId, createMockAnalysis('2026-01-21T10:00:00.000Z', 0.8));
  });

  afterEach(async () => {
    await History.clearHistory(testAgentId);
    const dir = History.getAnalysesDirectory(testAgentId);
    try {
      await fs.rm(dir, { recursive: true });
    } catch {
      // Directory might not exist
    }
  });

  it('should list all analyses', async () => {
    const analyses = await History.listAnalyses(testAgentId);
    expect(analyses).toHaveLength(4);
  });

  it('should sort analyses by timestamp (newest first)', async () => {
    const analyses = await History.listAnalyses(testAgentId);
    expect(analyses[0]!.timestamp).toBe('2026-01-21T10:00:00.000Z');
    expect(analyses[3]!.timestamp).toBe('2026-01-20T10:00:00.000Z');
  });

  it('should filter by minimum confidence', async () => {
    const analyses = await History.listAnalyses(testAgentId, {
      minConfidence: 0.75
    });
    expect(analyses).toHaveLength(2); // 0.9 and 0.8
    expect(analyses.every(a => a.data.overallConfidence >= 0.75)).toBe(true);
  });

  it('should filter by maximum confidence', async () => {
    const analyses = await History.listAnalyses(testAgentId, {
      maxConfidence: 0.75
    });
    expect(analyses).toHaveLength(2); // 0.7 and 0.5
    expect(analyses.every(a => a.data.overallConfidence <= 0.75)).toBe(true);
  });

  it('should filter by date range', async () => {
    const analyses = await History.listAnalyses(testAgentId, {
      startDate: '2026-01-20T11:00:00.000Z',
      endDate: '2026-01-20T12:30:00.000Z'
    });
    expect(analyses).toHaveLength(2); // 11:00 and 12:00
  });

  it('should apply limit', async () => {
    const analyses = await History.listAnalyses(testAgentId, {
      limit: 2
    });
    expect(analyses).toHaveLength(2);
    expect(analyses[0]!.timestamp).toBe('2026-01-21T10:00:00.000Z'); // newest
  });

  it('should combine multiple filters', async () => {
    const analyses = await History.listAnalyses(testAgentId, {
      minConfidence: 0.6,
      maxConfidence: 0.85,
      limit: 1
    });
    expect(analyses).toHaveLength(1);
    expect(analyses[0]!.data.overallConfidence).toBeGreaterThanOrEqual(0.6);
    expect(analyses[0]!.data.overallConfidence).toBeLessThanOrEqual(0.85);
  });

  it('should return empty array for agent with no history', async () => {
    const analyses = await History.listAnalyses('non-existent-agent');
    expect(analyses).toEqual([]);
  });

  it('should include file metadata in results', async () => {
    const analyses = await History.listAnalyses(testAgentId);
    expect(analyses[0]).toHaveProperty('timestamp');
    expect(analyses[0]).toHaveProperty('filename');
    expect(analyses[0]).toHaveProperty('filepath');
    expect(analyses[0]).toHaveProperty('data');
    expect(analyses[0]!.filename).toMatch(/\.json$/);
    expect(analyses[0]!.filepath).toContain(testAgentId);
  });
});

describe('History - Delete', () => {
  const testAgentId = 'test-agent-delete';

  const createMockAnalysis = (timestamp: string): MultiPerspectiveResult => ({
    perspectives: [],
    summary: `Analysis at ${timestamp}`,
    overallConfidence: 0.8,
    executionTime: 1000,
    timestamp
  });

  beforeEach(async () => {
    await History.saveAnalysis(testAgentId, createMockAnalysis('2026-01-20T10:00:00.000Z'));
    await History.saveAnalysis(testAgentId, createMockAnalysis('2026-01-20T11:00:00.000Z'));
    await History.saveAnalysis(testAgentId, createMockAnalysis('2026-01-21T10:00:00.000Z'));
  });

  afterEach(async () => {
    await History.clearHistory(testAgentId);
    const dir = History.getAnalysesDirectory(testAgentId);
    try {
      await fs.rm(dir, { recursive: true });
    } catch {
      // Directory might not exist
    }
  });

  it('should delete a specific analysis', async () => {
    const deleted = await History.deleteAnalysis(testAgentId, '2026-01-20T11:00:00.000Z');
    expect(deleted).toBe(true);

    const analyses = await History.listAnalyses(testAgentId);
    expect(analyses).toHaveLength(2);
    expect(analyses.find(a => a.timestamp === '2026-01-20T11:00:00.000Z')).toBeUndefined();
  });

  it('should return false when deleting non-existent analysis', async () => {
    const deleted = await History.deleteAnalysis(testAgentId, '2026-01-01T00:00:00.000Z');
    expect(deleted).toBe(false);
  });

  it('should clear all history', async () => {
    const deleted = await History.clearHistory(testAgentId);
    expect(deleted).toBe(3);

    const analyses = await History.listAnalyses(testAgentId);
    expect(analyses).toHaveLength(0);
  });

  it('should delete analyses before a specific date', async () => {
    const deleted = await History.deleteAnalysesBefore(testAgentId, '2026-01-21T00:00:00.000Z');
    expect(deleted).toBe(2); // Both from 2026-01-20

    const analyses = await History.listAnalyses(testAgentId);
    expect(analyses).toHaveLength(1);
    expect(analyses[0]!.timestamp).toBe('2026-01-21T10:00:00.000Z');
  });
});

describe('History - Statistics', () => {
  const testAgentId = 'test-agent-stats';

  const createMockAnalysis = (timestamp: string, confidence: number, executionTime: number): MultiPerspectiveResult => ({
    perspectives: [],
    summary: `Analysis at ${timestamp}`,
    overallConfidence: confidence,
    executionTime,
    timestamp
  });

  beforeEach(async () => {
    await History.saveAnalysis(testAgentId, createMockAnalysis('2026-01-20T10:00:00.000Z', 0.9, 1000));
    await History.saveAnalysis(testAgentId, createMockAnalysis('2026-01-20T11:00:00.000Z', 0.7, 2000));
    await History.saveAnalysis(testAgentId, createMockAnalysis('2026-01-21T10:00:00.000Z', 0.8, 1500));
  });

  afterEach(async () => {
    await History.clearHistory(testAgentId);
    const dir = History.getAnalysesDirectory(testAgentId);
    try {
      await fs.rm(dir, { recursive: true });
    } catch {
      // Directory might not exist
    }
  });

  it('should calculate total analyses', async () => {
    const stats = await History.getHistoryStats(testAgentId);
    expect(stats.totalAnalyses).toBe(3);
  });

  it('should calculate average confidence', async () => {
    const stats = await History.getHistoryStats(testAgentId);
    expect(stats.averageConfidence).toBeCloseTo(0.8, 2); // (0.9 + 0.7 + 0.8) / 3
  });

  it('should calculate average execution time', async () => {
    const stats = await History.getHistoryStats(testAgentId);
    expect(stats.averageExecutionTime).toBeCloseTo(1500, 0); // (1000 + 2000 + 1500) / 3
  });

  it('should identify oldest and newest analyses', async () => {
    const stats = await History.getHistoryStats(testAgentId);
    expect(stats.oldestAnalysis).toBe('2026-01-20T10:00:00.000Z');
    expect(stats.newestAnalysis).toBe('2026-01-21T10:00:00.000Z');
  });

  it('should calculate storage size', async () => {
    const stats = await History.getHistoryStats(testAgentId);
    expect(stats.storageSize).toBeGreaterThan(0);
  });

  it('should return zero stats for empty history', async () => {
    const stats = await History.getHistoryStats('non-existent-agent');
    expect(stats.totalAnalyses).toBe(0);
    expect(stats.averageConfidence).toBe(0);
    expect(stats.averageExecutionTime).toBe(0);
    expect(stats.oldestAnalysis).toBeNull();
    expect(stats.newestAnalysis).toBeNull();
    expect(stats.storageSize).toBe(0);
  });
});

describe('History - Export', () => {
  const testAgentId = 'test-agent-export';

  const createMockAnalysis = (timestamp: string): MultiPerspectiveResult => ({
    perspectives: [],
    summary: `Analysis at ${timestamp}`,
    overallConfidence: 0.8,
    executionTime: 1000,
    timestamp
  });

  beforeEach(async () => {
    await History.saveAnalysis(testAgentId, createMockAnalysis('2026-01-20T10:00:00.000Z'));
    await History.saveAnalysis(testAgentId, createMockAnalysis('2026-01-20T11:00:00.000Z'));
  });

  afterEach(async () => {
    await History.clearHistory(testAgentId);
    const dir = History.getAnalysesDirectory(testAgentId);
    try {
      await fs.rm(dir, { recursive: true });
    } catch {
      // Directory might not exist
    }
  });

  it('should export all analyses to a single JSON file', async () => {
    const outputPath = path.join(os.tmpdir(), 'test-export.json');

    try {
      const count = await History.exportHistory(testAgentId, outputPath);
      expect(count).toBe(2);

      // Verify export file exists
      const stats = await fs.stat(outputPath);
      expect(stats.isFile()).toBe(true);

      // Verify export content
      const content = await fs.readFile(outputPath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.agentId).toBe(testAgentId);
      expect(data.exportedAt).toBeDefined();
      expect(data.totalAnalyses).toBe(2);
      expect(data.analyses).toHaveLength(2);
      expect(data.analyses[0]).toHaveProperty('timestamp');
      expect(data.analyses[0]).toHaveProperty('overallConfidence');
    } finally {
      // Clean up export file
      try {
        await fs.unlink(outputPath);
      } catch {
        // File might not exist
      }
    }
  });
});

describe('History - Edge Cases', () => {
  const testAgentId = 'test-agent-edge-cases';

  afterEach(async () => {
    await History.clearHistory(testAgentId);
    const dir = History.getAnalysesDirectory(testAgentId);
    try {
      await fs.rm(dir, { recursive: true });
    } catch {
      // Directory might not exist
    }
  });

  it('should handle special characters in agent ID', async () => {
    const specialAgentId = 'agent-with-dashes_and_underscores.123';
    const mockAnalysis: MultiPerspectiveResult = {
      perspectives: [],
      summary: 'Test',
      overallConfidence: 0.8,
      executionTime: 1000,
      timestamp: '2026-01-20T12:00:00.000Z'
    };

    await History.saveAnalysis(specialAgentId, mockAnalysis);
    const loaded = await History.loadAnalysis(specialAgentId, mockAnalysis.timestamp);
    expect(loaded).not.toBeNull();

    await History.clearHistory(specialAgentId);
    const dir = History.getAnalysesDirectory(specialAgentId);
    try {
      await fs.rm(dir, { recursive: true });
    } catch {
      // Directory might not exist
    }
  });

  it('should handle corrupt JSON files gracefully', async () => {
    // Create a corrupt file
    const dir = await History.ensureAnalysesDirectory(testAgentId);
    const corruptFile = path.join(dir, 'corrupt.json');
    await fs.writeFile(corruptFile, '{ invalid json }', 'utf-8');

    // Should skip corrupt file and return empty array
    const analyses = await History.listAnalyses(testAgentId);
    expect(analyses).toEqual([]);
  });
});
