#!/bin/bash
# 03-configure-secrets.sh
# 读取本地 .env 文件并创建 K8s Secrets 和 ConfigMaps

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔐 配置 Kubernetes Secrets 和 ConfigMaps...${NC}"

# 检查必需文件
BACKEND_ENV_FILE="../../backend/.env"
if [ ! -f "$BACKEND_ENV_FILE" ]; then
    echo -e "${RED}❌ 找不到 backend/.env 文件${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 找到配置文件: $BACKEND_ENV_FILE${NC}"

# 创建 namespace
echo -e "${YELLOW}📦 创建 namespace...${NC}"
kubectl create namespace kortix-backend --dry-run=client -o yaml | kubectl apply -f -

# 读取 .env 文件并分类
echo -e "${YELLOW}📋 解析环境变量...${NC}"

# 敏感配置 (存储到 Secret)
SENSITIVE_VARS=(
    "SUPABASE_SERVICE_ROLE_KEY"
    "OPENAI_API_KEY" 
    "ANTHROPIC_API_KEY"
    "OPENROUTER_API_KEY"
    "MORPH_API_KEY"
    "GEMINI_API_KEY"
    "TAVILY_API_KEY"
    "FIRECRAWL_API_KEY"
    "RAPID_API_KEY"
    "DAYTONA_API_KEY"
    "TRIGGER_WEBHOOK_SECRET"
    "MCP_CREDENTIAL_ENCRYPTION_KEY"
    "KORTIX_ADMIN_API_KEY"
    "LANGFUSE_SECRET_KEY"
    "COMPOSIO_API_KEY"
    "CLOUDFLARE_API_TOKEN"
    "SLACK_CLIENT_SECRET"
    "PIPEDREAM_CLIENT_SECRET"
)

# 普通配置 (存储到 ConfigMap)
CONFIG_VARS=(
    "ENV_MODE"
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY"
    "REDIS_HOST"
    "REDIS_PORT"
    "FIRECRAWL_URL"
    "WEBHOOK_BASE_URL"
    "DAYTONA_SERVER_URL"
    "DAYTONA_TARGET"
    "LANGFUSE_PUBLIC_KEY"
    "LANGFUSE_HOST"
    "NEXT_PUBLIC_URL"
    "SLACK_CLIENT_ID"
    "SLACK_REDIRECT_URI"
    "PIPEDREAM_PROJECT_ID"
    "PIPEDREAM_CLIENT_ID"
    "PIPEDREAM_X_PD_ENVIRONMENT"
)

# 创建临时文件
SECRET_FILE=$(mktemp)
CONFIG_FILE=$(mktemp)

echo "# Backend Secrets" > $SECRET_FILE
echo "# Backend Config" > $CONFIG_FILE

# 解析 .env 文件
while IFS='=' read -r key value; do
    # 跳过注释和空行
    [[ $key =~ ^#.*$ ]] && continue
    [[ -z $key ]] && continue
    
    # 移除可能的引号
    value=$(echo "$value" | sed 's/^["'\'']\|["'\'']$//g')
    
    # 检查是否为敏感变量
    if [[ " ${SENSITIVE_VARS[*]} " =~ " $key " ]]; then
        echo "$key=$value" >> $SECRET_FILE
        echo "  🔒 $key: [HIDDEN]"
    elif [[ " ${CONFIG_VARS[*]} " =~ " $key " ]]; then
        echo "$key=$value" >> $CONFIG_FILE  
        echo "  📋 $key: $value"
    else
        echo "  ⚠️  跳过: $key (未在配置列表中)"
    fi
done < <(grep -v '^#' $BACKEND_ENV_FILE | grep -v '^$')

# 创建 K8s Secret
echo -e "\n${YELLOW}🔐 创建 Kubernetes Secret...${NC}"
kubectl create secret generic backend-secrets \
    --namespace=kortix-backend \
    --from-env-file=$SECRET_FILE \
    --dry-run=client -o yaml | kubectl apply -f -

# 创建 K8s ConfigMap  
echo -e "${YELLOW}📋 创建 Kubernetes ConfigMap...${NC}"

# 修改一些配置以适应 K8s 环境
sed -i.bak 's/ENV_MODE=local/ENV_MODE=production/' $CONFIG_FILE
sed -i.bak 's/REDIS_HOST=redis/REDIS_HOST=redis-service/' $CONFIG_FILE

kubectl create configmap backend-config \
    --namespace=kortix-backend \
    --from-env-file=$CONFIG_FILE \
    --dry-run=client -o yaml | kubectl apply -f -

# 验证创建结果
echo -e "\n${BLUE}🔍 验证配置...${NC}"
echo "=== Secrets ==="
kubectl get secrets -n kortix-backend
echo -e "\n=== ConfigMaps ==="  
kubectl get configmaps -n kortix-backend

echo -e "\n=== Secret 内容 (键名) ==="
kubectl describe secret backend-secrets -n kortix-backend

echo -e "\n=== ConfigMap 内容 ==="
kubectl describe configmap backend-config -n kortix-backend

# 清理临时文件
rm -f $SECRET_FILE $CONFIG_FILE
rm -f $CONFIG_FILE.bak

# 生成前端环境变量配置
echo -e "\n${YELLOW}🌐 生成前端 Vercel 环境变量...${NC}"

FRONTEND_ENV_FILE="../../frontend/.env.local"
if [ -f "$FRONTEND_ENV_FILE" ]; then
    echo "以下环境变量需要在 Vercel 中配置："
    echo "=================================="
    
    # 读取前端环境变量并修改为生产环境配置
    while IFS='=' read -r key value; do
        [[ $key =~ ^#.*$ ]] && continue
        [[ -z $key ]] && continue
        
        # 移除引号
        value=$(echo "$value" | sed 's/^["'\'']\|["'\'']$//g')
        
        # 修改 URL 为生产环境
        if [[ $key == "NEXT_PUBLIC_BACKEND_URL" ]]; then
            echo "$key=https://api.your-domain.com"
        elif [[ $key == "NEXT_PUBLIC_URL" ]]; then  
            echo "$key=https://your-domain.com"
        elif [[ $key == "NEXT_PUBLIC_ENV_MODE" ]]; then
            echo "$key=production"
        else
            echo "$key=$value"
        fi
    done < <(grep -v '^#' $FRONTEND_ENV_FILE | grep -v '^$')
    
    echo "=================================="
    echo "请复制以上配置到 Vercel 项目设置中"
fi

echo -e "\n${GREEN}🎉 环境配置完成！${NC}"
echo "现在可以运行 04-deploy-application.sh 部署应用"