/**
 * Tests for Database Snapshot System
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  createSnapshot,
  listSnapshots,
  getSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  validateSnapshot,
  cleanupSnapshots,
  getLatestSnapshot,
} from '../snapshot';
import { initializeDatabase } from '../index';
import { runMigrations } from '../migrations';
import { allMigrations } from '../migrations/';

describe('Snapshot System', () => {
  let testDir: string;
  let dbPath: string;
  let snapshotsDir: string;
  let db: Database.Database;

  beforeEach(() => {
    // Create temporary directories
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-test-'));
    dbPath = path.join(testDir, 'test.db');
    snapshotsDir = path.join(testDir, 'snapshots');

    // Initialize database
    const connection = initializeDatabase({ path: dbPath });
    db = connection.db;

    // Run migrations
    runMigrations(db, allMigrations);
  });

  afterEach(() => {
    // Close database
    if (db) {
      db.close();
    }

    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('createSnapshot', () => {
    it('should create a snapshot with metadata', async () => {
      const snapshot = await createSnapshot(db, snapshotsDir, {
        reason: 'Test snapshot',
        agentId: 'test-agent-001',
      });

      expect(snapshot).toBeDefined();
      expect(snapshot.id).toMatch(/^snapshot-\d+$/);
      expect(snapshot.reason).toBe('Test snapshot');
      expect(snapshot.agentId).toBe('test-agent-001');
      expect(snapshot.size).toBeGreaterThan(0);
      expect(snapshot.schemaVersion).toBeGreaterThan(0);

      // Verify files exist
      expect(fs.existsSync(snapshot.path)).toBe(true);
      expect(fs.existsSync(snapshot.path.replace('.db', '.json'))).toBe(true);
    });

    it('should create a snapshot with custom ID', async () => {
      const snapshot = await createSnapshot(db, snapshotsDir, {
        reason: 'Custom ID test',
        snapshotId: 'custom-snapshot-123',
      });

      expect(snapshot.id).toBe('custom-snapshot-123');
    });

    it('should create snapshots directory if it does not exist', async () => {
      const newSnapshotsDir = path.join(testDir, 'new-snapshots');
      expect(fs.existsSync(newSnapshotsDir)).toBe(false);

      await createSnapshot(db, newSnapshotsDir, {
        reason: 'Auto-create directory',
      });

      expect(fs.existsSync(newSnapshotsDir)).toBe(true);
    });

    it('should throw error if snapshot ID already exists', async () => {
      const snapshotId = 'duplicate-snapshot';

      await createSnapshot(db, snapshotsDir, {
        reason: 'First snapshot',
        snapshotId,
      });

      await expect(
        createSnapshot(db, snapshotsDir, {
          reason: 'Duplicate snapshot',
          snapshotId,
        })
      ).rejects.toThrow('Snapshot already exists');
    });
  });

  describe('listSnapshots', () => {
    it('should return empty array if no snapshots exist', () => {
      const snapshots = listSnapshots(snapshotsDir);
      expect(snapshots).toEqual([]);
    });

    it('should return empty array if snapshots directory does not exist', () => {
      const nonExistentDir = path.join(testDir, 'non-existent');
      const snapshots = listSnapshots(nonExistentDir);
      expect(snapshots).toEqual([]);
    });

    it('should list all snapshots sorted by date (newest first)', async () => {
      // Create multiple snapshots with delays to ensure different timestamps
      await createSnapshot(db, snapshotsDir, {
        reason: 'First snapshot',
        snapshotId: 'snapshot-1',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await createSnapshot(db, snapshotsDir, {
        reason: 'Second snapshot',
        snapshotId: 'snapshot-2',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await createSnapshot(db, snapshotsDir, {
        reason: 'Third snapshot',
        snapshotId: 'snapshot-3',
      });

      const snapshots = listSnapshots(snapshotsDir);

      expect(snapshots).toHaveLength(3);
      expect(snapshots[0]!.id).toBe('snapshot-3'); // Newest first
      expect(snapshots[1]!.id).toBe('snapshot-2');
      expect(snapshots[2]!.id).toBe('snapshot-1');
    });

    it('should filter snapshots by agent ID', async () => {
      await createSnapshot(db, snapshotsDir, {
        reason: 'Agent A snapshot',
        agentId: 'agent-a',
      });

      await createSnapshot(db, snapshotsDir, {
        reason: 'Agent B snapshot',
        agentId: 'agent-b',
      });

      await createSnapshot(db, snapshotsDir, {
        reason: 'Agent A snapshot 2',
        agentId: 'agent-a',
      });

      const agentASnapshots = listSnapshots(snapshotsDir, { agentId: 'agent-a' });

      expect(agentASnapshots).toHaveLength(2);
      expect(agentASnapshots.every((s) => s.agentId === 'agent-a')).toBe(true);
    });

    it('should limit number of snapshots returned', async () => {
      for (let i = 0; i < 5; i++) {
        await createSnapshot(db, snapshotsDir, {
          reason: `Snapshot ${i + 1}`,
          snapshotId: `snapshot-${i + 1}`,
        });
      }

      const snapshots = listSnapshots(snapshotsDir, { limit: 3 });

      expect(snapshots).toHaveLength(3);
    });

    it('should sort snapshots in ascending order when specified', async () => {
      await createSnapshot(db, snapshotsDir, {
        reason: 'First',
        snapshotId: 'snapshot-1',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await createSnapshot(db, snapshotsDir, {
        reason: 'Second',
        snapshotId: 'snapshot-2',
      });

      const snapshots = listSnapshots(snapshotsDir, { sortOrder: 'asc' });

      expect(snapshots[0]!.id).toBe('snapshot-1'); // Oldest first
      expect(snapshots[1]!.id).toBe('snapshot-2');
    });
  });

  describe('getSnapshot', () => {
    it('should get a specific snapshot by ID', async () => {
      await createSnapshot(db, snapshotsDir, {
        reason: 'Test snapshot',
        snapshotId: 'test-snapshot',
      });

      const snapshot = getSnapshot(snapshotsDir, 'test-snapshot');

      expect(snapshot).toBeDefined();
      expect(snapshot?.id).toBe('test-snapshot');
      expect(snapshot?.reason).toBe('Test snapshot');
    });

    it('should return null if snapshot does not exist', () => {
      const snapshot = getSnapshot(snapshotsDir, 'non-existent');
      expect(snapshot).toBeNull();
    });

    it('should return null if metadata file is corrupted', async () => {
      await createSnapshot(db, snapshotsDir, {
        reason: 'Test',
        snapshotId: 'corrupted',
      });

      // Corrupt metadata file
      const metadataPath = path.join(snapshotsDir, 'corrupted.json');
      fs.writeFileSync(metadataPath, 'invalid json {{{');

      const snapshot = getSnapshot(snapshotsDir, 'corrupted');
      expect(snapshot).toBeNull();
    });
  });

  describe('restoreSnapshot', () => {
    it('should restore database from snapshot', async () => {
      // Create test data in database
      db.prepare('INSERT INTO agents (id, role, display_name, created_at, status, main_goal, config_path) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        'agent-001',
        'Manager',
        'Test Manager',
        new Date().toISOString(),
        'active',
        'Test goal',
        '/path/to/config'
      );

      // Create snapshot
      const snapshot = await createSnapshot(db, snapshotsDir, {
        reason: 'Before restore test',
      });

      // Modify database
      db.prepare('UPDATE agents SET display_name = ? WHERE id = ?').run('Modified Name', 'agent-001');

      // Verify modification
      const modified = db.prepare('SELECT display_name FROM agents WHERE id = ?').get('agent-001') as { display_name: string };
      expect(modified.display_name).toBe('Modified Name');

      // Close and restore
      db.close();
      const restoredDb = await restoreSnapshot(dbPath, snapshot.path);

      // Verify restoration
      const restored = restoredDb.prepare('SELECT display_name FROM agents WHERE id = ?').get('agent-001') as { display_name: string };
      expect(restored.display_name).toBe('Test Manager');

      restoredDb.close();
    });

    it('should create backup before restoring', async () => {
      const snapshot = await createSnapshot(db, snapshotsDir, {
        reason: 'Restore test',
      });

      db.close();
      await restoreSnapshot(dbPath, snapshot.path, { createBackup: true });

      // Check for backup file
      const backupFiles = fs.readdirSync(testDir).filter((f) => f.includes('.before-restore-'));
      expect(backupFiles.length).toBeGreaterThan(0);
    });

    it('should skip backup if createBackup is false', async () => {
      const snapshot = await createSnapshot(db, snapshotsDir, {
        reason: 'Restore test',
      });

      db.close();
      await restoreSnapshot(dbPath, snapshot.path, { createBackup: false });

      // Check no backup file
      const backupFiles = fs.readdirSync(testDir).filter((f) => f.includes('.before-restore-'));
      expect(backupFiles.length).toBe(0);
    });

    it('should throw error if snapshot file does not exist', async () => {
      db.close();
      await expect(
        restoreSnapshot(dbPath, path.join(snapshotsDir, 'non-existent.db'))
      ).rejects.toThrow('Snapshot file not found');
    });

    it('should validate snapshot integrity before restoring', async () => {
      const snapshot = await createSnapshot(db, snapshotsDir, {
        reason: 'Integrity test',
      });

      // Corrupt snapshot
      fs.writeFileSync(snapshot.path, 'corrupted data');

      db.close();

      await expect(
        restoreSnapshot(dbPath, snapshot.path, { validateIntegrity: true })
      ).rejects.toThrow('Snapshot integrity check failed');
    });

    it('should skip integrity check if validateIntegrity is false', async () => {
      const snapshot = await createSnapshot(db, snapshotsDir, {
        reason: 'No validation test',
      });

      // Corrupt snapshot (but restoreSnapshot will fail on copy anyway)
      fs.writeFileSync(snapshot.path, 'corrupted data');

      db.close();

      // Should not throw integrity error, but will fail during restore
      await expect(
        restoreSnapshot(dbPath, snapshot.path, { validateIntegrity: false })
      ).rejects.toThrow();
    });
  });

  describe('deleteSnapshot', () => {
    it('should delete snapshot and metadata files', async () => {
      const snapshot = await createSnapshot(db, snapshotsDir, {
        reason: 'Delete test',
        snapshotId: 'to-delete',
      });

      expect(fs.existsSync(snapshot.path)).toBe(true);
      expect(fs.existsSync(snapshot.path.replace('.db', '.json'))).toBe(true);

      const deleted = deleteSnapshot(snapshotsDir, 'to-delete');

      expect(deleted).toBe(true);
      expect(fs.existsSync(snapshot.path)).toBe(false);
      expect(fs.existsSync(snapshot.path.replace('.db', '.json'))).toBe(false);
    });

    it('should return false if snapshot does not exist', () => {
      const deleted = deleteSnapshot(snapshotsDir, 'non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('validateSnapshot', () => {
    it('should return true for valid snapshot', async () => {
      const snapshot = await createSnapshot(db, snapshotsDir, {
        reason: 'Validation test',
      });

      const isValid = await validateSnapshot(snapshot.path);
      expect(isValid).toBe(true);
    });

    it('should return false for non-existent snapshot', async () => {
      const isValid = await validateSnapshot(path.join(snapshotsDir, 'non-existent.db'));
      expect(isValid).toBe(false);
    });

    it('should return false for corrupted snapshot', async () => {
      const snapshot = await createSnapshot(db, snapshotsDir, {
        reason: 'Corruption test',
      });

      // Corrupt snapshot
      fs.writeFileSync(snapshot.path, 'corrupted data');

      const isValid = await validateSnapshot(snapshot.path);
      expect(isValid).toBe(false);
    });
  });

  describe('cleanupSnapshots', () => {
    it('should delete old snapshots keeping N most recent', async () => {
      // Create 5 snapshots
      for (let i = 0; i < 5; i++) {
        await createSnapshot(db, snapshotsDir, {
          reason: `Snapshot ${i + 1}`,
          snapshotId: `snapshot-${i + 1}`,
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const deleted = cleanupSnapshots(snapshotsDir, 3);

      expect(deleted).toBe(2);

      const remaining = listSnapshots(snapshotsDir);
      expect(remaining).toHaveLength(3);

      // Verify the most recent 3 are kept (snapshot-3, snapshot-4, snapshot-5)
      const ids = remaining.map((s) => s.id).sort();
      expect(ids).toContain('snapshot-3');
      expect(ids).toContain('snapshot-4');
      expect(ids).toContain('snapshot-5');
    });

    it('should not delete anything if count <= keepCount', async () => {
      await createSnapshot(db, snapshotsDir, {
        reason: 'Snapshot 1',
        snapshotId: 'snapshot-1',
      });

      await createSnapshot(db, snapshotsDir, {
        reason: 'Snapshot 2',
        snapshotId: 'snapshot-2',
      });

      const deleted = cleanupSnapshots(snapshotsDir, 5);

      expect(deleted).toBe(0);

      const remaining = listSnapshots(snapshotsDir);
      expect(remaining).toHaveLength(2);
    });

    it('should throw error if keepCount < 1', () => {
      expect(() => cleanupSnapshots(snapshotsDir, 0)).toThrow('keepCount must be at least 1');
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return the most recent snapshot', async () => {
      await createSnapshot(db, snapshotsDir, {
        reason: 'First',
        snapshotId: 'snapshot-1',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await createSnapshot(db, snapshotsDir, {
        reason: 'Second',
        snapshotId: 'snapshot-2',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await createSnapshot(db, snapshotsDir, {
        reason: 'Latest',
        snapshotId: 'snapshot-3',
      });

      const result = getLatestSnapshot(snapshotsDir);

      expect(result).toBeDefined();
      expect(result?.id).toBe('snapshot-3');
    });

    it('should return null if no snapshots exist', () => {
      const latest = getLatestSnapshot(snapshotsDir);
      expect(latest).toBeNull();
    });
  });
});
