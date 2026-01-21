# Critical Bugs Found During Testing (v1.1.5)

## Date: 2026-01-20

## Bug 1: Missing Native Bindings ❌ CRITICAL

**Issue**: better-sqlite3 native bindings not included in binary distribution

**Error**:
```
Could not locate the bindings file. Tried:
→ /home/ubuntu/.recursivemanager/node_modules/better-sqlite3/build/better_sqlite3.node
```

**Root Cause**: The build script copies node_modules but doesn't rebuild native modules

**Impact**: `recursivemanager init` fails completely - BLOCKS ALL USAGE

**Workaround**: Manual rebuild:
```bash
cd ~/.recursivemanager && npm rebuild better-sqlite3
```

**Fix Required**: Update build script to rebuild native modules after copying

---

## Bug 2: .gitignore Not Created ❌ MODERATE

**Issue**: Despite code to create .gitignore, it's not being created during `init`

**Expected**: `.gitignore` created in project directory with:
```
.recursivemanager/logs/
.recursivemanager/.env
```

**Actual**: No `.gitignore` created

**Impact**: Users might accidentally commit sensitive logs

**Fix Required**: Debug init-gitignore.ts and ensure it runs

---

## Bug 3: Scheduler Not Tested ⏳ UNKNOWN

**Issue**: Haven't tested scheduler functionality yet

**Need to verify**:
- Task creation
- Task scheduling
- Priority queue
- Concurrent execution
- Dependencies

---

## Test Environment:
- Version: 1.1.5
- Platform: Ubuntu Linux
- Node: 20.19.6
