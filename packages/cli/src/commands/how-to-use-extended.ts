export function howToUseExtended(): void {
  console.log(`
RecursiveManager - Complete User Guide
======================================

OVERVIEW
--------
RecursiveManager is an AI-powered development manager that creates a hierarchical
organization of AI agents to help you achieve your development goals.

GETTING STARTED
--------------
1. Initialize with your goal:
   $ recursivemanager init "Build a web application with authentication"

2. Check your organization:
   $ recursivemanager status

3. Run AI analysis for important decisions:
   $ recursivemanager analyze "Should I use PostgreSQL or MongoDB?"

CORE CONCEPTS
------------
- **Agents**: AI team members with specific roles (CEO, CTO, Developer, etc.)
- **Organization**: Hierarchical structure (CEO → CTO → Backend Dev → etc.)
- **Multi-Perspective Analysis**: 8 expert agents analyze decisions from different angles:
  * Security Agent - Identifies security risks and vulnerabilities
  * Architecture Agent - Evaluates scalability and maintainability
  * Simplicity Agent - Recommends simplest effective approach
  * Financial Agent - Analyzes costs and budget impact
  * Marketing Agent - Considers user perception and positioning
  * UX Agent - Evaluates user experience impact
  * Growth Agent - Assesses growth and adoption potential
  * Emotional Agent - Considers team morale and user satisfaction

COMMAND REFERENCE
----------------

init <goal>
  Initialize RecursiveManager with your development goal
  Example: recursivemanager init "Create a REST API"

status
  Display current organization structure and agent statuses
  Shows: agent roles, tasks, progress

analyze <question>
  Run multi-perspective AI analysis with 8 expert agents
  Returns: comprehensive analysis with confidence scores
  Example: recursivemanager analyze "Should we add caching?"

hire
  Add a new AI agent to your organization
  Prompts: role, responsibilities, manager
  Creates: new agent in organization hierarchy

fire <agent-id>
  Remove an agent from your organization
  Requires: agent ID from status command
  Example: recursivemanager fire agent-123

message <agent-id> <message>
  Send a message/instruction to a specific agent
  Example: recursivemanager message agent-123 "Review the API design"

run <agent-id>
  Execute tasks for a specific agent
  Triggers: agent's autonomous task execution

logs [agent-id]
  View logs for all agents or a specific agent
  Example: recursivemanager logs agent-123

update
  Check for and install RecursiveManager updates
  Automatically: downloads latest, backs up current version

config
  View and edit RecursiveManager configuration
  Settings: API provider, model, rate limits, etc.

debug
  Show debug information and system diagnostics
  Displays: versions, configuration, system status

rollback
  Rollback to a previous version
  Restores: from automatic backup

CONFIGURATION
------------
Configuration file: ~/.recursivemanager/.env

Key settings:
  AI_PROVIDER=aiceo-gateway     # Primary AI provider
  AICEO_GATEWAY_URL=...         # Gateway endpoint
  AI_FALLBACK_PROVIDER=...      # Backup provider

Edit config: recursivemanager config

TROUBLESHOOTING
--------------
1. Check system status:
   $ recursivemanager debug

2. View logs:
   $ recursivemanager logs

3. Verify configuration:
   $ recursivemanager config

4. Rollback to previous version:
   $ recursivemanager rollback

BEST PRACTICES
-------------
1. Start with clear, specific goals
2. Use multi-perspective analysis for major decisions
3. Review agent status regularly
4. Keep your organization structure flat (3-4 levels max)
5. Use descriptive agent roles
6. Review logs when issues occur

EXAMPLES
--------
Complete workflow:
  $ recursivemanager init "Build e-commerce API with Stripe"
  $ recursivemanager status
  $ recursivemanager analyze "Should we use microservices?"
  $ recursivemanager hire
  $ recursivemanager message agent-cto "Design database schema"
  $ recursivemanager run agent-cto
  $ recursivemanager logs

For more help:
  - Command-specific: recursivemanager <command> --help
  - Quick start: recursivemanager how_to_use
  - Documentation: https://github.com/aaron777collins/RecursiveManager
  `);
}
