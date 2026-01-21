/**
 * Message command - Send messages to agents for reactive execution
 */

import { Command } from 'commander';
import { header, success, error, info, code } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { input, confirm, editor } from '../utils/prompts';
import * as fs from 'fs';
import * as path from 'path';
import { initializeDatabase, getAgent } from '@recursivemanager/common';
import {
  writeMessageToInbox,
  generateMessageId,
  MessageData,
} from '@recursivemanager/core';

interface MessageOptions {
  dataDir?: string;
  from?: string;
  subject?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  channel?: 'internal' | 'slack' | 'telegram' | 'email';
  actionRequired?: boolean;
  json?: boolean;
}

export function registerMessageCommand(program: Command): void {
  program
    .command('message <agent-id> [content]')
    .description('Send a message to an agent for reactive execution')
    .option('-d, --data-dir <dir>', 'Custom data directory')
    .option('-f, --from <agent-id>', 'Sender agent ID (defaults to "system")')
    .option('-s, --subject <subject>', 'Message subject')
    .option(
      '-p, --priority <priority>',
      'Message priority (low, normal, high, urgent)',
      'normal'
    )
    .option(
      '-c, --channel <channel>',
      'Communication channel (internal, slack, telegram, email)',
      'internal'
    )
    .option('-a, --action-required', 'Mark message as requiring action')
    .option('--json', 'Output result as JSON')
    .action(async (agentId: string, content: string | undefined, options: MessageOptions) => {
      try {
        console.log(header('\n✉️  Send Message to Agent'));
        console.log();

        // Determine data directory
        const dataDir =
          options.dataDir ||
          process.env.RECURSIVEMANAGER_DATA_DIR ||
          path.resolve(process.cwd(), '.recursivemanager');

        const markerFile = path.resolve(dataDir, '.recursivemanager');

        // Check if initialized
        if (!fs.existsSync(markerFile)) {
          console.log(error('❌ RecursiveManager is not initialized'));
          console.log(info('Run: recursivemanager init "<your goal>"'));
          process.exit(1);
        }

        // Connect to database
        const dbPath = path.resolve(dataDir, 'database.sqlite');
        if (!fs.existsSync(dbPath)) {
          console.log(error('❌ Database not found'));
          process.exit(1);
        }

        const dbConnection = initializeDatabase({ path: dbPath });
        const db = dbConnection.db;

        try {
          // Verify recipient agent exists
          const agent = getAgent(db, agentId);
          if (!agent) {
            console.log(error(`❌ Agent not found: ${agentId}`));
            process.exit(1);
          }

          if (agent.status === 'fired') {
            console.log(error(`❌ Cannot send message to fired agent: ${agentId}`));
            process.exit(1);
          }

          console.log(info(`Recipient: ${agent.display_name} (${agent.role})`));
          console.log();

          // Interactive prompts for missing fields
          const fromAgentId = options.from || 'system';
          const subject = options.subject || (await input('Subject (optional):', ''));
          const priority = options.priority || 'normal';
          const channel = options.channel || 'internal';
          const actionRequired = options.actionRequired || false;

          // Get message content
          let messageContent = content;
          if (!messageContent) {
            const useEditor = await confirm(
              'Use editor for message content? (No = inline input)',
              false
            );
            if (useEditor) {
              messageContent = await editor('Message content (will open editor):', '');
            } else {
              messageContent = await input('Message content:');
            }
          }

          if (!messageContent || messageContent.trim() === '') {
            console.log(error('❌ Message content cannot be empty'));
            process.exit(1);
          }

          // Generate message ID
          const messageId = generateMessageId();

          // Create message data
          const message: MessageData = {
            id: messageId,
            from: fromAgentId,
            to: agentId,
            timestamp: new Date().toISOString(),
            priority: priority as 'low' | 'normal' | 'high' | 'urgent',
            channel: channel as 'internal' | 'slack' | 'telegram' | 'email',
            read: false,
            actionRequired,
            content: messageContent,
          };

          if (subject) {
            message.subject = subject;
          }

          console.log();
          console.log(info('Message Details:'));
          console.log(code(`  ID: ${messageId}`));
          console.log(code(`  From: ${fromAgentId}`));
          console.log(code(`  To: ${agent.display_name} (${agent.id})`));
          console.log(code(`  Priority: ${priority}`));
          console.log(code(`  Channel: ${channel}`));
          console.log(code(`  Action Required: ${actionRequired ? 'Yes' : 'No'}`));
          if (subject) {
            console.log(code(`  Subject: ${subject}`));
          }
          console.log(code(`  Content: ${messageContent.substring(0, 60)}${messageContent.length > 60 ? '...' : ''}`));
          console.log();

          const shouldProceed = await confirm('Send this message?', true);
          if (!shouldProceed) {
            console.log(info('Message cancelled'));
            dbConnection.close();
            return;
          }

          const spinner = createSpinner('Sending message...');

          // Write message to agent's inbox
          const messagePath = await writeMessageToInbox(agentId, message, {
            dataDir,
          });

          spinner.succeed('Message sent successfully!');

          if (options.json) {
            console.log(
              JSON.stringify(
                {
                  success: true,
                  messageId,
                  agentId,
                  messagePath,
                  priority,
                  channel,
                },
                null,
                2
              )
            );
          } else {
            console.log();
            console.log(success('✅ Message sent successfully!'));
            console.log();
            console.log(info('Message Info:'));
            console.log(code(`  Message ID: ${messageId}`));
            console.log(code(`  Recipient: ${agent.display_name} (${agent.role})`));
            console.log(code(`  Priority: ${priority}`));
            console.log(code(`  File: ${messagePath}`));
            console.log();
            console.log(info('Next Steps:'));
            console.log(code(`  - Trigger agent: recursivemanager run ${agentId} --reactive`));
            console.log(code(`  - View agent: recursivemanager status --agent-id ${agentId}`));
            console.log(code(`  - Debug agent: recursivemanager debug ${agentId} --all`));
          }
        } finally {
          dbConnection.close();
        }
      } catch (err) {
        console.log();
        console.log(error(`❌ Error: ${(err as Error).message}`));
        if (process.env.DEBUG) {
          console.error(err);
        }
        process.exit(1);
      }
    });
}
