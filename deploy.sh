#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}开始部署 Wolflight 游戏服务...${NC}"

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}请使用 sudo 运行此脚本${NC}"
    exit 1
fi

# 设置工作目录
DEPLOY_DIR="/var/www/wolflight"
mkdir -p $DEPLOY_DIR

# 安装系统依赖
echo -e "${YELLOW}正在安装系统依赖...${NC}"
yum update -y
yum groupinstall "Development Tools" -y
yum install -y pcre-devel zlib-devel openssl-devel

# 安装 Node.js
echo -e "${YELLOW}正在安装 Node.js...${NC}"
curl -fsSL https://rpm.nodesource.com/setup_16.x | bash -
yum install -y nodejs

# 安装 PM2
echo -e "${YELLOW}正在安装 PM2...${NC}"
npm install -g pm2

# 安装并配置 Nginx
echo -e "${YELLOW}正在安装和配置 Nginx...${NC}"
# 创建 Nginx 配置
cat > /usr/local/nginx/conf/nginx.conf << 'NGINX_EOF'
worker_processes  1;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    sendfile        on;
    keepalive_timeout  65;

    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    server {
        listen 80;
        server_name _;

        # 前端静态文件
        location / {
            root /var/www/wolflight/dist;
            try_files $uri $uri/ /index.html;
            index index.html;
            
            # 添加跨域头
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' '*' always;
        }

        # 后端 API 代理
        location /api {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # WebSocket 代理
        location /socket.io/ {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 86400;
        }
    }
}
NGINX_EOF

# 创建 Nginx 服务
cat > /etc/systemd/system/nginx.service << 'SERVICE_EOF'
[Unit]
Description=nginx - high performance web server
Documentation=https://nginx.org/en/docs/
After=network-online.target remote-fs.target nss-lookup.target
Wants=network-online.target

[Service]
Type=forking
PIDFile=/usr/local/nginx/logs/nginx.pid
ExecStartPre=/usr/local/nginx/sbin/nginx -t -c /usr/local/nginx/conf/nginx.conf
ExecStart=/usr/local/nginx/sbin/nginx -c /usr/local/nginx/conf/nginx.conf
ExecReload=/bin/kill -s HUP $MAINPID
ExecStop=/bin/kill -s TERM $MAINPID

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# 重新加载系统服务
systemctl daemon-reload
systemctl enable nginx
systemctl start nginx

# 配置项目环境变量
echo -e "${YELLOW}正在配置环境变量...${NC}"
cat > $DEPLOY_DIR/.env << 'ENV_EOF'
# AI Service Configuration
FRIDAY_API_URL=https://aigc.sankuai.com/v1/openai/native/chat/completions
FRIDAY_API_KEY=your-api-key

# Server Configuration
PORT=3000
NODE_ENV=production
HOST=0.0.0.0

# Database Configuration
DB_PATH=./data/players.db
ENV_EOF

# 设置目录权限
echo -e "${YELLOW}正在设置目录权限...${NC}"
chown -R admin:admin $DEPLOY_DIR
chmod -R 755 $DEPLOY_DIR
chmod 600 $DEPLOY_DIR/.env

# 创建数据目录
mkdir -p $DEPLOY_DIR/data
chown -R admin:admin $DEPLOY_DIR/data

# 配置防火墙
echo -e "${YELLOW}正在配置防火墙...${NC}"
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=3000/tcp
firewall-cmd --reload

echo -e "${GREEN}基础环境配置完成！${NC}"
echo -e "${YELLOW}请执行以下步骤完成部署：${NC}"
echo -e "1. 编辑 .env 文件设置正确的 API 密钥："
echo -e "   ${GREEN}nano $DEPLOY_DIR/.env${NC}"
echo -e "2. 在项目目录下执行："
echo -e "   ${GREEN}npm install${NC}"
echo -e "   ${GREEN}npm run build${NC}"
echo -e "3. 在 server 目录下执行："
echo -e "   ${GREEN}cd server && npm install${NC}"
echo -e "4. 启动后端服务："
echo -e "   ${GREEN}pm2 start \"node --env-file=../.env src/index.js\" --name \"wolflight-server\"${NC}"
echo -e "   ${GREEN}pm2 save${NC}"
echo -e "5. 访问服务器 IP 地址测试游戏是否正常运行"
