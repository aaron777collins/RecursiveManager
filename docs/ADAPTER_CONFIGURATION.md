# Adapter Configuration

RecursiveManager uses adapters to execute AI agents. The adapter system is modular and supports multiple AI providers for agent execution.

## Overview

The adapter system determines how RecursiveManager communicates with AI models when executing agents (CEO, CTO, etc.). You can configure which provider to use, allowing you to:

- Route all agent execution through AICEO Gateway (centralized rate limiting)
- Connect directly to Anthropic's API
- Switch providers without code changes
- Configure custom endpoints

## Supported Adapters

### Claude Code Adapter

The Claude Code Adapter executes agents using the Claude CLI (Claude Code). This is the default and recommended adapter.

**Features**:
- Claude CLI integration (local execution)
- Provider routing (AICEO Gateway or direct Anthropic)
- Health checks before execution
- Debug logging support

## Configuration

### Environment Variables

Configure the adapter system using these environment variables:

#### Agent Execution Provider

**`AGENT_EXECUTION_PROVIDER`**
- **Description**: Which provider to use for agent execution
- **Options**: `aiceo-gateway`, `anthropic-direct`
- **Default**: `anthropic-direct`
- **Example**: `AGENT_EXECUTION_PROVIDER=aiceo-gateway`

#### Anthropic Configuration

**`ANTHROPIC_BASE_URL`**
- **Description**: Base URL for Anthropic API
- **Default**: `https://api.anthropic.com`
- **Example**: `ANTHROPIC_BASE_URL=https://api.anthropic.com`
- **Note**: When using AICEO Gateway, this remains the default Anthropic URL

**`ANTHROPIC_API_KEY`**
- **Description**: API key for Anthropic
- **Required**: Yes (for direct Anthropic access)
- **Example**: `ANTHROPIC_API_KEY=sk-ant-api03-...`
- **Security**: Never commit this to git! Store in `.env` file only

#### AICEO Gateway Configuration

**`AICEO_GATEWAY_API_KEY`**
- **Description**: Shared secret for AICEO Gateway authentication
- **Required**: Yes (when using `aiceo-gateway` provider)
- **Example**: `AICEO_GATEWAY_API_KEY=your-shared-secret`
- **Security**: Never commit this to git! Store in `.env` file only

## Provider Examples

### Example 1: Direct Anthropic (Default)

Connect directly to Anthropic's API without going through AICEO Gateway.

**.env Configuration**:
```bash
# Agent Execution Provider
AGENT_EXECUTION_PROVIDER=anthropic-direct

# Anthropic API Configuration
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-api-key-here
ANTHROPIC_BASE_URL=https://api.anthropic.com
```

**When to use**:
- Simple setup without AICEO Gateway
- Testing and development
- Single-project usage
- No need for centralized quota management

**Pros**:
- Simple configuration
- Direct API access
- No dependencies on AICEO Gateway

**Cons**:
- No centralized rate limiting
- No quota sharing across platforms
- Each project manages its own API usage

### Example 2: AICEO Gateway

Route all agent execution through AICEO's centralized Gateway for quota management and rate limiting.

**.env Configuration**:
```bash
# Agent Execution Provider
AGENT_EXECUTION_PROVIDER=aiceo-gateway

# AICEO Gateway API Key
AICEO_GATEWAY_API_KEY=your-shared-secret-here

# Anthropic Configuration (fallback)
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-api-key-here
ANTHROPIC_BASE_URL=https://api.anthropic.com
```

**When to use**:
- Multiple platforms sharing the same API quota (AICEO, RecursiveManager, Slack bots)
- Need centralized rate limiting (max 8 concurrent requests)
- Want to track all LLM API usage in one place
- Production deployments

**Pros**:
- Centralized quota management
- Rate limiting prevents API overload
- Usage tracking across all platforms
- Priority queue support

**Cons**:
- Requires AICEO Gateway to be running
- Additional network hop (slight latency)
- Dependency on gateway availability

**Note**: Currently, the Claude CLI adapter routes to Anthropic's API directly for both `aiceo-gateway` and `anthropic-direct` providers. Full AICEO Gateway proxy support for Claude CLI execution would require additional gateway endpoint implementation. However, multi-perspective AI analysis (8-agent system) does route through AICEO Gateway when configured.

### Example 3: Local Development

Recommended setup for local development and testing.

**.env Configuration**:
```bash
# Use direct Anthropic for simplicity
AGENT_EXECUTION_PROVIDER=anthropic-direct

# Anthropic API Configuration
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-api-key-here

# Enable debug logging
DEBUG=true
LOG_LEVEL=debug
```

### Example 4: Production Deployment

Recommended setup for production with AICEO Gateway.

**.env Configuration**:
```bash
# Use AICEO Gateway for quota management
AGENT_EXECUTION_PROVIDER=aiceo-gateway

# AICEO Gateway Configuration
AICEO_GATEWAY_API_KEY=your-production-shared-secret

# Anthropic Configuration (fallback)
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-api-key-here
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Production logging
LOG_LEVEL=info
```

## Health Checks

The adapter performs health checks before executing agents to ensure the provider is available.

### What Health Checks Verify

1. **Claude CLI Installation**: Verifies `claude --version` executes successfully
2. **Provider Reachability**: Confirms provider URL is accessible
3. **API Credentials**: Validates API key is configured and non-empty

### Health Check Behavior

- **Automatic**: Health check runs automatically before every agent execution
- **Failure**: If health check fails, agent execution returns an error
- **Logging**: Health check failures are logged with debug messages (when `DEBUG=true`)

### Manual Health Check

You can manually verify adapter health:

```typescript
import { ClaudeCodeAdapter } from '@recursivemanager/adapters';

const adapter = new ClaudeCodeAdapter({
  executable: 'claude',
  debug: true
});

const isHealthy = await adapter.healthCheck();
console.log('Adapter healthy:', isHealthy);
```

## Troubleshooting

### Error: "Claude CLI not found"

**Symptom**: Health check fails with "claude: command not found"

**Cause**: Claude CLI is not installed or not in PATH

**Solution**:
```bash
# Install Claude CLI (if not already installed)
npm install -g @anthropic-ai/claude-cli

# Or specify full path
export CLAUDE_CODE_PATH=/full/path/to/claude
```

### Error: "Invalid API key"

**Symptom**: Agent execution fails with authentication error

**Cause**: Missing or incorrect API key

**Solution**:
1. Verify `ANTHROPIC_API_KEY` is set in `.env` file
2. Ensure API key starts with `sk-ant-api03-`
3. Check for whitespace or quotes around the key
4. Verify the key is active in Anthropic Console

```bash
# Check if API key is set
echo $ANTHROPIC_API_KEY

# Should output: sk-ant-api03-... (not empty)
```

### Error: "AICEO Gateway unavailable"

**Symptom**: Health check fails when using `aiceo-gateway` provider

**Cause**: AICEO Gateway is not running or unreachable

**Solution**:
```bash
# Check if AICEO Gateway is running
curl -H "X-API-Key: your-api-key" http://localhost:4000/api/glm/status

# If not running, start AICEO Gateway
cd /path/to/AICEO
npm start

# Or switch to direct Anthropic as fallback
export AGENT_EXECUTION_PROVIDER=anthropic-direct
```

### Error: "Health check timed out"

**Symptom**: Health check takes too long and times out

**Cause**: Network issues or slow provider response

**Solution**:
1. Check network connectivity
2. Verify provider URL is correct
3. Try increasing timeout (if configurable)
4. Check firewall settings

```bash
# Test network connectivity
curl -v https://api.anthropic.com

# Should return HTTP 200 or 401 (not timeout)
```

### Provider not switching

**Symptom**: Changing `AGENT_EXECUTION_PROVIDER` doesn't switch providers

**Cause**: Environment variable not loaded or cached

**Solution**:
```bash
# Ensure .env file is in correct location
ls -la ~/.recursivemanager/.env

# Restart RecursiveManager to reload environment
recursivemanager stop
recursivemanager start

# Or reload environment in current shell
source ~/.recursivemanager/.env
```

### Debug Mode

Enable debug logging to see detailed adapter behavior:

```bash
# Enable debug mode
export DEBUG=true
export LOG_LEVEL=debug

# Run RecursiveManager
recursivemanager start

# Check logs
tail -f ~/.recursivemanager/logs/recursivemanager.log
```

Debug logs will show:
- Provider URL being used
- API key presence (first few characters only)
- Health check results
- Execution environment variables
- Error stack traces

## Best Practices

### Security

1. **Never commit API keys**: Always use `.env` files (gitignored)
2. **Rotate keys regularly**: Update API keys every 90 days
3. **Use environment variables**: Never hardcode credentials
4. **Restrict key permissions**: Use read-only keys when possible

### Performance

1. **Use AICEO Gateway in production**: Centralized rate limiting prevents quota exhaustion
2. **Monitor health checks**: Set up alerts for health check failures
3. **Cache aggressively**: Reduce redundant API calls
4. **Use appropriate timeouts**: Balance responsiveness with reliability

### Reliability

1. **Configure fallbacks**: Set `AI_FALLBACK_PROVIDER` for multi-perspective analysis
2. **Monitor quota usage**: Track API usage to avoid hitting limits
3. **Log all errors**: Enable error logging for troubleshooting
4. **Test health checks**: Verify health checks before deploying

## Integration with Multi-Perspective Analysis

The adapter configuration is separate from multi-perspective AI analysis configuration. Multi-perspective analysis uses the `AI_PROVIDER` environment variable, while agent execution uses `AGENT_EXECUTION_PROVIDER`.

**Multi-Perspective Analysis** (8-agent system):
- Uses `AI_PROVIDER` environment variable
- Configurable providers: `aiceo-gateway`, `anthropic-direct`, `openai-direct`, `custom`
- See [AI_PROVIDER_GUIDE.md](./AI_PROVIDER_GUIDE.md) for details

**Agent Execution** (CEO, CTO, etc.):
- Uses `AGENT_EXECUTION_PROVIDER` environment variable
- Configurable providers: `aiceo-gateway`, `anthropic-direct`
- Configured via this document

## Environment Variable Summary

Quick reference for all adapter-related environment variables:

```bash
# Agent Execution Provider
AGENT_EXECUTION_PROVIDER=anthropic-direct  # or aiceo-gateway

# Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
ANTHROPIC_BASE_URL=https://api.anthropic.com

# AICEO Gateway Configuration (if using aiceo-gateway)
AICEO_GATEWAY_API_KEY=your-shared-secret

# Claude CLI Configuration
CLAUDE_CODE_PATH=claude  # or /full/path/to/claude

# Debugging
DEBUG=false
LOG_LEVEL=info  # debug, info, warn, error
```

## See Also

- [AI Provider Guide](./AI_PROVIDER_GUIDE.md) - Configure multi-perspective AI analysis providers
- [AICEO Integration Guide](./AICEO_INTEGRATION_GUIDE.md) - Full AICEO Gateway integration
- [Configuration](./configuration.md) - General RecursiveManager configuration
- [Architecture Overview](./architecture/overview.md) - System architecture documentation
