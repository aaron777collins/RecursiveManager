/**
 * Prompt Template System
 *
 * Provides structured, reusable prompt templates for different execution modes.
 * This system ensures consistent, high-quality prompts across all agent executions.
 *
 * @module prompts
 */

import type { AgentConfig } from '@recursivemanager/common';
import type { ExecutionContext, TaskSchema, Message } from '../types';

/**
 * Build a continuous mode prompt for an agent
 *
 * Continuous mode is for agents actively working on tasks. This prompt:
 * - Presents the agent's identity, role, and goal
 * - Lists active tasks with priority and status
 * - Provides task context and workspace information
 * - Guides the agent to work on the highest priority task
 * - Instructs on task management and progress updates
 *
 * @param agent - Agent configuration
 * @param tasks - Active tasks for the agent
 * @param context - Full execution context
 * @returns Formatted prompt for continuous execution
 *
 * @example
 * ```typescript
 * const prompt = buildContinuousPrompt(agentConfig, activeTasks, context);
 * // Use prompt with Claude Code CLI
 * ```
 */
export function buildContinuousPrompt(
  agent: AgentConfig,
  tasks: TaskSchema[],
  context: ExecutionContext
): string {
  const sections: string[] = [];

  // Section 1: Identity and Role
  sections.push(buildIdentitySection(agent));

  // Section 2: Current Context
  sections.push(buildContextSection(context));

  // Section 3: Active Tasks
  if (tasks.length > 0) {
    sections.push(buildTaskListSection(tasks));
    sections.push(buildContinuousInstructions(tasks));
  } else {
    sections.push(buildNoTasksSection());
  }

  // Section 4: Workspace Information
  sections.push(buildWorkspaceSection(context));

  // Section 5: Behavioral Guidelines
  sections.push(buildBehaviorSection(agent));

  return sections.join('\n\n');
}

/**
 * Build a reactive mode prompt for an agent
 *
 * Reactive mode is for agents responding to messages. This prompt:
 * - Presents the agent's identity and communication style
 * - Lists unread messages with sender and channel information
 * - Provides message history context
 * - Guides the agent to respond appropriately
 * - Instructs on message handling and escalation
 *
 * @param agent - Agent configuration
 * @param messages - Unread messages for the agent
 * @param context - Full execution context
 * @returns Formatted prompt for reactive execution
 *
 * @example
 * ```typescript
 * const prompt = buildReactivePrompt(agentConfig, unreadMessages, context);
 * // Use prompt with Claude Code CLI
 * ```
 */
export function buildReactivePrompt(
  agent: AgentConfig,
  messages: Message[],
  context: ExecutionContext
): string {
  const sections: string[] = [];

  // Section 1: Identity and Role
  sections.push(buildIdentitySection(agent));

  // Section 2: Current Context
  sections.push(buildContextSection(context));

  // Section 3: Unread Messages
  if (messages.length > 0) {
    sections.push(buildMessageListSection(messages));
    sections.push(buildReactiveInstructions(agent));
  } else {
    sections.push(buildNoMessagesSection());
  }

  // Section 4: Communication Guidelines
  sections.push(buildCommunicationSection(agent));

  return sections.join('\n\n');
}

/**
 * Build a multi-perspective analysis prompt
 *
 * Multi-perspective mode is for agents performing analysis from multiple viewpoints.
 * This prompt:
 * - Presents the question or decision to be analyzed
 * - Specifies the perspective to analyze from
 * - Provides relevant context and constraints
 * - Guides the agent to provide structured analysis
 * - Instructs on format and depth of analysis
 *
 * @param question - The question or decision to analyze
 * @param perspective - The specific perspective to analyze from
 * @param context - Additional context for the analysis
 * @returns Formatted prompt for multi-perspective analysis
 *
 * @example
 * ```typescript
 * const prompt = buildMultiPerspectivePrompt(
 *   "Should we implement caching for the API?",
 *   "Performance Engineer",
 *   { currentLatency: "500ms", targetLatency: "100ms" }
 * );
 * ```
 */
export function buildMultiPerspectivePrompt(
  question: string,
  perspective: string,
  context?: Record<string, unknown>
): string {
  const sections: string[] = [];

  // Section 1: Analysis Setup
  sections.push('# Multi-Perspective Analysis Request');
  sections.push(
    `You are analyzing the following question from the perspective of a **${perspective}**:`
  );
  sections.push('');
  sections.push(`> ${question}`);

  // Section 2: Context (if provided)
  if (context && Object.keys(context).length > 0) {
    sections.push('');
    sections.push('## Additional Context');
    sections.push('');
    for (const [key, value] of Object.entries(context)) {
      sections.push(`- **${key}**: ${JSON.stringify(value)}`);
    }
  }

  // Section 3: Instructions
  sections.push('');
  sections.push('## Your Task');
  sections.push('');
  sections.push(`Provide a thorough analysis from the **${perspective}** perspective. Consider:`);
  sections.push('');
  sections.push('1. **Key Concerns**: What matters most from this perspective?');
  sections.push('2. **Risks**: What could go wrong? What are the potential pitfalls?');
  sections.push('3. **Benefits**: What are the advantages of different approaches?');
  sections.push('4. **Trade-offs**: What compromises need to be made?');
  sections.push('5. **Recommendations**: What would you suggest from this perspective?');
  sections.push('');
  sections.push('Be specific, concrete, and actionable in your analysis.');
  sections.push('Prioritize quality and thoroughness over speed.');

  return sections.join('\n');
}

/**
 * Build the identity section of a prompt
 * @private
 */
function buildIdentitySection(agent: AgentConfig): string {
  const { identity, goal } = agent;
  const lines: string[] = [];

  lines.push('# Agent Identity');
  lines.push('');
  lines.push(`You are **${identity.displayName}**, an AI agent in the RecursiveManager system.`);
  lines.push('');
  lines.push(`**Role**: ${identity.role}`);

  if (goal?.mainGoal) {
    lines.push(`**Goal**: ${goal.mainGoal}`);
  }

  if (identity.reportingTo) {
    lines.push(`**Reports to**: ${identity.reportingTo}`);
  }

  return lines.join('\n');
}

/**
 * Build the context section showing current state
 * @private
 */
function buildContextSection(context: ExecutionContext): string {
  const lines: string[] = [];

  lines.push('# Current Context');
  lines.push('');
  lines.push(
    `**Mode**: ${context.mode === 'continuous' ? 'Continuous (Task-focused)' : 'Reactive (Message-focused)'}`
  );
  lines.push(`**Workspace**: ${context.workspaceDir}`);
  lines.push(`**Active Tasks**: ${context.activeTasks.length}`);
  lines.push(`**Unread Messages**: ${context.messages.length}`);

  return lines.join('\n');
}

/**
 * Build the task list section for continuous mode
 * @private
 */
function buildTaskListSection(tasks: TaskSchema[]): string {
  const lines: string[] = [];

  lines.push('# Active Tasks');
  lines.push('');
  lines.push(`You have ${tasks.length} active task${tasks.length === 1 ? '' : 's'}:`);
  lines.push('');

  // Sort tasks by priority (critical > high > medium > low)
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedTasks = [...tasks].sort((a, b) => {
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  sortedTasks.forEach((task, index) => {
    const priorityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    }[task.priority];

    lines.push(`## ${index + 1}. ${task.title}`);
    lines.push('');
    lines.push(`- **Priority**: ${priorityEmoji} ${task.priority.toUpperCase()}`);
    lines.push(`- **Status**: ${task.status}`);
    lines.push(`- **ID**: ${task.id}`);

    if (task.parentTaskId) {
      lines.push(`- **Parent Task**: ${task.parentTaskId}`);
    }

    if (task.delegatedTo) {
      lines.push(`- **Delegated To**: ${task.delegatedTo}`);
    }

    lines.push('');
    lines.push('**Description**:');
    lines.push('');
    lines.push(task.description);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Build instructions for continuous mode
 * @private
 */
function buildContinuousInstructions(_tasks: TaskSchema[]): string {
  const lines: string[] = [];

  lines.push('# Instructions');
  lines.push('');
  lines.push('## Your Mission');
  lines.push('');
  lines.push(
    'Work on the **highest priority pending task** from the list above. Follow these steps:'
  );
  lines.push('');
  lines.push('1. **Select Task**: Choose the highest priority task that is in "pending" status');
  lines.push('2. **Understand Requirements**: Read the task description carefully');
  lines.push('3. **Plan Approach**: Break down the work if needed (create subtasks)');
  lines.push('4. **Execute**: Perform the work (write code, analyze data, etc.)');
  lines.push('5. **Update Progress**: Update the task status as you work');
  lines.push('6. **Complete**: Mark the task as "completed" when fully done');
  lines.push('');
  lines.push('## Task Management');
  lines.push('');
  lines.push('- If a task is too large, **break it into subtasks** and delegate as needed');
  lines.push(
    '- If you encounter blockers, **update the task status to "blocked"** and explain why'
  );
  lines.push('- If you need help from your manager, **escalate** by sending them a message');
  lines.push('- If a task requires a subordinate, **hire** one with appropriate skills');
  lines.push('');
  lines.push('## Quality Standards');
  lines.push('');
  lines.push('- **Test your work**: Ensure changes work before marking tasks complete');
  lines.push('- **Document as you go**: Add comments, update README files');
  lines.push('- **Follow existing patterns**: Maintain consistency with the codebase');
  lines.push('- **Think before acting**: Consider edge cases and potential issues');

  return lines.join('\n');
}

/**
 * Build the no tasks section for continuous mode
 * @private
 */
function buildNoTasksSection(): string {
  const lines: string[] = [];

  lines.push('# Status');
  lines.push('');
  lines.push('You currently have **no active tasks** assigned.');
  lines.push('');
  lines.push('## What to Do');
  lines.push('');
  lines.push('1. Check your workspace for any pending work or issues');
  lines.push("2. Review your subordinates' progress (if you have any)");
  lines.push('3. Send a status update to your manager');
  lines.push('4. Wait for new task assignments');

  return lines.join('\n');
}

/**
 * Build the workspace section showing available files
 * @private
 */
function buildWorkspaceSection(context: ExecutionContext): string {
  const lines: string[] = [];

  lines.push('# Workspace');
  lines.push('');
  lines.push(`**Directory**: ${context.workspaceDir}`);
  lines.push(
    `**Files**: ${context.workspaceFiles.length} file${context.workspaceFiles.length === 1 ? '' : 's'}`
  );

  if (context.workspaceFiles.length > 0 && context.workspaceFiles.length <= 20) {
    lines.push('');
    lines.push('**Available Files**:');
    lines.push('');
    context.workspaceFiles.forEach((file) => {
      lines.push(`- ${file}`);
    });
  } else if (context.workspaceFiles.length > 20) {
    lines.push('');
    lines.push('(Too many files to list - use file exploration tools to navigate)');
  }

  return lines.join('\n');
}

/**
 * Build the behavior section with agent-specific guidelines
 * @private
 */
function buildBehaviorSection(agent: AgentConfig): string {
  const lines: string[] = [];

  lines.push('# Behavioral Guidelines');
  lines.push('');

  // Note: The actual AgentConfig doesn't have autonomyLevel, so we'll provide general guidance
  lines.push('**Decision Making**:');
  lines.push('- Work independently within your defined role and permissions');
  lines.push('- Escalate to your manager when encountering blockers or major decisions');
  lines.push('- Follow the escalation policy for critical situations');
  lines.push('');

  if (agent.behavior?.escalationPolicy) {
    lines.push('**Escalation Policy**:');
    lines.push('');
    lines.push('Escalate to your manager when:');

    if (agent.behavior.escalationPolicy.escalateOnBlockedTask) {
      lines.push('- A task is blocked and you cannot proceed');
    }

    lines.push("- You need resources or permissions you don't have");
    lines.push('- You encounter errors or issues beyond your expertise');

    if (agent.behavior.escalationPolicy.autoEscalateAfterFailures) {
      lines.push(
        `- After ${agent.behavior.escalationPolicy.autoEscalateAfterFailures} consecutive failures`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Build the message list section for reactive mode
 * @private
 */
function buildMessageListSection(messages: Message[]): string {
  const lines: string[] = [];

  lines.push('# Unread Messages');
  lines.push('');
  lines.push(`You have ${messages.length} unread message${messages.length === 1 ? '' : 's'}:`);
  lines.push('');

  // Sort messages by timestamp (oldest first)
  const sortedMessages = [...messages].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  sortedMessages.forEach((msg, index) => {
    const channelEmoji =
      {
        internal: '📨',
        slack: '💬',
        telegram: '📱',
        email: '✉️',
      }[msg.channel] || '📬';

    lines.push(`## Message ${index + 1}`);
    lines.push('');
    lines.push(`${channelEmoji} **From**: ${msg.from} (via ${msg.channel})`);
    lines.push(`**Time**: ${new Date(msg.timestamp).toLocaleString()}`);
    lines.push('');
    lines.push('**Content**:');
    lines.push('');
    lines.push(msg.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Build instructions for reactive mode
 * @private
 */
function buildReactiveInstructions(_agent: AgentConfig): string {
  const lines: string[] = [];

  lines.push('# Instructions');
  lines.push('');
  lines.push('## Your Mission');
  lines.push('');
  lines.push(
    'Respond to the messages above in a timely and appropriate manner. Follow these guidelines:'
  );
  lines.push('');
  lines.push('1. **Read Carefully**: Understand what each message is asking or informing');
  lines.push('2. **Prioritize**: Handle urgent messages first');
  lines.push('3. **Respond Appropriately**: Provide helpful, clear, and professional responses');
  lines.push('4. **Take Action**: If a message requires work, create tasks or delegate');
  lines.push('5. **Mark as Read**: Messages you respond to should be marked as processed');
  lines.push('');
  lines.push('## Communication Style');
  lines.push('');
  lines.push('- Be clear and concise');
  lines.push('- Provide context in your responses');
  lines.push('- If you need more information, ask clarifying questions');
  lines.push('- If you cannot handle a request, escalate to your manager');

  return lines.join('\n');
}

/**
 * Build the no messages section for reactive mode
 * @private
 */
function buildNoMessagesSection(): string {
  const lines: string[] = [];

  lines.push('# Status');
  lines.push('');
  lines.push('You currently have **no unread messages**.');
  lines.push('');
  lines.push('## What to Do');
  lines.push('');
  lines.push('1. Check if there are any active tasks requiring attention');
  lines.push('2. Review your workspace for any updates or changes');
  lines.push('3. Monitor for new incoming messages');

  return lines.join('\n');
}

/**
 * Build the communication section with agent-specific guidelines
 * @private
 */
function buildCommunicationSection(agent: AgentConfig): string {
  const lines: string[] = [];

  lines.push('# Communication Guidelines');
  lines.push('');

  if (agent.communication?.preferredChannels && agent.communication.preferredChannels.length > 0) {
    lines.push('**Available Channels**:');
    lines.push('');
    agent.communication.preferredChannels.forEach((channel) => {
      lines.push(`- ${channel}`);
    });
    lines.push('');
  }

  lines.push('**Best Practices**:');
  lines.push('');
  lines.push('- Respond within a reasonable timeframe');
  lines.push('- Keep your manager informed of important developments');
  lines.push('- Use appropriate channels for different types of communication');
  lines.push('- Document important decisions and discussions');

  return lines.join('\n');
}
