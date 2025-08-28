#!/bin/bash
# 02-install-addons.sh
# 安装必需的 K8s 组件和插件

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 加载集群信息
if [ -f cluster-info.env ]; then
    source cluster-info.env
else
    echo -e "${RED}❌ 找不到 cluster-info.env 文件${NC}"
    echo "请先运行 01-create-cluster.sh"
    exit 1
fi

echo -e "${BLUE}🔧 安装 K8s 插件和组件...${NC}"

# 1. 安装 AWS Load Balancer Controller
echo -e "\n${YELLOW}📦 安装 AWS Load Balancer Controller...${NC}"

# 创建 IAM 策略（如果不存在）
POLICY_NAME="AWSLoadBalancerControllerIAMPolicy"
POLICY_ARN="arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/$POLICY_NAME"

if ! aws iam get-policy --policy-arn $POLICY_ARN &>/dev/null; then
    echo "创建 ALB Controller IAM 策略..."
    curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.2/docs/install/iam_policy.json
    aws iam create-policy \
        --policy-name $POLICY_NAME \
        --policy-document file://iam_policy.json
    rm -f iam_policy.json
fi

# 创建 IAM 服务账户
eksctl create iamserviceaccount \
  --cluster=$CLUSTER_NAME \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=$POLICY_ARN \
  --approve \
  --region=$REGION || echo "服务账户可能已存在"

# 安装 AWS Load Balancer Controller
kubectl apply \
    --validate=false \
    -f https://github.com/jetstack/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# 等待 cert-manager 就绪
echo "等待 cert-manager 就绪..."
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-cainjector -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager

# 下载并安装 ALB Controller
curl -Lo v2_7_2_full.yaml https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases/download/v2.7.2/v2_7_2_full.yaml
sed -i.bak -e 's|your-cluster-name|'${CLUSTER_NAME}'|g' v2_7_2_full.yaml
sed -i.bak -e 's|your-region|'${REGION}'|g' v2_7_2_full.yaml
kubectl apply -f v2_7_2_full.yaml
rm -f v2_7_2_full.yaml*

echo -e "${GREEN}✅ AWS Load Balancer Controller 安装完成${NC}"

# 2. 安装 Metrics Server
echo -e "\n${YELLOW}📊 安装 Metrics Server...${NC}"
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

echo -e "${GREEN}✅ Metrics Server 安装完成${NC}"

# 3. 安装 EBS CSI Driver（如果未安装）
echo -e "\n${YELLOW}💾 检查 EBS CSI Driver...${NC}"
if ! kubectl get csidriver ebs.csi.aws.com &>/dev/null; then
    echo "安装 EBS CSI Driver..."
    eksctl create addon --name aws-ebs-csi-driver --cluster $CLUSTER_NAME --region $REGION --service-account-role-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/AmazonEKS_EBS_CSI_DriverRole --force
fi

echo -e "${GREEN}✅ EBS CSI Driver 已就绪${NC}"

# 4. 创建 StorageClass
echo -e "\n${YELLOW}🗄️ 创建 StorageClass...${NC}"
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
EOF

# 移除原有的默认 StorageClass
kubectl patch storageclass gp2 -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}' || echo "gp2 StorageClass 不存在"

echo -e "${GREEN}✅ StorageClass 配置完成${NC}"

# 5. 等待所有组件就绪
echo -e "\n${YELLOW}⏳ 等待所有组件就绪...${NC}"
kubectl wait --for=condition=available --timeout=300s deployment/aws-load-balancer-controller -n kube-system
kubectl wait --for=condition=available --timeout=300s deployment/metrics-server -n kube-system

# 6. 验证安装
echo -e "\n${BLUE}🔍 验证组件状态...${NC}"
echo "=== Nodes ==="
kubectl get nodes

echo -e "\n=== System Pods ==="
kubectl get pods -n kube-system

echo -e "\n=== StorageClasses ==="
kubectl get storageclass

echo -e "\n=== CSI Drivers ==="
kubectl get csidriver

# 创建测试 Pod 验证功能
echo -e "\n${YELLOW}🧪 创建测试 Pod 验证功能...${NC}"
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
  namespace: default
spec:
  containers:
  - name: test
    image: nginx:alpine
    resources:
      requests:
        memory: "64Mi"
        cpu: "50m"
      limits:
        memory: "128Mi"
        cpu: "100m"
EOF

# 等待测试 Pod 运行
kubectl wait --for=condition=ready --timeout=60s pod/test-pod

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 测试 Pod 创建成功${NC}"
    kubectl delete pod test-pod
else
    echo -e "${RED}❌ 测试 Pod 创建失败${NC}"
fi

echo -e "\n${GREEN}🎉 所有插件安装完成！${NC}"
echo "现在可以运行 03-configure-secrets.sh 配置密钥"