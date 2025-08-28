# Vercel 前端部署指南

## 1. 准备工作

### 环境变量配置
在 Vercel 项目设置中配置以下环境变量：

```bash
NEXT_PUBLIC_ENV_MODE=production
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
# 指向 K8s 暴露的后端 API 地址
NEXT_PUBLIC_BACKEND_URL=https://api.your-domain.com
NEXT_PUBLIC_URL=https://your-domain.com
```

## 2. 部署方式

### 方式一：通过 GitHub 自动部署

1. Fork 或推送代码到 GitHub
2. 访问 [vercel.com](https://vercel.com)
3. 导入 GitHub 仓库
4. 选择 `frontend` 目录作为根目录
5. 框架预设选择 Next.js
6. 配置环境变量
7. 点击 Deploy

### 方式二：使用 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 进入前端目录
cd frontend

# 登录 Vercel
vercel login

# 部署到生产环境
vercel --prod

# 首次部署时的配置
? Set up and deploy "~/suna/frontend"? [Y/n] Y
? Which scope do you want to deploy to? Your Team
? Link to existing project? [y/N] n
? What's your project's name? kortix-frontend
? In which directory is your code located? ./
? Want to modify these settings? [y/N] n
```

## 3. 自定义域名配置

1. 在 Vercel Dashboard → Settings → Domains
2. 添加自定义域名
3. 配置 DNS：
   - CNAME: `cname.vercel-dns.com`
   - 或 A 记录: `76.76.21.21`

## 4. 性能优化配置

创建 `frontend/vercel.json`：

```json
{
  "functions": {
    "app/api/*": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.your-domain.com/api/:path*"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

## 5. 环境变量管理

### 开发环境
```bash
vercel env pull .env.local
```

### 生产环境
```bash
vercel env add NEXT_PUBLIC_BACKEND_URL production
```

## 6. 监控和分析

Vercel 自动提供：
- Web Analytics
- Real Experience Score
- Core Web Vitals
- Speed Insights

在项目 Dashboard → Analytics 查看

## 7. CI/CD 配置

`.github/workflows/vercel.yml`:

```yaml
name: Vercel Production Deployment
env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
  
on:
  push:
    branches:
      - main
    paths:
      - 'frontend/**'

jobs:
  Deploy-Production:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Vercel CLI
        run: npm install --global vercel@latest
        
      - name: Pull Vercel Environment Information
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: ./frontend
        
      - name: Build Project Artifacts
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: ./frontend
        
      - name: Deploy Project Artifacts to Vercel
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: ./frontend
```