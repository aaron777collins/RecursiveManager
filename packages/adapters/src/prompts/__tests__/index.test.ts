/**
 * Tests for Prompt Template System
 *
 * Validates that prompts are generated correctly for different execution modes
 * and contain all necessary information for agent execution.
 */

import { buildContinuousPrompt, buildReactivePrompt, buildMultiPerspectivePrompt } from '../index';
import type { AgentConfig } from '@recursive-manager/common';
import type { ExecutionContext, TaskSchema, Message } from '../../types';

/**
 * Helper function to create a mock agent config
 */
function createMockAgentConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    version: '1.0',
    identity: {
      id: 'agent-001',
      displayName: 'Test Agent',
      role: 'Software Engineer',
      createdAt: '2026-01-19T00:00:00Z',
      createdBy: 'system',
      reportingTo: 'manager-001',
    },
    goal: {
      mainGoal: 'Build high-quality software',
      subGoals: ['Write clean code', 'Test thoroughly'],
    },
    framework: {
      primary: 'claude-code',
    },
    communication: {
      preferredChannels: ['internal', 'slack'],
      notifyManager: {
        onTaskComplete: true,
        onError: true,
      },
    },
    behavior: {
      verbosity: 3,
      escalationPolicy: {
        autoEscalateAfterFailures: 3,
        escalateOnBlockedTask: true,
      },
    },
    permissions: {
      canHire: false,
      canFire: false,
      maxSubordinates: 0,
      hiringBudget: 0,
    },
    metadata: {
      tags: ['test'],
      description: 'Test agent',
    },
    ...overrides,
  } as AgentConfig;
}

/**
 * Helper function to create a mock task
 */
function createMockTask(overrides?: Partial<TaskSchema>): TaskSchema {
  return {
    id: 'task-001',
    title: 'Implement feature X',
    description: 'Add the new feature X to the system',
    status: 'pending',
    priority: 'high',
    createdAt: '2026-01-19T00:00:00Z',
    updatedAt: '2026-01-19T00:00:00Z',
    ...overrides,
  };
}

/**
 * Helper function to create a mock message
 */
function createMockMessage(overrides?: Partial<Message>): Message {
  return {
    id: 'msg-001',
    from: 'manager-001',
    to: 'agent-001',
    content: 'Please review the latest PR',
    channel: 'internal',
    timestamp: '2026-01-19T12:00:00Z',
    read: false,
    ...overrides,
  };
}

/**
 * Helper function to create a mock execution context
 */
function createMockContext(
  mode: 'continuous' | 'reactive',
  overrides?: Partial<ExecutionContext>
): ExecutionContext {
  const agent = createMockAgentConfig();
  return {
    agentId: 'agent-001',
    mode,
    config: agent,
    activeTasks: [],
    messages: [],
    workspaceFiles: ['README.md', 'package.json', 'src/index.ts'],
    workspaceDir: '/workspace/agent-001',
    workingDir: '/workspace/agent-001',
    ...overrides,
  };
}

describe('buildContinuousPrompt', () => {
  it('should generate a basic continuous prompt with agent identity', () => {
    const agent = createMockAgentConfig();
    const tasks: TaskSchema[] = [];
    const context = createMockContext('continuous');

    const prompt = buildContinuousPrompt(agent, tasks, context);

    // Should include agent identity
    expect(prompt).toContain('Test Agent');
    expect(prompt).toContain('Software Engineer');
    expect(prompt).toContain('Build high-quality software');
    expect(prompt).toContain('manager-001');
  });

  it('should include context information', () => {
    const agent = createMockAgentConfig();
    const tasks: TaskSchema[] = [];
    const context = createMockContext('continuous');

    const prompt = buildContinuousPrompt(agent, tasks, context);

    // Should include context
    expect(prompt).toContain('Continuous');
    expect(prompt).toContain('/workspace/agent-001');
  });

  it('should list active tasks with details', () => {
    const agent = createMockAgentConfig();
    const tasks: TaskSchema[] = [
      createMockTask({
        id: 'task-001',
        title: 'Fix critical bug',
        priority: 'critical',
        status: 'pending',
      }),
      createMockTask({
        id: 'task-002',
        title: 'Add new feature',
        priority: 'medium',
        status: 'in_progress',
      }),
    ];
    const context = createMockContext('continuous', { activeTasks: tasks });

    const prompt = buildContinuousPrompt(agent, tasks, context);

    // Should include both tasks
    expect(prompt).toContain('Fix critical bug');
    expect(prompt).toContain('Add new feature');
    expect(prompt).toContain('task-001');
    expect(prompt).toContain('task-002');
    expect(prompt).toContain('CRITICAL');
    expect(prompt).toContain('MEDIUM');
  });

  it('should sort tasks by priority (critical first)', () => {
    const agent = createMockAgentConfig();
    const tasks: TaskSchema[] = [
      createMockTask({ id: 'task-001', title: 'Low priority task', priority: 'low' }),
      createMockTask({ id: 'task-002', title: 'Critical task', priority: 'critical' }),
      createMockTask({ id: 'task-003', title: 'Medium task', priority: 'medium' }),
      createMockTask({ id: 'task-004', title: 'High priority task', priority: 'high' }),
    ];
    const context = createMockContext('continuous', { activeTasks: tasks });

    const prompt = buildContinuousPrompt(agent, tasks, context);

    // Find positions of task titles in the prompt
    const criticalPos = prompt.indexOf('Critical task');
    const highPos = prompt.indexOf('High priority task');
    const mediumPos = prompt.indexOf('Medium task');
    const lowPos = prompt.indexOf('Low priority task');

    // Verify correct ordering
    expect(criticalPos).toBeLessThan(highPos);
    expect(highPos).toBeLessThan(mediumPos);
    expect(mediumPos).toBeLessThan(lowPos);
  });

  it('should include task hierarchy information', () => {
    const agent = createMockAgentConfig();
    const tasks: TaskSchema[] = [
      createMockTask({
        id: 'task-002',
        title: 'Subtask',
        parentTaskId: 'task-001',
        delegatedTo: 'subordinate-001',
      }),
    ];
    const context = createMockContext('continuous', { activeTasks: tasks });

    const prompt = buildContinuousPrompt(agent, tasks, context);

    // Should include parent and delegation info
    expect(prompt).toContain('task-001');
    expect(prompt).toContain('subordinate-001');
  });

  it('should provide instructions for task management', () => {
    const agent = createMockAgentConfig();
    const tasks: TaskSchema[] = [createMockTask()];
    const context = createMockContext('continuous', { activeTasks: tasks });

    const prompt = buildContinuousPrompt(agent, tasks, context);

    // Should include instructions
    expect(prompt).toContain('highest priority');
    expect(prompt).toContain('Update Progress');
    expect(prompt).toContain('Quality Standards');
  });

  it('should include no-tasks message when task list is empty', () => {
    const agent = createMockAgentConfig();
    const tasks: TaskSchema[] = [];
    const context = createMockContext('continuous');

    const prompt = buildContinuousPrompt(agent, tasks, context);

    // Should include no-tasks guidance
    expect(prompt).toContain('no active tasks');
    expect(prompt).toContain('status update');
  });

  it('should include workspace information', () => {
    const agent = createMockAgentConfig();
    const tasks: TaskSchema[] = [];
    const context = createMockContext('continuous', {
      workspaceFiles: ['file1.ts', 'file2.ts', 'file3.ts'],
    });

    const prompt = buildContinuousPrompt(agent, tasks, context);

    // Should list workspace files
    expect(prompt).toContain('file1.ts');
    expect(prompt).toContain('file2.ts');
    expect(prompt).toContain('file3.ts');
  });

  it('should handle large workspace file lists gracefully', () => {
    const agent = createMockAgentConfig();
    const tasks: TaskSchema[] = [];
    const largeFileList = Array.from({ length: 100 }, (_, i) => `file${i}.ts`);
    const context = createMockContext('continuous', {
      workspaceFiles: largeFileList,
    });

    const prompt = buildContinuousPrompt(agent, tasks, context);

    // Should indicate too many files
    expect(prompt).toContain('Too many files');
    expect(prompt).not.toContain('file50.ts'); // Individual files not listed
  });

  it('should include behavior guidelines and escalation policy', () => {
    const agent = createMockAgentConfig({
      behavior: {
        escalationPolicy: {
          escalateOnBlockedTask: true,
          autoEscalateAfterFailures: 5,
        },
      },
    });
    const tasks: TaskSchema[] = [];
    const context = createMockContext('continuous');

    const prompt = buildContinuousPrompt(agent, tasks, context);

    // Should include decision making and escalation guidance
    expect(prompt).toContain('Decision Making');
    expect(prompt).toContain('Escalation Policy');
    expect(prompt).toContain('5 consecutive failures');
  });
});

describe('buildReactivePrompt', () => {
  it('should generate a basic reactive prompt with agent identity', () => {
    const agent = createMockAgentConfig();
    const messages: Message[] = [];
    const context = createMockContext('reactive');

    const prompt = buildReactivePrompt(agent, messages, context);

    // Should include agent identity
    expect(prompt).toContain('Test Agent');
    expect(prompt).toContain('Software Engineer');
  });

  it('should list unread messages with details', () => {
    const agent = createMockAgentConfig();
    const messages: Message[] = [
      createMockMessage({
        id: 'msg-001',
        from: 'manager-001',
        content: 'Please review the PR',
        channel: 'slack',
      }),
      createMockMessage({
        id: 'msg-002',
        from: 'colleague-001',
        content: 'Can you help with this issue?',
        channel: 'internal',
      }),
    ];
    const context = createMockContext('reactive', { messages });

    const prompt = buildReactivePrompt(agent, messages, context);

    // Should include both messages
    expect(prompt).toContain('Please review the PR');
    expect(prompt).toContain('Can you help with this issue?');
    expect(prompt).toContain('manager-001');
    expect(prompt).toContain('colleague-001');
    expect(prompt).toContain('slack');
    expect(prompt).toContain('internal');
  });

  it('should sort messages by timestamp (oldest first)', () => {
    const agent = createMockAgentConfig();
    const messages: Message[] = [
      createMockMessage({
        id: 'msg-003',
        content: 'Third message',
        timestamp: '2026-01-19T14:00:00Z',
      }),
      createMockMessage({
        id: 'msg-001',
        content: 'First message',
        timestamp: '2026-01-19T12:00:00Z',
      }),
      createMockMessage({
        id: 'msg-002',
        content: 'Second message',
        timestamp: '2026-01-19T13:00:00Z',
      }),
    ];
    const context = createMockContext('reactive', { messages });

    const prompt = buildReactivePrompt(agent, messages, context);

    // Find positions of messages in the prompt
    const firstPos = prompt.indexOf('First message');
    const secondPos = prompt.indexOf('Second message');
    const thirdPos = prompt.indexOf('Third message');

    // Verify correct ordering
    expect(firstPos).toBeLessThan(secondPos);
    expect(secondPos).toBeLessThan(thirdPos);
  });

  it('should provide instructions for message handling', () => {
    const agent = createMockAgentConfig();
    const messages: Message[] = [createMockMessage()];
    const context = createMockContext('reactive', { messages });

    const prompt = buildReactivePrompt(agent, messages, context);

    // Should include instructions
    expect(prompt).toContain('Respond to the messages');
    expect(prompt).toContain('Read Carefully');
    expect(prompt).toContain('Communication Style');
  });

  it('should include no-messages guidance when message list is empty', () => {
    const agent = createMockAgentConfig();
    const messages: Message[] = [];
    const context = createMockContext('reactive');

    const prompt = buildReactivePrompt(agent, messages, context);

    // Should include no-messages guidance
    expect(prompt).toContain('no unread messages');
  });

  it('should include communication guidelines', () => {
    const agent = createMockAgentConfig({
      communication: {
        preferredChannels: ['internal', 'slack', 'email'],
      },
    });
    const messages: Message[] = [];
    const context = createMockContext('reactive');

    const prompt = buildReactivePrompt(agent, messages, context);

    // Should include communication channels
    expect(prompt).toContain('internal');
    expect(prompt).toContain('slack');
    expect(prompt).toContain('email');
  });

  it('should handle different message channels with appropriate emojis', () => {
    const agent = createMockAgentConfig();
    const messages: Message[] = [
      createMockMessage({ channel: 'slack' }),
      createMockMessage({ channel: 'telegram' }),
      createMockMessage({ channel: 'email' }),
      createMockMessage({ channel: 'internal' }),
    ];
    const context = createMockContext('reactive', { messages });

    const prompt = buildReactivePrompt(agent, messages, context);

    // Should reference all channels
    expect(prompt).toContain('slack');
    expect(prompt).toContain('telegram');
    expect(prompt).toContain('email');
    expect(prompt).toContain('internal');
  });
});

describe('buildMultiPerspectivePrompt', () => {
  it('should generate a basic multi-perspective prompt', () => {
    const question = 'Should we implement caching for the API?';
    const perspective = 'Performance Engineer';

    const prompt = buildMultiPerspectivePrompt(question, perspective);

    // Should include the question and perspective
    expect(prompt).toContain(question);
    expect(prompt).toContain(perspective);
    expect(prompt).toContain('Multi-Perspective Analysis');
  });

  it('should include analysis structure guidelines', () => {
    const question = 'Should we migrate to TypeScript?';
    const perspective = 'Developer Experience Lead';

    const prompt = buildMultiPerspectivePrompt(question, perspective);

    // Should include analysis sections
    expect(prompt).toContain('Key Concerns');
    expect(prompt).toContain('Risks');
    expect(prompt).toContain('Benefits');
    expect(prompt).toContain('Trade-offs');
    expect(prompt).toContain('Recommendations');
  });

  it('should include additional context when provided', () => {
    const question = 'Should we scale horizontally or vertically?';
    const perspective = 'DevOps Engineer';
    const context = {
      currentLoad: '1000 req/s',
      targetLoad: '10000 req/s',
      budget: '$5000/month',
    };

    const prompt = buildMultiPerspectivePrompt(question, perspective, context);

    // Should include context values
    expect(prompt).toContain('currentLoad');
    expect(prompt).toContain('1000 req/s');
    expect(prompt).toContain('targetLoad');
    expect(prompt).toContain('10000 req/s');
    expect(prompt).toContain('budget');
    expect(prompt).toContain('$5000/month');
  });

  it('should handle missing context gracefully', () => {
    const question = 'Should we refactor the authentication system?';
    const perspective = 'Security Engineer';

    const prompt = buildMultiPerspectivePrompt(question, perspective);

    // Should not fail, should generate valid prompt
    expect(prompt).toContain(question);
    expect(prompt).toContain(perspective);
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('should emphasize quality and thoroughness', () => {
    const question = 'Which database should we use?';
    const perspective = 'Database Administrator';

    const prompt = buildMultiPerspectivePrompt(question, perspective);

    // Should emphasize quality
    expect(prompt).toContain('thorough');
    expect(prompt).toContain('quality');
    expect(prompt).toContain('actionable');
  });

  it('should handle complex context objects', () => {
    const question = 'Should we implement feature flags?';
    const perspective = 'Product Manager';
    const context = {
      teamSize: 10,
      deploymentFrequency: 'daily',
      rollbackRate: 0.05,
      features: ['feature-a', 'feature-b'],
      constraints: {
        time: '2 weeks',
        cost: '$10000',
      },
    };

    const prompt = buildMultiPerspectivePrompt(question, perspective, context);

    // Should serialize complex context
    expect(prompt).toContain('teamSize');
    expect(prompt).toContain('daily');
    expect(prompt).toContain('feature-a');
  });
});

describe('Prompt Integration', () => {
  it('should generate different prompts for continuous vs reactive mode', () => {
    const agent = createMockAgentConfig();
    const tasks = [createMockTask()];
    const messages = [createMockMessage()];
    const continuousContext = createMockContext('continuous', { activeTasks: tasks });
    const reactiveContext = createMockContext('reactive', { messages });

    const continuousPrompt = buildContinuousPrompt(agent, tasks, continuousContext);
    const reactivePrompt = buildReactivePrompt(agent, messages, reactiveContext);

    // Prompts should be different
    expect(continuousPrompt).not.toEqual(reactivePrompt);

    // Continuous should mention tasks
    expect(continuousPrompt).toContain('task');

    // Reactive should mention messages
    expect(reactivePrompt).toContain('message');
  });

  it('should generate non-empty prompts for all modes', () => {
    const agent = createMockAgentConfig();
    const tasks = [createMockTask()];
    const messages = [createMockMessage()];
    const continuousContext = createMockContext('continuous', { activeTasks: tasks });
    const reactiveContext = createMockContext('reactive', { messages });

    const continuousPrompt = buildContinuousPrompt(agent, tasks, continuousContext);
    const reactivePrompt = buildReactivePrompt(agent, messages, reactiveContext);
    const multiPerspectivePrompt = buildMultiPerspectivePrompt('Question', 'Perspective');

    // All prompts should be substantial
    expect(continuousPrompt.length).toBeGreaterThan(200);
    expect(reactivePrompt.length).toBeGreaterThan(200);
    expect(multiPerspectivePrompt.length).toBeGreaterThan(200);
  });

  it('should maintain consistent structure across different agent configs', () => {
    const task = createMockTask();
    const context = createMockContext('continuous', { activeTasks: [task] });

    // Different agents, same structure expected
    const agent1 = createMockAgentConfig({
      identity: { ...createMockAgentConfig().identity, displayName: 'Agent 1' },
    });
    const agent2 = createMockAgentConfig({
      identity: { ...createMockAgentConfig().identity, displayName: 'Agent 2' },
    });

    const prompt1 = buildContinuousPrompt(agent1, [task], context);
    const prompt2 = buildContinuousPrompt(agent2, [task], context);

    // Both should contain key sections
    expect(prompt1).toContain('# Agent Identity');
    expect(prompt2).toContain('# Agent Identity');
    expect(prompt1).toContain('# Active Tasks');
    expect(prompt2).toContain('# Active Tasks');
    expect(prompt1).toContain('# Instructions');
    expect(prompt2).toContain('# Instructions');
  });
});
