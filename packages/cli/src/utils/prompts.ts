/**
 * Interactive prompt utilities
 * Provides consistent user interaction across commands
 */

import inquirer from 'inquirer';

/**
 * Confirm action with user
 */
export async function confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue,
    },
  ]);
  return confirmed;
}

/**
 * Get text input from user
 */
export async function input(
  message: string,
  defaultValue?: string,
  validate?: (input: string) => boolean | string
): Promise<string> {
  const { value } = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message,
      default: defaultValue,
      validate,
    },
  ]);
  return value;
}

/**
 * Get password input from user
 */
export async function password(
  message: string,
  validate?: (input: string) => boolean | string
): Promise<string> {
  const { value } = await inquirer.prompt([
    {
      type: 'password',
      name: 'value',
      message,
      mask: '*',
      validate,
    },
  ]);
  return value;
}

/**
 * Select from list of choices
 */
export async function select(
  message: string,
  choices: string[] | Array<{ name: string; value: any }>,
  defaultChoice?: string | number
): Promise<any> {
  const { value } = await inquirer.prompt([
    {
      type: 'list',
      name: 'value',
      message,
      choices,
      default: defaultChoice,
    },
  ]);
  return value;
}

/**
 * Select multiple from list of choices
 */
export async function multiSelect(
  message: string,
  choices: string[] | Array<{ name: string; value: any }>,
  defaultChoices?: string[] | number[]
): Promise<any[]> {
  const { values } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'values',
      message,
      choices,
      default: defaultChoices,
    },
  ]);
  return values;
}

/**
 * Get number input from user
 */
export async function number(
  message: string,
  defaultValue?: number,
  validate?: (input: number) => boolean | string
): Promise<number> {
  const { value } = await inquirer.prompt([
    {
      type: 'number',
      name: 'value',
      message,
      default: defaultValue,
      validate,
    },
  ]);
  return value;
}

/**
 * Show editor for long text input
 */
export async function editor(message: string, defaultValue?: string): Promise<string> {
  const { value } = await inquirer.prompt([
    {
      type: 'editor',
      name: 'value',
      message,
      default: defaultValue,
    },
  ]);
  return value;
}
