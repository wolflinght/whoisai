#!/bin/bash

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "正在停止现有服务..."
pkill -f "node src/index.js"
pkill -f "vite"

# 等待进程完全停止
sleep 2

echo "正在启动服务端..."
cd "$SCRIPT_DIR/server"
node src/index.js &
SERVER_PID=$!

# 等待服务端启动
sleep 2

echo "正在启动客户端..."
cd "$SCRIPT_DIR"
npm run dev &
CLIENT_PID=$!

echo "所有服务已重启！"
echo "服务端运行在: http://localhost:3000 (PID: $SERVER_PID)"
echo "客户端运行在: http://localhost:5173 (PID: $CLIENT_PID)"
