export function howToUse(): void {
  console.log(`
RecursiveManager - Quick Start Guide
====================================

Basic Workflow:
  1. Initialize with a goal: recursivemanager init "Build a web application"
  2. Check organization status: recursivemanager status
  3. Interact with agents: recursivemanager hire, message, etc.

Common Commands:
  init <goal>           - Initialize RecursiveManager with your goal
  status                - View current organization chart
  analyze <question>    - Run multi-perspective AI analysis (8 expert agents)
  hire                  - Hire a new AI agent to your organization
  fire <agent-id>       - Remove an agent from your organization
  message <agent-id>    - Send a message to a specific agent
  run <agent-id>        - Execute an agent's tasks
  help                  - Show all available commands

For detailed documentation:
  recursivemanager how_to_use_extended

For help on a specific command:
  recursivemanager <command> --help

Examples:
  recursivemanager init "Create a REST API with authentication"
  recursivemanager analyze "Should I use TypeScript or JavaScript?"
  recursivemanager hire
  `);
}
