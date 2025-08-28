#!/bin/bash
# 01-create-cluster.sh  
# 创建 EKS 集群

set -e

# 配置变量
CLUSTER_NAME="kortix-cluster"
REGION=${AWS_DEFAULT_REGION:-us-west-2}
NODE_GROUP_NAME="kortix-workers"
NODE_TYPE="t3.medium"  # 2vCPU, 4GB RAM 性价比高
MIN_NODES=2
MAX_NODES=5
DESIRED_NODES=2

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 开始创建 EKS 集群...${NC}"
echo "集群名称: $CLUSTER_NAME"
echo "区域: $REGION"
echo "节点类型: $NODE_TYPE"
echo "节点数量: $MIN_NODES-$MAX_NODES (期望: $DESIRED_NODES)"

# 检查集群是否已存在
if aws eks describe-cluster --name $CLUSTER_NAME --region $REGION &>/dev/null; then
    echo -e "${YELLOW}⚠️  集群 $CLUSTER_NAME 已存在${NC}"
    read -p "是否删除并重新创建？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}🗑️ 删除现有集群...${NC}"
        eksctl delete cluster --name $CLUSTER_NAME --region $REGION
        echo -e "${GREEN}✅ 集群已删除${NC}"
    else
        echo "使用现有集群"
        exit 0
    fi
fi

# 创建 eksctl 配置文件
cat > cluster-config.yaml <<EOF
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: ${CLUSTER_NAME}
  region: ${REGION}
  version: "1.28"

iam:
  withOIDC: true

nodeGroups:
  - name: ${NODE_GROUP_NAME}
    instanceType: ${NODE_TYPE}
    minSize: ${MIN_NODES}
    maxSize: ${MAX_NODES}
    desiredCapacity: ${DESIRED_NODES}
    amiFamily: AmazonLinux2
    volumeSize: 50
    volumeType: gp3
    volumeEncrypted: true
    ssh:
      allow: false
    tags:
      Environment: production
      Project: kortix
      ManagedBy: eksctl
    iam:
      attachPolicyARNs:
        - arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy
        - arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy
        - arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
        - arn:aws:iam::aws:policy/AmazonEBSCSIDriverPolicy
      withAddonPolicies:
        ebs: true

addons:
- name: vpc-cni
  version: latest
- name: coredns
  version: latest
- name: kube-proxy
  version: latest
- name: aws-ebs-csi-driver
  version: latest
  wellKnownPolicies:
    ebsCSIController: true
EOF

echo -e "\n${YELLOW}📋 集群配置:${NC}"
cat cluster-config.yaml

echo -e "\n${BLUE}🏗️ 开始创建集群（预计需要 15-20 分钟）...${NC}"
eksctl create cluster -f cluster-config.yaml

# 验证集群创建
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}🎉 集群创建成功！${NC}"
    
    # 更新 kubeconfig
    echo -e "${YELLOW}⚙️ 更新 kubeconfig...${NC}"
    aws eks update-kubeconfig --region $REGION --name $CLUSTER_NAME
    
    # 验证连接
    echo -e "${BLUE}🔍 验证集群状态...${NC}"
    kubectl get nodes
    kubectl get pods -A
    
    # 显示集群信息
    echo -e "\n${GREEN}📊 集群信息:${NC}"
    echo "集群名称: $CLUSTER_NAME"
    echo "区域: $REGION" 
    echo "API 服务器端点: $(aws eks describe-cluster --name $CLUSTER_NAME --region $REGION --query 'cluster.endpoint' --output text)"
    echo "集群版本: $(aws eks describe-cluster --name $CLUSTER_NAME --region $REGION --query 'cluster.version' --output text)"
    
    # 保存集群信息到文件
    cat > cluster-info.env <<EOF
CLUSTER_NAME=$CLUSTER_NAME
REGION=$REGION
NODE_GROUP_NAME=$NODE_GROUP_NAME
CLUSTER_ENDPOINT=$(aws eks describe-cluster --name $CLUSTER_NAME --region $REGION --query 'cluster.endpoint' --output text)
EOF
    
    echo -e "\n${GREEN}✅ 集群创建完成！现在可以运行 02-install-addons.sh${NC}"
    
else
    echo -e "${RED}❌ 集群创建失败${NC}"
    exit 1
fi

# 清理临时文件
rm -f cluster-config.yaml