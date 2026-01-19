/**
 * Task ID Generator (Task 2.3.5)
 *
 * This module provides functions to generate unique task IDs with the format:
 * task-{number}-{slug}
 *
 * Examples:
 * - task-1-setup-api
 * - task-42-implement-auth
 * - task-123-fix-bug-in-login
 *
 * The numeric portion is managed per-agent to ensure uniqueness.
 * The slug portion is derived from the task title.
 */

import Database from 'better-sqlite3';

/**
 * Generates a URL-friendly slug from a string
 *
 * @param text - The text to slugify
 * @returns A lowercase, hyphenated slug containing only alphanumeric characters and hyphens
 *
 * @example
 * ```typescript
 * slugify('Setup API'); // 'setup-api'
 * slugify('Fix Bug in Login!'); // 'fix-bug-in-login'
 * slugify('Implement @user Auth (OAuth2)'); // 'implement-user-auth-oauth2'
 * ```
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Remove all non-alphanumeric characters except hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Replace multiple consecutive hyphens with a single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Limit length to 50 characters for readability
    .substring(0, 50)
    // Remove trailing hyphen if substring cut in the middle
    .replace(/-+$/, '');
}

/**
 * Gets the next task number for an agent
 *
 * This function queries the database to find the highest task number
 * currently used by an agent and returns the next available number.
 *
 * @param db - Database instance
 * @param agentId - The agent ID to get the next task number for
 * @returns The next available task number (starting from 1)
 *
 * @example
 * ```typescript
 * const nextNum = getNextTaskNumber(db, 'ceo-001');
 * console.log(nextNum); // 1 (if no tasks exist)
 * // After creating task-1-*
 * console.log(getNextTaskNumber(db, 'ceo-001')); // 2
 * ```
 */
export function getNextTaskNumber(db: Database.Database, agentId: string): number {
  // Query for all task IDs for this agent that match the pattern task-{number}-*
  const query = db.prepare(`
    SELECT id
    FROM tasks
    WHERE agent_id = ?
      AND id LIKE 'task-%'
  `);

  const results = query.all(agentId) as Array<{ id: string }>;

  // Extract numeric portions and find the maximum
  let maxNumber = 0;
  for (const result of results) {
    // Extract number from task-{number}-{slug} format
    const match = result.id.match(/^task-(\d+)-/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  return maxNumber + 1;
}

/**
 * Generates a unique task ID for an agent
 *
 * The ID format is: task-{number}-{slug}
 * - {number}: Auto-incremented per agent (starts at 1)
 * - {slug}: URL-friendly version of the task title
 *
 * This function ensures uniqueness by:
 * 1. Querying the database for the highest task number for the agent
 * 2. Incrementing to get the next number
 * 3. Combining with the slugified title
 *
 * @param db - Database instance
 * @param agentId - The agent ID creating the task
 * @param title - The task title
 * @returns A unique task ID in the format task-{number}-{slug}
 *
 * @example
 * ```typescript
 * const id1 = generateTaskId(db, 'ceo-001', 'Setup API');
 * // Returns: 'task-1-setup-api'
 *
 * const id2 = generateTaskId(db, 'ceo-001', 'Implement Auth');
 * // Returns: 'task-2-implement-auth'
 *
 * const id3 = generateTaskId(db, 'cto-001', 'Fix Bug');
 * // Returns: 'task-1-fix-bug' (different agent, starts at 1)
 * ```
 */
export function generateTaskId(
  db: Database.Database,
  agentId: string,
  title: string
): string {
  const number = getNextTaskNumber(db, agentId);
  const slug = slugify(title);

  // Ensure we have a valid slug (fallback to 'task' if empty)
  const validSlug = slug || 'task';

  return `task-${number}-${validSlug}`;
}
