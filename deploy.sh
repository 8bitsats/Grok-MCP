#!/bin/bash
# Deployment script for GrokArt MCP Server

# Configuration - modify these variables
REGISTRY="your-registry.com" # e.g., docker.io/username or gcr.io/project-id
IMAGE_NAME="grokart"
IMAGE_TAG=$(date +%Y%m%d-%H%M%S)
REMOTE_HOST="your-server.com" # For SSH deployment
REMOTE_USER="username"
DEPLOY_PATH="/path/to/deployment"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Make sure .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found. Create it first with your X_AI_API_KEY.${NC}"
    echo -e "Example: X_AI_API_KEY=your-api-key"
    exit 1
fi

# Function to display usage information
show_usage() {
    echo -e "${YELLOW}GrokArt MCP Server Deployment Script${NC}"
    echo ""
    echo "Usage:"
    echo "  $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build       Build Docker image locally"
    echo "  push        Build and push to container registry"
    echo "  deploy-ssh  Deploy via SSH to remote server"
    echo "  deploy-k8s  Deploy to Kubernetes cluster (requires kubectl and valid context)"
    echo "  help        Show this help message"
    echo ""
    echo "Edit this script to configure registry, server, and other deployment options."
}

# Build the image locally
build_image() {
    echo -e "${GREEN}Building Docker image locally...${NC}"
    docker build -t ${IMAGE_NAME}:latest .
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Build successful!${NC}"
    else
        echo -e "${RED}Build failed.${NC}"
        exit 1
    fi
}

# Push to registry
push_image() {
    echo -e "${GREEN}Building and pushing Docker image to registry...${NC}"
    
    # Tag with registry and version
    docker tag ${IMAGE_NAME}:latest ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
    docker tag ${IMAGE_NAME}:latest ${REGISTRY}/${IMAGE_NAME}:latest
    
    # Push images
    docker push ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
    docker push ${REGISTRY}/${IMAGE_NAME}:latest
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Push successful!${NC}"
        echo -e "Image: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    else
        echo -e "${RED}Push failed.${NC}"
        exit 1
    fi
}

# Deploy via SSH
deploy_ssh() {
    echo -e "${GREEN}Deploying to remote server via SSH...${NC}"
    
    # Create deployment directory
    ssh ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${DEPLOY_PATH}"
    
    # Copy necessary files
    scp docker-compose.yml ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_PATH}/
    scp .env ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_PATH}/
    
    # Update docker-compose.yml to use the registry image
    ssh ${REMOTE_USER}@${REMOTE_HOST} "sed -i 's|build:.*|image: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}|g' ${DEPLOY_PATH}/docker-compose.yml"
    
    # Start the service
    ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${DEPLOY_PATH} && docker-compose pull && docker-compose up -d"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Deployment successful!${NC}"
    else
        echo -e "${RED}Deployment failed.${NC}"
        exit 1
    fi
}

# Deploy to Kubernetes
deploy_k8s() {
    echo -e "${GREEN}Deploying to Kubernetes...${NC}"
    
    # Create Kubernetes deployment manifests if they don't exist
    if [ ! -f k8s/deployment.yaml ]; then
        echo -e "${YELLOW}Creating Kubernetes manifests in k8s/ directory...${NC}"
        mkdir -p k8s
        
        # Create deployment.yaml
        cat > k8s/deployment.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grokart
  labels:
    app: grokart
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grokart
  template:
    metadata:
      labels:
        app: grokart
    spec:
      containers:
      - name: grokart
        image: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
        envFrom:
        - secretRef:
            name: grokart-secrets
        resources:
          limits:
            cpu: "1"
            memory: "512Mi"
          requests:
            cpu: "500m"
            memory: "256Mi"
EOF

        # Create secret.yaml template
        cat > k8s/secret.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: grokart-secrets
type: Opaque
data:
  # Base64 encoded environment variables
  # echo -n "your-api-key" | base64
  X_AI_API_KEY: "REPLACE_WITH_BASE64_ENCODED_API_KEY"
EOF
    fi
    
    # Update image tag in deployment.yaml
    sed -i'' -e "s|image: .*|image: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}|g" k8s/deployment.yaml
    
    # Apply the Kubernetes manifests
    echo -e "${YELLOW}Creating Kubernetes secret from .env file...${NC}"
    API_KEY=$(grep X_AI_API_KEY .env | cut -d= -f2)
    API_KEY_B64=$(echo -n "$API_KEY" | base64)
    sed -i'' -e "s|X_AI_API_KEY: .*|X_AI_API_KEY: ${API_KEY_B64}|g" k8s/secret.yaml
    
    kubectl apply -f k8s/secret.yaml
    kubectl apply -f k8s/deployment.yaml
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Kubernetes deployment successful!${NC}"
    else
        echo -e "${RED}Kubernetes deployment failed.${NC}"
        exit 1
    fi
}

# Process command line arguments
case "$1" in
    build)
        build_image
        ;;
    push)
        build_image
        push_image
        ;;
    deploy-ssh)
        push_image
        deploy_ssh
        ;;
    deploy-k8s)
        push_image
        deploy_k8s
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        show_usage
        exit 1
        ;;
esac

exit 0
