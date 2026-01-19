/**
 * Spinner utilities for CLI loading indicators
 * Provides consistent loading UI across commands
 */

import ora, { Ora } from 'ora';
import { colors } from './colors';

/**
 * Create and start a spinner
 */
export function createSpinner(text: string): Ora {
  return ora({
    text,
    color: 'magenta',
  }).start();
}

/**
 * Create a spinner and execute an async task
 */
export async function withSpinner<T>(
  text: string,
  task: () => Promise<T>,
  successText?: string,
  errorText?: string
): Promise<T> {
  const spinner = createSpinner(text);

  try {
    const result = await task();
    spinner.succeed(successText || text);
    return result;
  } catch (error) {
    spinner.fail(errorText || `Failed: ${text}`);
    throw error;
  }
}

/**
 * Update spinner text
 */
export function updateSpinner(spinner: Ora, text: string): void {
  spinner.text = text;
}

/**
 * Complete spinner with success
 */
export function succeedSpinner(spinner: Ora, text?: string): void {
  if (text) {
    spinner.succeed(text);
  } else {
    spinner.succeed();
  }
}

/**
 * Complete spinner with failure
 */
export function failSpinner(spinner: Ora, text?: string): void {
  if (text) {
    spinner.fail(text);
  } else {
    spinner.fail();
  }
}

/**
 * Complete spinner with warning
 */
export function warnSpinner(spinner: Ora, text?: string): void {
  spinner.stopAndPersist({
    symbol: colors.warning('⚠'),
    text: text || spinner.text,
  });
}

/**
 * Complete spinner with info
 */
export function infoSpinner(spinner: Ora, text?: string): void {
  spinner.stopAndPersist({
    symbol: colors.info('ℹ'),
    text: text || spinner.text,
  });
}
