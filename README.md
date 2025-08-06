# Custom GPT Prompt Evaluator

by: Cedric Chua (cedric.chua@thinkingmachin.es)

## Description

A web app that can be used to provide custom feedback to evaluate user prompts to a LLM. The frontend is build on React, and the backend uses NodeJS. The service is being hosted as a POC on Render (https://promptevaluator-umx3.onrender.com/). It has a participant view and an admin view to see collated user prompts.

## Production Deployment (GCP VM)

### Prerequisites

1. **Google Cloud Platform Setup:**
   - GCP Project with Compute Engine API enabled
   - VM instance running Ubuntu 22.04 LTS
   - Cloud SQL instance (PostgreSQL)
   - VPC network with firewall rules

2. **Required Credentials:**
   - GCP Service Account key (JSON file)
   - Cloud SQL password
   - OpenAI API key
   - Cloudflare tunnel token

### Deployment Steps

#### 1. **VM Setup**
```bash
# Create VM instance (if not exists)
gcloud compute instances create instance-20250806-051331 \
    --zone=us-central1-c \
    --machine-type=e2-medium \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --tags=http-server,https-server \
    --boot-disk-size=20GB
```

#### 2. **Firewall Rules**
```bash
# Allow HTTP traffic for webapp
gcloud compute firewall-rules create prompt-evaluator-vpc-allow-app \
    --network=prompt-evaluator-vpc \
    --allow=tcp:3000 \
    --source-ranges=0.0.0.0/0 \
    --description="Allow access to prompt evaluator webapp"
```

#### 3. **Upload Application Code**
```bash
# Upload code to VM
gcloud compute scp --recurse . luis@instance-20250806-051331:~/promptevaluator --zone=us-central1-c
```

#### 4. **SSH into VM and Setup**
```bash
# SSH into VM
gcloud compute ssh instance-20250806-051331 --zone=us-central1-c

# Navigate to project
cd ~/promptevaluator

# Copy environment template
cp env.example .env

# Edit environment variables
nano .env
```

#### 5. **Environment Configuration**
Create `.env` file with:
```
OPENAI_API_KEY=your_openai_api_key_here
PGHOST=localhost
PGUSER=postgres
PGPASSWORD=your_cloudsql_password_here
PGDATABASE=prompt-evaluator-db
PGPORT=5432
```

#### 6. **Database Setup**
```bash
# Install PostgreSQL client
sudo apt-get update && sudo apt-get install -y postgresql-client

# Create database
psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE \"prompt-evaluator-db\";"

# Run schema
psql -h localhost -p 5432 -U postgres -d "prompt-evaluator-db" -f create_schema.sql
```

#### 7. **Install Docker and Deploy**
```bash
# Install Docker
sudo apt-get install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
newgrp docker

# Deploy application
chmod +x deploy.sh
./deploy.sh
```

#### 8. **Start Cloud SQL Proxy**
In a separate terminal session:
```bash
# SSH into VM
gcloud compute ssh instance-20250806-051331 --zone=us-central1-c

# Start Cloud SQL proxy
cloud-sql-proxy --private-ip --credentials-file=promptevaluator-468202-6f26e405c4.json promptevaluator-468202:us-central1:prompt-evaluator-prod
```

#### 9. **Setup Cloudflare Tunnel**
```bash
# Start Cloudflare tunnel with host networking
docker run -d --network host --name cloudflare-tunnel cloudflare/cloudflared:latest tunnel --no-autoupdate run --token YOUR_TUNNEL_TOKEN
```

### Redeployment

#### **Option 1: Using Redeploy Script (Recommended)**
```bash
# From your local machine
./redeploy.sh
```

#### **Option 2: Manual Redeployment**
```bash
# Upload updated code
gcloud compute scp --recurse . luis@instance-20250806-051331:~/promptevaluator --zone=us-central1-c

# SSH and redeploy
gcloud compute ssh instance-20250806-051331 --zone=us-central1-c
cd ~/promptevaluator
docker-compose down
docker-compose up -d --build
```

### Access Your Application

- **Local**: `http://localhost:3000`
- **Cloudflare**: `https://prompt-checker.tm8.dev`

### Docker Commands

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Stop application
docker-compose down

# Rebuild after changes
docker-compose up -d --build

# Check Cloudflare tunnel
docker logs cloudflare-tunnel
```

### Troubleshooting

#### **Database Connection Issues**
- Ensure Cloud SQL proxy is running in a separate terminal
- Verify `.env` file has correct database credentials
- Check if database exists: `psql -h localhost -p 5432 -U postgres -d "prompt-evaluator-db" -c "\dt"`

#### **Network Issues**
- Verify firewall rules allow port 3000
- Check if containers are using host networking: `docker inspect prompt-evaluator-app | grep NetworkMode`

#### **Cloudflare Tunnel Issues**
- Ensure tunnel is running with host networking: `docker run --network host ...`
- Check tunnel logs: `docker logs cloudflare-tunnel`

### Architecture

- **Frontend**: HTML/CSS/JavaScript (served by Express)
- **Backend**: Node.js with Express
- **Database**: PostgreSQL (Cloud SQL)
- **Container**: Docker with host networking
- **Proxy**: Cloud SQL proxy for database connection
- **Tunnel**: Cloudflare tunnel for external access
- **Infrastructure**: GCP VM with VPC networking