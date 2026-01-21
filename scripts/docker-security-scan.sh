#!/bin/bash
# Security scanning script for Docker images
# Uses Trivy to scan for vulnerabilities in the Docker image

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

IMAGE_NAME="${1:-recursivemanager:latest}"
SEVERITY="${2:-HIGH,CRITICAL}"
EXIT_ON_ERROR="${3:-false}"

echo -e "${GREEN}Starting security scan for image: ${IMAGE_NAME}${NC}"
echo -e "${YELLOW}Severity levels: ${SEVERITY}${NC}"
echo ""

# Check if Trivy is installed
if ! command -v trivy &> /dev/null; then
    echo -e "${YELLOW}Trivy not found. Installing Trivy...${NC}"

    # Detect OS and install Trivy
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install aquasecurity/trivy/trivy
    else
        echo -e "${RED}Unsupported OS. Please install Trivy manually: https://aquasecurity.github.io/trivy/latest/getting-started/installation/${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}Running Trivy scan...${NC}"
echo ""

# Run Trivy scan
TRIVY_EXIT_CODE=0
trivy image \
    --severity "${SEVERITY}" \
    --no-progress \
    --format table \
    "${IMAGE_NAME}" || TRIVY_EXIT_CODE=$?

echo ""
echo -e "${GREEN}Scan complete!${NC}"

# Check if we should exit on errors
if [ "${EXIT_ON_ERROR}" = "true" ] && [ ${TRIVY_EXIT_CODE} -ne 0 ]; then
    echo -e "${RED}Security vulnerabilities found! Exiting with error.${NC}"
    exit ${TRIVY_EXIT_CODE}
fi

# Generate JSON report for CI/CD
if [ "${CI}" = "true" ]; then
    echo -e "${YELLOW}Generating JSON report for CI/CD...${NC}"
    trivy image \
        --severity "${SEVERITY}" \
        --format json \
        --output trivy-report.json \
        "${IMAGE_NAME}"
    echo -e "${GREEN}Report saved to trivy-report.json${NC}"
fi

exit 0
