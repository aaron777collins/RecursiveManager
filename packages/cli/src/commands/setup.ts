/**
 * Setup command - Configure AICEO Gateway for RecursiveManager
 *
 * Interactive wizard to set up AICEO Gateway integration for routing
 * AI requests through a centralized gateway.
 */

import { Command } from 'commander';
import { header, success, error, info, code, subheader } from '../utils/colors';
import { input, password, select, confirm } from '../utils/prompts';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description('Configure AICEO Gateway for RecursiveManager')
    .option('--skip-test', 'Skip connection test')
    .action(async (options: { skipTest?: boolean }) => {
      try {
        console.log(header('\n🔧 AICEO Gateway Setup'));
        console.log();
        console.log(info('This wizard will configure RecursiveManager to use AICEO Gateway'));
        console.log(info('for centralized AI request routing and rate limiting.'));
        console.log();

        // Get the global config directory
        const globalConfigDir = path.join(os.homedir(), '.recursivemanager');
        const globalEnvPath = path.join(globalConfigDir, '.env');

        // Ensure directory exists
        if (!fs.existsSync(globalConfigDir)) {
          fs.mkdirSync(globalConfigDir, { recursive: true, mode: 0o755 });
        }

        // Load existing config if it exists
        const existingConfig: Record<string, string> = {};
        if (fs.existsSync(globalEnvPath)) {
          const envContent = fs.readFileSync(globalEnvPath, 'utf8');
          for (const line of envContent.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              const [key, ...valueParts] = trimmed.split('=');
              if (key && valueParts.length > 0) {
                existingConfig[key] = valueParts.join('=');
              }
            }
          }
        }

        console.log(subheader('Step 1: AICEO Gateway Connection'));
        console.log();

        const gatewayUrl = await input(
          'AICEO Gateway URL',
          existingConfig.AICEO_GATEWAY_URL || 'http://localhost:4000/api/glm/submit'
        );

        const gatewayApiKey = await password(
          'AICEO Gateway API Key',
          (value: string) => {
            if (!value || value.length < 10) {
              return 'API key must be at least 10 characters';
            }
            return true;
          }
        );

        console.log();
        console.log(subheader('Step 2: AI Provider Configuration'));
        console.log();

        const providerChoice = await select('Which AI provider should AICEO Gateway use?', [
          { name: 'GLM (Zhipu AI)', value: 'glm' },
          { name: 'Anthropic (Claude)', value: 'anthropic' },
          { name: 'OpenAI (GPT)', value: 'openai' },
          { name: 'Custom Endpoint (e.g., z.ai proxy)', value: 'custom' },
        ]);

        let model = 'glm-4.7';
        let customEndpoint = '';
        let customApiKey = '';

        if (providerChoice === 'glm') {
          model = await input('Model', existingConfig.AICEO_GATEWAY_MODEL || 'glm-4.7');
        } else if (providerChoice === 'anthropic') {
          model = await input('Model', existingConfig.AICEO_GATEWAY_MODEL || 'claude-sonnet-4-5');
        } else if (providerChoice === 'openai') {
          model = await input('Model', existingConfig.AICEO_GATEWAY_MODEL || 'gpt-4-turbo');
        } else if (providerChoice === 'custom') {
          console.log();
          console.log(info('Custom provider configuration'));
          console.log();

          customEndpoint = await input(
            'Custom Endpoint URL',
            existingConfig.AICEO_GATEWAY_CUSTOM_ENDPOINT || 'https://api.z.ai/api/anthropic/v1/messages'
          );

          customApiKey = await password(
            'Custom Endpoint API Key',
            (value: string) => {
              if (!value || value.length < 10) {
                return 'API key must be at least 10 characters';
              }
              return true;
            }
          );

          model = await input(
            'Model',
            existingConfig.AICEO_GATEWAY_MODEL || 'claude-sonnet-4-5-20250514'
          );
        }

        console.log();
        console.log(subheader('Step 3: Request Priority'));
        console.log();

        const priority = await select(
          'Request priority for AI analysis',
          [
            { name: 'High (process first)', value: 'high' },
            { name: 'Normal (standard queue)', value: 'normal' },
            { name: 'Low (background processing)', value: 'low' },
          ],
          existingConfig.AICEO_GATEWAY_PRIORITY || 'high'
        );

        // Build .env content
        const envContent = `# AICEO Gateway Configuration for RecursiveManager
# This file is auto-loaded by RecursiveManager globally

# Use AICEO Gateway as the primary AI provider
AI_PROVIDER=aiceo-gateway

# AICEO Gateway endpoint configuration
AICEO_GATEWAY_URL=${gatewayUrl}
AICEO_GATEWAY_API_KEY=${gatewayApiKey}
AICEO_GATEWAY_PROVIDER=${providerChoice}
AICEO_GATEWAY_MODEL=${model}

# Custom provider configuration (only used when provider=custom)
${providerChoice === 'custom' ? `AICEO_GATEWAY_CUSTOM_ENDPOINT=${customEndpoint}` : '# AICEO_GATEWAY_CUSTOM_ENDPOINT='}
${providerChoice === 'custom' ? `AICEO_GATEWAY_CUSTOM_API_KEY=${customApiKey}` : '# AICEO_GATEWAY_CUSTOM_API_KEY='}

# Request priority (high/medium/low)
AICEO_GATEWAY_PRIORITY=${priority}
`;

        console.log();
        console.log(subheader('Summary'));
        console.log();
        console.log(info('Configuration will be written to: ') + code(globalEnvPath));
        console.log();
        console.log('Gateway URL: ' + code(gatewayUrl));
        console.log('Provider: ' + code(providerChoice));
        console.log('Model: ' + code(model));
        console.log('Priority: ' + code(priority));
        if (providerChoice === 'custom') {
          console.log('Custom Endpoint: ' + code(customEndpoint));
        }
        console.log();

        const shouldSave = await confirm('Save configuration?', true);
        if (!shouldSave) {
          console.log(info('Setup cancelled'));
          return;
        }

        // Write the .env file
        fs.writeFileSync(globalEnvPath, envContent, { mode: 0o600 });

        console.log();
        console.log(success('✅ Configuration saved!'));

        // Test connection if not skipped
        if (!options.skipTest) {
          console.log();
          console.log(subheader('Testing Connection...'));
          console.log();

          try {
            const response = await fetch(gatewayUrl.replace('/submit', '/status'), {
              method: 'GET',
              headers: {
                'X-API-Key': gatewayApiKey
              }
            });

            if (response.ok) {
              console.log(success('✅ AICEO Gateway connection successful!'));
              console.log();

              // Try a test request
              console.log(info('Sending test request...'));
              const testResponse = await fetch(gatewayUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-API-Key': gatewayApiKey
                },
                body: JSON.stringify({
                  provider: providerChoice,
                  model: model,
                  priority: priority,
                  source: 'recursivemanager-setup',
                  sourceId: 'test',
                  messages: [{ role: 'user', content: 'Say "AICEO Gateway connection successful!"' }],
                  maxTokens: 50
                })
              });

              if (testResponse.ok) {
                const testData = await testResponse.json() as { success: boolean; response?: { content?: string }; error?: string };
                if (testData.success) {
                  console.log(success('✅ Test request successful!'));
                  console.log(info('Response: ') + code(testData.response?.content || 'OK'));
                } else {
                  console.log(error('⚠️  Test request failed: ') + (testData.error || 'Unknown error'));
                }
              } else {
                console.log(error('⚠️  Test request failed: ') + `HTTP ${testResponse.status}`);
              }
            } else {
              console.log(error('⚠️  AICEO Gateway connection failed'));
              console.log(error('Status: ') + `HTTP ${response.status}`);
            }
          } catch (err) {
            console.log(error('⚠️  Connection test failed: ') + ((err as Error).message));
          }
        }

        console.log();
        console.log(info('Next steps:'));
        console.log('  • Run ' + code('recursivemanager config') + ' to view all settings');
        console.log('  • Run ' + code('recursivemanager status') + ' to check agent status');
        console.log();

      } catch (err) {
        console.error(error('Setup failed: ' + (err as Error).message));
        process.exit(1);
      }
    });
}
