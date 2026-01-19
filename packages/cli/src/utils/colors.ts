/**
 * Color utilities for CLI output
 * Provides consistent styling across commands
 */

import chalk from 'chalk';

export const colors = {
  // Status colors
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,

  // Brand colors (deep purple theme)
  primary: chalk.hex('#8b5cf6'),
  secondary: chalk.hex('#6d28d9'),
  accent: chalk.hex('#a78bfa'),

  // Text colors
  dim: chalk.dim,
  bold: chalk.bold,
  underline: chalk.underline,

  // Semantic colors
  highlight: chalk.cyan,
  muted: chalk.gray,
};

/**
 * Format success message
 */
export function success(message: string): string {
  return colors.success('✓ ' + message);
}

/**
 * Format error message
 */
export function error(message: string): string {
  return colors.error('✗ ' + message);
}

/**
 * Format warning message
 */
export function warning(message: string): string {
  return colors.warning('⚠ ' + message);
}

/**
 * Format info message
 */
export function info(message: string): string {
  return colors.info('ℹ ' + message);
}

/**
 * Format header message
 */
export function header(message: string): string {
  return colors.bold(colors.primary(message));
}

/**
 * Format subheader message
 */
export function subheader(message: string): string {
  return colors.bold(message);
}

/**
 * Format code/path text
 */
export function code(text: string): string {
  return colors.accent(text);
}

/**
 * Format emphasized text
 */
export function emphasis(text: string): string {
  return colors.bold(text);
}
