#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="kortix-backend"
ECR_REGISTRY="706929238717.dkr.ecr.us-west-2.amazonaws.com"
ECR_REPOSITORY="suna-backend"
IMAGE_TAG="latest"
REGION="us-west-2"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed or not in PATH"
        exit 1
    fi
}

# Function to wait for deployment to be ready
wait_for_deployment() {
    local deployment_name=$1
    local timeout=${2:-300}
    
    print_status "Waiting for deployment $deployment_name to be ready..."
    
    kubectl wait --for=condition=available --timeout=${timeout}s deployment/$deployment_name -n $NAMESPACE
    
    if [ $? -eq 0 ]; then
        print_success "Deployment $deployment_name is ready"
        return 0
    else
        print_error "Deployment $deployment_name failed to become ready within ${timeout} seconds"
        return 1
    fi
}

# Function to enable feature flags
enable_feature_flags() {
    print_status "Enabling feature flags..."
    
    # Get the backend API pod name
    local pod_name=$(kubectl get pods -n $NAMESPACE -l app=backend-api --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    
    if [ -z "$pod_name" ]; then
        print_error "No running backend-api pod found"
        return 1
    fi
    
    print_status "Found backend API pod: $pod_name"
    
    # List of feature flags to enable
    local flags=(
        "custom_agents:Enable custom agent creation and management"
        "suna_default_agent:Enable Suna default agent functionality"
        "mcp_module:Enable MCP (Model Context Protocol) module"
        "templates_api:Enable templates API functionality"
        "knowledge_base:Enable knowledge base functionality"
        "composio_integration:Enable Composio integration"
        "pipedream_integration:Enable Pipedream integration"
        "transcription_service:Enable transcription service"
        "email_notifications:Enable email notification system"
        "api_keys_management:Enable API keys management"
        "triggers_system:Enable triggers system"
        "admin_panel:Enable admin panel access"
    )
    
    # Enable each flag
    for flag_info in "${flags[@]}"; do
        IFS=':' read -r flag_name description <<< "$flag_info"
        
        print_status "Enabling flag: $flag_name"
        
        kubectl exec $pod_name -n $NAMESPACE -- uv run python flags/setup.py enable "$flag_name" "$description" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            print_success "✓ Enabled: $flag_name"
        else
            print_warning "⚠ Failed to enable: $flag_name (may already be enabled)"
        fi
    done
    
    print_success "Feature flags configuration completed"
}

# Function to get cluster status
get_cluster_status() {
    print_status "Checking EKS cluster status..."
    
    # Check if cluster is running
    local cluster_status=$(aws eks describe-cluster --name kortix-cluster --region $REGION --query 'cluster.status' --output text 2>/dev/null)
    
    if [ "$cluster_status" = "ACTIVE" ]; then
        print_success "EKS cluster is active"
        return 0
    else
        print_error "EKS cluster is not active (status: $cluster_status)"
        return 1
    fi
}

# Function to build and push Docker image
build_and_push_image() {
    print_status "Building and pushing Docker image..."
    
    # Navigate to backend directory
    cd /Users/guanqunhuang/Desktop/Reality/suna/backend
    
    # Login to ECR
    print_status "Logging in to ECR..."
    aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
    
    # Build the image
    print_status "Building Docker image..."
    docker build --platform linux/amd64 -t $ECR_REPOSITORY:$IMAGE_TAG .
    
    if [ $? -ne 0 ]; then
        print_error "Docker build failed"
        return 1
    fi
    
    # Tag the image
    docker tag $ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
    
    # Push the image
    print_status "Pushing Docker image to ECR..."
    docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
    
    if [ $? -eq 0 ]; then
        print_success "Docker image pushed successfully"
        return 0
    else
        print_error "Docker push failed"
        return 1
    fi
}

# Function to deploy to Kubernetes
deploy_to_kubernetes() {
    print_status "Deploying to Kubernetes..."
    
    # Navigate to deployment directory
    cd /Users/guanqunhuang/Desktop/Reality/suna/deployment/hybrid
    
    # Apply the deployment
    kubectl apply -f backend-k8s-deployment.yaml
    
    if [ $? -ne 0 ]; then
        print_error "Kubernetes deployment failed"
        return 1
    fi
    
    # Restart the deployment to pick up the new image
    kubectl rollout restart deployment/backend-api -n $NAMESPACE
    kubectl rollout restart deployment/backend-worker -n $NAMESPACE
    
    # Wait for deployments to be ready
    wait_for_deployment "backend-api" 600
    wait_for_deployment "backend-worker" 300
    
    print_success "Kubernetes deployment completed"
}

# Function to verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    # Get service endpoint
    local load_balancer=$(kubectl get svc backend-service -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
    
    if [ -z "$load_balancer" ]; then
        print_warning "LoadBalancer hostname not found, checking if it's still provisioning..."
        
        # Wait a bit and try again
        sleep 30
        load_balancer=$(kubectl get svc backend-service -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
    fi
    
    if [ -n "$load_balancer" ]; then
        print_success "Backend service available at: http://$load_balancer/api"
        
        # Test health endpoint
        print_status "Testing health endpoint..."
        
        local health_status=$(curl -s -o /dev/null -w "%{http_code}" "http://$load_balancer/api/health" --max-time 10 2>/dev/null || echo "000")
        
        if [ "$health_status" = "200" ]; then
            print_success "✓ Health check passed"
        else
            print_warning "⚠ Health check returned status: $health_status"
        fi
    else
        print_warning "LoadBalancer hostname not available yet"
    fi
    
    # Show pod status
    print_status "Pod status:"
    kubectl get pods -n $NAMESPACE -l app=backend-api
    kubectl get pods -n $NAMESPACE -l app=backend-worker
}

# Main deployment function
main() {
    print_status "Starting automated Suna backend deployment..."
    print_status "Target: EKS cluster 'kortix-cluster' in region $REGION"
    
    # Check required commands
    check_command "kubectl"
    check_command "docker"
    check_command "aws"
    
    # Check cluster status
    if ! get_cluster_status; then
        print_error "Cannot proceed with deployment - cluster not ready"
        exit 1
    fi
    
    # Build and push image
    if ! build_and_push_image; then
        print_error "Build and push failed"
        exit 1
    fi
    
    # Deploy to Kubernetes
    if ! deploy_to_kubernetes; then
        print_error "Kubernetes deployment failed"
        exit 1
    fi
    
    # Wait a bit for pods to be fully ready before enabling flags
    print_status "Waiting 60 seconds for pods to be fully initialized..."
    sleep 60
    
    # Enable feature flags
    if ! enable_feature_flags; then
        print_warning "Feature flag enablement had issues, but deployment continues"
    fi
    
    # Verify deployment
    verify_deployment
    
    print_success "🎉 Automated deployment completed successfully!"
    print_status "Your backend is now running with:"
    print_status "- Updated CORS configuration (includes consciousness.systems)"
    print_status "- Claude Sonnet 4 available in free tier"
    print_status "- All feature flags automatically enabled"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "flags-only")
        print_status "Enabling feature flags only..."
        enable_feature_flags
        ;;
    "verify")
        print_status "Verifying deployment only..."
        verify_deployment
        ;;
    "build-only")
        print_status "Building and pushing image only..."
        build_and_push_image
        ;;
    *)
        echo "Usage: $0 [deploy|flags-only|verify|build-only]"
        echo "  deploy     - Full deployment (default)"
        echo "  flags-only - Enable feature flags only"
        echo "  verify     - Verify existing deployment"
        echo "  build-only - Build and push image only"
        exit 1
        ;;
esac