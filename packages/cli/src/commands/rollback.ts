/**
 * Rollback command - Restore database from a snapshot
 */

import { Command } from 'commander';
import { header, error, info, code, subheader, warning, success } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { loadConfig } from '../utils/config';
import { confirm, select } from '../utils/prompts';
import {
  listSnapshots,
  getSnapshot,
  restoreSnapshot,
  validateSnapshot,
  type Snapshot,
} from '@recursive-manager/common';
import * as path from 'path';

export function registerRollbackCommand(program: Command): void {
  program
    .command('rollback [snapshot-id]')
    .description('Restore database from a snapshot')
    .option('--history', 'List available snapshots')
    .option('--limit <n>', 'Limit number of snapshots to show (default: 20)', '20')
    .option('--agent-id <id>', 'Filter snapshots by agent ID')
    .option('--json', 'Output as JSON')
    .option('--data-dir <dir>', 'Custom data directory')
    .option('--no-backup', 'Skip creating backup before restore (not recommended)')
    .option('--no-validate', 'Skip integrity validation before restore (not recommended)')
    .action(
      async (
        snapshotId: string | undefined,
        options: {
          history?: boolean;
          limit?: string;
          agentId?: string;
          json?: boolean;
          dataDir?: string;
          backup?: boolean;
          validate?: boolean;
        }
      ) => {
        try {
          const config = loadConfig(options.dataDir);
          const snapshotsDir = path.join(config.dataDir, 'snapshots');

          // List snapshots mode
          if (options.history) {
            await listSnapshotsMode(snapshotsDir, options);
            return;
          }

          // Restore mode
          if (!snapshotId) {
            // Interactive snapshot selection
            const selectedId = await selectSnapshotInteractive(snapshotsDir, options);
            if (!selectedId) {
              console.log(info('No snapshot selected. Use --history to list available snapshots.'));
              console.log();
              return;
            }
            snapshotId = selectedId;
          }

          await restoreSnapshotMode(config.dbPath, snapshotsDir, snapshotId, options);
        } catch (err) {
          console.error(error('Rollback failed: ' + (err as Error).message));
          console.log();
          process.exit(1);
        }
      }
    );
}

/**
 * List snapshots mode
 */
async function listSnapshotsMode(
  snapshotsDir: string,
  options: { limit?: string; agentId?: string; json?: boolean }
): Promise<void> {
  const limit = parseInt(options.limit || '20', 10);
  const snapshots = listSnapshots(snapshotsDir, {
    limit: limit > 0 ? limit : undefined,
    agentId: options.agentId,
    sortOrder: 'desc',
  });

  if (options.json) {
    console.log(JSON.stringify(snapshots, null, 2));
    return;
  }

  console.log();
  console.log(header('📸 Available Snapshots'));
  console.log();

  if (snapshots.length === 0) {
    console.log(info('No snapshots found.'));
    console.log();
    console.log(
      warning(
        'Snapshots are automatically created when hiring or firing agents, or you can create them manually.'
      )
    );
    console.log();
    return;
  }

  console.log(subheader(`Showing ${snapshots.length} most recent snapshots:`));
  console.log();

  snapshots.forEach((snapshot: Snapshot, index: number) => {
    const date = new Date(snapshot.createdAt).toLocaleString();
    const sizeMB = (snapshot.size / 1024 / 1024).toFixed(2);
    const agentInfo = snapshot.agentId ? ` (Agent: ${snapshot.agentId})` : '';

    console.log(`${index + 1}. ${code(snapshot.id)}`);
    console.log(`   Reason: ${snapshot.reason}${agentInfo}`);
    console.log(`   Created: ${date}`);
    console.log(`   Size: ${sizeMB} MB`);
    console.log();
  });

  console.log(info('Use ' + code('rollback <snapshot-id>') + ' to restore a snapshot'));
  console.log();
}

/**
 * Interactive snapshot selection
 */
async function selectSnapshotInteractive(
  snapshotsDir: string,
  options: { agentId?: string }
): Promise<string | null> {
  const snapshots = listSnapshots(snapshotsDir, {
    limit: 10,
    agentId: options.agentId,
    sortOrder: 'desc',
  });

  if (snapshots.length === 0) {
    console.log();
    console.log(warning('No snapshots available to restore.'));
    console.log();
    console.log(info('Use ' + code('rollback --history') + ' to see all snapshots'));
    console.log();
    return null;
  }

  console.log();
  console.log(header('🔄 Select Snapshot to Restore'));
  console.log();

  const choices = snapshots.map((snapshot: Snapshot, index: number) => {
    const date = new Date(snapshot.createdAt).toLocaleString();
    const agentInfo = snapshot.agentId ? ` [${snapshot.agentId}]` : '';
    return {
      name: `${index + 1}. ${snapshot.reason}${agentInfo} - ${date}`,
      value: snapshot.id,
    };
  });

  choices.push({
    name: 'Cancel',
    value: 'CANCEL',
  });

  const snapshotId = await select('Select a snapshot to restore:', choices);

  return snapshotId === 'CANCEL' ? null : snapshotId;
}

/**
 * Restore snapshot mode
 */
async function restoreSnapshotMode(
  dbPath: string,
  snapshotsDir: string,
  snapshotId: string,
  options: { json?: boolean; backup?: boolean; validate?: boolean }
): Promise<void> {
  const spinner = options.json ? null : createSpinner('Loading snapshot...');

  // Get snapshot metadata
  const snapshot = getSnapshot(snapshotsDir, snapshotId);
  if (!snapshot) {
    if (spinner) spinner.fail('Snapshot not found');
    console.error(error(`Snapshot '${snapshotId}' not found`));
    console.log();
    console.log(warning('Use ' + code('rollback --history') + ' to list available snapshots'));
    console.log();
    process.exit(1);
  }

  if (spinner) spinner.succeed('Snapshot loaded');

  // Display snapshot information
  if (!options.json) {
    console.log();
    console.log(subheader('Snapshot Information:'));
    console.log();
    console.log('ID:', code(snapshot.id));
    console.log('Reason:', code(snapshot.reason));
    console.log('Created:', code(new Date(snapshot.createdAt).toLocaleString()));
    console.log('Size:', code((snapshot.size / 1024 / 1024).toFixed(2) + ' MB'));
    if (snapshot.agentId) {
      console.log('Agent ID:', code(snapshot.agentId));
    }
    console.log('Schema Version:', code(snapshot.schemaVersion.toString()));
    console.log();

    console.log(
      warning(
        '⚠️  WARNING: This will replace your current database with the snapshot. All changes since the snapshot will be lost!'
      )
    );
    console.log();

    // Confirmation prompt
    const confirmed = await confirm('Are you sure you want to restore this snapshot?', false);

    if (!confirmed) {
      console.log();
      console.log(info('Restore cancelled.'));
      console.log();
      return;
    }
    console.log();
  }

  // Validate snapshot if requested
  if (options.validate !== false) {
    const validationSpinner = options.json
      ? null
      : createSpinner('Validating snapshot integrity...');

    const isValid = await validateSnapshot(snapshot.path);

    if (!isValid) {
      if (validationSpinner) validationSpinner.fail('Snapshot validation failed');
      console.error(error('Snapshot integrity check failed. The snapshot may be corrupted.'));
      console.log();
      console.log(warning('Use --no-validate to skip validation (not recommended)'));
      console.log();
      process.exit(1);
    }

    if (validationSpinner) validationSpinner.succeed('Snapshot validated');
  }

  // Close any existing database connections
  // Note: In a real scenario, we need to ensure the database is not in use
  const restoreSpinner = options.json ? null : createSpinner('Restoring snapshot...');

  try {
    // Restore the snapshot
    const newDb = await restoreSnapshot(snapshot.path, dbPath, {
      createBackup: options.backup !== false,
      validateIntegrity: false, // Already validated above if requested
    });

    // Close the new database connection
    newDb.close();

    if (restoreSpinner) restoreSpinner.succeed('Snapshot restored successfully');

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            success: true,
            snapshotId: snapshot.id,
            restoredAt: new Date().toISOString(),
            backup: options.backup !== false,
          },
          null,
          2
        )
      );
    } else {
      console.log();
      console.log(success('✓ Database successfully restored from snapshot!'));
      console.log();
      if (options.backup !== false) {
        console.log(info('A backup of your previous database was saved.'));
        console.log();
      }
      console.log(info('Use ' + code('status') + ' to verify the restored state'));
      console.log();
    }
  } catch (err) {
    if (restoreSpinner) restoreSpinner.fail('Restore failed');
    throw err;
  }
}
