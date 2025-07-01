#!/bin/bash

# AWS Deployment Script for Traxmate Bridge
# Usage: ./scripts/deploy-aws.sh [environment]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="traxmate-bridge"
REGION="us-east-1"
ENVIRONMENT=${1:-"production"}

echo -e "${GREEN}🚀 Starting AWS deployment for $APP_NAME...${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if EB CLI is installed
if ! command -v eb &> /dev/null; then
    echo -e "${RED}❌ EB CLI is not installed. Please install it first.${NC}"
    echo "Install with: pip install awsebcli"
    exit 1
fi

# Check if required environment variables are set
echo -e "${YELLOW}🔍 Checking environment variables...${NC}"

REQUIRED_VARS=("CISCO_SPACES_ACCESS_TOKEN" "TRAXMATE_API_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo -e "${YELLOW}Please set these variables before deploying.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All required environment variables are set.${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f ".ebextensions/01_environment.config" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory.${NC}"
    exit 1
fi

# Initialize EB application if not already done
if [ ! -d ".elasticbeanstalk" ]; then
    echo -e "${YELLOW}🔧 Initializing Elastic Beanstalk application...${NC}"
    eb init $APP_NAME --platform node.js --region $REGION
fi

# Check if environment exists
if ! eb status $ENVIRONMENT &> /dev/null; then
    echo -e "${YELLOW}🏗️ Creating new environment: $ENVIRONMENT${NC}"
    eb create $ENVIRONMENT --instance-type t3.small --elb-type application
else
    echo -e "${GREEN}✅ Environment $ENVIRONMENT already exists.${NC}"
fi

# Set environment variables
echo -e "${YELLOW}⚙️ Setting environment variables...${NC}"
eb setenv \
    NODE_ENV=production \
    CISCO_SPACES_ACCESS_TOKEN="$CISCO_SPACES_ACCESS_TOKEN" \
    TRAXMATE_API_KEY="$TRAXMATE_API_KEY" \
    CISCO_SPACES_FIREHOSE_URL="${CISCO_SPACES_FIREHOSE_URL:-https://api.cisco.com/spaces/firehose}" \
    TRAXMATE_INGESTION_URL="${TRAXMATE_INGESTION_URL:-https://api.traxmate.io/v1/data/ingest}" \
    LOG_LEVEL=info

# Deploy the application
echo -e "${YELLOW}📦 Deploying application...${NC}"
eb deploy $ENVIRONMENT

# Wait for deployment to complete
echo -e "${YELLOW}⏳ Waiting for deployment to complete...${NC}"
eb status $ENVIRONMENT

# Get the application URL
APP_URL=$(eb status $ENVIRONMENT | grep "CNAME" | awk '{print $2}')
if [ -n "$APP_URL" ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo -e "${GREEN}🌐 Application URL: http://$APP_URL${NC}"
    echo -e "${GREEN}🏥 Health Check: http://$APP_URL/health${NC}"
    echo -e "${GREEN}📊 Status: http://$APP_URL/status${NC}"
else
    echo -e "${RED}❌ Could not retrieve application URL.${NC}"
    exit 1
fi

# Test the health endpoint
echo -e "${YELLOW}🧪 Testing health endpoint...${NC}"
sleep 30  # Wait for application to fully start

if curl -f -s "http://$APP_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
else
    echo -e "${YELLOW}⚠️ Health check failed. The application might still be starting up.${NC}"
fi

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${YELLOW}📝 Monitor your application with: eb logs $ENVIRONMENT${NC}" 