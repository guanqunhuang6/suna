# 🚀 Kortix 云部署完整指南

## 目录
1. [架构概述](#架构概述)
2. [部署前准备](#部署前准备)
3. [方案一：Docker Compose 部署](#方案一docker-compose-部署)
4. [方案二：Kubernetes 部署](#方案二kubernetes-部署)
5. [方案三：Serverless 部署](#方案三serverless-部署)
6. [监控和维护](#监控和维护)
7. [故障排查](#故障排查)

## 架构概述

Kortix 平台包含以下核心组件：

| 组件 | 技术栈 | 端口 | 说明 |
|-----|--------|------|------|
| 前端 | Next.js 15 | 3000 | Web UI |
| 后端API | FastAPI | 8000 | REST API |
| Worker | Dramatiq | - | 后台任务 |
| 缓存 | Redis 7 | 6379 | 会话和缓存 |
| 数据库 | Supabase | - | PostgreSQL + Auth |
| 代理沙箱 | Daytona | - | 隔离执行环境 |

## 部署前准备

### 1. 必需的外部服务

#### Supabase 设置
1. 访问 [supabase.com](https://supabase.com) 创建项目
2. 获取以下配置：
   - Project URL
   - Anon Key
   - Service Role Key
3. 在 Project Settings → API → Exposed Schemas 中添加 `basejump`

#### API 密钥准备
| 服务 | 获取地址 | 用途 |
|-----|---------|------|
| Anthropic/OpenAI | [anthropic.com](https://anthropic.com) / [openai.com](https://openai.com) | LLM 提供商（至少一个） |
| Tavily | [tavily.com](https://tavily.com) | Web 搜索 |
| Firecrawl | [firecrawl.dev](https://firecrawl.dev) | Web 抓取 |
| Daytona | [daytona.io](https://daytona.io) | 代理沙箱 |
| RapidAPI | [rapidapi.com](https://rapidapi.com) | 数据 API |

### 2. 环境变量配置

创建 `backend/.env`:
```bash
# 核心配置
ENV_MODE=production
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Redis（Docker部署用redis，云部署用实际地址）
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_SSL=false

# LLM（至少配置一个）
ANTHROPIC_API_KEY=your_key
# OPENAI_API_KEY=your_key

# 必需的API
TAVILY_API_KEY=your_key
FIRECRAWL_API_KEY=your_key
DAYTONA_API_KEY=your_key
DAYTONA_SERVER_URL=https://app.daytona.io/api
DAYTONA_TARGET=us
RAPID_API_KEY=your_key

# 安全
MCP_CREDENTIAL_ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
WEBHOOK_BASE_URL=https://your-domain.com/api
TRIGGER_WEBHOOK_SECRET=your_secret_string
```

创建 `frontend/.env.local`:
```bash
NEXT_PUBLIC_ENV_MODE=production
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_BACKEND_URL=https://your-domain.com/api
NEXT_PUBLIC_URL=https://your-domain.com
```

## 方案一：Docker Compose 部署

### 适用场景
- 中小型团队
- 单机部署
- 快速启动

### 云平台选择
- AWS EC2 (t3.xlarge 或更高)
- 阿里云 ECS (4核8GB 或更高)
- 腾讯云 CVM
- Azure VM

### 部署步骤

1. **准备服务器**
```bash
# SSH 连接到服务器
ssh user@your-server-ip

# 安装 Docker 和 Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo systemctl start docker
sudo systemctl enable docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

2. **部署应用**
```bash
# 克隆代码
git clone https://github.com/kortix-ai/suna.git
cd suna

# 配置环境变量
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# 编辑上述文件，填入实际配置

# 启动服务
docker-compose up -d --build

# 查看日志
docker-compose logs -f
```

3. **配置反向代理（Nginx + SSL）**
```bash
# 安装 Nginx 和 Certbot
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx

# 配置 Nginx
sudo nano /etc/nginx/sites-available/kortix

# 添加以下配置：
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 1800s;
    }
}

# 启用站点
sudo ln -s /etc/nginx/sites-available/kortix /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 配置 SSL
sudo certbot --nginx -d your-domain.com
```

## 方案二：Kubernetes 部署

### 适用场景
- 大型团队
- 高可用需求
- 自动伸缩

### 云平台选择
- AWS EKS
- Google GKE
- Azure AKS
- 阿里云 ACK

### 部署步骤

1. **准备集群**
```bash
# 以 AWS EKS 为例
eksctl create cluster --name kortix-cluster --region us-west-2 --nodes 3 --node-type t3.large
```

2. **安装必需组件**
```bash
# 安装 Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/aws/deploy.yaml

# 安装 cert-manager (SSL证书)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml
```

3. **部署应用**
```bash
cd deployment/kubernetes

# 编辑配置
nano configmap.yaml  # 填入实际配置

# 部署
kubectl apply -f pvc.yaml
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml

# 查看状态
kubectl get pods -n kortix
kubectl get ingress -n kortix
```

### 配置自动伸缩
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-api-hpa
  namespace: kortix
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## 方案三：Serverless 部署

### 适用场景
- 成本敏感
- 不规则流量
- 快速原型

### 前端部署（Vercel）

1. **Fork 项目到 GitHub**

2. **连接 Vercel**
```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
cd frontend
vercel --prod
```

3. **配置环境变量**
在 Vercel 控制台设置环境变量

### 后端部署（AWS Lambda）

1. **安装 SAM CLI**
```bash
pip install aws-sam-cli
```

2. **部署**
```bash
cd deployment/serverless

# 构建
sam build

# 部署
sam deploy --guided
```

## 监控和维护

### 日志管理

**Docker Compose**:
```bash
# 查看所有日志
docker-compose logs -f

# 查看特定服务
docker-compose logs -f backend
```

**Kubernetes**:
```bash
# 查看 Pod 日志
kubectl logs -f deployment/backend-api -n kortix

# 使用 stern 查看多个 Pod
stern backend -n kortix
```

### 性能监控

推荐工具：
- **Prometheus + Grafana**: 系统指标
- **Langfuse**: LLM 调用监控
- **Sentry**: 错误追踪

### 备份策略

1. **数据库备份**（Supabase 自动备份）
2. **Redis 持久化**:
```bash
# Docker 卷备份
docker run --rm -v suna_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz /data
```

## 故障排查

### 常见问题

1. **后端无法连接 Redis**
```bash
# 检查 Redis 状态
docker-compose ps redis
# 或 Kubernetes
kubectl get pod -l app=redis -n kortix
```

2. **前端无法连接后端**
- 检查环境变量 `NEXT_PUBLIC_BACKEND_URL`
- 检查 CORS 设置
- 验证网络连通性

3. **Agent 执行失败**
- 检查 Daytona API 密钥
- 验证 Worker 日志
- 确认 Redis 连接

### 健康检查端点

- 前端: `https://your-domain.com/`
- 后端: `https://your-domain.com/api/health`
- API文档: `https://your-domain.com/api/docs`

## 安全建议

1. **使用 HTTPS**: 所有生产环境必须启用 SSL
2. **密钥管理**: 使用密钥管理服务（AWS Secrets Manager、HashiCorp Vault）
3. **网络隔离**: 将数据库和 Redis 放在私有子网
4. **定期更新**: 及时更新依赖和安全补丁
5. **访问控制**: 配置防火墙规则，限制不必要的端口

## 成本优化

| 部署方案 | 月成本估算 | 适用规模 |
|---------|-----------|---------|
| Docker Compose (t3.xlarge) | $150-200 | 1-100 用户 |
| Kubernetes (3节点) | $300-500 | 100-1000 用户 |
| Serverless | $50-300 | 按需计费 |

## 支持

- GitHub Issues: [github.com/kortix-ai/suna/issues](https://github.com/kortix-ai/suna/issues)
- Discord: [discord.gg/Py6pCBUUPw](https://discord.gg/Py6pCBUUPw)
- 文档: [docs.suna.so](https://docs.suna.so)