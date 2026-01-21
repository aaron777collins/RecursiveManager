/**
 * Analyze command - Run multi-perspective AI analysis on a decision or question
 *
 * This command triggers the multi-perspective analysis system which runs all 8
 * perspective agents in parallel (Security, Architecture, Simplicity, Financial,
 * Marketing, UX, Growth, Emotional Intelligence) to provide comprehensive analysis
 * from multiple viewpoints.
 */

import { Command } from 'commander';
import { header, error, info, code, subheader, success } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import type { MultiPerspectiveResult } from '@recursivemanager/core';

export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Run multi-perspective AI analysis on a decision or question')
    .argument('<question>', 'The question or decision to analyze')
    .option('--format <format>', 'Output format: text, json, markdown', 'text')
    .option('--data-dir <dir>', 'Custom data directory')
    .option('--timeout <seconds>', 'Analysis timeout in seconds', '120')
    .action(async (question: string, options: { format?: string; dataDir?: string; timeout?: string }) => {
      try {
        console.log(header('\n🧠 Multi-Perspective Analysis'));
        console.log();
        console.log(info('Question: ') + code(question));
        console.log();

        const spinner = createSpinner('Running analysis with 8 perspective agents...');

        // Dynamically import AI analysis components
        const { MultiPerspectiveAnalysis } = await import('@recursivemanager/core/dist/ai-analysis/multi-perspective.js');
        const { ProviderFactory } = await import('@recursivemanager/core/dist/ai-analysis/providers/factory.js');

        // Create provider with health check and fallback support
        const provider = await ProviderFactory.createWithHealthCheck();

        // Create analysis orchestrator
        // Constructor: MultiPerspectiveAnalysis(provider, cache?, agentId?, persistHistory?)
        const analysis = new MultiPerspectiveAnalysis(
          provider,
          undefined,      // Use default global cache
          'cli-analyze',  // Agent ID for tracking
          false           // Don't persist for CLI command
        );

        // Run analysis
        const startTime = Date.now();
        const result: MultiPerspectiveResult = await analysis.analyze(question);
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

        spinner.succeed(`Analysis completed in ${totalTime}s`);
        console.log();

        // Format and display results
        const format = (options.format || 'text') as 'text' | 'json' | 'markdown';

        switch (format) {
          case 'json':
            console.log(JSON.stringify(result, null, 2));
            break;

          case 'markdown':
            displayMarkdownResults(result);
            break;

          case 'text':
          default:
            displayTextResults(result);
            break;
        }

        console.log();
        console.log(success('✓ Analysis complete'));
        console.log();

      } catch (err) {
        const errorMessage = (err as Error).message;

        // Handle specific error types
        if (errorMessage.includes('timeout') || errorMessage.includes('exceeded')) {
          console.error(error('⏱️  Analysis timed out. Try increasing the timeout with --timeout <seconds>'));
        } else if (errorMessage.includes('No available AI providers')) {
          console.error(error('❌ No AI providers available. Check your configuration:'));
          console.log();
          console.log(info('  • Ensure AI_PROVIDER is set in your environment'));
          console.log(info('  • Check AICEO_GATEWAY_URL and AICEO_GATEWAY_API_KEY if using gateway'));
          console.log(info('  • Verify provider credentials (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)'));
          console.log();
        } else {
          console.error(error('Failed to run analysis: ' + errorMessage));
        }

        process.exit(1);
      }
    });
}

/**
 * Display results in human-readable text format
 */
function displayTextResults(result: MultiPerspectiveResult): void {
  console.log(subheader('┌─────────────────────────────────────────────────────────────┐'));
  console.log(subheader('│ Multi-Perspective Analysis Results                         │'));
  console.log(subheader(`│ Overall Confidence: ${result.overallConfidence.toFixed(2).padEnd(40)}│`));
  console.log(subheader(`│ Execution Time: ${(result.executionTime / 1000).toFixed(2)}s${' '.repeat(39 - (result.executionTime / 1000).toFixed(2).length)}│`));
  console.log(subheader('└─────────────────────────────────────────────────────────────┘'));
  console.log();

  // Display table header
  console.log('┌─────────────────────┬────────────┬─────────────────────────────────┐');
  console.log('│ Perspective         │ Confidence │ Summary                          │');
  console.log('├─────────────────────┼────────────┼─────────────────────────────────┤');

  // Display each perspective
  for (const perspective of result.perspectives) {
    const perspectiveName = perspective.perspective.padEnd(19);
    const confidence = perspective.confidence.toFixed(2).padEnd(10);

    // Extract first sentence or first 31 chars of analysis for summary
    const summary = getSummary(perspective.analysis, 31);

    console.log(`│ ${perspectiveName} │ ${confidence} │ ${summary} │`);
  }

  console.log('└─────────────────────┴────────────┴─────────────────────────────────┘');
  console.log();

  // Display detailed analyses
  console.log(subheader('Detailed Analyses:'));
  console.log();

  for (const perspective of result.perspectives) {
    console.log(success(`▸ ${perspective.perspective} (Confidence: ${perspective.confidence.toFixed(2)})`));
    console.log();

    // Indent the analysis text
    const lines = perspective.analysis.split('\n');
    for (const line of lines) {
      console.log('  ' + line);
    }

    if (perspective.reasoning) {
      console.log();
      console.log(info('  Reasoning:'));
      const reasoningLines = perspective.reasoning.split('\n');
      for (const line of reasoningLines) {
        console.log('    ' + line);
      }
    }

    console.log();
  }
}

/**
 * Display results in markdown format
 */
function displayMarkdownResults(result: MultiPerspectiveResult): void {
  console.log('# Multi-Perspective Analysis');
  console.log();
  console.log(`**Overall Confidence**: ${result.overallConfidence.toFixed(2)}`);
  console.log(`**Execution Time**: ${(result.executionTime / 1000).toFixed(2)}s`);
  console.log(`**Timestamp**: ${result.timestamp}`);
  console.log();

  console.log('## Summary');
  console.log();
  console.log('| Perspective | Confidence | Summary |');
  console.log('|-------------|------------|---------|');

  for (const perspective of result.perspectives) {
    const summary = getSummary(perspective.analysis, 50).replace(/\|/g, '\\|');
    console.log(`| ${perspective.perspective} | ${perspective.confidence.toFixed(2)} | ${summary} |`);
  }

  console.log();
  console.log('## Detailed Analyses');
  console.log();

  for (const perspective of result.perspectives) {
    console.log(`### ${perspective.perspective} (Confidence: ${perspective.confidence.toFixed(2)})`);
    console.log();
    console.log(perspective.analysis);

    if (perspective.reasoning) {
      console.log();
      console.log('**Reasoning:**');
      console.log();
      console.log(perspective.reasoning);
    }

    console.log();
  }

  console.log('---');
  console.log();
  console.log(result.summary);
}

/**
 * Extract a summary from analysis text (first sentence or first N chars)
 */
function getSummary(text: string, maxLength: number): string {
  // Try to get first sentence
  const firstSentence = text.match(/^[^.!?]+[.!?]/);
  if (firstSentence && firstSentence[0].length <= maxLength) {
    return firstSentence[0].trim();
  }

  // Otherwise truncate to maxLength
  if (text.length <= maxLength) {
    return text.trim();
  }

  return text.substring(0, maxLength - 3).trim() + '...';
}
