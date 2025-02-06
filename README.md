# 谁是AI 问答小游戏

一个有趣的H5问答游戏，玩家需要通过提问来找出其他玩家中谁是真人。

## 功能特点

- 实时多人在线游戏
- AI玩家使用多个不同的语言模型
- 智能推荐问题系统
- 积分奖励机制
- 美观的用户界面

## 技术栈

### 前端
- Vue 3
- Vuex
- Vue Router
- Element Plus
- Socket.IO Client

### 后端
- Node.js
- Express
- Socket.IO
- OpenAI API

## 安装说明

1. 克隆仓库后进入项目目录：
```bash
cd who-is-ai
```

2. 安装前端依赖：
```bash
npm install
```

3. 安装后端依赖：
```bash
cd server
npm install
```

4. 配置环境变量：
   - 在 server 目录下创建 .env 文件
   - 添加你的 OpenAI API 密钥：
     ```
     OPENAI_API_KEY=your_api_key_here
     ```

5. 启动服务：

前端（开发模式）：
```bash
npm run dev
```

后端（开发模式）：
```bash
cd server
npm run dev
```

## 游戏规则

1. 开始游戏需要至少两名真人玩家
2. 每局游戏中：
   - 1名玩家作为提问者
   - 1名玩家作为真人回答者
   - 3个AI扮演的玩家
3. 提问者有5次提问机会
4. 每轮提问后，提问者需要选择一个他认为是真人的玩家
5. 积分规则：
   - 提问者第1轮猜对：8分
   - 提问者第2轮猜对：4分
   - 提问者第3轮猜对：2分
   - 提问者第4轮猜对：1分
   - 回答者每轮不被淘汰：1分（累加）

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进这个项目！

## 许可证

MIT License
