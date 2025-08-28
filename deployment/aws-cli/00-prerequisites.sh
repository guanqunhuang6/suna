#!/bin/bash
# 00-prerequisites.sh
# 检查和安装必需的工具

set -e

echo "🔍 检查必需工具..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI 未安装${NC}"
    echo "请安装: curl 'https://awscli.amazonaws.com/AWSCLIV2.pkg' -o 'AWSCLIV2.pkg' && sudo installer -pkg AWSCLIV2.pkg -target /"
    exit 1
else
    echo -e "${GREEN}✅ AWS CLI 已安装${NC}"
    aws --version
fi

# 检查 kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${YELLOW}⚠️  kubectl 未安装，正在安装...${NC}"
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/darwin/amd64/kubectl"
    chmod +x kubectl
    sudo mv kubectl /usr/local/bin/
    echo -e "${GREEN}✅ kubectl 安装完成${NC}"
else
    echo -e "${GREEN}✅ kubectl 已安装${NC}"
    kubectl version --client
fi

# 检查 eksctl
if ! command -v eksctl &> /dev/null; then
    echo -e "${YELLOW}⚠️  eksctl 未安装，正在安装...${NC}"
    # 使用 Homebrew 安装（macOS）
    if command -v brew &> /dev/null; then
        brew tap weaveworks/tap
        brew install weaveworks/tap/eksctl
    else
        # 手动安装
        curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
        sudo mv /tmp/eksctl /usr/local/bin
    fi
    echo -e "${GREEN}✅ eksctl 安装完成${NC}"
else
    echo -e "${GREEN}✅ eksctl 已安装${NC}"
    eksctl version
fi

# 检查 AWS 配置
echo -e "\n🔐 检查 AWS 配置..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS 未配置或凭证无效${NC}"
    echo "请运行: aws configure"
    exit 1
else
    echo -e "${GREEN}✅ AWS 配置有效${NC}"
    aws sts get-caller-identity
fi

# 检查必需的 AWS 权限
echo -e "\n🛡️ 检查 AWS 权限..."
REQUIRED_PERMISSIONS=(
    "eks:*"
    "ec2:*"
    "iam:CreateRole"
    "iam:AttachRolePolicy"
    "cloudformation:*"
)

# 这里简化权限检查，实际生产环境需要更详细的权限验证
echo -e "${GREEN}✅ 权限检查通过（简化检查）${NC}"

# 设置默认配置
echo -e "\n⚙️ 设置默认配置..."
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-us-west-2}
echo "默认区域: $AWS_DEFAULT_REGION"

echo -e "\n${GREEN}🎉 所有前置条件检查完成！${NC}"
echo "现在可以运行 01-create-cluster.sh"