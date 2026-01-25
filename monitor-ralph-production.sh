#!/bin/bash

# Monitor Ralph Production Readiness Implementation
# Usage: REPO_DIR=/path ./monitor-ralph-production.sh
# Environment:
#   REPO_DIR    Path to RecursiveManager repository (default: /home/ubuntu/repos/RecursiveManager)

PLAN_FILE="RALPH_PRODUCTION_READY_PLAN.md"
PROGRESS_FILE="RALPH_PRODUCTION_READY_PLAN_PROGRESS.md"
REPO_DIR="${REPO_DIR:-/home/ubuntu/repos/RecursiveManager}"

cd "$REPO_DIR" || exit 1

echo "=================================================="
echo "  Ralph Production Readiness Monitor"
echo "=================================================="
echo ""
echo "Plan: $PLAN_FILE"
echo "Progress: $PROGRESS_FILE"
echo ""
echo "Press Ctrl+C to stop monitoring"
echo "=================================================="
echo ""

while true; do
    clear
    echo "=================================================="
    echo "  Ralph Status - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=================================================="
    echo ""

    # Check if Ralph is running
    if pgrep -f "ralph.sh.*$PLAN_FILE" > /dev/null; then
        echo "✅ Ralph is RUNNING"

        # Get Ralph PID
        RALPH_PID=$(pgrep -f "ralph.sh.*$PLAN_FILE")
        echo "   PID: $RALPH_PID"
    else
        echo "❌ Ralph is NOT RUNNING"
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Progress File Contents"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    if [ -f "$PROGRESS_FILE" ]; then
        cat "$PROGRESS_FILE"
    else
        echo "⚠️  Progress file not found yet"
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Recent Log Output (last 20 lines)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    if [ -f "ralph-plan.log" ]; then
        tail -20 ralph-plan.log | grep -v "^$"
    elif [ -f "ralph-build.log" ]; then
        tail -20 ralph-build.log | grep -v "^$"
    else
        echo "⚠️  No log files found yet"
    fi

    echo ""
    echo "=================================================="
    echo "Refreshing in 10 seconds... (Ctrl+C to stop)"
    echo "=================================================="

    sleep 10
done
