/**
 * @recursive-manager/adapters
 *
 * Framework adapters for RecursiveManager (Claude Code, OpenCode, etc.).
 * This package provides interfaces to different AI coding frameworks.
 */

export const VERSION = '0.1.0';

// Core adapter types and interfaces
export type {
  ExecutionMode,
  ExecutionContext,
  ExecutionResult,
  Capability,
  FrameworkAdapter,
  TaskSchema,
  Message,
} from './types';

// Adapter registry
export { AdapterRegistry } from './AdapterRegistry';
export type { AdapterRegistryConfig, AdapterInfo } from './AdapterRegistry';

// Framework adapters
export { ClaudeCodeAdapter } from './adapters/claude-code';
export type { ClaudeCodeAdapterOptions } from './adapters/claude-code';

// Prompt templates
export {
  buildContinuousPrompt,
  buildReactivePrompt,
  buildMultiPerspectivePrompt,
} from './prompts';
