#!/bin/bash

echo "正在停止现有服务..."
pkill -f "node src/index.js"
pkill -f "vite"

# 等待进程完全停止
sleep 2

echo "正在启动服务端..."
cd server
node src/index.js &

# 等待服务端启动
sleep 2

echo "正在启动客户端..."
cd ..
npm run dev &

echo "所有服务已重启！"
echo "服务端运行在: http://localhost:3000"
echo "客户端运行在: http://localhost:5173"
