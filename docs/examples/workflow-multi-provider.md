# Example Workflow: Multi-Provider Setup with Failover

This example demonstrates using RecursiveManager with multiple AI providers and automatic failover for maximum resilience.

## When to Use Multi-Provider Setup

- **High Availability**: Ensure analysis continues even if primary provider is down
- **Cost Optimization**: Use cheaper providers when possible, premium for critical analyses
- **Quota Management**: Automatically switch when hitting quota limits
- **Risk Mitigation**: Don't depend on single vendor
- **Testing**: Compare results across different LLM providers

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RecursiveManager                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │     ProviderFactory          │
        │  (with health checks)        │
        └──────────────┬───────────────┘
                       │
           ┌───────────┼───────────┐
           │                       │
           ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│ Primary Provider │    │ Fallback Provider│
│  AICEO Gateway   │    │   GLM Direct     │
└──────────────────┘    └──────────────────┘
```

## Configuration

### Step 1: Configure Environment Variables

Create `.env` file with multiple providers:

```bash
# RecursiveManager AI Provider Configuration

# ============================================
# Multi-Perspective Analysis Provider
# ============================================
AI_PROVIDER=aiceo-gateway
AI_FALLBACK_PROVIDER=glm-direct

# --- AICEO Gateway (Primary) ---
AICEO_GATEWAY_URL=http://localhost:4000/api/glm/submit
AICEO_GATEWAY_API_KEY=your-shared-secret-here
AICEO_GATEWAY_PROVIDER=glm
AICEO_GATEWAY_MODEL=glm-4.7
AICEO_GATEWAY_PRIORITY=high

# --- Direct GLM (Fallback #1) ---
GLM_API_KEY=your-glm-api-key-here
GLM_API_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
GLM_MODEL=glm-4.7

# --- Direct Anthropic (Fallback #2 - for critical use) ---
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages
ANTHROPIC_MODEL=claude-sonnet-4-5

# --- Direct OpenAI (Alternative) ---
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_API_URL=https://api.openai.com/v1/chat/completions
OPENAI_MODEL=gpt-4-turbo

# --- Analysis Configuration ---
ANALYSIS_CACHE_TTL_MS=3600000  # 1 hour
```

### Step 2: Verify All Providers

Test each provider connection:

```bash
# Test AICEO Gateway (primary)
curl http://localhost:4000/api/glm/status

# Test GLM Direct (fallback)
curl -X POST https://open.bigmodel.cn/api/paas/v4/chat/completions \
  -H "Authorization: Bearer $GLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"glm-4.7","messages":[{"role":"user","content":"hello"}]}'

# Test Anthropic
curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-5","max_tokens":100,"messages":[{"role":"user","content":"hello"}]}'

# Test OpenAI
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4-turbo","messages":[{"role":"user","content":"hello"}]}'
```

## Usage Scenarios

### Scenario 1: Automatic Failover

Primary provider down → automatic fallback:

```bash
# Primary: AICEO Gateway, Fallback: GLM Direct
export AI_PROVIDER=aiceo-gateway
export AI_FALLBACK_PROVIDER=glm-direct

# If AICEO Gateway is down, automatically uses GLM Direct
npx recursive-manager analyze "Should we implement A/B testing for our features?"
```

**Console Output on Failover**:
```
WARNING: Primary provider (aiceo-gateway) health check failed: ECONNREFUSED
INFO: Attempting fallback provider: glm-direct
INFO: Fallback provider (glm-direct) health check passed
INFO: Using fallback provider for analysis

┌─────────────────────────────────────────────────────────────┐
│ Multi-Perspective Analysis                                   │
│ Provider: glm-direct (fallback)                              │
│ Overall Confidence: 0.77                                     │
└─────────────────────────────────────────────────────────────┘
```

### Scenario 2: Manual Provider Switching

Override default provider for specific analysis:

```typescript
import { ProviderFactory } from '@recursive-manager/core';
import { MultiPerspectiveAnalysis } from '@recursive-manager/core';

// Use AICEO Gateway (primary)
const primaryProvider = ProviderFactory.create('aiceo-gateway');
const primaryAnalysis = new MultiPerspectiveAnalysis(primaryProvider);
const result1 = await primaryAnalysis.analyze("Question 1");

// Use Anthropic Direct (for premium quality)
const anthropicProvider = ProviderFactory.create('anthropic-direct');
const anthropicAnalysis = new MultiPerspectiveAnalysis(anthropicProvider);
const result2 = await anthropicAnalysis.analyze("Critical decision");

// Use OpenAI Direct (for comparison)
const openaiProvider = ProviderFactory.create('openai-direct');
const openaiAnalysis = new MultiPerspectiveAnalysis(openaiProvider);
const result3 = await openaiAnalysis.analyze("Compare results");
```

### Scenario 3: Cost-Optimized Provider Selection

```typescript
interface ProviderCost {
  name: string;
  costPer1MInput: number;
  costPer1MOutput: number;
}

const providerCosts: ProviderCost[] = [
  { name: 'glm-direct', costPer1MInput: 0.5, costPer1MOutput: 0.5 },
  { name: 'anthropic-direct', costPer1MInput: 3, costPer1MOutput: 15 },
  { name: 'openai-direct', costPer1MInput: 10, costPer1MOutput: 30 }
];

async function analyzeWithCostOptimization(
  question: string,
  maxBudget: number
): Promise<MultiPerspectiveResult> {
  // Sort providers by cost (cheapest first)
  const sortedProviders = providerCosts.sort(
    (a, b) => a.costPer1MInput - b.costPer1MInput
  );

  for (const providerInfo of sortedProviders) {
    try {
      const provider = ProviderFactory.create(providerInfo.name);
      const analysis = new MultiPerspectiveAnalysis(provider);
      const result = await analysis.analyze(question);

      // Calculate actual cost
      let totalCost = 0;
      result.perspectives.forEach(p => {
        if (p.metadata?.usage) {
          const inputCost = (p.metadata.usage.inputTokens / 1_000_000) * providerInfo.costPer1MInput;
          const outputCost = (p.metadata.usage.outputTokens / 1_000_000) * providerInfo.costPer1MOutput;
          totalCost += inputCost + outputCost;
        }
      });

      console.log(`Provider: ${providerInfo.name}, Cost: $${totalCost.toFixed(4)}`);

      if (totalCost <= maxBudget) {
        return result;
      } else {
        console.log(`Cost exceeded budget, trying next provider...`);
      }
    } catch (error) {
      console.log(`Provider ${providerInfo.name} failed, trying next...`);
    }
  }

  throw new Error('No provider within budget');
}

// Use cheapest provider within $0.10 budget
const result = await analyzeWithCostOptimization(
  "Should we add dark mode to our app?",
  0.10
);
```

### Scenario 4: Provider Comparison

Compare results across multiple providers:

```typescript
import { ProviderFactory } from '@recursive-manager/core';
import { MultiPerspectiveAnalysis } from '@recursive-manager/core';

async function compareProviders(question: string) {
  const providers = ['aiceo-gateway', 'anthropic-direct', 'openai-direct'];
  const results = [];

  for (const providerName of providers) {
    try {
      const provider = ProviderFactory.create(providerName);
      const analysis = new MultiPerspectiveAnalysis(provider, {
        agentId: `compare-${providerName}`,
        persistHistory: false  // Don't save comparison runs
      });

      const startTime = Date.now();
      const result = await analysis.analyze(question);
      const duration = Date.now() - startTime;

      results.push({
        provider: providerName,
        result,
        duration,
        overallConfidence: result.overallConfidence
      });

      console.log(`${providerName}: ${duration}ms, confidence: ${result.overallConfidence}`);
    } catch (error) {
      console.log(`${providerName}: FAILED - ${error.message}`);
    }
  }

  // Compare results
  console.log('\n=== Provider Comparison ===');
  results.forEach(r => {
    console.log(`\n${r.provider.toUpperCase()}`);
    console.log(`  Overall Confidence: ${r.overallConfidence}`);
    console.log(`  Execution Time: ${r.duration}ms`);
    console.log(`  Security: ${r.result.perspectives[0].confidence}`);
    console.log(`  Architecture: ${r.result.perspectives[1].confidence}`);
  });

  return results;
}

// Compare all providers
await compareProviders("Should we migrate to Kubernetes?");
```

### Scenario 5: Health Check Monitoring

Monitor provider availability:

```typescript
import { ProviderFactory } from '@recursive-manager/core';

async function checkProviderHealth() {
  const providers = [
    'aiceo-gateway',
    'glm-direct',
    'anthropic-direct',
    'openai-direct'
  ];

  const healthStatus = [];

  for (const providerName of providers) {
    try {
      const provider = ProviderFactory.create(providerName);
      const startTime = Date.now();
      const healthy = await provider.healthCheck();
      const responseTime = Date.now() - startTime;

      healthStatus.push({
        provider: providerName,
        healthy,
        responseTime
      });
    } catch (error) {
      healthStatus.push({
        provider: providerName,
        healthy: false,
        error: error.message
      });
    }
  }

  // Display results
  console.log('Provider Health Status:');
  console.log('┌──────────────────┬─────────┬──────────────┐');
  console.log('│ Provider         │ Status  │ Response Time│');
  console.log('├──────────────────┼─────────┼──────────────┤');
  healthStatus.forEach(status => {
    const statusIcon = status.healthy ? '✓' : '✗';
    const responseTime = status.responseTime ? `${status.responseTime}ms` : 'N/A';
    console.log(`│ ${status.provider.padEnd(16)} │ ${statusIcon}       │ ${responseTime.padEnd(12)} │`);
  });
  console.log('└──────────────────┴─────────┴──────────────┘');

  return healthStatus;
}

// Check all providers
await checkProviderHealth();
```

## Failover Strategies

### Strategy 1: Sequential Failover

Try providers in order until one succeeds:

```typescript
import { ProviderFactory } from '@recursive-manager/core';

async function analyzeWithSequentialFailover(question: string) {
  const providerPriority = [
    'aiceo-gateway',    // Try gateway first (centralized rate limiting)
    'glm-direct',       // Fallback to GLM (same credentials, bypass rate limiter)
    'anthropic-direct', // Fallback to premium provider
    'openai-direct'     // Last resort
  ];

  for (const providerName of providerPriority) {
    try {
      console.log(`Trying provider: ${providerName}...`);
      const provider = ProviderFactory.create(providerName);

      // Quick health check
      const healthy = await provider.healthCheck();
      if (!healthy) {
        console.log(`Provider ${providerName} health check failed, skipping...`);
        continue;
      }

      // Run analysis
      const analysis = new MultiPerspectiveAnalysis(provider);
      const result = await analysis.analyze(question);
      console.log(`Success with provider: ${providerName}`);
      return result;
    } catch (error) {
      console.log(`Provider ${providerName} failed: ${error.message}`);
      // Continue to next provider
    }
  }

  throw new Error('All providers failed');
}

// Use sequential failover
const result = await analyzeWithSequentialFailover(
  "Should we implement OAuth 2.0 authentication?"
);
```

### Strategy 2: Fastest Provider Wins

Use all providers concurrently, return fastest:

```typescript
async function analyzeWithFastestProvider(question: string) {
  const providers = ['aiceo-gateway', 'anthropic-direct', 'openai-direct'];

  const promises = providers.map(async (providerName) => {
    const provider = ProviderFactory.create(providerName);
    const analysis = new MultiPerspectiveAnalysis(provider);
    const result = await analysis.analyze(question);
    return { provider: providerName, result };
  });

  // Return result from fastest provider
  const { provider, result } = await Promise.race(promises);
  console.log(`Fastest provider: ${provider}`);
  return result;
}

// Use fastest provider
const result = await analyzeWithFastestProvider(
  "Should we add WebSocket support for real-time features?"
);
```

### Strategy 3: Quality-First with Timeout

Use premium provider with fallback on timeout:

```typescript
async function analyzeWithTimeout(
  question: string,
  timeoutMs: number = 10000
) {
  const primaryProvider = ProviderFactory.create('anthropic-direct');
  const fallbackProvider = ProviderFactory.create('glm-direct');

  const primaryAnalysis = new MultiPerspectiveAnalysis(primaryProvider);

  try {
    // Try primary with timeout
    const result = await Promise.race([
      primaryAnalysis.analyze(question),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]) as MultiPerspectiveResult;

    console.log('Used primary provider (high quality)');
    return result;
  } catch (error) {
    if (error.message === 'Timeout') {
      console.log('Primary provider timed out, using fallback...');
      const fallbackAnalysis = new MultiPerspectiveAnalysis(fallbackProvider);
      return await fallbackAnalysis.analyze(question);
    }
    throw error;
  }
}

// Use quality-first with 10s timeout
const result = await analyzeWithTimeout(
  "Should we implement serverless architecture?",
  10000
);
```

## Monitoring and Alerting

### Track Provider Usage

```typescript
interface ProviderUsage {
  provider: string;
  requests: number;
  failures: number;
  totalCost: number;
  avgResponseTime: number;
}

const usageTracker: Map<string, ProviderUsage> = new Map();

async function trackAnalysis(providerName: string, question: string) {
  const startTime = Date.now();

  try {
    const provider = ProviderFactory.create(providerName);
    const analysis = new MultiPerspectiveAnalysis(provider);
    const result = await analysis.analyze(question);
    const responseTime = Date.now() - startTime;

    // Update usage stats
    const usage = usageTracker.get(providerName) || {
      provider: providerName,
      requests: 0,
      failures: 0,
      totalCost: 0,
      avgResponseTime: 0
    };

    usage.requests += 1;
    usage.avgResponseTime = (usage.avgResponseTime * (usage.requests - 1) + responseTime) / usage.requests;

    usageTracker.set(providerName, usage);

    return result;
  } catch (error) {
    const usage = usageTracker.get(providerName) || {
      provider: providerName,
      requests: 0,
      failures: 0,
      totalCost: 0,
      avgResponseTime: 0
    };

    usage.failures += 1;
    usageTracker.set(providerName, usage);

    throw error;
  }
}

// View usage stats
function displayUsageStats() {
  console.log('Provider Usage Statistics:');
  console.log('┌──────────────────┬──────────┬──────────┬──────────────┐');
  console.log('│ Provider         │ Requests │ Failures │ Avg Response │');
  console.log('├──────────────────┼──────────┼──────────┼──────────────┤');

  usageTracker.forEach(usage => {
    const failureRate = usage.requests > 0 ? (usage.failures / usage.requests * 100).toFixed(1) : '0.0';
    console.log(`│ ${usage.provider.padEnd(16)} │ ${String(usage.requests).padEnd(8)} │ ${String(usage.failures).padEnd(8)} │ ${Math.round(usage.avgResponseTime)}ms         │`);
  });

  console.log('└──────────────────┴──────────┴──────────┴──────────────┘');
}
```

## Best Practices

1. **Always Configure Fallback**:
   - Set `AI_FALLBACK_PROVIDER` to ensure resilience
   - Test failover regularly

2. **Monitor Provider Health**:
   - Run health checks before analysis
   - Track failure rates
   - Alert on provider downtime

3. **Cost-Aware Routing**:
   - Use cheaper providers for non-critical analyses
   - Reserve premium providers for important decisions

4. **Cache Aggressively**:
   - Reduce costs across all providers
   - Improve response times

5. **Test All Providers Regularly**:
   - Verify credentials don't expire
   - Ensure health checks work
   - Validate API changes

## Next Steps

- Review [AI_PROVIDER_GUIDE.md](../AI_PROVIDER_GUIDE.md) for detailed provider configuration
- Review [AICEO_INTEGRATION_GUIDE.md](../AICEO_INTEGRATION_GUIDE.md) for integration details
- Explore other workflows:
  - [AICEO Gateway Workflow](./workflow-aiceo-gateway.md)
  - [Direct Anthropic Workflow](./workflow-anthropic-direct.md)
  - [Analysis Example](./analysis-example.md)
