/**
 * Message file writing utilities
 *
 * Handles writing message files with frontmatter to agent inboxes
 */

import { mkdir } from 'fs/promises';
import path from 'path';
import { atomicWrite, getInboxPath } from '@recursive-manager/common';

/**
 * Message data structure
 */
export interface MessageData {
  id: string;
  from: string;
  to: string;
  timestamp: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channel: 'internal' | 'slack' | 'telegram' | 'email';
  read?: boolean;
  actionRequired?: boolean;
  subject?: string;
  threadId?: string;
  inReplyTo?: string;
  content: string;
}

/**
 * Generate a unique message ID
 * Format: msg-{timestamp}-{random}
 *
 * @returns Unique message ID
 */
export function generateMessageId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `msg-${timestamp}-${random}`;
}

/**
 * Convert message data to markdown with YAML frontmatter
 *
 * @param message - Message data
 * @returns Markdown string with frontmatter
 */
export function formatMessageFile(message: MessageData): string {
  const frontmatter: Record<string, any> = {
    id: message.id,
    from: message.from,
    to: message.to,
    timestamp: message.timestamp,
    priority: message.priority,
    channel: message.channel,
    read: message.read ?? false,
    actionRequired: message.actionRequired ?? false,
  };

  if (message.subject) {
    frontmatter.subject = message.subject;
  }

  if (message.threadId) {
    frontmatter.threadId = message.threadId;
  }

  if (message.inReplyTo) {
    frontmatter.inReplyTo = message.inReplyTo;
  }

  // Convert frontmatter to YAML
  const yamlLines = Object.entries(frontmatter).map(([key, value]) => {
    if (typeof value === 'string') {
      // Escape quotes in strings
      const escaped = value.replace(/"/g, '\\"');
      return `${key}: "${escaped}"`;
    }
    return `${key}: ${value}`;
  });

  const yaml = yamlLines.join('\n');

  return `---
${yaml}
---

${message.content}
`;
}

/**
 * Write a message file to an agent's inbox
 *
 * @param agentId - Recipient agent ID
 * @param message - Message data
 * @param options - Write options (dataDir, requireAgentDir)
 * @returns Path to the written message file
 */
export async function writeMessageToInbox(
  agentId: string,
  message: MessageData,
  options: { dataDir?: string; requireAgentDir?: boolean } = {}
): Promise<string> {
  // Get inbox path (map dataDir to baseDir for PathOptions)
  const inboxDir = getInboxPath(agentId, { baseDir: options.dataDir });

  // Optionally check if agent directory exists before writing
  // This is useful for notifications to ensure agent hasn't been fired/deleted
  if (options.requireAgentDir) {
    const agentDir = path.dirname(inboxDir);
    const { access } = await import('fs/promises');
    try {
      await access(agentDir);
    } catch (error) {
      throw new Error(`Agent directory does not exist for agent ${agentId}. Agent may have been deleted or not properly initialized.`);
    }
  }

  // Determine subdirectory based on read status
  const subDir = message.read ? 'read' : 'unread';
  const targetDir = path.join(inboxDir, subDir);

  // Ensure directory exists (create recursively if needed)
  await mkdir(targetDir, { recursive: true, mode: 0o755 });

  // Generate file path
  const fileName = `${message.id}.md`;
  const filePath = path.join(targetDir, fileName);

  // Format message content
  const content = formatMessageFile(message);

  // Write file atomically
  await atomicWrite(filePath, content, {
    mode: 0o644,
  });

  return filePath;
}

/**
 * Write multiple messages in batch
 *
 * @param messages - Array of {agentId, message} pairs
 * @param options - Write options
 * @returns Array of written file paths
 */
export async function writeMessagesInBatch(
  messages: Array<{ agentId: string; message: MessageData }>,
  options: { dataDir?: string } = {}
): Promise<string[]> {
  const results = await Promise.allSettled(
    messages.map(({ agentId, message }) => writeMessageToInbox(agentId, message, options))
  );

  const paths: string[] = [];
  const errors: Error[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      paths.push(result.value);
    } else {
      const message = messages[index];
      errors.push(
        new Error(`Failed to write message to ${message?.agentId ?? 'unknown'}: ${result.reason}`)
      );
    }
  });

  // If some messages failed, log but don't throw
  // This allows partial success in notification scenarios
  if (errors.length > 0) {
    console.warn(`${errors.length}/${messages.length} messages failed to write:`, errors);
  }

  return paths;
}
