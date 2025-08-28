#!/bin/bash
# deploy-all.sh
# 一键部署整个 Kortix 后端到 AWS EKS

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 艺术字标题
echo -e "${PURPLE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██╗  ██╗ ██████╗ ██████╗ ████████╗██╗██╗  ██╗              ║
║   ██║ ██╔╝██╔═══██╗██╔══██╗╚══██╔══╝██║╚██╗██╔╝              ║
║   █████╔╝ ██║   ██║██████╔╝   ██║   ██║ ╚███╔╝               ║
║   ██╔═██╗ ██║   ██║██╔══██╗   ██║   ██║ ██╔██╗               ║
║   ██║  ██╗╚██████╔╝██║  ██║   ██║   ██║██╔╝ ██╗              ║
║   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝╚═╝  ╚═╝              ║
║                                                               ║
║           AWS EKS 自动化部署脚本                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${BLUE}🚀 开始自动化部署流程...${NC}\n"

# 检查是否有必要的文件
REQUIRED_FILES=(
    "00-prerequisites.sh"
    "01-create-cluster.sh"
    "02-install-addons.sh" 
    "03-configure-secrets.sh"
    "04-deploy-application.sh"
    "05-setup-monitoring.sh"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ 找不到必要文件: $file${NC}"
        exit 1
    fi
done

# 确认部署
echo -e "${YELLOW}⚠️  这将在您的 AWS 账户中创建以下资源:${NC}"
echo "• EKS 集群 (kortix-cluster)"
echo "• EC2 实例 (2-5个节点)"
echo "• LoadBalancers (ALB/NLB)"
echo "• EBS 卷 (存储)"
echo "• 监控系统 (Prometheus/Grafana)"
echo ""
echo -e "${YELLOW}预估成本: $100-200/月${NC}"
echo ""
read -p "确认继续部署？(y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "部署取消"
    exit 0
fi

# 记录开始时间
START_TIME=$(date +%s)
echo -e "${GREEN}开始时间: $(date)${NC}\n"

# 第一步：检查前置条件
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}步骤 1/6: 检查前置条件${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
chmod +x 00-prerequisites.sh
./00-prerequisites.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 前置条件检查失败${NC}"
    exit 1
fi

# 第二步：创建集群
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}步骤 2/6: 创建 EKS 集群 (约 15-20 分钟)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
chmod +x 01-create-cluster.sh
./01-create-cluster.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 集群创建失败${NC}"
    exit 1
fi

# 第三步：安装插件
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}步骤 3/6: 安装 K8s 插件${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
chmod +x 02-install-addons.sh
./02-install-addons.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 插件安装失败${NC}"
    exit 1
fi

# 第四步：配置密钥
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}步骤 4/6: 配置环境变量和密钥${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
chmod +x 03-configure-secrets.sh
./03-configure-secrets.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 密钥配置失败${NC}"
    exit 1
fi

# 第五步：部署应用
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}步骤 5/6: 部署 Kortix 应用${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
chmod +x 04-deploy-application.sh
./04-deploy-application.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 应用部署失败${NC}"
    exit 1
fi

# 第六步：设置监控
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}步骤 6/6: 配置监控系统${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
chmod +x 05-setup-monitoring.sh
./05-setup-monitoring.sh

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  监控系统配置失败，但应用部署成功${NC}"
fi

# 计算总耗时
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
HOURS=$((DURATION / 3600))
MINUTES=$(((DURATION % 3600) / 60))
SECONDS=$((DURATION % 60))

# 获取访问信息
BACKEND_LB=$(kubectl get service backend-api-service -n kortix-backend -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "正在创建中...")
GRAFANA_LB=$(kubectl get service kube-prometheus-stack-grafana -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "正在创建中...")

# 显示成功信息
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 部署成功完成！${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${PURPLE}📊 部署摘要:${NC}"
echo "总耗时: ${HOURS}h ${MINUTES}m ${SECONDS}s"
echo "集群名称: kortix-cluster"
echo "区域: ${AWS_DEFAULT_REGION:-us-west-2}"
echo "节点数: 2 (可扩展到 5)"

echo -e "\n${PURPLE}🌐 访问信息:${NC}"
echo "┌─────────────────────────────────────────────────────────────────┐"
echo "│ 后端 API                                                        │"
echo "├─────────────────────────────────────────────────────────────────┤"
echo "│ URL: http://$BACKEND_LB"
echo "│ 健康检查: http://$BACKEND_LB/health"
echo "│ API 文档: http://$BACKEND_LB/docs"
echo "└─────────────────────────────────────────────────────────────────┘"

echo "┌─────────────────────────────────────────────────────────────────┐"
echo "│ 监控系统                                                        │"
echo "├─────────────────────────────────────────────────────────────────┤"
echo "│ Grafana: http://$GRAFANA_LB"
echo "│ 用户名: admin"
echo "│ 密码: kortix-admin-2024"
echo "└─────────────────────────────────────────────────────────────────┘"

echo -e "\n${PURPLE}📋 后续步骤:${NC}"
echo "1. 等待 LoadBalancer 完全就绪 (2-5分钟)"
echo "2. 在 Vercel 中配置前端环境变量:"
echo "   NEXT_PUBLIC_BACKEND_URL=http://$BACKEND_LB"
echo "3. 访问 Grafana 查看监控数据"
echo "4. 测试 API 端点确保正常工作"

echo -e "\n${PURPLE}🛠️  管理命令:${NC}"
echo "# 查看所有 Pod 状态"
echo "kubectl get pods -n kortix-backend"
echo ""
echo "# 查看应用日志"
echo "kubectl logs -f deployment/backend-api -n kortix-backend"
echo ""
echo "# 扩缩容"
echo "kubectl scale deployment backend-api --replicas=3 -n kortix-backend"
echo ""
echo "# 删除整个部署"
echo "eksctl delete cluster --name kortix-cluster --region ${AWS_DEFAULT_REGION:-us-west-2}"

# 生成完整的部署报告
cat > deployment-summary.txt <<EOF
Kortix EKS 部署摘要
==================
部署时间: $(date)
总耗时: ${HOURS}h ${MINUTES}m ${SECONDS}s

集群信息:
- 名称: kortix-cluster
- 区域: ${AWS_DEFAULT_REGION:-us-west-2}
- 节点类型: t3.medium
- 节点数量: 2-5 (自动伸缩)

服务访问:
- 后端 API: http://$BACKEND_LB
- 健康检查: http://$BACKEND_LB/health
- API 文档: http://$BACKEND_LB/docs
- Grafana: http://$GRAFANA_LB (admin/kortix-admin-2024)

关键组件:
✅ EKS 集群
✅ Backend API (2 副本)
✅ Worker (2 副本)
✅ Redis (1 副本)
✅ Prometheus/Grafana 监控
✅ 自动扩缩容 (HPA)
✅ LoadBalancer
✅ 持久化存储

管理命令:
kubectl get pods -n kortix-backend
kubectl logs -f deployment/backend-api -n kortix-backend
kubectl scale deployment backend-api --replicas=3 -n kortix-backend

清理命令:
eksctl delete cluster --name kortix-cluster --region ${AWS_DEFAULT_REGION:-us-west-2}
EOF

echo -e "\n${GREEN}📄 完整部署信息已保存到 deployment-summary.txt${NC}"
echo -e "${GREEN}🎊 Kortix 后端已成功部署到 AWS EKS！${NC}\n"