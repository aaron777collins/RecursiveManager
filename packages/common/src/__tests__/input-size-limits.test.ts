/**
 * Input Size Limits Tests
 *
 * Tests to verify that the JSON schemas enforce maxLength constraints
 * to prevent excessively large inputs that could cause memory or performance issues.
 */

import { validateAgentConfig, validateTask, validateMessage } from '../schema-validation';

describe('Input Size Limits', () => {
  describe('Agent Config Size Limits', () => {
    it('should reject agent ID exceeding 128 characters', () => {
      const config: any = {
        version: '1.0.0',
        identity: {
          id: 'a'.repeat(129), // Exceeds 128 char limit
          role: 'Test Role',
          displayName: 'Test Agent',
          createdAt: new Date().toISOString(),
          createdBy: 'root',
          reportingTo: null
        },
        goal: {
          mainGoal: 'Test goal',
          subGoals: [],
          successCriteria: []
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
          canFire: false,
          canEscalate: true,
          canAccessExternalAPIs: false,
          allowedDomains: [],
          maxDelegationDepth: 0,
          canSelfModify: false,
          workspaceQuotaMB: 1024,
          maxExecutionMinutes: 60
        },
        framework: {
          primary: 'claude-code'
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toContain('128 characters');
    });

    it('should accept agent ID at maximum 128 characters', () => {
      const config: any = {
        version: '1.0.0',
        identity: {
          id: 'a'.repeat(128), // Exactly 128 chars
          role: 'Test Role',
          displayName: 'Test Agent',
          createdAt: new Date().toISOString(),
          createdBy: 'root',
          reportingTo: null
        },
        goal: {
          mainGoal: 'Test goal',
          subGoals: [],
          successCriteria: []
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
          canFire: false,
          canEscalate: true,
          canAccessExternalAPIs: false,
          allowedDomains: [],
          maxDelegationDepth: 0,
          canSelfModify: false,
          workspaceQuotaMB: 1024,
          maxExecutionMinutes: 60
        },
        framework: {
          primary: 'claude-code'
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should reject mainGoal exceeding 10240 characters', () => {
      const config: any = {
        version: '1.0.0',
        identity: {
          id: 'test-agent',
          role: 'Test Role',
          displayName: 'Test Agent',
          createdAt: new Date().toISOString(),
          createdBy: 'root',
          reportingTo: null
        },
        goal: {
          mainGoal: 'x'.repeat(10241), // Exceeds 10240 char limit
          subGoals: [],
          successCriteria: []
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
          canFire: false,
          canEscalate: true,
          canAccessExternalAPIs: false,
          allowedDomains: [],
          maxDelegationDepth: 0,
          canSelfModify: false,
          workspaceQuotaMB: 1024,
          maxExecutionMinutes: 60
        },
        framework: {
          primary: 'claude-code'
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject too many subGoals (>100)', () => {
      const config: any = {
        version: '1.0.0',
        identity: {
          id: 'test-agent',
          role: 'Test Role',
          displayName: 'Test Agent',
          createdAt: new Date().toISOString(),
          createdBy: 'root',
          reportingTo: null
        },
        goal: {
          mainGoal: 'Test goal',
          subGoals: Array(101).fill('subgoal'), // Exceeds 100 item limit
          successCriteria: []
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
          canFire: false,
          canEscalate: true,
          canAccessExternalAPIs: false,
          allowedDomains: [],
          maxDelegationDepth: 0,
          canSelfModify: false,
          workspaceQuotaMB: 1024,
          maxExecutionMinutes: 60
        },
        framework: {
          primary: 'claude-code'
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject customInstructions exceeding 102400 characters', () => {
      const config: any = {
        version: '1.0.0',
        identity: {
          id: 'test-agent',
          role: 'Test Role',
          displayName: 'Test Agent',
          createdAt: new Date().toISOString(),
          createdBy: 'root',
          reportingTo: null
        },
        goal: {
          mainGoal: 'Test goal',
          subGoals: [],
          successCriteria: []
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
          canFire: false,
          canEscalate: true,
          canAccessExternalAPIs: false,
          allowedDomains: [],
          maxDelegationDepth: 0,
          canSelfModify: false,
          workspaceQuotaMB: 1024,
          maxExecutionMinutes: 60
        },
        framework: {
          primary: 'claude-code'
        },
        behavior: {
          customInstructions: 'x'.repeat(102401) // Exceeds 102400 char limit
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Task Size Limits', () => {
    it('should reject task title exceeding 1024 characters', () => {
      const task: any = {
        version: '1.0.0',
        task: {
          id: 'task-1-test',
          title: 'x'.repeat(1025), // Exceeds 1024 char limit
          status: 'pending',
          priority: 'medium',
          createdAt: new Date().toISOString(),
          startedAt: null,
          completedAt: null,
          estimatedCompletionAt: null
        },
        hierarchy: {
          parentTask: null,
          childTasks: [],
          depth: 0,
          maxDepth: 5
        },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          delegatedBy: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily'
        },
        progress: {
          percentComplete: 0,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: new Date().toISOString(),
          blockedBy: [],
          blockedSince: null,
          blockReason: null
        },
        context: {
          relatedFiles: [],
          externalDependencies: [],
          notes: '',
          tags: []
        },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
          lastSuccessAt: null
        }
      };

      const result = validateTask(task);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject task notes exceeding 1048576 characters (1MB)', () => {
      const task: any = {
        version: '1.0.0',
        task: {
          id: 'task-1-test',
          title: 'Test Task',
          status: 'pending',
          priority: 'medium',
          createdAt: new Date().toISOString(),
          startedAt: null,
          completedAt: null,
          estimatedCompletionAt: null
        },
        hierarchy: {
          parentTask: null,
          childTasks: [],
          depth: 0,
          maxDepth: 5
        },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          delegatedBy: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily'
        },
        progress: {
          percentComplete: 0,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: new Date().toISOString(),
          blockedBy: [],
          blockedSince: null,
          blockReason: null
        },
        context: {
          relatedFiles: [],
          externalDependencies: [],
          notes: 'x'.repeat(1048577), // Exceeds 1MB limit
          tags: []
        },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
          lastSuccessAt: null
        }
      };

      const result = validateTask(task);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject too many child tasks (>10000)', () => {
      const task: any = {
        version: '1.0.0',
        task: {
          id: 'task-1-test',
          title: 'Test Task',
          status: 'pending',
          priority: 'medium',
          createdAt: new Date().toISOString(),
          startedAt: null,
          completedAt: null,
          estimatedCompletionAt: null
        },
        hierarchy: {
          parentTask: null,
          childTasks: Array(10001).fill('task-1-child'), // Exceeds 10000 item limit
          depth: 0,
          maxDepth: 5
        },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          delegatedBy: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily'
        },
        progress: {
          percentComplete: 0,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: new Date().toISOString(),
          blockedBy: [],
          blockedSince: null,
          blockReason: null
        },
        context: {
          relatedFiles: [],
          externalDependencies: [],
          notes: '',
          tags: []
        },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
          lastSuccessAt: null
        }
      };

      const result = validateTask(task);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Message Size Limits', () => {
    it('should reject message subject exceeding 1024 characters', () => {
      const message: any = {
        id: 'msg-123-test',
        from: 'agent-1',
        to: 'agent-2',
        timestamp: new Date().toISOString(),
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
        subject: 'x'.repeat(1025), // Exceeds 1024 char limit
        readAt: null,
        archivedAt: null,
        tags: [],
        attachments: []
      };

      const result = validateMessage(message);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject attachment with size exceeding 1GB', () => {
      const message: any = {
        id: 'msg-123-test',
        from: 'agent-1',
        to: 'agent-2',
        timestamp: new Date().toISOString(),
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
        readAt: null,
        archivedAt: null,
        tags: [],
        attachments: [
          {
            filename: 'large-file.bin',
            path: '/path/to/file',
            size: 1073741825, // Exceeds 1GB (1073741824 bytes) limit
            mimeType: 'application/octet-stream'
          }
        ]
      };

      const result = validateMessage(message);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject too many attachments (>1000)', () => {
      const message: any = {
        id: 'msg-123-test',
        from: 'agent-1',
        to: 'agent-2',
        timestamp: new Date().toISOString(),
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
        readAt: null,
        archivedAt: null,
        tags: [],
        attachments: Array(1001).fill({
          filename: 'file.txt',
          path: '/path/to/file',
          size: 100,
          mimeType: 'text/plain'
        })
      };

      const result = validateMessage(message);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should accept attachment at maximum 1GB size', () => {
      const message: any = {
        id: 'msg-123-test',
        from: 'agent-1',
        to: 'agent-2',
        timestamp: new Date().toISOString(),
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
        readAt: null,
        archivedAt: null,
        tags: [],
        attachments: [
          {
            filename: 'large-file.bin',
            path: '/path/to/file',
            size: 1073741824, // Exactly 1GB
            mimeType: 'application/octet-stream'
          }
        ]
      };

      const result = validateMessage(message);
      expect(result.valid).toBe(true);
    });
  });
});
