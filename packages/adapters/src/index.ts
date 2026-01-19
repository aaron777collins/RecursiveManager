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
