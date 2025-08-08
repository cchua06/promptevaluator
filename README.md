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
   - Secret Manager enabled

2. **Required Credentials:**
   - GCP Service Account key (JSON file) - stored in GitHub Secrets
   - All other secrets stored in Google Cloud Secret Manager

### Security Considerations ⚠️

#### **Firewall Configuration**
- **Current**: SSH access open to 0.0.0.0/0 (insecure/bad)
- **Recommendation**: Restrict to specific IP ranges
```bash
# Update firewall rules to restrict SSH access
gcloud compute firewall-rules update prompt-evaluator-vpc-allow-app \
    --source-ranges=YOUR_OFFICE_IP/32,YOUR_HOME_IP/32
```

#### **Service Account Permissions**
The deployment uses a service account with minimal required roles:
- **Secret Manager Secret Accessor** - Access secrets
- **Cloud SQL Client** - Database connection
- **Compute Instance Admin (v1)** - VM operations
- **Service Account User** - SSH access

### Automated Deployment Setup

#### 1. **GitHub Repository Configuration**
```bash
# Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):
GCP_SA_KEY=your_service_account_json_key
```

#### 2. **Google Cloud Secret Manager Setup**
```bash
# Create secrets in Secret Manager
gcloud secrets create GCP_PROJECT_ID --replication-policy="automatic"
gcloud secrets create VM_INSTANCE_NAME --replication-policy="automatic"
gcloud secrets create VM_ZONE --replication-policy="automatic"
gcloud secrets create OPENAI_API_KEY --replication-policy="automatic"
gcloud secrets create CLOUDSQL_PASSWORD --replication-policy="automatic"
gcloud secrets create CLOUDFLARE_TUNNEL_TOKEN --replication-policy="automatic"
```

#### 3. **VM Setup (One-time)**
```bash
# Create VM instance (if not exists)
gcloud compute instances create instance-20250806-051331 \
    --zone=us-central1-c \
    --machine-type=e2-medium \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --tags=http-server,https-server \
    --boot-disk-size=20GB

# Enable OS Login for secure SSH access
gcloud compute instances add-metadata instance-20250806-051331 \
    --zone=us-central1-c \
    --metadata enable-oslogin=TRUE
```

#### 4. **Firewall Rules**
```bash
# Allow HTTP traffic for webapp
gcloud compute firewall-rules create prompt-evaluator-vpc-allow-app \
    --network=prompt-evaluator-vpc \
    --allow=tcp:3000 \
    --source-ranges=0.0.0.0/0 \
    --description="Allow access to prompt evaluator webapp"

# ⚠️ SECURITY: Restrict SSH access to specific IPs
gcloud compute firewall-rules update prompt-evaluator-vpc-allow-app \
    --source-ranges=YOUR_OFFICE_IP/32,YOUR_HOME_IP/32
```

#### 5. **Database Setup (One-time)**
```bash
# Install PostgreSQL client
sudo apt-get update && sudo apt-get install -y postgresql-client

# Create database
psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE \"prompt-evaluator-db\";"

# Run schema
psql -h localhost -p 5432 -U postgres -d "prompt-evaluator-db" -f create_schema.sql
```

#### 6. **Install Docker (One-time)**
```bash
# Install Docker
sudo apt-get install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
newgrp docker
```

#### 7. **Start Cloud SQL Proxy (Manual - Required)**
In a separate terminal session:
```bash
# SSH into VM
gcloud compute ssh instance-20250806-051331 --zone=us-central1-c

# Start Cloud SQL proxy
cloud-sql-proxy --private-ip --credentials-file=promptevaluator-468202-6f26e405c4.json promptevaluator-468202:us-central1:prompt-evaluator-prod
```

### Automated Deployment

#### **Deploy via GitHub Actions**
1. Go to your GitHub repository
2. Navigate to "Actions" tab
3. Select "Deploy to GCP VM" workflow
4. Click "Run workflow" > "Run workflow"

#### **What the Automated Deployment Does:**
1. ✅ **Authenticates** with Google Cloud using service account
2. ✅ **Uploads code** to VM (excludes .git and node_modules)
3. ✅ **Creates .env file** with secrets from Secret Manager
4. ✅ **Stops existing containers** with `docker-compose down`
5. ✅ **Builds and starts containers** with `docker-compose up -d --build`
6. ✅ **Restarts Cloudflare tunnel** for external access
7. ✅ **Health checks** the deployment

### Manual Redeployment

#### **Option 1: Using Redeploy Script**
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
- Verify `.env` file has correct database credentials (auto-generated by deployment)
- Check if database exists: `psql -h localhost -p 5432 -U postgres -d "prompt-evaluator-db" -c "\dt"`

#### **Network Issues**
- Verify firewall rules allow port 3000
- Check if containers are using host networking: `docker inspect prompt-evaluator-app | grep NetworkMode`

#### **Cloudflare Tunnel Issues**
- Ensure tunnel is running with host networking: `docker run --network host ...`
- Check tunnel logs: `docker logs cloudflare-tunnel`

#### **Deployment Issues**
- Check GitHub Actions logs for detailed error messages
- Verify all secrets exist in Secret Manager
- Ensure service account has required IAM roles

### Deployment Architecture

- **Database**: PostgreSQL (Cloud SQL)
- **Container**: Docker with host networking
- **Proxy**: Cloud SQL proxy for database connection
- **Tunnel**: Cloudflare tunnel for external access
- **Infrastructure**: GCP VM with VPC networking
- **CI/CD**: GitHub Actions with automated deployment
- **Secrets**: Google Cloud Secret Manager
- **Security**: Service account with minimal IAM roles