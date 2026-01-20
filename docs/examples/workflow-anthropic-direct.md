# Example Workflow: Using Direct Anthropic API

This example demonstrates using RecursiveManager with direct Anthropic API access, bypassing AICEO Gateway.

## When to Use Direct Anthropic

- **AICEO Gateway not available** - Running RecursiveManager standalone
- **Separate quota management** - Don't want to share quota with other systems
- **Simplified setup** - No need for AICEO Gateway infrastructure
- **Testing/development** - Quick setup for local development

## Prerequisites

1. **Anthropic API Key**:
   - Sign up at https://console.anthropic.com/
   - Generate an API key
   - Note: Direct API usage incurs Anthropic API costs (no centralized rate limiting)

2. **RecursiveManager Installed**:
   ```bash
   cd /home/ubuntu/repos/RecursiveManager
   npm install
   npm run build
   ```

## Configuration

### Step 1: Configure Environment Variables

Create `.env` file in RecursiveManager root:

```bash
# RecursiveManager AI Provider Configuration

# ============================================
# Multi-Perspective Analysis Provider
# ============================================
AI_PROVIDER=anthropic-direct

# --- Direct Anthropic Configuration ---
ANTHROPIC_API_KEY=sk-ant-api03-your-api-key-here
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages
ANTHROPIC_MODEL=claude-sonnet-4-5

# --- Analysis Configuration ---
ANALYSIS_CACHE_TTL_MS=3600000  # 1 hour
```

### Step 2: Verify Configuration

Test Anthropic API connection:

```bash
curl -X POST https://api.anthropic.com/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-5",
    "max_tokens": 1024,
    "messages": [
      {
        "role": "user",
        "content": "Hello, Claude!"
      }
    ]
  }'
```

## Usage Scenarios

### Scenario 1: Manual Multi-Perspective Analysis

Run a manual analysis from the CLI:

```bash
cd /home/ubuntu/repos/RecursiveManager
npx recursive-manager analyze "Should we implement server-side rendering (SSR) for our React app?"
```

**Expected Output**:
```
┌─────────────────────────────────────────────────────────────┐
│ Multi-Perspective Analysis                                   │
│ Overall Confidence: 0.79                                     │
│ Execution Time: 3.8s                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────┬────────────┬──────────────────────────────────────┐
│ Perspective     │ Confidence │ Summary                               │
├─────────────────┼────────────┼──────────────────────────────────────┤
│ Security        │ 0.80       │ SSR reduces XSS risks but...         │
│ Architecture    │ 0.88       │ Better SEO, but increases...         │
│ Simplicity      │ 0.65       │ Adds significant complexity...       │
│ Financial       │ 0.75       │ Higher server costs, but...          │
│ Marketing       │ 0.92       │ Critical for SEO and...              │
│ UX              │ 0.85       │ Faster initial load, better...       │
│ Growth          │ 0.78       │ Better discoverability...            │
│ Emotional       │ 0.70       │ Team needs to learn SSR...           │
└─────────────────┴────────────┴──────────────────────────────────────┘

Full analysis saved to: ~/.recursive-manager/agents/cli-analyze/analyses/2026-01-20T16-12-45.json
```

### Scenario 2: JSON Output for Automation

Export analysis as JSON for processing:

```bash
npx recursive-manager analyze "Should we adopt TypeScript for our JavaScript project?" \
  --format json > analysis.json
```

**analysis.json**:
```json
{
  "perspectives": [
    {
      "perspective": "Security",
      "analysis": "TypeScript provides compile-time type checking which can catch many security vulnerabilities...",
      "confidence": 0.85,
      "reasoning": "Type safety reduces runtime errors and prevents many common security issues.",
      "metadata": {
        "model": "claude-sonnet-4-5",
        "usage": {
          "inputTokens": 245,
          "outputTokens": 512
        },
        "provider": "anthropic-direct"
      }
    }
    // ... 7 more perspectives
  ],
  "summary": "**Security** (Confidence: 0.85):\n...",
  "overallConfidence": 0.81,
  "executionTime": 3621,
  "timestamp": "2026-01-20T16:12:45.123Z"
}
```

### Scenario 3: Markdown Output for Documentation

Generate markdown report:

```bash
npx recursive-manager analyze "Should we adopt microservices architecture?" \
  --format markdown > decision-analysis.md
```

**decision-analysis.md**:
```markdown
# Multi-Perspective Analysis

**Overall Confidence**: 0.76
**Execution Time**: 4.1s
**Timestamp**: 2026-01-20T16:15:30.456Z

---

## Security (Confidence: 0.82)

Microservices architecture introduces new security challenges:

- **Network Security**: Each service needs authentication/authorization
- **Attack Surface**: More endpoints to secure
- **Data Protection**: Distributed data requires careful handling
- **Secret Management**: Each service needs credentials

**Recommendations**: Implement API gateway, service mesh, centralized auth.

---

## Architecture (Confidence: 0.88)

Microservices provide excellent scalability but increase operational complexity:

- **Scalability**: Independent scaling of services
- **Technology Flexibility**: Different tech stacks per service
- **Deployment**: More complex CI/CD pipelines
- **Monitoring**: Distributed tracing required

**Recommendations**: Start with well-defined service boundaries, invest in observability.

---

<!-- ... 6 more perspectives -->
```

### Scenario 4: Programmatic Analysis in TypeScript

```typescript
import { ExecutionOrchestrator } from '@recursive-manager/core';
import { loadConfig } from '@recursive-manager/common';

const config = loadConfig();
const orchestrator = new ExecutionOrchestrator(config);

// Analyze a decision
const result = await orchestrator.analyzeDecision(
  "Should we migrate our PostgreSQL database to MongoDB?"
);

// Process results
const highConfidencePerspectives = result.perspectives.filter(
  p => p.confidence > 0.8
);

console.log('High Confidence Perspectives:');
highConfidencePerspectives.forEach(p => {
  console.log(`- ${p.perspective}: ${p.confidence}`);
  console.log(`  ${p.analysis.substring(0, 100)}...`);
});

// Check overall consensus
if (result.overallConfidence > 0.75) {
  console.log('Strong consensus - proceed with confidence');
} else if (result.overallConfidence > 0.6) {
  console.log('Moderate consensus - proceed with caution');
} else {
  console.log('Low consensus - reconsider or gather more information');
}
```

### Scenario 5: Agent Lifecycle with Analysis

```typescript
import { ExecutionOrchestrator } from '@recursive-manager/core';
import { loadConfig } from '@recursive-manager/common';

const config = loadConfig();
const orchestrator = new ExecutionOrchestrator(config);

// Hire agent with analysis
const hireResult = await orchestrator.hireAgentWithAnalysis(
  'ceo-agent-001',
  {
    id: 'frontend-specialist-001',
    role: 'frontend',
    type: 'specialist',
    framework: 'claude-code',
    status: 'idle'
  },
  {
    requiresAnalysis: true
  }
);

console.log('Hire Analysis:', hireResult.analysis?.summary);

// Later, fire agent with analysis
const fireResult = await orchestrator.fireAgentWithAnalysis(
  'frontend-specialist-001',
  'graceful',
  {
    requiresAnalysis: true
  }
);

console.log('Fire Analysis:', fireResult.analysis?.summary);
```

## Monitoring and Cost Management

### Track Token Usage

Anthropic API usage is metered by tokens. Monitor usage:

```typescript
import { MultiPerspectiveAnalysis } from '@recursive-manager/core';
import { ProviderFactory } from '@recursive-manager/core';

const provider = await ProviderFactory.createWithHealthCheck();
const analysis = new MultiPerspectiveAnalysis(provider);

const result = await analysis.analyze("Your question here");

// Calculate total token usage
let totalInputTokens = 0;
let totalOutputTokens = 0;

result.perspectives.forEach(p => {
  if (p.metadata?.usage) {
    totalInputTokens += p.metadata.usage.inputTokens;
    totalOutputTokens += p.metadata.usage.outputTokens;
  }
});

console.log('Total Input Tokens:', totalInputTokens);
console.log('Total Output Tokens:', totalOutputTokens);

// Estimate cost (Anthropic pricing as of 2026-01)
// Claude Sonnet 4.5: $3/M input tokens, $15/M output tokens
const inputCost = (totalInputTokens / 1_000_000) * 3;
const outputCost = (totalOutputTokens / 1_000_000) * 15;
const totalCost = inputCost + outputCost;

console.log(`Estimated Cost: $${totalCost.toFixed(4)}`);
```

### Cache to Reduce Costs

```typescript
import { MultiPerspectiveAnalysis } from '@recursive-manager/core';
import { ProviderFactory } from '@recursive-manager/core';

const provider = await ProviderFactory.createWithHealthCheck();
const analysis = new MultiPerspectiveAnalysis(provider);

// Run analysis multiple times with same context
const context = "Should we add real-time collaboration features?";

// First run - makes API calls
const result1 = await analysis.analyze(context);
console.log('First run - API calls made');

// Second run - uses cache (no API calls, no cost)
const result2 = await analysis.analyze(context);
console.log('Second run - cached (instant, free)');

// Check cache stats
const stats = analysis.getCacheStats();
console.log('Cache Hit Rate:', (stats.hitRate * 100).toFixed(1) + '%');
console.log('API Calls Saved:', stats.hits);
```

## Troubleshooting

### Error: "Anthropic API key not configured"

**Solution**: Set ANTHROPIC_API_KEY environment variable
```bash
export ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

### Error: "Rate limit exceeded"

Anthropic has rate limits (requests per minute). **Solution**: Implement retry logic with exponential backoff:

```typescript
async function analyzeWithRetry(question: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await orchestrator.analyzeDecision(question);
      return result;
    } catch (error) {
      if (error.message.includes('rate limit') && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

### Error: "Model not found"

**Solution**: Verify model name is correct
```bash
# Valid models (as of 2026-01):
# - claude-opus-4-5
# - claude-sonnet-4-5
# - claude-haiku-4

export ANTHROPIC_MODEL=claude-sonnet-4-5
```

## Best Practices

1. **Use Caching Aggressively**:
   - Set `ANALYSIS_CACHE_TTL_MS=86400000` (24 hours) for stable contexts
   - Monitor cache hit rate with `getCacheStats()`

2. **Choose Appropriate Models**:
   - **Claude Opus 4.5**: Best reasoning, highest cost (use for critical decisions)
   - **Claude Sonnet 4.5**: Balanced quality/cost (recommended default)
   - **Claude Haiku 4**: Fast, cheap (use for high-volume simple analyses)

3. **Batch Analyses When Possible**:
   - Multiple analyses in quick succession benefit from cache
   - Run related analyses together to maximize cache hits

4. **Monitor Costs**:
   - Track token usage per analysis
   - Set budget alerts in Anthropic Console
   - Review monthly usage reports

5. **Use JSON Format for Automation**:
   - Parse results programmatically
   - Build decision support systems
   - Generate automated reports

## Comparison: Direct Anthropic vs AICEO Gateway

| Feature | Direct Anthropic | AICEO Gateway |
|---------|-----------------|---------------|
| **Setup Complexity** | Low (just API key) | Medium (requires gateway running) |
| **Rate Limiting** | Anthropic's limits | Centralized across all platforms |
| **Cost Tracking** | Anthropic Console only | Centralized dashboard |
| **Quota Management** | Per-account | Shared across platforms |
| **Failover** | Manual configuration | Automatic with fallback |
| **Best For** | Standalone use, simple setups | Multi-platform, centralized control |

## Next Steps

- Review [AI_PROVIDER_GUIDE.md](../AI_PROVIDER_GUIDE.md) for detailed configuration
- Explore other workflows:
  - [AICEO Gateway Workflow](./workflow-aiceo-gateway.md)
  - [Multi-Provider Workflow](./workflow-multi-provider.md)
  - [Analysis Example](./analysis-example.md)
