#!/bin/bash

# Script to automatically run Ralph build after plan completes

PLAN_FILE="FINAL_PRODUCTION_PLAN.md"
PLAN_PROGRESS="FINAL_PRODUCTION_PLAN_PROGRESS.md"
PLAN_LOG="ralph_final_plan.log"
BUILD_LOG="ralph_final_build.log"

echo "Monitoring Ralph plan execution..."
echo "Plan file: $PLAN_FILE"
echo "Progress file: $PLAN_PROGRESS"
echo

# Wait for plan to complete
while true; do
    if [ ! -f "$PLAN_PROGRESS" ]; then
        echo "Waiting for progress file to be created..."
        sleep 10
        continue
    fi
    
    # Check if plan is complete
    if grep -q "Status:.*RALPH_DONE" "$PLAN_PROGRESS"; then
        echo "✓ Plan completed!"
        break
    elif grep -q "Status:.*FAILED" "$PLAN_PROGRESS"; then
        echo "✗ Plan failed!"
        echo "Check log: $PLAN_LOG"
        exit 1
    fi
    
    # Show progress
    STATUS=$(grep "Status:" "$PLAN_PROGRESS" | tail -1 || echo "Status: Unknown")
    ITERATION=$(grep "Iterations:" "$PLAN_PROGRESS" | tail -1 || echo "Iterations: 0")
    echo "[$(date '+%H:%M:%S')] $STATUS | $ITERATION"
    
    sleep 15
done

echo
echo "Starting Ralph build..."
echo

# Start Ralph build
nohup /home/ubuntu/ralph/ralph.sh "$PLAN_FILE" build > "$BUILD_LOG" 2>&1 &
BUILD_PID=$!
echo "$BUILD_PID" > ralph_final_build.pid

echo "Ralph BUILD started with PID: $BUILD_PID"
echo "Log file: $BUILD_LOG"
echo
echo "Monitor with: tail -f $BUILD_LOG"
