/**
 * Analysis History Persistence
 *
 * Saves all multi-perspective analyses to disk for audit trail and later review.
 * Analysis files are stored in the agent's workspace:
 * ~/.recursive-manager/agents/{agentId}/analyses/{timestamp}.json
 *
 * Features:
 * - Automatic directory creation
 * - ISO timestamp-based filenames
 * - Full MultiPerspectiveResult storage
 * - Query capabilities (list, get by timestamp)
 * - Cleanup of old analyses
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { MultiPerspectiveResult } from './multi-perspective.js';

/**
 * Stored analysis entry with file metadata
 */
export interface StoredAnalysis {
  timestamp: string;
  filename: string;
  filepath: string;
  data: MultiPerspectiveResult;
}

/**
 * Analysis history filter options
 */
export interface HistoryFilter {
  /** Filter by minimum confidence score */
  minConfidence?: number;
  /** Filter by maximum confidence score */
  maxConfidence?: number;
  /** Filter by date range - start date (ISO string) */
  startDate?: string;
  /** Filter by date range - end date (ISO string) */
  endDate?: string;
  /** Limit number of results */
  limit?: number;
}

/**
 * Analysis history statistics
 */
export interface HistoryStats {
  totalAnalyses: number;
  averageConfidence: number;
  averageExecutionTime: number;
  oldestAnalysis: string | null;
  newestAnalysis: string | null;
  storageSize: number; // bytes
}

/**
 * Gets the base directory for analysis history
 * Default: ~/.recursive-manager/agents/{agentId}/analyses/
 */
export function getAnalysesDirectory(agentId: string): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.recursive-manager', 'agents', agentId, 'analyses');
}

/**
 * Generates a filename for an analysis based on timestamp
 * Format: YYYY-MM-DDTHH-mm-ss-SSS.json
 */
export function generateAnalysisFilename(timestamp: string): string {
  // Convert ISO timestamp to filesystem-safe format
  const safeTimestamp = timestamp.replace(/:/g, '-').replace(/\./g, '-');
  return `${safeTimestamp}.json`;
}

/**
 * Ensures the analyses directory exists, creating it if necessary
 */
export async function ensureAnalysesDirectory(agentId: string): Promise<string> {
  const dir = getAnalysesDirectory(agentId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Saves an analysis result to disk
 *
 * @param agentId - Agent identifier (for directory organization)
 * @param analysis - The analysis result to save
 * @returns The filepath where the analysis was saved
 */
export async function saveAnalysis(
  agentId: string,
  analysis: MultiPerspectiveResult
): Promise<string> {
  const dir = await ensureAnalysesDirectory(agentId);
  const filename = generateAnalysisFilename(analysis.timestamp);
  const filepath = path.join(dir, filename);

  // Write analysis as formatted JSON
  const json = JSON.stringify(analysis, null, 2);
  await fs.writeFile(filepath, json, 'utf-8');

  return filepath;
}

/**
 * Loads an analysis from disk by timestamp
 *
 * @param agentId - Agent identifier
 * @param timestamp - ISO timestamp of the analysis
 * @returns The analysis result, or null if not found
 */
export async function loadAnalysis(
  agentId: string,
  timestamp: string
): Promise<MultiPerspectiveResult | null> {
  const dir = getAnalysesDirectory(agentId);
  const filename = generateAnalysisFilename(timestamp);
  const filepath = path.join(dir, filename);

  try {
    const json = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(json) as MultiPerspectiveResult;
  } catch (error) {
    // File not found or invalid JSON
    return null;
  }
}

/**
 * Lists all analyses for an agent
 *
 * @param agentId - Agent identifier
 * @param filter - Optional filter criteria
 * @returns Array of stored analyses, sorted by timestamp (newest first)
 */
export async function listAnalyses(
  agentId: string,
  filter?: HistoryFilter
): Promise<StoredAnalysis[]> {
  const dir = getAnalysesDirectory(agentId);

  try {
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Read all JSON files
    const files = await fs.readdir(dir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    // Load and parse all analyses
    const analyses: StoredAnalysis[] = [];

    for (const filename of jsonFiles) {
      const filepath = path.join(dir, filename);
      try {
        const json = await fs.readFile(filepath, 'utf-8');
        const data = JSON.parse(json) as MultiPerspectiveResult;

        // Apply filters
        if (filter) {
          if (filter.minConfidence !== undefined && data.overallConfidence < filter.minConfidence) {
            continue;
          }
          if (filter.maxConfidence !== undefined && data.overallConfidence > filter.maxConfidence) {
            continue;
          }
          if (filter.startDate !== undefined && data.timestamp < filter.startDate) {
            continue;
          }
          if (filter.endDate !== undefined && data.timestamp > filter.endDate) {
            continue;
          }
        }

        analyses.push({
          timestamp: data.timestamp,
          filename,
          filepath,
          data
        });
      } catch (error) {
        // Skip invalid files
        continue;
      }
    }

    // Sort by timestamp (newest first)
    analyses.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Apply limit
    if (filter?.limit !== undefined && filter.limit > 0) {
      return analyses.slice(0, filter.limit);
    }

    return analyses;
  } catch (error) {
    // Directory doesn't exist or other error
    return [];
  }
}

/**
 * Deletes an analysis from disk
 *
 * @param agentId - Agent identifier
 * @param timestamp - ISO timestamp of the analysis to delete
 * @returns true if deleted, false if not found
 */
export async function deleteAnalysis(
  agentId: string,
  timestamp: string
): Promise<boolean> {
  const dir = getAnalysesDirectory(agentId);
  const filename = generateAnalysisFilename(timestamp);
  const filepath = path.join(dir, filename);

  try {
    await fs.unlink(filepath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Deletes all analyses for an agent
 *
 * @param agentId - Agent identifier
 * @returns Number of analyses deleted
 */
export async function clearHistory(agentId: string): Promise<number> {
  const analyses = await listAnalyses(agentId);

  let deleted = 0;
  for (const analysis of analyses) {
    const success = await deleteAnalysis(agentId, analysis.timestamp);
    if (success) {
      deleted++;
    }
  }

  return deleted;
}

/**
 * Deletes analyses older than a specified date
 *
 * @param agentId - Agent identifier
 * @param beforeDate - ISO timestamp - delete analyses before this date
 * @returns Number of analyses deleted
 */
export async function deleteAnalysesBefore(
  agentId: string,
  beforeDate: string
): Promise<number> {
  const analyses = await listAnalyses(agentId, {
    endDate: beforeDate
  });

  let deleted = 0;
  for (const analysis of analyses) {
    const success = await deleteAnalysis(agentId, analysis.timestamp);
    if (success) {
      deleted++;
    }
  }

  return deleted;
}

/**
 * Gets statistics about analysis history
 *
 * @param agentId - Agent identifier
 * @returns Statistics object
 */
export async function getHistoryStats(agentId: string): Promise<HistoryStats> {
  const analyses = await listAnalyses(agentId);

  if (analyses.length === 0) {
    return {
      totalAnalyses: 0,
      averageConfidence: 0,
      averageExecutionTime: 0,
      oldestAnalysis: null,
      newestAnalysis: null,
      storageSize: 0
    };
  }

  // Calculate averages
  const totalConfidence = analyses.reduce((sum, a) => sum + a.data.overallConfidence, 0);
  const totalExecutionTime = analyses.reduce((sum, a) => sum + a.data.executionTime, 0);

  // Calculate storage size
  let storageSize = 0;
  for (const analysis of analyses) {
    try {
      const stats = await fs.stat(analysis.filepath);
      storageSize += stats.size;
    } catch {
      // Skip if file is inaccessible
    }
  }

  return {
    totalAnalyses: analyses.length,
    averageConfidence: totalConfidence / analyses.length,
    averageExecutionTime: totalExecutionTime / analyses.length,
    oldestAnalysis: analyses[analyses.length - 1]!.timestamp,
    newestAnalysis: analyses[0]!.timestamp,
    storageSize
  };
}

/**
 * Exports all analyses to a single JSON file
 *
 * @param agentId - Agent identifier
 * @param outputPath - Path to export file
 * @returns Number of analyses exported
 */
export async function exportHistory(
  agentId: string,
  outputPath: string
): Promise<number> {
  const analyses = await listAnalyses(agentId);

  const exportData = {
    agentId,
    exportedAt: new Date().toISOString(),
    totalAnalyses: analyses.length,
    analyses: analyses.map(a => a.data)
  };

  const json = JSON.stringify(exportData, null, 2);
  await fs.writeFile(outputPath, json, 'utf-8');

  return analyses.length;
}
