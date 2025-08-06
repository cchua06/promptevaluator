#!/bin/bash

echo "🚀 Prompt Evaluator Redeployment Script"
echo "======================================="

# Configuration
VM_NAME="instance-20250806-051331"
VM_ZONE="us-central1-c"
PROJECT_DIR="~/promptevaluator"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📤 Uploading code to VM...${NC}"
gcloud compute scp --recurse . luis@${VM_NAME}:${PROJECT_DIR} --zone=${VM_ZONE}

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Code uploaded successfully${NC}"
else
    echo -e "${RED}❌ Code upload failed${NC}"
    exit 1
fi

echo -e "${YELLOW}🔧 Redeploying application...${NC}"
gcloud compute ssh luis@${VM_NAME} --zone=${VM_ZONE} --command="
cd ${PROJECT_DIR}
echo 'Stopping containers...'
docker-compose down
echo 'Building and starting containers...'
docker-compose up -d --build
echo 'Checking container status...'
docker-compose ps
echo 'Recent logs:'
docker-compose logs --tail=20
"

echo -e "${YELLOW}🌐 Restarting Cloudflare tunnel...${NC}"
gcloud compute ssh luis@${VM_NAME} --zone=${VM_ZONE} --command="
docker stop cloudflare-tunnel 2>/dev/null || true
docker rm cloudflare-tunnel 2>/dev/null || true
docker run -d --network host --name cloudflare-tunnel cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJhIjoiNjVlYmEzNGU0MWRiMDkyMTA0NjE4ODczMDc4MzJiZjEiLCJ0IjoiMTYxYjA4MjItYmMwMC00MmY5LWE5ZjMtZjljMTY2ODhlM2U5IiwicyI6Ik1XWTRNR0V4WWprdE9UZzBPQzAwWWpObExUZzRNemN0WXpnMU9ERTFNalpqTnpZeiJ9
"

echo -e "${GREEN}🎉 Redeployment complete!${NC}"
echo -e "${YELLOW}📊 Check your application at: https://prompt-checker.tm8.dev${NC}" 