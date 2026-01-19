#!/bin/bash
# Script to replace all saveAgentConfig calls with the helper function

FILE="packages/core/src/execution/__tests__/executeContinuous.integration.test.ts"

# Find and replace pattern for most agent configs (Software Engineer)
sed -i 's/await saveAgentConfig(agentId, {$/await saveAgentConfig(agentId, createValidAgentConfig(agentId, '\''Software Engineer'\''));/g' "$FILE"

# Remove multiline config blocks (this is a simplified approach - we'll handle manually if needed)
echo "Manual fixes still needed for complex multi-line configs"
