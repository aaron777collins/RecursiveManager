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

/**
 * All available migrations in order
 *
 * IMPORTANT: Always add new migrations at the end of this array
 * with incrementing version numbers.
 */
export const allMigrations: Migration[] = [migration001, migration002, migration003];

/**
 * Get all available migrations
 *
 * @returns Array of all migrations
 */
export function getMigrations(): Migration[] {
  return allMigrations;
}
