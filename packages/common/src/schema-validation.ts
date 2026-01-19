/**
 * Schema Validation Module (Phase 1.2)
 *
 * Provides JSON Schema validation for all RecursiveManager configuration files.
 * Uses AJV (Another JSON Schema Validator) with format validation support.
 */

import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import agentConfigSchema from './schemas/agent-config.schema.json';
import scheduleSchema from './schemas/schedule.schema.json';
import taskSchema from './schemas/task.schema.json';
import messageSchema from './schemas/message.schema.json';
import metadataSchema from './schemas/metadata.schema.json';
import subordinatesSchema from './schemas/subordinates.schema.json';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

/**
 * Detailed validation error with context
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
  schemaPath?: string;
}

/**
 * Custom error class for schema validation failures
 */
export class SchemaValidationError extends Error {
  public readonly errors: ValidationError[];

  constructor(message: string, errors: ValidationError[]) {
    super(message);
    this.name = 'SchemaValidationError';
    this.errors = errors;
    Error.captureStackTrace(this, SchemaValidationError);
  }

  /**
   * Get a formatted error message with all validation errors
   */
  public getFormattedErrors(): string {
    return this.errors
      .map((err, idx) => {
        const parts = [`${idx + 1}. Field: ${err.field}`, `   Message: ${err.message}`];
        if (err.value !== undefined) {
          parts.push(`   Value: ${JSON.stringify(err.value)}`);
        }
        if (err.schemaPath) {
          parts.push(`   Schema path: ${err.schemaPath}`);
        }
        return parts.join('\n');
      })
      .join('\n\n');
  }
}

/**
 * Singleton AJV instance with formats support
 */
let ajvInstance: Ajv | null = null;

/**
 * Get or create the AJV instance
 */
function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = new Ajv({
      allErrors: true, // Collect all errors, not just the first one
      strict: true, // Strict mode for better error detection
      verbose: true, // Include validated data in errors
    });
    addFormats(ajvInstance); // Add format validators (email, date-time, etc.)
  }
  return ajvInstance;
}

/**
 * Convert AJV errors to our ValidationError format with detailed messages
 */
function formatAjvErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  if (!errors || errors.length === 0) {
    return [];
  }

  return errors.map((err) => {
    // Extract field path (remove leading slash)
    const field = err.instancePath ? err.instancePath.slice(1).replace(/\//g, '.') : 'root';

    // Build a human-readable message
    let message = '';
    switch (err.keyword) {
      case 'required':
        message = `Missing required field: ${err.params.missingProperty}`;
        break;
      case 'type':
        message = `Expected type ${err.params.type}, but got ${typeof err.data}`;
        break;
      case 'enum':
        message = `Must be one of: ${err.params.allowedValues.join(', ')}`;
        break;
      case 'pattern':
        message = `Must match pattern: ${err.params.pattern}`;
        break;
      case 'format':
        message = `Must be a valid ${err.params.format} format`;
        break;
      case 'minimum':
        message = `Must be >= ${err.params.limit}`;
        break;
      case 'maximum':
        message = `Must be <= ${err.params.limit}`;
        break;
      case 'minLength':
        message = `Must be at least ${err.params.limit} characters long`;
        break;
      case 'maxLength':
        message = `Must be at most ${err.params.limit} characters long`;
        break;
      case 'minItems':
        message = `Must have at least ${err.params.limit} items`;
        break;
      case 'maxItems':
        message = `Must have at most ${err.params.limit} items`;
        break;
      case 'additionalProperties':
        message = `Additional property not allowed: ${err.params.additionalProperty}`;
        break;
      default:
        message = err.message || 'Validation failed';
    }

    return {
      field: field || 'root',
      message,
      value: err.data,
      schemaPath: err.schemaPath,
    };
  });
}

/**
 * Compile and cache a validator for a given schema
 */
const validatorCache = new Map<string, ValidateFunction>();

function getValidator(schemaId: string, schema: object): ValidateFunction {
  if (!validatorCache.has(schemaId)) {
    const ajv = getAjv();
    const validator = ajv.compile(schema);
    validatorCache.set(schemaId, validator);
  }
  return validatorCache.get(schemaId)!;
}

/**
 * Validate agent configuration against the schema
 *
 * @param config - Agent configuration object to validate
 * @returns ValidationResult with detailed error messages
 *
 * @example
 * ```typescript
 * const result = validateAgentConfig(config);
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 * }
 * ```
 */
export function validateAgentConfig(config: unknown): ValidationResult {
  const validate = getValidator('agent-config', agentConfigSchema);
  const valid = validate(config);

  if (valid) {
    return { valid: true };
  }

  const errors = formatAjvErrors(validate.errors);
  return { valid: false, errors };
}

/**
 * Validate agent configuration and throw on error
 *
 * @param config - Agent configuration object to validate
 * @throws {SchemaValidationError} If validation fails
 *
 * @example
 * ```typescript
 * try {
 *   validateAgentConfigStrict(config);
 *   // Config is valid
 * } catch (error) {
 *   if (error instanceof SchemaValidationError) {
 *     console.error(error.getFormattedErrors());
 *   }
 * }
 * ```
 */
export function validateAgentConfigStrict(config: unknown): void {
  const result = validateAgentConfig(config);
  if (!result.valid) {
    throw new SchemaValidationError(
      `Agent configuration validation failed with ${result.errors?.length || 0} error(s)`,
      result.errors || []
    );
  }
}

/**
 * Validate schedule configuration against the schema
 *
 * @param schedule - Schedule configuration object to validate
 * @returns ValidationResult with detailed error messages
 */
export function validateSchedule(schedule: unknown): ValidationResult {
  const validate = getValidator('schedule', scheduleSchema);
  const valid = validate(schedule);

  if (valid) {
    return { valid: true };
  }

  const errors = formatAjvErrors(validate.errors);
  return { valid: false, errors };
}

/**
 * Validate schedule configuration and throw on error
 *
 * @param schedule - Schedule configuration object to validate
 * @throws {SchemaValidationError} If validation fails
 */
export function validateScheduleStrict(schedule: unknown): void {
  const result = validateSchedule(schedule);
  if (!result.valid) {
    throw new SchemaValidationError(
      `Schedule configuration validation failed with ${result.errors?.length || 0} error(s)`,
      result.errors || []
    );
  }
}

/**
 * Validate task configuration against the schema
 *
 * @param task - Task configuration object to validate
 * @returns ValidationResult with detailed error messages
 */
export function validateTask(task: unknown): ValidationResult {
  const validate = getValidator('task', taskSchema);
  const valid = validate(task);

  if (valid) {
    return { valid: true };
  }

  const errors = formatAjvErrors(validate.errors);
  return { valid: false, errors };
}

/**
 * Validate task configuration and throw on error
 *
 * @param task - Task configuration object to validate
 * @throws {SchemaValidationError} If validation fails
 */
export function validateTaskStrict(task: unknown): void {
  const result = validateTask(task);
  if (!result.valid) {
    throw new SchemaValidationError(
      `Task configuration validation failed with ${result.errors?.length || 0} error(s)`,
      result.errors || []
    );
  }
}

/**
 * Validate message configuration against the schema
 *
 * @param message - Message configuration object to validate
 * @returns ValidationResult with detailed error messages
 */
export function validateMessage(message: unknown): ValidationResult {
  const validate = getValidator('message', messageSchema);
  const valid = validate(message);

  if (valid) {
    return { valid: true };
  }

  const errors = formatAjvErrors(validate.errors);
  return { valid: false, errors };
}

/**
 * Validate message configuration and throw on error
 *
 * @param message - Message configuration object to validate
 * @throws {SchemaValidationError} If validation fails
 */
export function validateMessageStrict(message: unknown): void {
  const result = validateMessage(message);
  if (!result.valid) {
    throw new SchemaValidationError(
      `Message configuration validation failed with ${result.errors?.length || 0} error(s)`,
      result.errors || []
    );
  }
}

/**
 * Validate metadata configuration against the schema
 *
 * @param metadata - Metadata configuration object to validate
 * @returns ValidationResult with detailed error messages
 */
export function validateMetadata(metadata: unknown): ValidationResult {
  const validate = getValidator('metadata', metadataSchema);
  const valid = validate(metadata);

  if (valid) {
    return { valid: true };
  }

  const errors = formatAjvErrors(validate.errors);
  return { valid: false, errors };
}

/**
 * Validate metadata configuration and throw on error
 *
 * @param metadata - Metadata configuration object to validate
 * @throws {SchemaValidationError} If validation fails
 */
export function validateMetadataStrict(metadata: unknown): void {
  const result = validateMetadata(metadata);
  if (!result.valid) {
    throw new SchemaValidationError(
      `Metadata configuration validation failed with ${result.errors?.length || 0} error(s)`,
      result.errors || []
    );
  }
}

/**
 * Validate subordinates configuration against the schema
 *
 * @param subordinates - Subordinates configuration object to validate
 * @returns ValidationResult with detailed error messages
 */
export function validateSubordinates(subordinates: unknown): ValidationResult {
  const validate = getValidator('subordinates', subordinatesSchema);
  const valid = validate(subordinates);

  if (valid) {
    return { valid: true };
  }

  const errors = formatAjvErrors(validate.errors);
  return { valid: false, errors };
}

/**
 * Validate subordinates configuration and throw on error
 *
 * @param subordinates - Subordinates configuration object to validate
 * @throws {SchemaValidationError} If validation fails
 */
export function validateSubordinatesStrict(subordinates: unknown): void {
  const result = validateSubordinates(subordinates);
  if (!result.valid) {
    throw new SchemaValidationError(
      `Subordinates configuration validation failed with ${result.errors?.length || 0} error(s)`,
      result.errors || []
    );
  }
}

/**
 * Clear the validator cache (useful for testing)
 * @internal
 */
export function clearValidatorCache(): void {
  validatorCache.clear();
}
