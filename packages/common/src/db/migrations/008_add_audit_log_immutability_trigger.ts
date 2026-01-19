/**
 * Migration 008: Add audit log immutability trigger
 *
 * This migration adds a trigger to enforce that audit_log entries are immutable
 * after creation. This is critical for security auditing and compliance.
 *
 * The trigger prevents UPDATE and DELETE operations on existing audit_log records.
 * This ensures that audit logs cannot be tampered with after creation.
 */

import { Migration } from '../migrations';

export const migration008: Migration = {
  version: 8,
  description: 'Add audit log immutability trigger',

  up: [
    // Create trigger to prevent updates to audit_log
    `
    CREATE TRIGGER prevent_audit_log_update
    BEFORE UPDATE ON audit_log
    BEGIN
      SELECT RAISE(ABORT, 'Audit log entries are immutable and cannot be updated');
    END
    `,

    // Create trigger to prevent deletes from audit_log
    `
    CREATE TRIGGER prevent_audit_log_delete
    BEFORE DELETE ON audit_log
    BEGIN
      SELECT RAISE(ABORT, 'Audit log entries are immutable and cannot be deleted');
    END
    `,
  ],

  down: [
    // Drop triggers
    'DROP TRIGGER IF EXISTS prevent_audit_log_delete',
    'DROP TRIGGER IF EXISTS prevent_audit_log_update',
  ],
};
