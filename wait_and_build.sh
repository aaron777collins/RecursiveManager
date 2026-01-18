#!/bin/bash
# Wait for ralph plan to complete, then run ralph build

echo "Waiting for ralph plan to complete..."

# Wait for the ralph plan process to finish
while ps aux | grep "ralph.sh COMPREHENSIVE_PLAN.md plan" | grep -v grep > /dev/null; do
    sleep 5
done

echo "Ralph plan completed! Starting ralph build..."
cd ~/repos/RecursiveManager
nohup ~/ralph/ralph.sh COMPREHENSIVE_PLAN.md build > ralph_build.log 2>&1 &
echo "Ralph build started with PID: $!"
