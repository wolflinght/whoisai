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
- Friday One-API (支持多个AI模型)

## 项目结构

```
.
├── server/                 # 后端服务
│   ├── src/
│   │   ├── index.js       # 主服务器入口
│   │   ├── models.js      # 数据模型
│   │   ├── database.js    # 数据库配置
│   │   ├── logger.js      # 日志工具
│   │   └── services/
│   │       └── ai.js      # AI服务配置和函数
│   └── package.json
│
├── src/                    # 前端源码
│   ├── components/        
│   │   └── Leaderboard.vue # 排行榜组件
│   ├── views/
│   │   ├── Home.vue       # 首页
│   │   ├── Game.vue       # 游戏主界面
│   │   └── GameIntro.vue  # 游戏介绍
│   ├── store/
│   │   ├── index.js       # Vuex store
│   │   └── game.js        # 游戏状态管理
│   ├── services/
│   │   ├── socket.js      # Socket.IO客户端
│   │   └── avatar.js      # 头像服务
│   ├── App.vue            # 根组件
│   └── main.js            # 应用入口
│
├── public/                 # 静态资源
├── logs/                   # 游戏日志
├── restart.sh             # 重启脚本
├── test-models.js         # AI模型测试脚本
└── package.json
```

## 核心文件说明

### 后端

- `server/src/index.js`: 
  - 服务器入口文件
  - 处理Socket.IO连接
  - 管理游戏状态
  - 处理玩家匹配和游戏流程

- `server/src/services/ai.js`:
  - AI模型配置和管理
  - 支持的模型：
    - GPT-3.5
    - GPT-4
    - Claude-2
    - 豆包
    - Moonshot
    - 通义千问
    - 阶跃星辰
    - ABAB
    - LongCat
  - 生成AI回答
  - 推荐问题生成

### 前端

- `src/views/Game.vue`:
  - 游戏主界面组件
  - 处理游戏逻辑和状态
  - 玩家交互界面

- `src/store/game.js`:
  - 游戏状态管理
  - 玩家信息
  - 游戏进度
  - 分数统计

- `src/services/socket.js`:
  - Socket.IO客户端配置
  - 实时通信处理
  - 事件监听和发送

### 工具脚本

- `restart.sh`:
  - 重启服务器和客户端
  - 清理缓存
  - 重新构建项目

- `test-models.js`:
  - AI模型测试工具
  - 验证API连接
  - 测试模型响应

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
   - 在根目录下创建 .env 文件
   - 添加必要的环境变量：
     ```
     FRIDAY_API_URL=your_friday_api_url
     FRIDAY_API_KEY=your_friday_api_key
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

或使用重启脚本：
```bash
./restart.sh
```

## 游戏规则

1. 开始游戏需要至少两名真人玩家
2. 每局游戏中：
   - 1名玩家作为提问者
   - 1名玩家作为真人回答者
   - 3个AI扮演的玩家（随机从9个AI模型中选择）
3. 提问者有5次提问机会
4. 每轮提问后，提问者需要选择一个他认为是真人的玩家
5. 积分规则：
   - 提问者第1轮猜对：8分
   - 提问者第2轮猜对：4分
   - 提问者第3轮猜对：2分
   - 提问者第4轮猜对：1分
   - 回答者每轮不被淘汰：1分（累加）

## 开发指南

### 添加新的AI模型

1. 在 `server/src/services/ai.js` 中的 `AI_MODELS` 对象中添加新模型配置
2. 确保新模型支持 Friday One-API 的接口格式
3. 在 `generateAIAnswer` 函数中处理新模型的特殊参数（如果有）

### 修改游戏逻辑

1. 游戏核心逻辑在 `server/src/index.js` 中
2. 前端交互逻辑在 `src/views/Game.vue` 中
3. 状态管理在 `src/store/game.js` 中

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进这个项目！

## 许可证

MIT License
