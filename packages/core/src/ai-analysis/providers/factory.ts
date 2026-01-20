/**
 * ProviderFactory
 *
 * Creates AI provider instances based on configuration with health check
 * and automatic fallback support.
 */

import { AIProvider } from './base';
import { AICEOGatewayProvider } from './aiceo-gateway';
import { AnthropicDirectProvider } from './anthropic-direct';
import { OpenAIDirectProvider } from './openai-direct';
import { CustomProvider } from './custom';

/**
 * Factory for creating AI provider instances
 *
 * Configuration via environment variables:
 * - AI_PROVIDER: Default provider (aiceo-gateway, anthropic-direct, openai-direct, custom)
 * - AI_FALLBACK_PROVIDER: Fallback if primary unavailable (optional)
 */
export class ProviderFactory {
  /**
   * Create a provider instance by name
   *
   * @param providerName - Name of the provider to create (optional, reads from env if not provided)
   * @returns AIProvider instance
   * @throws Error if provider name is unknown
   */
  static create(providerName?: string): AIProvider {
    const name = providerName || process.env.AI_PROVIDER || 'aiceo-gateway';

    switch (name) {
      case 'aiceo-gateway':
        return new AICEOGatewayProvider();

      case 'anthropic-direct':
        return new AnthropicDirectProvider();

      case 'openai-direct':
        return new OpenAIDirectProvider();

      case 'custom':
        return new CustomProvider();

      default:
        throw new Error(`Unknown AI provider: ${name}`);
    }
  }

  /**
   * Create a provider with automatic health check and fallback
   *
   * Tries the primary provider first. If health check fails and a fallback
   * is configured, tries the fallback provider. Throws if no healthy provider found.
   *
   * @returns Promise resolving to a healthy AIProvider instance
   * @throws Error if no healthy providers are available
   */
  static async createWithHealthCheck(): Promise<AIProvider> {
    const primaryProviderName = process.env.AI_PROVIDER || 'aiceo-gateway';
    const fallbackProviderName = process.env.AI_FALLBACK_PROVIDER;

    // Try primary provider
    const primary = this.create(primaryProviderName);

    try {
      const isPrimaryHealthy = await primary.healthCheck();

      if (isPrimaryHealthy) {
        return primary;
      }
    } catch (error) {
      console.warn(
        `Primary provider ${primary.name} health check failed:`,
        error instanceof Error ? error.message : error
      );
    }

    // Primary is unhealthy, try fallback if configured
    if (!fallbackProviderName) {
      throw new Error(
        `Primary provider ${primary.name} unavailable and no fallback configured. ` +
          `Set AI_FALLBACK_PROVIDER environment variable to enable fallback.`
      );
    }

    // Try fallback provider
    const fallback = this.create(fallbackProviderName);

    try {
      const isFallbackHealthy = await fallback.healthCheck();

      if (isFallbackHealthy) {
        console.warn(
          `Primary provider ${primary.name} unavailable, using fallback: ${fallback.name}`
        );
        return fallback;
      }
    } catch (error) {
      console.error(
        `Fallback provider ${fallback.name} health check failed:`,
        error instanceof Error ? error.message : error
      );
    }

    // Both providers failed
    throw new Error(
      `No available AI providers. Primary (${primary.name}) and fallback (${fallback.name}) both failed health checks.`
    );
  }
}
