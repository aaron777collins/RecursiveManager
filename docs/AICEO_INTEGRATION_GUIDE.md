# AICEO Integration Guide

This guide explains how to integrate RecursiveManager with the AICEO GLM Gateway for centralized, rate-limited AI provider access.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Setup](#setup)
4. [Testing Integration](#testing-integration)
5. [Quota Management](#quota-management)
6. [Monitoring](#monitoring)
7. [Cost Tracking](#cost-tracking)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Configuration](#advanced-configuration)

---

## Overview

### What is AICEO Gateway Integration?

RecursiveManager can integrate with the AICEO GLM Gateway to:
- **Centralize AI provider access** across multiple platforms (RecursiveManager, Slack bots, web apps, etc.)
- **Share quota limits** to avoid overloading LLM APIs (especially important for GLM's 10 concurrent request limit)
- **Track costs centrally** across all platforms and use cases
- **Enable failover** between multiple LLM providers (GLM, Anthropic, OpenAI)
- **Leverage priority queuing** to ensure critical requests are processed first

### Architecture

```
┌─────────────────────┐
│ RecursiveManager    │
│ (Multi-Perspective  │
│  Analysis System)   │
└──────────┬──────────┘
           │
           │ HTTP: POST /api/glm/submit
           │ Auth: X-API-Key header
           │
           ▼
┌─────────────────────────────────────┐
│ AICEO GLM Gateway                   │
│ - Rate limiting (8 concurrent)      │
│ - Priority queue (high/normal/low)  │
│ - Quota tracking (2400/5hr)         │
│ - Request logging & analytics       │
└──────────┬──────────────────────────┘
           │
           │ Routes to configured provider
           │
    ┌──────┴──────┬──────────┬──────────┐
    ▼             ▼          ▼          ▼
┌────────┐  ┌──────────┐  ┌────────┐  ┌────────┐
│  GLM   │  │ Anthropic│  │ OpenAI │  │ Custom │
│  API   │  │   API    │  │  API   │  │Endpoint│
└────────┘  └──────────┘  └────────┘  └────────┘
```

---

## Prerequisites

### 1. AICEO Gateway Running

The AICEO Gateway must be running and accessible from RecursiveManager.

**Check if AICEO is running:**
```bash
# Check if AICEO process is running
ps aux | grep -i aiceo

# Check if gateway endpoint is accessible
curl http://localhost:4000/api/glm/status
```

**Expected response:**
```json
{
  "status": "operational",
  "concurrentRequests": 0,
  "queueDepth": 0,
  "maxConcurrent": 8,
  "quotaInfo": {
    "used": 0,
    "total": 2400,
    "remaining": 2400
  }
}
```

**If AICEO is not running:**
```bash
# Navigate to AICEO directory
cd /home/ubuntu/repos/AICEO

# Start AICEO services
npm run dev
```

### 2. API Key Configured

The AICEO Gateway uses a shared secret (API key) for authentication. This key must be configured in both AICEO and RecursiveManager.

**In AICEO:**
1. Check AICEO's `.env` file for `GLM_GATEWAY_API_KEY`
2. If not set, generate a secure key:
   ```bash
   # Generate a random API key
   openssl rand -hex 32
   ```
3. Add to AICEO's `.env`:
   ```bash
   GLM_GATEWAY_API_KEY=your-generated-key-here
   ```
4. Restart AICEO to apply changes

**In RecursiveManager:**
- You'll configure this in the next section (Setup)

### 3. Network Connectivity

Ensure RecursiveManager can reach AICEO Gateway:

```bash
# Test connectivity
curl -X POST http://localhost:4000/api/glm/submit \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "provider": "glm",
    "model": "glm-4.7",
    "messages": [{"role": "user", "content": "Hello"}],
    "source": "test",
    "sourceId": "connectivity-test"
  }'
```

**If you get "Connection refused":**
- Check AICEO is running (`ps aux | grep aiceo`)
- Check AICEO is listening on port 4000 (`netstat -tlnp | grep 4000`)
- Check firewall rules if running on separate machines

---

## Setup

### Step 1: Configure Environment Variables

Create or update RecursiveManager's `.env` file:

```bash
cd /home/ubuntu/repos/RecursiveManager

# Copy example .env if it doesn't exist
cp .env.example .env

# Edit .env with your configuration
nano .env
```

**Minimal AICEO Gateway Configuration:**
```bash
# Multi-Perspective Analysis Provider
AI_PROVIDER=aiceo-gateway

# AICEO Gateway Configuration
AICEO_GATEWAY_URL=http://localhost:4000/api/glm/submit
AICEO_GATEWAY_API_KEY=your-aiceo-gateway-api-key-here
AICEO_GATEWAY_PROVIDER=glm
AICEO_GATEWAY_MODEL=glm-4.7
AICEO_GATEWAY_PRIORITY=high
```

**With Fallback Provider (Recommended):**
```bash
# Multi-Perspective Analysis Provider
AI_PROVIDER=aiceo-gateway
AI_FALLBACK_PROVIDER=glm-direct

# AICEO Gateway Configuration
AICEO_GATEWAY_URL=http://localhost:4000/api/glm/submit
AICEO_GATEWAY_API_KEY=your-aiceo-gateway-api-key-here
AICEO_GATEWAY_PROVIDER=glm
AICEO_GATEWAY_MODEL=glm-4.7
AICEO_GATEWAY_PRIORITY=high

# Direct GLM (Fallback if AICEO Gateway down)
GLM_API_KEY=your-glm-api-key-here
GLM_API_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
GLM_MODEL=glm-4.7
```

### Step 2: Configuration Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_PROVIDER` | Yes | `aiceo-gateway` | Primary provider for multi-perspective analysis |
| `AICEO_GATEWAY_URL` | Yes | `http://localhost:4000/api/glm/submit` | AICEO Gateway endpoint |
| `AICEO_GATEWAY_API_KEY` | Yes | - | Shared secret from AICEO's `.env` |
| `AICEO_GATEWAY_PROVIDER` | No | `glm` | Which LLM AICEO should route to (`glm`, `anthropic`, `openai`) |
| `AICEO_GATEWAY_MODEL` | No | `glm-4.7` | Model to request from provider |
| `AICEO_GATEWAY_PRIORITY` | No | `high` | Request priority (`high`, `normal`, `low`) |
| `AI_FALLBACK_PROVIDER` | No | - | Fallback if primary unavailable (e.g., `glm-direct`) |

### Step 3: Verify Configuration

```bash
# Check environment variables are loaded
cd /home/ubuntu/repos/RecursiveManager
node -e "console.log(process.env.AICEO_GATEWAY_URL)"
# Should output: http://localhost:4000/api/glm/submit

node -e "console.log(process.env.AICEO_GATEWAY_API_KEY)"
# Should output: your-aiceo-gateway-api-key-here
```

---

## Testing Integration

### Test 1: Health Check

Verify RecursiveManager can connect to AICEO Gateway:

```bash
cd /home/ubuntu/repos/RecursiveManager

# Build the project
npm run build

# Run a test analysis command (will fail if gateway unreachable)
npx recursive-manager analyze "Should we add caching?" --format json
```

**Expected behavior:**
- Command executes without connection errors
- Analysis results are returned from all 8 perspective agents
- Check AICEO logs for incoming requests

**If you see "AICEO Gateway unavailable":**
1. Verify AICEO is running: `ps aux | grep aiceo`
2. Verify gateway URL is correct: `echo $AICEO_GATEWAY_URL`
3. Verify API key matches: Compare AICEO's `GLM_GATEWAY_API_KEY` with RecursiveManager's `AICEO_GATEWAY_API_KEY`
4. Check AICEO logs for authentication errors

### Test 2: Single Analysis

Run a simple analysis to verify the full pipeline:

```bash
npx recursive-manager analyze "What are the risks of adding Redis caching?" --format text
```

**Expected output:**
```
┌─────────────────────────────────────────────────────────────┐
│ Multi-Perspective Analysis                                   │
│ Overall Confidence: 0.78                                     │
│ Execution Time: 3.2s                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────┬────────────┬────────────────────────────────┐
│ Perspective │ Confidence │ Summary                         │
├─────────────┼────────────┼────────────────────────────────┤
│ Security    │ 0.85       │ Ensures secure key storage...  │
│ Architecture│ 0.82       │ Adds complexity but...         │
│ Simplicity  │ 0.65       │ Increases system complexity... │
│ Financial   │ 0.75       │ Redis hosting costs...         │
│ Marketing   │ 0.80       │ Performance improvements...    │
│ UX          │ 0.70       │ Faster response times...       │
│ Growth      │ 0.85       │ Supports scaling...            │
│ Emotional   │ 0.60       │ Learning curve for team...     │
└─────────────┴────────────┴────────────────────────────────┘
```

**What to verify:**
- ✅ All 8 perspectives return results
- ✅ Execution time is reasonable (< 10 seconds for 8 parallel requests)
- ✅ Confidence scores are present (0.0-1.0 range)
- ✅ No error messages about gateway unavailability

### Test 3: Check AICEO Logs

Verify requests are reaching AICEO Gateway:

```bash
# In AICEO directory, check logs
cd /home/ubuntu/repos/AICEO
tail -f logs/api.log

# You should see entries like:
# [INFO] POST /api/glm/submit - source: recursive-manager, sourceId: security-agent-analysis
# [INFO] Request queued with priority: high, queue depth: 0
# [INFO] Request completed in 1234ms, wait time: 0ms
```

### Test 4: Verify Database Logging

Check that requests are being logged to AICEO's database:

```bash
cd /home/ubuntu/repos/AICEO

# Query recent requests from RecursiveManager
psql -U aiceo -d aiceo -c "
  SELECT
    source,
    source_id,
    provider,
    model,
    success,
    created_at
  FROM glm_gateway_requests
  WHERE source = 'recursive-manager'
  ORDER BY created_at DESC
  LIMIT 10;
"
```

**Expected output:**
```
      source       |       source_id        | provider |  model  | success |         created_at
-------------------+------------------------+----------+---------+---------+----------------------------
 recursive-manager | security-agent-analysis| glm      | glm-4.7 | t       | 2026-01-20 12:34:56.789
 recursive-manager | architecture-analysis  | glm      | glm-4.7 | t       | 2026-01-20 12:34:57.123
 ...
```

---

## Quota Management

### Understanding Rate Limits

The AICEO Gateway enforces rate limits to protect the GLM API from overload:

| Limit Type | Value | Description |
|------------|-------|-------------|
| **Concurrent Requests** | 8 | Maximum simultaneous requests to LLM API (safety buffer from GLM's 10 limit) |
| **Quota Window** | 5 hours | Time window for quota tracking |
| **Quota Total** | 2400 | Maximum requests per 5-hour window |

### Priority Queue Behavior

The gateway uses a 3-level priority queue:

| Priority | Use Case | Queue Behavior |
|----------|----------|----------------|
| **high** | Critical analysis, production features | Processed first, bypasses normal queue |
| **normal** | Standard analysis, development work | Processed in order, after high priority |
| **low** | Background tasks, non-urgent analysis | Processed last, when queue is empty |

**RecursiveManager's multi-perspective analysis uses `high` priority by default** (configurable via `AICEO_GATEWAY_PRIORITY`).

### Checking Current Quota Usage

**Via AICEO Gateway API:**
```bash
curl http://localhost:4000/api/glm/usage
```

**Expected response:**
```json
{
  "used": 245,
  "total": 2400,
  "remaining": 2155,
  "windowStart": "2026-01-20T08:00:00.000Z",
  "windowEnd": "2026-01-20T13:00:00.000Z",
  "percentUsed": 10.2
}
```

**Via Database Query:**
```sql
-- Check quota usage in current window
SELECT
  COUNT(*) as requests_used,
  2400 - COUNT(*) as requests_remaining,
  ROUND((COUNT(*) * 100.0 / 2400), 2) as percent_used
FROM glm_gateway_requests
WHERE created_at >= NOW() - INTERVAL '5 hours';
```

### What Happens When Quota is Exceeded?

When the quota is exceeded, the gateway will:
1. **Return 429 status code** (Too Many Requests)
2. **Include retry-after header** with seconds until quota resets
3. **Log the rejection** for monitoring

**RecursiveManager's behavior:**
- Multi-perspective analysis will fail with error message
- If `AI_FALLBACK_PROVIDER` is configured, it will automatically switch to fallback
- Error will include helpful message about quota limits

**How to handle quota exhaustion:**
- Configure `AI_FALLBACK_PROVIDER` to automatically failover
- Reduce `AICEO_GATEWAY_PRIORITY` to `normal` or `low` for non-critical analysis
- Wait for quota window to reset (5 hours from first request)
- Coordinate with other platforms using AICEO Gateway

### Queue Depth Monitoring

Check how many requests are waiting in queue:

```bash
curl http://localhost:4000/api/glm/status
```

**Response includes:**
```json
{
  "concurrentRequests": 6,
  "queueDepth": 12,
  "maxConcurrent": 8
}
```

**Interpretation:**
- `concurrentRequests: 6` → 6 requests currently executing
- `queueDepth: 12` → 12 requests waiting in queue
- `maxConcurrent: 8` → Maximum 8 requests can execute simultaneously

**High queue depth (> 20) indicates:**
- Heavy load across all platforms using AICEO Gateway
- Consider reducing RecursiveManager's analysis frequency
- Consider lowering priority from `high` to `normal`
- Check if other platforms are misconfigured (infinite loops, etc.)

---

## Monitoring

### Real-Time Monitoring

**1. Gateway Status Dashboard**

AICEO provides a web dashboard for monitoring:

```bash
# Open AICEO dashboard in browser
open http://localhost:4000/dashboard/gateway
```

**Dashboard shows:**
- Current concurrent requests
- Queue depth by priority
- Quota usage (used/remaining/percentage)
- Recent request history
- Error rate and success rate
- Average wait time
- Provider distribution (GLM vs Anthropic vs OpenAI)

**2. Logs Monitoring**

Tail AICEO logs for real-time visibility:

```bash
cd /home/ubuntu/repos/AICEO

# Follow all gateway activity
tail -f logs/gateway.log

# Filter for RecursiveManager requests only
tail -f logs/gateway.log | grep "recursive-manager"

# Monitor errors only
tail -f logs/gateway.log | grep ERROR
```

### Historical Analytics

**1. Request Analytics Query**

```sql
-- Request volume by source (last 24 hours)
SELECT
  source,
  COUNT(*) as total_requests,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed,
  ROUND(AVG(wait_time_ms), 2) as avg_wait_ms,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens
FROM glm_gateway_requests
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY source
ORDER BY total_requests DESC;
```

**2. Provider Usage Analysis**

```sql
-- Provider usage by source
SELECT
  source,
  provider,
  COUNT(*) as requests,
  ROUND(AVG(wait_time_ms), 2) as avg_wait_ms
FROM glm_gateway_requests
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY source, provider
ORDER BY source, requests DESC;
```

**3. Peak Usage Times**

```sql
-- Requests per hour (last 7 days)
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as requests,
  AVG(wait_time_ms) as avg_wait_ms
FROM glm_gateway_requests
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour DESC;
```

### Alerting

**Set up alerts for:**
- Quota usage > 90%
- Queue depth > 50
- Error rate > 10%
- Average wait time > 10 seconds

**Example: Slack alert for high quota usage**

```bash
# Check quota and alert if > 90%
cd /home/ubuntu/repos/AICEO

# Create monitoring script
cat > scripts/check-quota.sh << 'EOF'
#!/bin/bash
USAGE=$(curl -s http://localhost:4000/api/glm/usage | jq -r '.percentUsed')
if (( $(echo "$USAGE > 90" | bc -l) )); then
  ./scripts/slack-update.sh ":warning: AICEO Gateway quota at ${USAGE}% - ${2400} limit approaching"
fi
EOF

chmod +x scripts/check-quota.sh

# Run via cron every 5 minutes
crontab -e
# Add: */5 * * * * /home/ubuntu/repos/AICEO/scripts/check-quota.sh
```

---

## Cost Tracking

### Token Usage by Source

AICEO tracks token usage for every request, enabling cost analysis by source platform:

```sql
-- Token usage by source (last 30 days)
SELECT
  source,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(input_tokens + output_tokens) as total_tokens,
  COUNT(*) as requests,
  ROUND(AVG(input_tokens), 2) as avg_input_tokens,
  ROUND(AVG(output_tokens), 2) as avg_output_tokens
FROM glm_gateway_requests
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY source
ORDER BY total_tokens DESC;
```

**Example output:**
```
      source       | total_input_tokens | total_output_tokens | total_tokens | requests | avg_input_tokens | avg_output_tokens
-------------------+--------------------+---------------------+--------------+----------+------------------+-------------------
 recursive-manager | 1,250,000          | 3,750,000           | 5,000,000    | 2,450    | 510.20           | 1,530.61
 slack-bot         | 450,000            | 850,000             | 1,300,000    | 1,200    | 375.00           | 708.33
 aiceo             | 300,000            | 600,000             | 900,000      | 800      | 375.00           | 750.00
```

### Cost Calculation

**GLM Pricing (as of 2026-01-20):**
- Input: ¥0.001 per 1,000 tokens
- Output: ¥0.001 per 1,000 tokens

**SQL query with cost calculation:**

```sql
-- Cost by source (last 30 days, in CNY)
SELECT
  source,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens,
  ROUND((SUM(input_tokens) * 0.001 / 1000), 2) as input_cost_cny,
  ROUND((SUM(output_tokens) * 0.001 / 1000), 2) as output_cost_cny,
  ROUND((SUM(input_tokens + output_tokens) * 0.001 / 1000), 2) as total_cost_cny
FROM glm_gateway_requests
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY source
ORDER BY total_cost_cny DESC;
```

### Cost Optimization Strategies

**1. Use Analysis Caching**

RecursiveManager's multi-perspective analysis includes built-in caching:
- Identical analysis contexts return cached results (no API calls)
- Default TTL: 1 hour (configurable via `ANALYSIS_CACHE_TTL_MS`)
- Cache hit rate tracked in analysis statistics

**Check cache effectiveness:**
```typescript
// In RecursiveManager code
const orchestrator = new ExecutionOrchestrator(/* ... */);
const result = await orchestrator.analyzeDecision("Should we add caching?");

// Get cache statistics
const stats = orchestrator.getCacheStats();
console.log(`Cache hit rate: ${stats.hitRate}%`);
console.log(`API calls saved: ${stats.hits}`);
```

**2. Adjust Priority for Non-Critical Analysis**

Lower priority to `normal` or `low` for background analysis:

```bash
# In RecursiveManager's .env
AICEO_GATEWAY_PRIORITY=normal  # Instead of high
```

**3. Reduce Analysis Frequency**

If running automated analysis, reduce frequency:
- Analyze only on significant changes (not every commit)
- Batch multiple decisions into single analysis
- Use analysis history to avoid re-analyzing identical contexts

**4. Monitor Token Usage Per Agent**

Some perspective agents may use more tokens than others. Monitor and optimize prompts:

```sql
-- Average tokens by source_id (agent type)
SELECT
  source_id,
  COUNT(*) as requests,
  ROUND(AVG(input_tokens), 2) as avg_input,
  ROUND(AVG(output_tokens), 2) as avg_output
FROM glm_gateway_requests
WHERE source = 'recursive-manager'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY source_id
ORDER BY avg_output DESC;
```

**If certain agents are expensive:**
- Review agent prompts for verbosity
- Consider reducing maxTokens for that agent
- Evaluate if that perspective is needed for every analysis

---

## Troubleshooting

### Issue 1: "AICEO Gateway unavailable"

**Symptoms:**
```
ERROR: AICEO Gateway unavailable at http://localhost:4000/api/glm/submit
```

**Solutions:**
1. **Check AICEO is running:**
   ```bash
   ps aux | grep aiceo
   # If not running:
   cd /home/ubuntu/repos/AICEO && npm run dev
   ```

2. **Check gateway URL:**
   ```bash
   echo $AICEO_GATEWAY_URL
   # Should be: http://localhost:4000/api/glm/submit

   # Test connectivity:
   curl http://localhost:4000/api/glm/status
   ```

3. **Check firewall rules (if on separate machines):**
   ```bash
   # On AICEO server:
   sudo ufw allow 4000/tcp

   # On RecursiveManager server:
   curl http://<aiceo-server-ip>:4000/api/glm/status
   ```

4. **Configure fallback provider:**
   ```bash
   # In RecursiveManager's .env
   AI_FALLBACK_PROVIDER=glm-direct
   GLM_API_KEY=your-glm-api-key
   ```

### Issue 2: "Invalid API key"

**Symptoms:**
```
ERROR: AICEO Gateway error: Invalid API key
```

**Solutions:**
1. **Verify API key matches:**
   ```bash
   # On AICEO server:
   cd /home/ubuntu/repos/AICEO
   grep GLM_GATEWAY_API_KEY .env

   # On RecursiveManager server:
   cd /home/ubuntu/repos/RecursiveManager
   grep AICEO_GATEWAY_API_KEY .env

   # Keys must match exactly
   ```

2. **Check for whitespace:**
   ```bash
   # Remove trailing whitespace
   export AICEO_GATEWAY_API_KEY=$(echo "$AICEO_GATEWAY_API_KEY" | xargs)
   ```

3. **Regenerate and update:**
   ```bash
   # Generate new key
   openssl rand -hex 32

   # Update both AICEO and RecursiveManager .env files
   # Restart both services
   ```

### Issue 3: "429 Too Many Requests"

**Symptoms:**
```
ERROR: AICEO Gateway quota exceeded (429)
Retry after: 3600 seconds
```

**Solutions:**
1. **Check quota usage:**
   ```bash
   curl http://localhost:4000/api/glm/usage
   ```

2. **Wait for quota reset:**
   - Quota resets 5 hours after first request in window
   - Check `windowEnd` in usage response

3. **Configure fallback provider:**
   ```bash
   # Automatically failover when quota exceeded
   AI_FALLBACK_PROVIDER=anthropic-direct
   ANTHROPIC_API_KEY=your-anthropic-key
   ```

4. **Coordinate with other platforms:**
   - Check which platforms are consuming quota
   - Adjust priorities or reduce frequency

### Issue 4: High Wait Times

**Symptoms:**
```
Analysis completed in 45 seconds (wait time: 40s)
```

**Solutions:**
1. **Check queue depth:**
   ```bash
   curl http://localhost:4000/api/glm/status
   # If queueDepth > 20, high load
   ```

2. **Lower priority for non-critical analysis:**
   ```bash
   AICEO_GATEWAY_PRIORITY=normal  # Or low
   ```

3. **Check for infinite loops:**
   ```sql
   -- Find sources with abnormal request rates
   SELECT
     source,
     COUNT(*) as requests_last_hour
   FROM glm_gateway_requests
   WHERE created_at >= NOW() - INTERVAL '1 hour'
   GROUP BY source
   ORDER BY requests_last_hour DESC;
   ```

4. **Increase concurrent limit (cautiously):**
   ```bash
   # In AICEO's .env (only if GLM API supports it)
   MAX_CONCURRENT_REQUESTS=10  # Increase from 8
   ```

### Issue 5: Analysis Returns Empty Results

**Symptoms:**
```
Multi-Perspective Analysis completed but all perspectives empty
```

**Solutions:**
1. **Check AICEO logs for LLM API errors:**
   ```bash
   cd /home/ubuntu/repos/AICEO
   tail -f logs/gateway.log | grep ERROR
   ```

2. **Verify LLM API credentials in AICEO:**
   ```bash
   # Check GLM API key is configured
   grep GLM_API_KEY /home/ubuntu/repos/AICEO/.env

   # Test GLM API directly
   curl https://open.bigmodel.cn/api/paas/v4/chat/completions \
     -H "Authorization: Bearer $GLM_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"glm-4.7","messages":[{"role":"user","content":"test"}]}'
   ```

3. **Check AICEO provider configuration:**
   ```bash
   # Verify which provider AICEO is routing to
   curl http://localhost:4000/api/glm/status
   ```

---

## Advanced Configuration

### Multi-Region Setup

If AICEO and RecursiveManager are in different regions:

**1. Update AICEO_GATEWAY_URL with full domain:**
```bash
AICEO_GATEWAY_URL=https://aiceo.yourdomain.com/api/glm/submit
```

**2. Use HTTPS (strongly recommended):**
```bash
# Set up SSL certificate on AICEO server
# Update URL to use https://
```

**3. Consider latency:**
- Multi-perspective analysis makes 8 parallel requests
- Network latency will add to total execution time
- Consider running AICEO and RecursiveManager in same region

### Load Balancing Multiple AICEO Instances

For high availability, run multiple AICEO Gateway instances:

**1. Set up load balancer (nginx, HAProxy, AWS ALB):**
```nginx
upstream aiceo_gateway {
  server aiceo1.internal:4000;
  server aiceo2.internal:4000;
  server aiceo3.internal:4000;
}

server {
  listen 80;
  server_name aiceo.yourdomain.com;

  location /api/glm/ {
    proxy_pass http://aiceo_gateway;
    proxy_set_header X-API-Key $http_x_api_key;
  }
}
```

**2. Update RecursiveManager configuration:**
```bash
AICEO_GATEWAY_URL=http://aiceo.yourdomain.com/api/glm/submit
```

**3. Share quota across instances:**
- Use shared Redis for quota tracking
- Configure all AICEO instances to use same Redis instance

### Custom Provider in AICEO

AICEO can route to custom LLM endpoints. Configure in AICEO:

```bash
# In AICEO's .env
CUSTOM_PROVIDER_URL=https://your-llm-endpoint.com/api/chat
CUSTOM_PROVIDER_API_KEY=your-custom-key
CUSTOM_PROVIDER_FORMAT=openai  # or anthropic, or custom
```

Then in RecursiveManager:
```bash
AICEO_GATEWAY_PROVIDER=custom
```

---

## Summary

**Quick Start Checklist:**
- [ ] AICEO Gateway is running
- [ ] AICEO_GATEWAY_API_KEY is set and matches AICEO's GLM_GATEWAY_API_KEY
- [ ] RecursiveManager's .env is configured with AICEO Gateway settings
- [ ] Test analysis command runs successfully
- [ ] Requests appear in AICEO logs and database
- [ ] Fallback provider is configured (optional but recommended)

**Best Practices:**
- ✅ Always configure `AI_FALLBACK_PROVIDER` for resilience
- ✅ Use `high` priority sparingly (only for critical analysis)
- ✅ Monitor quota usage regularly
- ✅ Enable analysis caching to reduce API calls
- ✅ Check cache hit rates to verify effectiveness
- ✅ Set up alerting for quota > 90% and high queue depth
- ✅ Review cost tracking monthly to optimize token usage

**Need Help?**
- Check [Troubleshooting](#troubleshooting) section above
- Review AICEO logs: `/home/ubuntu/repos/AICEO/logs/gateway.log`
- Query request database for analytics
- Review [AI_PROVIDER_GUIDE.md](./AI_PROVIDER_GUIDE.md) for provider-specific details

---

**Related Documentation:**
- [AI Provider Guide](./AI_PROVIDER_GUIDE.md) - Complete guide to AI provider system
- [AICEO GLM Gateway API](../../../AICEO/docs/GLM_GATEWAY_API.md) - API reference
- [RecursiveManager Configuration](./CONFIGURATION.md) - Full configuration reference
