#!/bin/bash

# monitor-ralph.sh - Monitor multiple ralph processes and post updates to Slack
# Usage: REPO_DIR=/path ./monitor-ralph.sh [interval_seconds]
# Environment:
#   REPO_DIR    Path to RecursiveManager repository (default: /home/ubuntu/repos/RecursiveManager)

set -e

INTERVAL=${1:-60}  # Default: check every 60 seconds
REPO_DIR="${REPO_DIR:-/home/ubuntu/repos/RecursiveManager}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL}"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Progress files to monitor
PROGRESS_FILES=(
    "$REPO_DIR/PRODUCTION_READINESS_PLAN_PROGRESS.md"
    "$REPO_DIR/COMPLETE_PRODUCTION_READY_PLAN_PROGRESS.md"
    "$REPO_DIR/PRODUCTION_READINESS_IMPLEMENTATION_PROGRESS.md"
)

# Parse progress from markdown file
parse_progress() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo "0/0 (0%)|N/A|NOT_FOUND"
        return
    fi

    # Extract total and completed tasks
    local total=$(grep -oP '(?<=^Total tasks: )\d+' "$file" 2>/dev/null | head -1)
    local completed=$(grep -E '^\- \[x\]' "$file" 2>/dev/null | wc -l)

    # Try alternative format (numbered tasks)
    if [[ -z "$total" ]]; then
        total=$(grep -E '^(Task|\d+\.)' "$file" 2>/dev/null | wc -l)
    fi

    # Calculate percentage
    local percent=0
    if [[ $total -gt 0 ]]; then
        percent=$(( completed * 100 / total ))
    fi

    # Get current task (last unchecked or "Done")
    local current=$(grep -E '^\- \[ \]' "$file" 2>/dev/null | head -1 | sed 's/^- \[ \] //' | cut -c 1-60)
    if [[ -z "$current" ]]; then
        if grep -q "RALPH_DONE" "$file" 2>/dev/null; then
            current="✅ COMPLETE"
        else
            current="In progress..."
        fi
    fi

    echo "$completed/$total ($percent%)|$current|ACTIVE"
}

# Find PID for a plan
find_pid() {
    local plan_name="$1"
    ps aux | grep "ralph.sh $plan_name" | grep -v grep | awk '{print $2}' | head -1
}

# Check if process is running
is_running() {
    local pid="$1"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

# Send to Slack
send_slack() {
    local message="$1"

    if [[ -z "$SLACK_WEBHOOK" ]]; then
        echo -e "${YELLOW}[WARN]${NC} SLACK_WEBHOOK_URL not set, skipping Slack notification"
        return
    fi

    curl -s -X POST "$SLACK_WEBHOOK" \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"$message\"}" \
        > /dev/null 2>&1
}

# Format status report
generate_report() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local report="📊 *Ralph Progress Report* - $timestamp\n\n"

    for progress_file in "${PROGRESS_FILES[@]}"; do
        local basename=$(basename "$progress_file" "_PROGRESS.md")
        local plan_file="$REPO_DIR/${basename}.md"

        # Parse progress
        IFS='|' read -r progress current_task status <<< "$(parse_progress "$progress_file")"

        # Find PID
        local pid=$(find_pid "$basename.md")
        local running_status="⚫ Stopped"
        if is_running "$pid"; then
            running_status="🟢 Running (PID: $pid)"
        fi

        # Check if done
        if grep -q "RALPH_DONE" "$progress_file" 2>/dev/null; then
            running_status="✅ Complete"
        fi

        # Add to report
        report+="*$basename*\n"
        report+="  Status: $running_status\n"
        report+="  Progress: \`$progress\`\n"
        report+="  Current: $current_task\n\n"
    done

    echo -e "$report"
}

# Store last progress to detect changes
declare -A LAST_PROGRESS

# Main monitoring loop
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Ralph Progress Monitor${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Monitoring interval: ${YELLOW}${INTERVAL}s${NC}"
echo -e "Slack notifications: ${YELLOW}$([ -n "$SLACK_WEBHOOK" ] && echo "Enabled" || echo "Disabled")${NC}"
echo ""

# Send initial report
initial_report=$(generate_report)
echo "$initial_report"
send_slack "$initial_report"

while true; do
    sleep "$INTERVAL"

    changed=false
    current_report=""

    for progress_file in "${PROGRESS_FILES[@]}"; do
        local basename=$(basename "$progress_file" "_PROGRESS.md")
        IFS='|' read -r progress current_task status <<< "$(parse_progress "$progress_file")"

        # Check if progress changed
        if [[ "${LAST_PROGRESS[$basename]}" != "$progress" ]]; then
            changed=true
            LAST_PROGRESS[$basename]="$progress"

            # Check if just completed
            if grep -q "RALPH_DONE" "$progress_file" 2>/dev/null && [[ "$progress" == *"100%"* ]]; then
                local complete_msg="🎉 *$basename* COMPLETED! $progress"
                echo -e "\n${GREEN}$complete_msg${NC}"
                send_slack "$complete_msg"
            fi
        fi
    done

    # Send periodic update if anything changed
    if $changed; then
        current_report=$(generate_report)
        echo -e "\n${YELLOW}━━━ Update at $(date '+%H:%M:%S') ━━━${NC}"
        echo "$current_report"
        send_slack "$current_report"
    else
        echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} No changes detected"
    fi
done
