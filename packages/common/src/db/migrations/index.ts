/**
 * Database Migrations Registry
 *
 * This file exports all available migrations in order.
 * Each migration must have a unique version number and should be added
 * to the migrations array in sequential order.
 *
 * @module db/migrations
 */

import { Migration } from '../migrations';
import { migration001 } from './001_create_agents_table';
import { migration002 } from './002_create_tasks_table';
import { migration003 } from './003_create_messages_table';
import { migration004 } from './004_create_schedules_table';
import { migration005 } from './005_create_audit_log_table';
import { migration006 } from './006_create_org_hierarchy_table';
import { migration007 } from './007_add_task_metadata_columns';
import { migration008 } from './008_add_audit_log_immutability_trigger';
import { migration009 } from './009_add_schedule_dependencies';

/**
 * All available migrations in order
 *
 * IMPORTANT: Always add new migrations at the end of this array
 * with incrementing version numbers.
 */
export const allMigrations: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
];

/**
 * Get all available migrations
 *
 * @returns Array of all migrations
 */
export function getMigrations(): Migration[] {
  return allMigrations;
}
