#!/bin/bash

# Auto-start Ralph build when plan completes

PLAN_LOG="ralph-plan.log"
BUILD_LOG="ralph-build.log"
PLAN_FILE="RALPH_PRODUCTION_READY_PLAN.md"

echo "Monitoring Ralph plan completion..."

# Wait for plan to complete
while true; do
    if tail -20 "$PLAN_LOG" 2>/dev/null | grep -q "Planning complete"; then
        echo "✅ Ralph plan completed!"
        sleep 2
        
        echo "📋 Starting Ralph BUILD mode..."
        cd /home/ubuntu/repos/RecursiveManager
        nohup /home/ubuntu/ralph/ralph.sh "$PLAN_FILE" build > "$BUILD_LOG" 2>&1 &
        
        echo "✅ Ralph BUILD started with PID: $!"
        echo "Monitor with: tail -f $BUILD_LOG"
        exit 0
    fi
    
    # Check if Ralph is still running
    if ! pgrep -f "ralph.sh.*$PLAN_FILE.*plan" > /dev/null; then
        echo "⚠️  Ralph plan process not found. It may have finished or failed."
        if [ -f "RALPH_PRODUCTION_READY_PLAN_PROGRESS.md" ]; then
            echo "Progress file exists. Checking status..."
            grep "RALPH_DONE" RALPH_PRODUCTION_READY_PLAN_PROGRESS.md && echo "✅ Planning complete!" && exit 0
        fi
        echo "❌ Ralph may have failed. Check logs:"
        echo "   tail -50 $PLAN_LOG"
        exit 1
    fi
    
    sleep 10
done
