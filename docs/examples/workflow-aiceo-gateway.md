# Example Workflow: Using AICEO Gateway

This example demonstrates a complete workflow using RecursiveManager with AICEO Gateway for centralized rate-limited LLM access.

## Prerequisites

1. **AICEO Gateway Running**:
   ```bash
   cd /home/ubuntu/repos/AICEO
   npm run dev
   # Gateway should be running at http://localhost:4000
   ```

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
AI_PROVIDER=aiceo-gateway
AI_FALLBACK_PROVIDER=glm-direct

# --- AICEO Gateway Configuration ---
AICEO_GATEWAY_URL=http://localhost:4000/api/glm/submit
AICEO_GATEWAY_API_KEY=your-shared-secret-here
AICEO_GATEWAY_PROVIDER=glm
AICEO_GATEWAY_MODEL=glm-4.7
AICEO_GATEWAY_PRIORITY=high

# --- Direct GLM (Fallback) ---
GLM_API_KEY=your-glm-api-key-here
GLM_API_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
GLM_MODEL=glm-4.7

# --- Analysis Configuration ---
ANALYSIS_CACHE_TTL_MS=3600000  # 1 hour
```

### Step 2: Verify Configuration

```bash
# Check AICEO Gateway is reachable
curl http://localhost:4000/api/glm/status

# Expected output:
# {
#   "healthy": true,
#   "concurrentRequests": 0,
#   "queueDepth": 0,
#   "quotaRemaining": 2400
# }
```

## Usage Scenarios

### Scenario 1: Manual Multi-Perspective Analysis

Run a manual analysis from the CLI:

```bash
cd /home/ubuntu/repos/RecursiveManager
npx recursive-manager analyze "Should we migrate from REST to GraphQL for our API?"
```

**Expected Output**:
```
┌─────────────────────────────────────────────────────────────┐
│ Multi-Perspective Analysis                                   │
│ Overall Confidence: 0.76                                     │
│ Execution Time: 4.2s                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────┬────────────┬──────────────────────────────────────┐
│ Perspective     │ Confidence │ Summary                               │
├─────────────────┼────────────┼──────────────────────────────────────┤
│ Security        │ 0.82       │ GraphQL increases attack surface...  │
│ Architecture    │ 0.85       │ Better data fetching, but adds...    │
│ Simplicity      │ 0.68       │ Increases complexity significantly.. │
│ Financial       │ 0.72       │ Higher dev costs, but better...      │
│ Marketing       │ 0.78       │ Modern tech stack, good for...       │
│ UX              │ 0.88       │ Improved frontend experience...      │
│ Growth          │ 0.75       │ Flexible API supports mobile...      │
│ Emotional       │ 0.62       │ Learning curve steep for team...     │
└─────────────────┴────────────┴──────────────────────────────────────┘

Full analysis saved to: ~/.recursive-manager/agents/cli-analyze/analyses/2026-01-20T15-34-22.json
```

### Scenario 2: Programmatic Analysis

Use RecursiveManager's API to trigger analysis:

```typescript
import { ExecutionOrchestrator } from '@recursive-manager/core';
import { loadConfig } from '@recursive-manager/common';

const config = loadConfig();
const orchestrator = new ExecutionOrchestrator(config);

// Analyze a hiring decision
const result = await orchestrator.analyzeDecision(
  "Should we hire a dedicated DevOps engineer for our team?"
);

console.log('Overall Confidence:', result.overallConfidence);
console.log('Perspectives:', result.perspectives.length); // 8

// Access specific perspective
const securityPerspective = result.perspectives.find(
  p => p.perspective === 'Security'
);
console.log('Security Analysis:', securityPerspective.analysis);
console.log('Security Confidence:', securityPerspective.confidence);
```

### Scenario 3: Decision Triggers (Hiring)

Trigger analysis automatically before hiring an agent:

```typescript
import { ExecutionOrchestrator } from '@recursive-manager/core';
import { loadConfig } from '@recursive-manager/common';

const config = loadConfig();
const orchestrator = new ExecutionOrchestrator(config);

// Hire agent with analysis
const result = await orchestrator.hireAgentWithAnalysis(
  'ceo-agent-001',
  {
    id: 'marketing-specialist-001',
    role: 'marketing',
    type: 'specialist',
    framework: 'claude-code',
    status: 'idle'
  },
  {
    requiresAnalysis: true  // Triggers multi-perspective analysis
  }
);

console.log('Analysis:', result.analysis);
console.log('Agent Hired:', result.agentId);
```

### Scenario 4: Viewing Request Metrics

Check how many requests were sent through AICEO Gateway:

```bash
# View gateway status
curl http://localhost:4000/api/glm/status

# View gateway metrics
curl http://localhost:4000/api/glm/metrics

# View GLM quota usage
curl http://localhost:4000/api/glm/usage
```

**Expected Metrics Output**:
```json
{
  "totalRequests": 24,
  "successfulRequests": 23,
  "failedRequests": 1,
  "averageWaitTime": 1234,
  "requestsByPriority": {
    "high": 18,
    "normal": 5,
    "low": 1
  },
  "requestsBySource": {
    "recursive-manager": 24
  }
}
```

## Monitoring and Debugging

### View Analysis History

```bash
# List all past analyses
ls ~/.recursive-manager/agents/cli-analyze/analyses/

# View specific analysis
cat ~/.recursive-manager/agents/cli-analyze/analyses/2026-01-20T15-34-22.json
```

### Check Cache Performance

```typescript
import { MultiPerspectiveAnalysis } from '@recursive-manager/core';
import { ProviderFactory } from '@recursive-manager/core';

const provider = await ProviderFactory.createWithHealthCheck();
const analysis = new MultiPerspectiveAnalysis(provider);

// Run analysis twice with same context
const context = "Should we add Redis caching?";
await analysis.analyze(context);  // First run - API calls made
await analysis.analyze(context);  // Second run - cached (instant)

// Check cache stats
const stats = analysis.getCacheStats();
console.log('Cache Hits:', stats.hits);      // 1
console.log('Cache Misses:', stats.misses);  // 1
console.log('Hit Rate:', stats.hitRate);     // 50%
```

### Debug Provider Connection

```bash
# Test AICEO Gateway connection
curl -X POST http://localhost:4000/api/glm/submit \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-shared-secret-here" \
  -d '{
    "provider": "glm",
    "model": "glm-4.7",
    "priority": "high",
    "source": "test",
    "sourceId": "test-001",
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful assistant."
      },
      {
        "role": "user",
        "content": "Say hello."
      }
    ]
  }'
```

## Troubleshooting

### Error: "AICEO Gateway unavailable"

**Solution 1**: Check AICEO Gateway is running
```bash
curl http://localhost:4000/api/glm/status
```

**Solution 2**: Check API key matches
```bash
# In AICEO .env file
echo $GLM_GATEWAY_API_KEY

# In RecursiveManager .env file
echo $AICEO_GATEWAY_API_KEY

# These must match
```

### Error: "GLM quota exceeded"

**Solution**: Wait for quota window to reset (5 hours) or use fallback provider
```bash
# Check quota usage
curl http://localhost:4000/api/glm/usage

# Use fallback provider temporarily
export AI_PROVIDER=glm-direct
npx recursive-manager analyze "Your question here"
```

### Error: "Invalid API key"

**Solution**: Verify X-API-Key header matches GLM_GATEWAY_API_KEY
```bash
# Check AICEO expects this key
grep GLM_GATEWAY_API_KEY /home/ubuntu/repos/AICEO/.env

# Check RecursiveManager is sending this key
grep AICEO_GATEWAY_API_KEY /home/ubuntu/repos/RecursiveManager/.env
```

## Best Practices

1. **Use High Priority for Critical Decisions**:
   ```bash
   export AICEO_GATEWAY_PRIORITY=high
   ```

2. **Monitor Cache Hit Rate**:
   - Cache identical contexts to reduce API calls
   - Aim for >30% cache hit rate for common analyses

3. **Review Analysis History**:
   - Keep audit trail of all decisions
   - Export history periodically for backup

4. **Set Appropriate Cache TTL**:
   - 1 hour (default) for frequently changing contexts
   - 24 hours for stable decision contexts

5. **Use Fallback Provider**:
   - Always configure `AI_FALLBACK_PROVIDER`
   - Ensures resilience when gateway is down

## Next Steps

- Review [AI_PROVIDER_GUIDE.md](../AI_PROVIDER_GUIDE.md) for detailed provider configuration
- Review [AICEO_INTEGRATION_GUIDE.md](../AICEO_INTEGRATION_GUIDE.md) for integration details
- Explore other workflows:
  - [Direct Anthropic Workflow](./workflow-anthropic-direct.md)
  - [Multi-Provider Workflow](./workflow-multi-provider.md)
  - [Analysis Example](./analysis-example.md)
