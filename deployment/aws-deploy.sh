#!/bin/bash
# AWS EC2 部署脚本

# 1. 更新系统
sudo yum update -y

# 2. 安装 Docker 和 Docker Compose
sudo yum install -y docker git
sudo service docker start
sudo usermod -a -G docker ec2-user

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. 克隆代码
git clone https://github.com/kortix-ai/suna.git
cd suna

# 4. 配置环境变量
echo "请配置以下环境变量文件:"
echo "- backend/.env"
echo "- frontend/.env.local"

# 5. 启动服务
docker-compose up -d --build

# 6. 配置 Nginx（可选）
sudo yum install -y nginx
cat > /etc/nginx/conf.d/kortix.conf <<'EOF'
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
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 1800s;
    }
}
EOF

sudo service nginx restart

echo "部署完成！"
echo "前端访问: http://your-server-ip:3000"
echo "API访问: http://your-server-ip:8000"