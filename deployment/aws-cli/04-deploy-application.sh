#!/bin/bash
# 04-deploy-application.sh
# 部署 Kortix 后端应用到 K8s 集群

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 部署 Kortix 后端应用...${NC}"

# 检查必需文件
DEPLOYMENT_FILE="../hybrid/backend-k8s-deployment.yaml"
if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo -e "${RED}❌ 找不到部署文件: $DEPLOYMENT_FILE${NC}"
    exit 1
fi

# 检查集群连接
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}❌ 无法连接到 K8s 集群${NC}"
    echo "请确保已运行 aws eks update-kubeconfig"
    exit 1
fi

echo -e "${GREEN}✅ K8s 集群连接正常${NC}"

# 检查必需的 Secrets 和 ConfigMaps
echo -e "${YELLOW}🔍 检查配置...${NC}"
if ! kubectl get secret backend-secrets -n kortix-backend &>/dev/null; then
    echo -e "${RED}❌ 找不到 backend-secrets${NC}"
    echo "请先运行 03-configure-secrets.sh"
    exit 1
fi

if ! kubectl get configmap backend-config -n kortix-backend &>/dev/null; then
    echo -e "${RED}❌ 找不到 backend-config${NC}"
    echo "请先运行 03-configure-secrets.sh"  
    exit 1
fi

echo -e "${GREEN}✅ 配置检查通过${NC}"

# 部署应用
echo -e "\n${YELLOW}📦 部署应用组件...${NC}"

echo "部署 Redis..."
kubectl apply -f $DEPLOYMENT_FILE

# 等待部署完成
echo -e "\n${YELLOW}⏳ 等待 Pod 启动...${NC}"

# 等待 Redis 就绪
echo "等待 Redis Pod..."
kubectl wait --for=condition=ready --timeout=300s pod -l app=redis -n kortix-backend

echo "等待 Backend API Pod..."
kubectl wait --for=condition=ready --timeout=300s pod -l app=backend-api -n kortix-backend

echo "等待 Worker Pod..."  
kubectl wait --for=condition=ready --timeout=300s pod -l app=backend-worker -n kortix-backend

# 检查部署状态
echo -e "\n${BLUE}📊 检查部署状态...${NC}"

echo "=== Deployments ==="
kubectl get deployments -n kortix-backend

echo -e "\n=== Pods ==="
kubectl get pods -n kortix-backend -o wide

echo -e "\n=== Services ==="
kubectl get services -n kortix-backend

echo -e "\n=== HPA ==="
kubectl get hpa -n kortix-backend

echo -e "\n=== PVC ==="
kubectl get pvc -n kortix-backend

# 检查 Pod 日志
echo -e "\n${YELLOW}📋 检查应用日志...${NC}"

# Backend API 日志
BACKEND_POD=$(kubectl get pods -n kortix-backend -l app=backend-api -o jsonpath='{.items[0].metadata.name}')
if [ ! -z "$BACKEND_POD" ]; then
    echo "=== Backend API 日志 (最后20行) ==="
    kubectl logs $BACKEND_POD -n kortix-backend --tail=20
fi

# Worker 日志
WORKER_POD=$(kubectl get pods -n kortix-backend -l app=backend-worker -o jsonpath='{.items[0].metadata.name}')
if [ ! -z "$WORKER_POD" ]; then
    echo -e "\n=== Worker 日志 (最后10行) ==="
    kubectl logs $WORKER_POD -n kortix-backend --tail=10
fi

# 获取 LoadBalancer 地址
echo -e "\n${YELLOW}🌐 获取访问地址...${NC}"
BACKEND_LB=$(kubectl get service backend-api-service -n kortix-backend -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

if [ ! -z "$BACKEND_LB" ]; then
    echo -e "${GREEN}✅ 后端 API 地址: http://$BACKEND_LB${NC}"
    echo "健康检查: http://$BACKEND_LB/health"
    echo "API 文档: http://$BACKEND_LB/docs"
    
    # 保存访问信息
    cat > backend-access-info.txt <<EOF
Backend API LoadBalancer: $BACKEND_LB
Health Check: http://$BACKEND_LB/health
API Docs: http://$BACKEND_LB/docs
Grafana Metrics: http://$BACKEND_LB/metrics

Frontend 环境变量更新：
NEXT_PUBLIC_BACKEND_URL=http://$BACKEND_LB

K8s 管理命令：
# 查看 Pod 状态
kubectl get pods -n kortix-backend

# 查看日志
kubectl logs -f deployment/backend-api -n kortix-backend
kubectl logs -f deployment/backend-worker -n kortix-backend

# 重启应用
kubectl rollout restart deployment/backend-api -n kortix-backend
kubectl rollout restart deployment/backend-worker -n kortix-backend

# 扩缩容
kubectl scale deployment backend-api --replicas=3 -n kortix-backend

# 进入 Pod 调试
kubectl exec -it deployment/backend-api -n kortix-backend -- /bin/bash
EOF
    
    echo -e "\n${GREEN}📄 访问信息已保存到 backend-access-info.txt${NC}"
else
    echo -e "${YELLOW}⏳ LoadBalancer 正在创建中...${NC}"
    echo "请稍等几分钟再检查："
    echo "kubectl get service backend-api-service -n kortix-backend"
fi

# 测试健康检查
echo -e "\n${YELLOW}🧪 测试应用健康...${NC}"
if [ ! -z "$BACKEND_LB" ]; then
    echo "等待 LoadBalancer 就绪..."
    sleep 30
    
    if curl -s -f "http://$BACKEND_LB/health" >/dev/null; then
        echo -e "${GREEN}✅ 健康检查通过！${NC}"
    else
        echo -e "${YELLOW}⚠️  健康检查暂时失败，可能还在启动中${NC}"
    fi
fi

# 显示有用的命令
echo -e "\n${BLUE}📚 有用的管理命令：${NC}"
cat <<EOF

# 查看实时日志
kubectl logs -f deployment/backend-api -n kortix-backend
kubectl logs -f deployment/backend-worker -n kortix-backend

# 查看资源使用
kubectl top pods -n kortix-backend
kubectl top nodes

# 进入 Pod 调试
kubectl exec -it deployment/backend-api -n kortix-backend -- /bin/bash

# 扩缩容
kubectl scale deployment backend-api --replicas=3 -n kortix-backend

# 更新应用
kubectl set image deployment/backend-api backend=ghcr.io/suna-ai/suna-backend:latest -n kortix-backend

# 查看事件
kubectl get events -n kortix-backend --sort-by='.lastTimestamp'

EOF

echo -e "\n${GREEN}🎉 应用部署完成！${NC}"

# 检查是否有失败的 Pod
FAILED_PODS=$(kubectl get pods -n kortix-backend --field-selector=status.phase!=Running -o jsonpath='{.items[*].metadata.name}')
if [ ! -z "$FAILED_PODS" ]; then
    echo -e "\n${YELLOW}⚠️  发现异常 Pod: $FAILED_PODS${NC}"
    echo "请检查日志: kubectl describe pod $FAILED_PODS -n kortix-backend"
fi

echo -e "\n现在可以配置前端连接到: ${GREEN}http://$BACKEND_LB${NC}"