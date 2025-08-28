#!/bin/bash

echo "🚀 开始部署 Kortix 到 Kubernetes..."

# 检查 kubectl 是否安装
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl 未安装，请先安装 kubectl"
    exit 1
fi

# 创建命名空间
echo "📦 创建命名空间..."
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: kortix
EOF

# 部署 PVC
echo "💾 创建持久化存储..."
kubectl apply -f pvc.yaml

# 配置 Secrets 和 ConfigMaps
echo "🔐 配置密钥..."
echo "⚠️  请先编辑 configmap.yaml 文件，填入您的实际配置值"
read -p "已完成配置编辑？(y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl apply -f configmap.yaml
else
    echo "❌ 请先完成配置后再运行部署"
    exit 1
fi

# 构建并推送前端镜像（如果使用自定义镜像）
echo "🏗️  构建前端镜像..."
read -p "是否需要构建自定义前端镜像？(y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "请输入您的镜像仓库地址（例如: your-registry.com/kortix-frontend）:"
    read FRONTEND_IMAGE
    
    # 构建镜像
    cd ../../frontend
    docker build -t $FRONTEND_IMAGE:latest .
    docker push $FRONTEND_IMAGE:latest
    
    # 更新 deployment.yaml 中的镜像地址
    cd ../deployment/kubernetes
    sed -i "s|kortix-frontend:latest|$FRONTEND_IMAGE:latest|g" deployment.yaml
fi

# 部署应用
echo "🚀 部署应用..."
kubectl apply -f deployment.yaml

# 等待部署完成
echo "⏳ 等待部署完成..."
kubectl wait --for=condition=available --timeout=300s deployment/backend-api -n kortix
kubectl wait --for=condition=available --timeout=300s deployment/frontend -n kortix

# 检查部署状态
echo "✅ 检查部署状态..."
kubectl get pods -n kortix
kubectl get svc -n kortix
kubectl get ingress -n kortix

echo "🎉 部署完成!"
echo ""
echo "📝 后续步骤:"
echo "1. 配置 DNS 将域名指向 Ingress IP"
echo "2. 等待 SSL 证书自动配置（如果使用 cert-manager）"
echo "3. 访问 https://your-domain.com"
echo ""
echo "🔍 查看日志:"
echo "kubectl logs -f deployment/backend-api -n kortix"
echo "kubectl logs -f deployment/frontend -n kortix"