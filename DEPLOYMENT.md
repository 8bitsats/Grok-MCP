# GrokArt MCP Server Deployment Guide

This guide explains how to deploy the GrokArt MCP server in different environments.

## Prerequisites

- Docker and Docker Compose installed on your development machine
- A valid xAI API key set in the `.env` file
- For Kubernetes deployment: `kubectl` installed and configured

## Deployment Options

### 1. Local Development

For local development and testing:

```bash
# Build and run locally
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop the server
docker-compose down
```

### 2. Automated Deployment

We've provided a deployment script (`deploy.sh`) that simplifies deployment to various environments:

```bash
# Make the script executable (if not already)
chmod +x deploy.sh

# See available commands
./deploy.sh help
```

#### 2.1 Build Locally

Build the Docker image on your local machine:

```bash
./deploy.sh build
```

#### 2.2 Container Registry Deployment

Build and push the image to a container registry:

1. Edit `deploy.sh` to set your registry information:
   ```bash
   REGISTRY="your-registry.com"  # e.g., docker.io/username or gcr.io/project-id
   ```

2. Build and push:
   ```bash
   ./deploy.sh push
   ```

#### 2.3 SSH Deployment

Deploy to a remote server via SSH:

1. Edit `deploy.sh` to set your server information:
   ```bash
   REMOTE_HOST="your-server.com"
   REMOTE_USER="username"
   DEPLOY_PATH="/path/to/deployment"
   ```

2. Deploy:
   ```bash
   ./deploy.sh deploy-ssh
   ```

#### 2.4 Kubernetes Deployment

Deploy to a Kubernetes cluster:

1. Before deploying, review the Kubernetes manifests in the `k8s/` directory:
   - `deployment.yaml`: Defines the Deployment resource
   - `service.yaml`: Defines the Service resource (optional)
   - `secret.yaml`: Contains the base64-encoded API key

2. Deploy:
   ```bash
   ./deploy.sh deploy-k8s
   ```

   This will:
   - Build and push the Docker image to your registry
   - Create or update the Kubernetes manifests
   - Apply the manifests to your cluster

3. Manual Kubernetes deployment:
   ```bash
   # Encode your API key
   API_KEY_B64=$(echo -n "your-api-key" | base64)
   
   # Update the secret.yaml file
   # Then apply the manifests
   kubectl apply -f k8s/secret.yaml
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/service.yaml
   ```

## Monitoring and Troubleshooting

### Docker Compose

```bash
# View logs
docker-compose logs -f

# Check running containers
docker ps

# Restart service
docker-compose restart
```

### Kubernetes

```bash
# Get pods
kubectl get pods -l app=grokart

# View logs
kubectl logs -l app=grokart

# Describe deployment
kubectl describe deployment grokart

# Restart deployment
kubectl rollout restart deployment grokart
```

## Security Considerations

- The `.env` file and `k8s/secret.yaml` contain sensitive API keys. Never commit these files to source control with real credentials.
- For production deployments, consider implementing proper secret management solutions (e.g., HashiCorp Vault, AWS Secrets Manager).
- The base64 encoding in Kubernetes secrets is not encryption. It's merely an encoding format.

## Customization

- For custom environment variables, add them to the `.env` file locally and update the Kubernetes secret as needed.
- Edit resource limits in `k8s/deployment.yaml` based on your workload requirements.
- If you need to expose the service externally, modify `k8s/service.yaml` to use a LoadBalancer or NodePort type.
