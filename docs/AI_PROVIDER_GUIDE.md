# AI Provider Guide

**Version**: 1.0
**Last Updated**: 2026-01-20

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Provider Options](#provider-options)
4. [Configuration Reference](#configuration-reference)
5. [Multi-Perspective Analysis](#multi-perspective-analysis)
6. [Troubleshooting](#troubleshooting)
7. [Advanced: Custom Providers](#advanced-custom-providers)

---

## Overview

### What is the AI Provider System?

RecursiveManager's AI Provider System is a modular architecture that enables multi-perspective AI analysis across different LLM providers. Instead of being locked into a single AI service, RecursiveManager can use:

- **AICEO Gateway**: Centralized rate-limited access with quota management across platforms
- **Anthropic Direct**: Direct API access to Claude models
- **OpenAI Direct**: Direct API access to GPT models
- **Custom Providers**: Your own LLM endpoints or other services

### Key Features

- **8-Agent Multi-Perspective Analysis**: Every decision is analyzed from 8 different expert perspectives
- **Provider Flexibility**: Switch providers without code changes via environment variables
- **Automatic Failover**: Configure fallback providers for resilience
- **Health Checks**: Automatic provider availability checking before requests
- **Centralized Rate Limiting**: Use AICEO Gateway to manage quotas across all platforms
- **Cost Tracking**: Monitor LLM API usage and costs across all requests

### Why Use the AI Provider System?

1. **Better Decisions**: 8 expert perspectives provide comprehensive analysis
2. **Cost Control**: Centralized rate limiting prevents quota overruns
3. **Flexibility**: Switch providers instantly without changing code
4. **Resilience**: Automatic fallback when primary provider is unavailable
5. **No Vendor Lock-in**: Works with any OpenAI-compatible API

---

## Quick Start

Get up and running with AICEO Gateway in 5 minutes.

### Prerequisites

- RecursiveManager installed and configured
- AICEO instance running at `http://localhost:4000` (or custom URL)
- AICEO Gateway API key (shared secret)

### Step 1: Configure Environment Variables

Create or edit `~/.recursive-manager/.env`:

```bash
# AI Provider Configuration
AI_PROVIDER=aiceo-gateway
AI_FALLBACK_PROVIDER=anthropic-direct

# AICEO Gateway Configuration
AICEO_GATEWAY_URL=http://localhost:4000/api/glm/submit
AICEO_GATEWAY_API_KEY=your-shared-secret-here
AICEO_GATEWAY_PROVIDER=glm
AICEO_GATEWAY_MODEL=glm-4.7
AICEO_GATEWAY_PRIORITY=high

# Anthropic Fallback (optional, for when gateway is unavailable)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages
ANTHROPIC_MODEL=claude-sonnet-4-5
```

### Step 2: Test the Configuration

Run a quick analysis to verify everything works:

```bash
recursive-manager analyze "Should we add Redis caching to our API?"
```

You should see output like:

```
┌─────────────────────────────────────────────────────────────┐
│ Multi-Perspective Analysis                                   │
│ Overall Confidence: 0.78                                     │
│ Execution Time: 3.2s                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────┬────────────┬────────────────────────────────┐
│ Perspective │ Confidence │ Summary                         │
├─────────────┼────────────┼────────────────────────────────┤
│ Security    │ 0.85       │ Increases attack surface...    │
│ Architecture│ 0.82       │ Better scalability but...      │
│ Simplicity  │ 0.65       │ Significantly increases...     │
│ Financial   │ 0.75       │ Higher infrastructure costs... │
│ Marketing   │ 0.80       │ Enables "enterprise-grade"...  │
│ UX          │ 0.70       │ May improve performance...     │
│ Growth      │ 0.85       │ Supports rapid scaling...      │
│ Emotional   │ 0.60       │ Team learning curve steep...   │
└─────────────┴────────────┴────────────────────────────────┘
```

### Step 3: Start Using Multi-Perspective Analysis

The ExecutionOrchestrator now has multi-perspective analysis built in:

```typescript
import { ExecutionOrchestrator } from '@recursive-manager/core';

const orchestrator = new ExecutionOrchestrator(config);

// Analyze a decision before making it
const analysis = await orchestrator.analyzeDecision(
  "Should we hire a new DevOps engineer?"
);

console.log('Overall Confidence:', analysis.overallConfidence);
console.log('Perspectives:', analysis.perspectives.length); // 8
```

### That's It!

You're now using RecursiveManager's AI Provider System with centralized quota management through AICEO Gateway.

---

## Provider Options

RecursiveManager supports four types of AI providers:

### 1. AICEO Gateway (Recommended)

**Use when**: You want centralized rate limiting, quota management, and cost tracking across multiple platforms.

**Pros**:
- Centralized quota management (no overruns)
- Rate limiting shared across AICEO, RecursiveManager, Slack bots, etc.
- Cost tracking and analytics
- Request auditing and logging
- Priority queue support (high/normal/low)

**Cons**:
- Requires AICEO instance running
- Additional network hop (minimal latency)

**Configuration**:
```bash
AI_PROVIDER=aiceo-gateway
AICEO_GATEWAY_URL=http://localhost:4000/api/glm/submit
AICEO_GATEWAY_API_KEY=your-shared-secret
AICEO_GATEWAY_PROVIDER=glm       # Which LLM AICEO should use
AICEO_GATEWAY_MODEL=glm-4.7
AICEO_GATEWAY_PRIORITY=high
```

**Best For**:
- Production deployments
- Teams with multiple AI-powered tools
- Cost-conscious organizations
- Environments requiring audit trails

### 2. Anthropic Direct

**Use when**: You want direct access to Claude models without going through AICEO Gateway.

**Pros**:
- Direct API access (lowest latency)
- No dependency on AICEO Gateway
- Access to latest Claude models immediately
- Simple configuration

**Cons**:
- No centralized rate limiting
- No quota management across platforms
- Individual API costs per request
- No built-in audit trail

**Configuration**:
```bash
AI_PROVIDER=anthropic-direct
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages
ANTHROPIC_MODEL=claude-sonnet-4-5
```

**Best For**:
- Development and testing
- Single-platform deployments
- When AICEO Gateway is unavailable
- Maximum performance requirements

### 3. OpenAI Direct

**Use when**: You want to use GPT models instead of Claude or GLM.

**Pros**:
- Access to GPT-4, GPT-4 Turbo, etc.
- Direct OpenAI API access
- Well-documented API
- Simple configuration

**Cons**:
- No centralized rate limiting
- Higher costs compared to GLM
- Different quality characteristics than Claude

**Configuration**:
```bash
AI_PROVIDER=openai-direct
OPENAI_API_KEY=sk-xxxxx
OPENAI_API_URL=https://api.openai.com/v1/chat/completions
OPENAI_MODEL=gpt-4-turbo
```

**Best For**:
- GPT-specific use cases
- Organizations already using OpenAI
- Testing different model providers

### 4. Custom Provider

**Use when**: You have your own LLM endpoint or want to use a different provider.

**Pros**:
- Complete flexibility
- Use any OpenAI or Anthropic-compatible endpoint
- Use local models (Ollama, LM Studio, etc.)
- Use other cloud providers (Azure OpenAI, AWS Bedrock, etc.)

**Cons**:
- Requires compatible API format
- No built-in support from RecursiveManager team
- You're responsible for availability and costs

**Configuration**:
```bash
AI_PROVIDER=custom
CUSTOM_PROVIDER_URL=https://your-endpoint.com/v1/chat
CUSTOM_PROVIDER_API_KEY=your-api-key
CUSTOM_PROVIDER_FORMAT=openai  # or 'anthropic' or 'custom'
```

**Best For**:
- On-premise deployments
- Custom LLM infrastructure
- Local development with Ollama/LM Studio
- Azure OpenAI, AWS Bedrock, etc.

---

## Configuration Reference

### Provider Selection

```bash
# Primary provider (required)
AI_PROVIDER=aiceo-gateway  # Options: aiceo-gateway, anthropic-direct, openai-direct, custom

# Fallback provider (optional, recommended for resilience)
AI_FALLBACK_PROVIDER=anthropic-direct  # Used if primary unavailable
```

### AICEO Gateway Configuration

```bash
AICEO_GATEWAY_URL=http://localhost:4000/api/glm/submit
AICEO_GATEWAY_API_KEY=your-shared-secret-here
AICEO_GATEWAY_PROVIDER=glm       # Which LLM provider AICEO uses: glm, anthropic, openai
AICEO_GATEWAY_MODEL=glm-4.7      # Model to request
AICEO_GATEWAY_PRIORITY=high      # Request priority: high, normal, low
```

**AICEO_GATEWAY_PROVIDER Options**:
- `glm`: Use Z.AI GLM models (cost-effective, high quality)
- `anthropic`: Use Claude models through AICEO
- `openai`: Use GPT models through AICEO

### Anthropic Direct Configuration

```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages  # Default
ANTHROPIC_MODEL=claude-sonnet-4-5                        # or claude-opus-4-5
```

### OpenAI Direct Configuration

```bash
OPENAI_API_KEY=sk-xxxxx
OPENAI_API_URL=https://api.openai.com/v1/chat/completions  # Default
OPENAI_MODEL=gpt-4-turbo                                     # or gpt-4, gpt-3.5-turbo
```

### Custom Provider Configuration

```bash
CUSTOM_PROVIDER_URL=https://your-endpoint.com/api/chat
CUSTOM_PROVIDER_API_KEY=your-custom-key
CUSTOM_PROVIDER_FORMAT=openai  # Options: openai, anthropic, custom
```

**CUSTOM_PROVIDER_FORMAT**:
- `openai`: Uses OpenAI-compatible message format
- `anthropic`: Uses Anthropic-compatible message format
- `custom`: Generic format (see Advanced section)

### Analysis Configuration

```bash
# Cache TTL for analysis results (default: 1 hour)
ANALYSIS_CACHE_TTL_MS=3600000  # 1 hour in milliseconds
```

### Environment Variable Precedence

1. Explicit environment variables (highest priority)
2. `~/.recursive-manager/.env` file
3. Default values (lowest priority)

---

## Multi-Perspective Analysis

### How It Works

RecursiveManager uses 8 specialized AI agents to analyze decisions from different expert perspectives:

1. **Security Agent**: Identifies vulnerabilities, compliance issues, OWASP Top 10 risks
2. **Architecture Agent**: Evaluates scalability, maintainability, technical debt, design patterns
3. **Simplicity Agent**: Advocates for reducing complexity, YAGNI principle, avoiding over-engineering
4. **Financial Agent**: Analyzes costs, benefits, ROI, resource utilization, opportunity costs
5. **Marketing Agent**: Assesses positioning, messaging, competitive advantage, brand perception
6. **UX Agent**: Evaluates usability, accessibility, cognitive load, user journey
7. **Growth Agent**: Analyzes user acquisition, retention, virality, scaling strategies
8. **Emotional Agent**: Considers team morale, developer experience, psychological safety, stress factors

### Parallel Execution

All 8 agents run in **parallel** using the configured AI provider. This means:

- Maximum efficiency (all analyses complete in the time of the slowest agent)
- Consistent provider usage (all 8 agents use the same configuration)
- Faster results (typically 3-5 seconds total for all 8 perspectives)

### Confidence Scoring

Each agent returns a confidence score (0.0 - 1.0). The overall confidence is calculated using:

```
overallConfidence = average(allConfidences) - (stdDev * 0.5)
```

This algorithm **lowers confidence when agents disagree**, promoting healthy skepticism when perspectives conflict.

### Result Structure

```typescript
interface MultiPerspectiveResult {
  perspectives: PerspectiveAnalysis[];  // All 8 perspectives
  summary: string;                       // Executive summary (markdown)
  overallConfidence: number;             // 0.0 - 1.0
  executionTime: number;                 // Milliseconds
  timestamp: string;                     // ISO 8601 format
}

interface PerspectiveAnalysis {
  perspective: string;      // "Security", "Architecture", etc.
  analysis: string;         // Full analysis text
  confidence: number;       // 0.0 - 1.0
  reasoning?: string;       // Optional reasoning
  metadata?: {
    model: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
    waitTime?: number;
    provider: string;
  };
}
```

### Using Multi-Perspective Analysis

#### CLI Command

```bash
# Analyze a question from all 8 perspectives
recursive-manager analyze "Should we migrate to microservices?"

# JSON output for programmatic use
recursive-manager analyze "Should we add Redis caching?" --format json

# Markdown output for documentation
recursive-manager analyze "Which database should we use?" --format markdown > analysis.md

# Custom timeout (default: 120 seconds)
recursive-manager analyze "Complex question..." --timeout 180
```

#### Programmatic API

```typescript
import { ExecutionOrchestrator } from '@recursive-manager/core';

const orchestrator = new ExecutionOrchestrator(config);

// Analyze a decision
const result = await orchestrator.analyzeDecision(
  "Should we add a new microservice for user authentication?"
);

// Access perspectives
result.perspectives.forEach(p => {
  console.log(`${p.perspective}: ${p.confidence}`);
  console.log(p.analysis);
});

// Check overall confidence
if (result.overallConfidence > 0.7) {
  console.log('High confidence decision');
} else {
  console.log('Low confidence - agents disagree');
}
```

#### Decision Triggers

RecursiveManager can automatically trigger multi-perspective analysis before major operations:

```typescript
// Hire agent with analysis
await orchestrator.hireAgentWithAnalysis(
  managerId,
  agentConfig,
  { requiresAnalysis: true }
);

// Fire agent with analysis
await orchestrator.fireAgentWithAnalysis(
  agentId,
  'gradual',
  { requiresAnalysis: true }
);

// Pause agent with analysis
await orchestrator.pauseAgentWithAnalysis(
  agentId,
  { requiresAnalysis: true }
);

// Resume agent with analysis
await orchestrator.resumeAgentWithAnalysis(
  agentId,
  { requiresAnalysis: true }
);
```

### Caching

Identical analysis contexts are cached to avoid redundant API calls:

- **Cache Key**: SHA-256 hash of analysis context
- **TTL**: Configurable via `ANALYSIS_CACHE_TTL_MS` (default: 1 hour)
- **Storage**: In-memory (dev) or Redis (production)
- **Statistics**: Hit rate, miss count, cache size tracking

```typescript
import { MultiPerspectiveAnalysis } from '@recursive-manager/core';

const analysis = new MultiPerspectiveAnalysis(provider);

// First call - hits API (8 requests)
await analysis.analyze('Should we add Redis?');

// Second call - hits cache (0 requests)
await analysis.analyze('Should we add Redis?');

// Check cache statistics
const stats = analysis.getCacheStats();
console.log('Hit rate:', stats.hitRate);
```

### History Persistence

All analyses are automatically saved to disk for audit trail:

- **Location**: `~/.recursive-manager/agents/{agentId}/analyses/{timestamp}.json`
- **Format**: JSON with full MultiPerspectiveResult
- **Searchable**: Filter by confidence, date range, or other criteria

```typescript
// List all analyses with filtering
const history = await analysis.listHistory({
  minConfidence: 0.7,
  startDate: new Date('2026-01-01'),
  limit: 10
});

// Get specific analysis
const item = await analysis.getHistoryItem('2026-01-20T10-30-00');

// Get statistics
const stats = await analysis.getHistoryStats();
console.log('Average confidence:', stats.averageConfidence);

// Export to file
await analysis.exportHistory('/backup/analyses.json');

// Cleanup old analyses
await analysis.deleteHistoryBefore(new Date('2025-12-01'));
```

---

## Troubleshooting

### Provider Connection Errors

#### AICEO Gateway Unavailable

**Error**:
```
ERROR: AICEO Gateway unavailable at http://localhost:4000/api/glm/submit
```

**Solutions**:
1. Verify AICEO is running: `curl http://localhost:4000/api/glm/status`
2. Check AICEO Gateway URL: `echo $AICEO_GATEWAY_URL`
3. Configure fallback provider:
   ```bash
   export AI_FALLBACK_PROVIDER=anthropic-direct
   export ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
   ```
4. Check network connectivity: `ping localhost`

#### Invalid API Key

**Error**:
```
ERROR: Invalid API key for AICEO Gateway
```

**Solutions**:
1. Verify API key is set: `echo $AICEO_GATEWAY_API_KEY`
2. Check key matches AICEO configuration (in AICEO's `.env`)
3. Ensure no trailing spaces or quotes in `.env` file
4. Restart RecursiveManager after changing `.env`

#### Provider Authentication Failed

**Error**:
```
ERROR: Anthropic API authentication failed (401)
```

**Solutions**:
1. Verify API key is valid: `echo $ANTHROPIC_API_KEY`
2. Check API key has correct format: `sk-ant-api03-xxxxx`
3. Test API key directly:
   ```bash
   curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model":"claude-sonnet-4-5","messages":[{"role":"user","content":"test"}],"max_tokens":10}'
   ```
4. Regenerate API key from provider dashboard

### Configuration Errors

#### No Provider Configured

**Error**:
```
ERROR: No AI provider configured
```

**Solution**:
```bash
# Set primary provider
export AI_PROVIDER=aiceo-gateway
export AICEO_GATEWAY_URL=http://localhost:4000/api/glm/submit
export AICEO_GATEWAY_API_KEY=your-key
```

#### Missing Required Environment Variables

**Error**:
```
ERROR: AICEO_GATEWAY_URL not configured
```

**Solution**:
Create or update `~/.recursive-manager/.env`:
```bash
AICEO_GATEWAY_URL=http://localhost:4000/api/glm/submit
AICEO_GATEWAY_API_KEY=your-shared-secret
AICEO_GATEWAY_PROVIDER=glm
AICEO_GATEWAY_MODEL=glm-4.7
```

Then restart RecursiveManager to reload environment.

### Performance Issues

#### Analysis Taking Too Long

**Issue**: Multi-perspective analysis taking > 30 seconds

**Solutions**:
1. Check provider latency:
   - AICEO Gateway: Check AICEO logs for slow LLM responses
   - Direct providers: Check network latency to API endpoints
2. Increase timeout:
   ```bash
   recursive-manager analyze "question" --timeout 180
   ```
3. Check cache hit rate:
   ```typescript
   const stats = analysis.getCacheStats();
   console.log('Hit rate:', stats.hitRate);
   ```
   Low hit rate (< 0.5) means most requests hitting API
4. Verify all 8 agents running in parallel (check logs)

#### High API Costs

**Issue**: Unexpected high LLM API costs

**Solutions**:
1. Use AICEO Gateway for centralized quota management
2. Configure fallback to cheaper provider (GLM instead of GPT-4):
   ```bash
   AICEO_GATEWAY_PROVIDER=glm
   AICEO_GATEWAY_MODEL=glm-4.7
   ```
3. Increase cache TTL to reduce duplicate requests:
   ```bash
   ANALYSIS_CACHE_TTL_MS=7200000  # 2 hours
   ```
4. Review analysis history for duplicate analyses:
   ```typescript
   const history = await analysis.listHistory({ limit: 100 });
   // Check for repeated contexts
   ```

### Provider Fallback Issues

#### Fallback Not Working

**Issue**: Primary provider fails but fallback not used

**Solution**:
Ensure fallback provider is configured:
```bash
AI_FALLBACK_PROVIDER=anthropic-direct
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

Verify fallback provider has required credentials.

#### Both Providers Unavailable

**Error**:
```
ERROR: No available AI providers (primary and fallback both failed)
```

**Solutions**:
1. Check primary provider health:
   ```bash
   curl http://localhost:4000/api/glm/status
   ```
2. Check fallback provider credentials:
   ```bash
   echo $ANTHROPIC_API_KEY
   ```
3. Add additional fallback providers:
   ```bash
   # If Anthropic fails, add OpenAI as backup
   export AI_FALLBACK_PROVIDER=openai-direct
   export OPENAI_API_KEY=sk-xxxxx
   ```

### Cache Issues

#### Cache Not Working

**Issue**: All requests hitting API, no cache hits

**Solutions**:
1. Verify caching is enabled (it's on by default)
2. Check cache statistics:
   ```typescript
   const stats = analysis.getCacheStats();
   console.log(stats);
   ```
3. Ensure contexts are identical (whitespace matters):
   ```typescript
   // These are DIFFERENT contexts:
   await analysis.analyze('Should we add Redis?');
   await analysis.analyze('Should we add Redis? '); // Extra space
   ```
4. Clear cache and test:
   ```typescript
   analysis.clearCache();
   await analysis.analyze('test'); // Miss
   await analysis.analyze('test'); // Hit
   ```

#### Cache Growing Too Large

**Issue**: Memory usage increasing over time

**Solutions**:
1. Run manual garbage collection:
   ```typescript
   analysis.cleanupCache(); // Removes expired entries
   ```
2. Reduce cache TTL:
   ```bash
   export ANALYSIS_CACHE_TTL_MS=1800000  # 30 minutes
   ```
3. Use Redis for production (scales better than in-memory)

---

## Advanced: Custom Providers

### Creating a Custom Provider

If you have your own LLM endpoint or want to use a provider not natively supported, you can use the custom provider.

#### OpenAI-Compatible Endpoints

Many providers offer OpenAI-compatible APIs (Ollama, LM Studio, Azure OpenAI, etc.):

```bash
AI_PROVIDER=custom
CUSTOM_PROVIDER_URL=http://localhost:11434/v1/chat/completions  # Ollama
CUSTOM_PROVIDER_API_KEY=not-required  # Ollama doesn't need API key
CUSTOM_PROVIDER_FORMAT=openai
```

#### Anthropic-Compatible Endpoints

For providers using Anthropic's message format:

```bash
AI_PROVIDER=custom
CUSTOM_PROVIDER_URL=https://your-claude-proxy.com/v1/messages
CUSTOM_PROVIDER_API_KEY=your-proxy-key
CUSTOM_PROVIDER_FORMAT=anthropic
```

#### Custom Format

For completely custom endpoints, use `custom` format:

```bash
AI_PROVIDER=custom
CUSTOM_PROVIDER_URL=https://your-llm-api.com/analyze
CUSTOM_PROVIDER_API_KEY=your-api-key
CUSTOM_PROVIDER_FORMAT=custom
```

**Custom format request structure**:
```json
{
  "prompt": "Should we add Redis caching?",
  "systemPrompt": "You are a Security Expert...",
  "agentType": "security",
  "context": {},
  "temperature": 0.7,
  "maxTokens": 4000
}
```

**Expected response**:
```json
{
  "content": "Analysis result text...\n\nConfidence: 0.85"
}
```

### Local Development with Ollama

Ollama provides a free local LLM server:

1. Install Ollama: https://ollama.ai
2. Pull a model: `ollama pull llama2`
3. Start Ollama: `ollama serve`
4. Configure RecursiveManager:
   ```bash
   AI_PROVIDER=custom
   CUSTOM_PROVIDER_URL=http://localhost:11434/v1/chat/completions
   CUSTOM_PROVIDER_API_KEY=ollama
   CUSTOM_PROVIDER_FORMAT=openai
   ```

### Azure OpenAI

Azure OpenAI provides enterprise-grade Claude and GPT access:

```bash
AI_PROVIDER=custom
CUSTOM_PROVIDER_URL=https://your-resource.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2023-05-15
CUSTOM_PROVIDER_API_KEY=your-azure-api-key
CUSTOM_PROVIDER_FORMAT=openai
```

### AWS Bedrock

AWS Bedrock provides access to multiple LLM providers:

```bash
# Requires custom integration (not yet supported out-of-box)
# Contact RecursiveManager team for AWS Bedrock adapter
```

### Implementing Your Own Provider

For maximum flexibility, you can create a custom provider in code:

```typescript
import { AIProvider, AIAnalysisRequest, AIAnalysisResponse } from '@recursive-manager/core';

export class MyCustomProvider implements AIProvider {
  name = 'my-custom-provider';

  async submit(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    // Your custom logic here
    const response = await fetch('https://my-api.com/analyze', {
      method: 'POST',
      body: JSON.stringify({
        prompt: request.prompt,
        system: request.systemPrompt
      })
    });

    const data = await response.json();

    return {
      content: data.result,
      confidence: this.extractConfidence(data.result),
      metadata: {
        model: 'my-model',
        provider: 'my-custom-provider'
      }
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('https://my-api.com/health');
      return response.ok;
    } catch {
      return false;
    }
  }

  private extractConfidence(content: string): number {
    const match = content.match(/Confidence:\s*([0-9.]+)/i);
    return match ? parseFloat(match[1]) : 0.7;
  }
}
```

Then register it with the ProviderFactory:

```typescript
import { ProviderFactory } from '@recursive-manager/core';
import { MyCustomProvider } from './my-custom-provider';

// Add to factory.ts
case 'my-custom-provider':
  return new MyCustomProvider();
```

---

## Best Practices

### 1. Use AICEO Gateway for Production

Centralized rate limiting and quota management prevents overruns and controls costs.

### 2. Configure Fallback Provider

Ensure resilience by configuring a fallback provider:

```bash
AI_PROVIDER=aiceo-gateway
AI_FALLBACK_PROVIDER=anthropic-direct
```

### 3. Monitor Cache Hit Rate

High cache hit rates (> 0.5) indicate efficient API usage:

```typescript
setInterval(() => {
  const stats = analysis.getCacheStats();
  console.log('Cache hit rate:', stats.hitRate);
}, 60000); // Every minute
```

### 4. Use Appropriate Models

Balance cost and quality:

- **High-stakes decisions**: GPT-4, Claude Opus
- **Routine analysis**: GLM-4.7, Claude Sonnet
- **Quick checks**: GPT-3.5, Claude Haiku

### 5. Review Analysis History

Periodically review saved analyses for insights:

```bash
# Export all analyses
recursive-manager analyze --export /backup/analyses-$(date +%Y%m%d).json

# Analyze analysis statistics
recursive-manager analyze --stats
```

### 6. Set Appropriate Cache TTL

Balance freshness and cost:

- **Rapidly changing contexts**: 30 minutes (`ANALYSIS_CACHE_TTL_MS=1800000`)
- **Stable contexts**: 2-4 hours (`ANALYSIS_CACHE_TTL_MS=7200000`)
- **Static contexts**: 24 hours (`ANALYSIS_CACHE_TTL_MS=86400000`)

### 7. Use Priority Appropriately

When using AICEO Gateway:

- **high**: Critical decisions, time-sensitive analysis
- **normal**: Routine analysis, background tasks
- **low**: Batch processing, non-urgent analysis

---

## Support

### Getting Help

- **Documentation**: https://github.com/your-org/RecursiveManager/docs
- **Issues**: https://github.com/your-org/RecursiveManager/issues
- **Discussions**: https://github.com/your-org/RecursiveManager/discussions

### Common Questions

**Q: Can I use multiple providers simultaneously?**
A: Not directly, but you can configure a primary and fallback provider. The system will automatically switch if the primary fails.

**Q: How much does multi-perspective analysis cost?**
A: Each analysis makes 8 LLM API calls (one per perspective). With GLM-4.7, this costs approximately $0.02-0.05 per analysis.

**Q: Can I disable specific perspectives?**
A: Not currently. All 8 perspectives are always included. This is intentional to ensure comprehensive analysis.

**Q: How do I add a new perspective agent?**
A: See the Contributing guide for instructions on adding custom agents.

**Q: Does the cache work across restarts?**
A: With in-memory caching (default), no. Use Redis for persistent caching.

---

**END OF GUIDE**
