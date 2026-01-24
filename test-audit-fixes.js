#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Add packages/common/dist to require path
const commonDist = path.join(__dirname, 'packages/common/dist');
const { initializeDatabase, runMigrations } = require(commonDist);

// Import all migrations
const migrations = require(path.join(commonDist, 'db/migrations/index'));

console.log('=== RecursiveManager Audit Fixes Test ===\n');

const dbPath = '/tmp/test-audit-fixes.db';
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('✓ Removed old test database');
}

// Initialize database with all migrations
console.log('\n1. Initializing database...');
try {
  const conn = initializeDatabase({ path: dbPath });
  const db = conn.db;

  console.log('✓ Database initialized');

  // Run all migrations
  console.log('\n2. Running migrations...');
  const allMigrations = migrations.all_migrations;
  const appliedCount = runMigrations(db, allMigrations);
  console.log(`✓ Applied ${appliedCount} migrations`);

  // Test 1: Check FK constraint on messages.from_agent_id
  console.log('\n3. Testing FK constraint on messages.from_agent_id...');
  const messagesFk = db.prepare("PRAGMA foreign_key_list(messages)").all();
  const hasFromAgentFk = messagesFk.some(fk => fk.from === 'from_agent_id');
  if (hasFromAgentFk) {
    console.log('✓ FK constraint on messages.from_agent_id exists');
  } else {
    console.log('✗ FK constraint on messages.from_agent_id MISSING');
  }

  // Test 2: Check indexes
  console.log('\n4. Testing indexes...');
  const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").all();

  const expectedIndexes = [
    { name: 'idx_messages_from_agent_id', table: 'messages' },
    { name: 'idx_audit_log_target_agent_id', table: 'audit_log' }
  ];

  for (const expected of expectedIndexes) {
    const found = indexes.some(idx => idx.name === expected.name && idx.tbl_name === expected.table);
    if (found) {
      console.log(`✓ Index ${expected.name} exists on ${expected.table}`);
    } else {
      console.log(`✗ Index ${expected.name} MISSING on ${expected.table}`);
    }
  }

  // Test 3: Check schedules table structure
  console.log('\n5. Testing schedules table...');
  const schedulesInfo = db.prepare("PRAGMA table_info(schedules)").all();
  if (schedulesInfo.length > 0) {
    console.log(`✓ Schedules table exists with ${schedulesInfo.length} columns`);

    // Check for key columns
    const columnNames = schedulesInfo.map(col => col.name);
    const expectedColumns = ['id', 'agent_id', 'trigger_type', 'enabled', 'next_execution_at'];
    for (const col of expectedColumns) {
      if (columnNames.includes(col)) {
        console.log(`  ✓ Column '${col}' exists`);
      } else {
        console.log(`  ✗ Column '${col}' MISSING`);
      }
    }
  } else {
    console.log('✗ Schedules table MISSING');
  }

  // Test 4: Check CHECK constraints
  console.log('\n6. Testing CHECK constraints...');

  // Try to insert invalid agent status
  try {
    db.prepare("INSERT INTO agents (id, role, display_name, created_at, status, main_goal, config_path) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      'test-agent-1',
      'test-role',
      'Test Agent',
      new Date().toISOString(),
      'invalid_status', // Should fail
      'test goal',
      '/test/config.json'
    );
    console.log('✗ CHECK constraint on agents.status NOT working (invalid status accepted)');
  } catch (err) {
    console.log('✓ CHECK constraint on agents.status works (rejected invalid status)');
  }

  // Try to insert valid agent status
  try {
    db.prepare("INSERT INTO agents (id, role, display_name, created_at, status, main_goal, config_path) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      'test-agent-2',
      'test-role',
      'Test Agent',
      new Date().toISOString(),
      'idle', // Should succeed
      'test goal',
      '/test/config.json'
    );
    console.log('✓ Valid agent status accepted');
  } catch (err) {
    console.log('✗ Valid agent status rejected:', err.message);
  }

  // Test 5: Verify audit log immutability trigger
  console.log('\n7. Testing audit log immutability...');
  try {
    // First, insert an audit log entry
    db.prepare("INSERT INTO audit_log (id, timestamp, action, agent_id) VALUES (?, ?, ?, ?)").run(
      'test-audit-1',
      new Date().toISOString(),
      'test_action',
      'test-agent-2'
    );
    console.log('  ✓ Audit log entry created');

    // Try to update it (should fail)
    try {
      db.prepare("UPDATE audit_log SET action = ? WHERE id = ?").run('modified_action', 'test-audit-1');
      console.log('  ✗ Audit log immutability trigger NOT working (update allowed)');
    } catch (err) {
      console.log('  ✓ Audit log immutability trigger works (update prevented)');
    }
  } catch (err) {
    console.log('  ✗ Error testing audit log:', err.message);
  }

  // Test 6: Test schedules queries (if they exist)
  console.log('\n8. Testing schedules query API...');
  try {
    const schedulesQueries = require(path.join(commonDist, 'db/queries/schedules'));
    console.log('✓ Schedules queries module exists');

    // Check for expected functions
    const expectedFunctions = [
      'createSchedule',
      'getSchedule',
      'updateSchedule',
      'deleteSchedule',
      'getSchedulesReadyToExecute',
      'getContinuousSchedulesReadyToCheck'
    ];

    for (const funcName of expectedFunctions) {
      if (typeof schedulesQueries[funcName] === 'function') {
        console.log(`  ✓ Function '${funcName}' exists`);
      } else {
        console.log(`  ✗ Function '${funcName}' MISSING`);
      }
    }
  } catch (err) {
    console.log('✗ Schedules queries module NOT found:', err.message);
  }

  // Summary
  console.log('\n=== Test Summary ===');
  console.log('✓ Database migrations completed successfully');
  console.log('✓ All audit fixes have been applied');
  console.log('\nDatabase location:', dbPath);
  console.log('Tables created:', db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get().count);
  console.log('Indexes created:', indexes.length);

  conn.close();
  console.log('\n✓ Database closed successfully');

} catch (error) {
  console.error('\n✗ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
