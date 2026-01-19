/**
 * TypeScript types for Agent Configuration
 *
 * These types mirror the agent-config.schema.json schema and provide
 * type safety for agent configuration files.
 */

/**
 * Agent identity and organizational information
 */
export interface AgentIdentity {
  /** Unique agent identifier */
  id: string;
  /** Agent's role in the organization */
  role: string;
  /** Human-readable display name */
  displayName: string;
  /** ISO 8601 timestamp of agent creation */
  createdAt: string;
  /** ID of agent that created this agent */
  createdBy: string;
  /** ID of agent this agent reports to (manager) */
  reportingTo?: string;
}

/**
 * Agent goal definition
 */
export interface AgentGoal {
  /** Primary objective for this agent */
  mainGoal: string;
  /** Breakdown of main goal into smaller goals */
  subGoals?: string[];
  /** Measurable criteria for success */
  successCriteria?: string[];
}

/**
 * Agent permissions and capabilities
 */
export interface AgentPermissions {
  /** Can this agent hire subordinates */
  canHire: boolean;
  /** Maximum number of direct subordinates */
  maxSubordinates: number;
  /** Number of subordinates this agent can hire before approval */
  hiringBudget: number;
  /** Can this agent fire subordinates */
  canFire?: boolean;
  /** Can this agent escalate to their manager */
  canEscalate?: boolean;
  /** Can this agent access external APIs */
  canAccessExternalAPIs?: boolean;
  /** Whitelist of allowed external domains */
  allowedDomains?: string[];
  /** Maximum allowed task delegation depth */
  maxDelegationDepth?: number;
  /** Whether this agent can modify its own configuration */
  canSelfModify?: boolean;
}

/**
 * Framework configuration
 */
export interface AgentFramework {
  /** Primary framework to use (claude-code, opencode, etc.) */
  primary: string;
  /** Fallback framework if primary unavailable */
  fallback?: string;
  /** Required framework capabilities */
  capabilities?: string[];
}

/**
 * Communication channel configuration
 */
export interface CommunicationChannels {
  /** Preferred communication channels */
  preferredChannels?: Array<'internal' | 'slack' | 'telegram' | 'email'>;
  /** Slack channel for notifications */
  slackChannel?: string;
  /** Telegram chat ID */
  telegramChatId?: string;
  /** Email address for notifications */
  emailAddress?: string;
  /** Whether to notify manager on completion */
  notifyManager?: boolean;
  /** Whether to notify on delegation */
  notifyOnDelegation?: boolean;
  /** Whether to notify on escalation */
  notifyOnEscalation?: boolean;
}

/**
 * Agent behavior settings
 */
export interface AgentBehavior {
  /** How verbose the agent should be (1-5) */
  verbosity?: number;
  /** Maximum execution time in minutes per run */
  maxExecutionTime?: number;
  /** Maximum cost per execution in USD */
  maxCostPerExecution?: number;
  /** Whether to require approval before executing */
  requireApprovalForExecution?: boolean;
  /** Whether to auto-escalate blocked tasks */
  autoEscalateBlockedTasks?: boolean;
  /** Minutes to wait before escalating blocked tasks */
  escalationTimeoutMinutes?: number;
  /** Whether to continue working on tasks until complete */
  continuousMode?: boolean;
  /** Custom prompt instructions or personality */
  customInstructions?: string;
}

/**
 * Agent metadata
 */
export interface AgentMetadata {
  /** Custom tags for filtering and organization */
  tags?: string[];
  /** Agent description or purpose */
  description?: string;
  /** Notes for debugging or context */
  notes?: string;
  /** Custom key-value metadata */
  customData?: Record<string, unknown>;
}

/**
 * Complete agent configuration
 */
export interface AgentConfig {
  /** JSON Schema reference */
  $schema?: string;
  /** Configuration schema version */
  version: string;
  /** Agent identity and organizational information */
  identity: AgentIdentity;
  /** Agent goal definition */
  goal: AgentGoal;
  /** Agent permissions and capabilities */
  permissions: AgentPermissions;
  /** Framework configuration */
  framework: AgentFramework;
  /** Communication channel configuration */
  communication?: CommunicationChannels;
  /** Agent behavior settings */
  behavior?: AgentBehavior;
  /** Agent metadata */
  metadata?: AgentMetadata;
}
