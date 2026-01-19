#!/bin/bash

# Create GitHub labels for RecursiveManager project tracking
# Requires GitHub CLI (gh) to be installed and authenticated

set -e

echo "🏷️  Creating GitHub labels for RecursiveManager..."
echo ""

# Phase labels
echo "Creating Phase labels..."
gh label create "phase-0" --description "Pre-implementation setup" --color "0E8A16" || true
gh label create "phase-1" --description "Foundation & Core Infrastructure" --color "1D76DB" || true
gh label create "phase-2" --description "Core Agent System" --color "5319E7" || true
gh label create "phase-3" --description "Execution Engine" --color "B60205" || true
gh label create "phase-4" --description "Scheduling & Triggers" --color "D93F0B" || true
gh label create "phase-5" --description "Messaging Integration" --color "FBCA04" || true
gh label create "phase-6" --description "CLI & User Experience" --color "0075CA" || true
gh label create "phase-7" --description "Observability & Debugging" --color "C2E0C6" || true
gh label create "phase-8" --description "Security & Resilience" --color "D4C5F9" || true
gh label create "phase-9" --description "OpenCode Adapter" --color "E99695" || true
gh label create "phase-10" --description "Documentation & Examples" --color "BFD4F2" || true

# Type labels
echo "Creating Type labels..."
gh label create "implementation" --description "Implementation task from plan" --color "C5DEF5" || true
gh label create "bug" --description "Bug or defect" --color "D73A4A" || true
gh label create "enhancement" --description "New feature or enhancement" --color "A2EEEF" || true
gh label create "documentation" --description "Documentation work" --color "0075CA" || true
gh label create "testing" --description "Testing task" --color "D4C5F9" || true

# Priority labels
echo "Creating Priority labels..."
gh label create "priority-critical" --description "Critical priority - blocking" --color "B60205" || true
gh label create "priority-high" --description "High priority" --color "D93F0B" || true
gh label create "priority-medium" --description "Medium priority" --color "FBCA04" || true
gh label create "priority-low" --description "Low priority" --color "C2E0C6" || true

# Status labels (optional - can use project status instead)
echo "Creating Status labels..."
gh label create "status-blocked" --description "Blocked by dependencies" --color "D73A4A" || true
gh label create "status-needs-review" --description "Needs code review" --color "FBCA04" || true
gh label create "status-needs-testing" --description "Needs testing" --color "D4C5F9" || true

# Special labels
echo "Creating Special labels..."
gh label create "edge-case" --description "Related to documented edge case" --color "E99695" || true
gh label create "multi-perspective" --description "Requires multi-perspective analysis" --color "5319E7" || true
gh label create "breaking-change" --description "Breaking change" --color "B60205" || true
gh label create "good-first-issue" --description "Good for newcomers" --color "7057FF" || true
gh label create "help-wanted" --description "Extra attention needed" --color "008672" || true

echo ""
echo "✅ Labels created successfully!"
echo ""
echo "💡 View all labels: gh label list"
echo "💡 Or visit: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/labels"
