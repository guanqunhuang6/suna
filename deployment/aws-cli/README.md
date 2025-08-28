# 🚀 Kortix AWS EKS 部署指南

完整的 AWS CLI 自动化部署脚本，将 Kortix 后端部署到 Amazon EKS。

## 📋 概述

这套脚本会自动化完成以下任务：
1. **检查前置条件** - 验证工具和AWS配置
2. **创建EKS集群** - 自动创建生产级K8s集群
3. **安装必要插件** - ALB Controller, Metrics Server等
4. **配置密钥** - 从本地.env文件创建K8s Secrets
5. **部署应用** - Redis, Backend API, Worker
6. **设置监控** - Prometheus + Grafana

## 🎯 一键部署

### 快速开始
```bash
cd deployment/aws-cli
chmod +x deploy-all.sh
./deploy-all.sh
```

### 分步执行
```bash
# 1. 检查前置条件
./00-prerequisites.sh

# 2. 创建集群 (15-20分钟)
./01-create-cluster.sh

# 3. 安装插件
./02-install-addons.sh

# 4. 配置密钥
./03-configure-secrets.sh

# 5. 部署应用
./04-deploy-application.sh

# 6. 设置监控
./05-setup-monitoring.sh
```

## 📋 前置要求

### 必需工具
- **AWS CLI v2** - 已配置凭证
- **kubectl** - K8s命令行工具
- **eksctl** - EKS管理工具
- **Helm** - K8s包管理器

### AWS权限
需要以下权限：
- EKS集群管理
- EC2实例管理  
- IAM角色创建
- LoadBalancer创建
- EBS卷管理

### 配置文件
确保以下文件存在且已配置：
- `../../backend/.env` - 后端环境变量
- `../../frontend/.env.local` - 前端环境变量

## 🏗️ 架构概述

```
Internet
    ↓
AWS ALB LoadBalancer
    ↓
EKS Cluster (kortix-cluster)
├── Backend API (2 replicas)
├── Worker (2 replicas) 
├── Redis (1 replica)
└── Monitoring (Prometheus/Grafana)
    ↓
External Services
├── Supabase (Database)
└── Daytona (Agent Sandbox)
```

## 📊 资源配置

| 组件 | 副本数 | CPU | 内存 | 存储 |
|------|--------|-----|------|------|
| Backend API | 2-10 | 0.5-1 | 1-2Gi | - |
| Worker | 2 | 0.5-1 | 1-2Gi | - |
| Redis | 1 | 0.1-0.2 | 256-512Mi | 10Gi |
| Monitoring | - | 1+ | 2-4Gi | 30Gi |

## 🔧 自动扩缩容

- **最小副本**: 2个
- **最大副本**: 10个
- **CPU阈值**: 70%
- **内存阈值**: 80%

## 🔐 安全配置

### Secrets管理
敏感数据存储在K8s Secrets中：
```yaml
# 自动从 backend/.env 提取
apiVersion: v1
kind: Secret
metadata:
  name: backend-secrets
data:
  OPENAI_API_KEY: [base64-encoded]
  ANTHROPIC_API_KEY: [base64-encoded]
  # ... 其他敏感配置
```

### 网络安全
- 所有内部通信使用ClusterIP
- 只有必要的端口对外暴露
- 使用AWS安全组限制访问

## 📈 监控告警

### 预配置告警
- API服务宕机 (1分钟)
- 高延迟 (>1秒, 5分钟)
- 高CPU使用率 (>80%, 10分钟)
- 高内存使用率 (>90%, 10分钟)
- Redis宕机 (1分钟)

### Grafana Dashboard
- **URL**: `http://[grafana-lb]`
- **用户名**: `admin`
- **密码**: `kortix-admin-2024`

预置Dashboard：
- Kubernetes集群监控
- 节点监控
- Kortix应用监控 (自定义)

## 🌐 访问信息

部署完成后会显示：
```bash
后端API: http://[backend-lb]
健康检查: http://[backend-lb]/health
API文档: http://[backend-lb]/docs
Grafana: http://[grafana-lb]
```

## 🛠️ 常用管理命令

### 查看状态
```bash
# 所有Pod状态
kubectl get pods -n kortix-backend

# 服务状态
kubectl get services -n kortix-backend

# HPA状态
kubectl get hpa -n kortix-backend
```

### 查看日志
```bash
# API日志
kubectl logs -f deployment/backend-api -n kortix-backend

# Worker日志
kubectl logs -f deployment/backend-worker -n kortix-backend

# Redis日志
kubectl logs -f deployment/redis -n kortix-backend
```

### 扩缩容
```bash
# 手动扩容API
kubectl scale deployment backend-api --replicas=5 -n kortix-backend

# 手动扩容Worker
kubectl scale deployment backend-worker --replicas=3 -n kortix-backend
```

### 更新应用
```bash
# 更新镜像
kubectl set image deployment/backend-api \
  backend=ghcr.io/suna-ai/suna-backend:v2.0 \
  -n kortix-backend

# 重启应用 
kubectl rollout restart deployment/backend-api -n kortix-backend
```

### 调试
```bash
# 进入Pod调试
kubectl exec -it deployment/backend-api -n kortix-backend -- /bin/bash

# 查看事件
kubectl get events -n kortix-backend --sort-by='.lastTimestamp'

# 描述Pod状态
kubectl describe pod [pod-name] -n kortix-backend
```

## 💰 成本估算

### 月度成本 (us-west-2)
- **EKS控制平面**: $72
- **EC2实例** (2x t3.medium): $60
- **LoadBalancer**: $22
- **EBS存储** (50Gi): $5
- **数据传输**: $10-50
- **总计**: ~$170-210/月

### 成本优化建议
1. 使用Spot实例节省70%
2. 配置集群自动伸缩
3. 定期清理未使用的资源
4. 使用Reserved Instance

## 🧹 清理资源

### 删除整个部署
```bash
# 删除EKS集群 (会删除所有相关资源)
eksctl delete cluster --name kortix-cluster --region us-west-2
```

### 部分清理
```bash
# 只删除应用
kubectl delete namespace kortix-backend

# 只删除监控
helm uninstall kube-prometheus-stack -n monitoring
kubectl delete namespace monitoring
```

## 🚨 故障排查

### 常见问题

1. **集群创建失败**
   ```bash
   # 检查AWS权限
   aws sts get-caller-identity
   
   # 检查区域配置
   echo $AWS_DEFAULT_REGION
   ```

2. **Pod启动失败**
   ```bash
   # 查看Pod状态
   kubectl describe pod [pod-name] -n kortix-backend
   
   # 查看日志
   kubectl logs [pod-name] -n kortix-backend
   ```

3. **LoadBalancer无法访问**
   ```bash
   # 检查LoadBalancer状态
   kubectl get service backend-api-service -n kortix-backend
   
   # 检查安全组规则
   aws ec2 describe-security-groups
   ```

4. **监控无法访问**
   ```bash
   # 检查Grafana Pod
   kubectl get pods -n monitoring -l app.kubernetes.io/name=grafana
   
   # 重启Grafana
   kubectl rollout restart deployment/kube-prometheus-stack-grafana -n monitoring
   ```

## 📞 支持

- **GitHub Issues**: [kortix-ai/suna](https://github.com/kortix-ai/suna/issues)
- **Discord**: [Kortix Community](https://discord.gg/Py6pCBUUPw)
- **文档**: [Kortix Docs](https://docs.kortix.ai)

## 🔄 更新日志

- **v1.0**: 初始版本，基础EKS部署
- **v1.1**: 添加监控和告警
- **v1.2**: 优化资源配置和成本
- **v1.3**: 添加自动扩缩容和故障恢复