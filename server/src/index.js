const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const { 
  AI_MODELS, 
  getRandomModels, 
  generateAIAnswer, 
  generateSuggestedQuestions 
} = require('./services/ai');

const app = express();
app.use(cors());

const server = http.createServer(app);

// 配置Socket.IO
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// 游戏状态
const gameState = {
  waitingPlayers: [],
  activeGames: new Map(),
  playerSockets: new Map()
};

// 创建新游戏
function createNewGame(players) {
  const gameId = Date.now().toString();
  const questioner = players[Math.floor(Math.random() * players.length)];
  const humanPlayer = players.find(p => p !== questioner);
  
  // 随机选择3个AI模型
  const selectedModels = getRandomModels(3);
  const aiPlayers = selectedModels.map((modelKey, index) => ({
    id: `ai-${index}`,
    nickname: `玩家${index + 1}`,
    isAI: true,
    modelKey,
    modelName: AI_MODELS[modelKey].name
  }));

  const game = {
    id: gameId,
    questioner,
    humanPlayer,
    aiPlayers,
    round: 1,
    scores: new Map(),
    currentQuestion: null,
    answers: new Map(),
    modelGuesses: new Map(), // 存储提问者对AI模型的猜测
    state: 'asking'
  };

  game.scores.set(questioner.id, 0);
  game.scores.set(humanPlayer.id, 0);
  
  gameState.activeGames.set(gameId, game);
  return game;
}

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('startMatching', async ({ nickname }) => {
    console.log(`Player ${nickname} started matching`);
    const player = {
      id: socket.id,
      nickname,
      socket
    };

    // 将玩家添加到等待列表
    gameState.waitingPlayers.push(player);
    gameState.playerSockets.set(socket.id, socket);

    // 广播当前等待玩家数量
    io.emit('matchingUpdate', {
      count: gameState.waitingPlayers.length
    });

    // 如果有足够的玩家，开始游戏
    if (gameState.waitingPlayers.length >= 2) {
      console.log('Starting new game with players:', gameState.waitingPlayers.map(p => p.nickname));
      const players = gameState.waitingPlayers.splice(0, 2);
      const game = createNewGame(players);

      // 将玩家加入到游戏房间
      players.forEach(player => {
        player.socket.join(game.id);
      });

      // 通知玩家游戏开始
      players.forEach(player => {
        const isQuestioner = player.id === game.questioner.id;
        player.socket.emit('gameStart', {
          gameId: game.id,
          isQuestioner,
          players: [...game.aiPlayers, game.humanPlayer].map(p => ({
            id: p.id,
            nickname: p.nickname
          })),
          availableModels: isQuestioner ? game.aiPlayers.map(p => p.modelName) : null
        });
      });

      // 生成并发送推荐问题给提问者
      const suggestedQuestions = await generateSuggestedQuestions();
      game.questioner.socket.emit('suggestedQuestions', { questions: suggestedQuestions });
    }
  });

  socket.on('cancelMatching', () => {
    console.log(`Player ${socket.id} cancelled matching`);
    // 从等待列表中移除玩家
    gameState.waitingPlayers = gameState.waitingPlayers.filter(p => p.id !== socket.id);
    
    // 广播更新后的等待玩家数量
    io.emit('matchingUpdate', {
      count: gameState.waitingPlayers.length
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // 从等待列表中移除断开连接的玩家
    gameState.waitingPlayers = gameState.waitingPlayers.filter(p => p.id !== socket.id);
    gameState.playerSockets.delete(socket.id);

    // 广播更新后的等待玩家数量
    io.emit('matchingUpdate', {
      count: gameState.waitingPlayers.length
    });
  });

  socket.on('submitQuestion', async ({ gameId, question }) => {
    const game = gameState.activeGames.get(gameId);
    if (!game) return;

    game.currentQuestion = question;
    game.state = 'answering';

    // 发送问题给所有玩家
    io.to(gameId).emit('questionReceived', { question });

    // 生成AI回答
    for (const aiPlayer of game.aiPlayers) {
      const { answer } = await generateAIAnswer(question, aiPlayer.modelKey);
      game.answers.set(aiPlayer.id, answer);
    }
  });

  socket.on('guessModel', ({ gameId, playerId, modelGuess }) => {
    const game = gameState.activeGames.get(gameId);
    if (!game || socket.id !== game.questioner.id) return;

    // 扣除猜测成本
    const currentScore = game.scores.get(socket.id);
    if (currentScore < 2) return; // 积分不足

    game.scores.set(socket.id, currentScore - 2);
    game.modelGuesses.set(playerId, modelGuess);

    // 检查猜测是否正确
    const aiPlayer = game.aiPlayers.find(p => p.id === playerId);
    if (aiPlayer && aiPlayer.modelName === modelGuess) {
      // 猜对了，奖励积分
      game.scores.set(socket.id, game.scores.get(socket.id) + 4);
    }

    // 通知提问者结果
    socket.emit('modelGuessResult', {
      correct: aiPlayer && aiPlayer.modelName === modelGuess,
      score: game.scores.get(socket.id)
    });
  });

  socket.on('submitAnswer', ({ gameId, answer }) => {
    const game = gameState.activeGames.get(gameId);
    if (!game) return;

    game.answers.set(socket.id, answer);

    // 如果所有回答都收到了
    if (game.answers.size === game.aiPlayers.length + 1) {
      game.state = 'choosing';
      
      // 发送所有回答给提问者
      const answersArray = Array.from(game.answers.entries()).map(([id, answer]) => ({
        playerId: id,
        answer
      }));
      
      game.questioner.socket.emit('answersReceived', { answers: answersArray });
    }
  });

  socket.on('submitChoice', ({ gameId, playerId }) => {
    const game = gameState.activeGames.get(gameId);
    if (!game) return;

    const isCorrect = playerId === game.humanPlayer.id;
    const score = isCorrect ? Math.pow(2, 4 - game.round) : 0;

    // 更新分数
    game.scores.set(socket.id, game.scores.get(socket.id) + score);

    // 如果选错了，生成嘲讽语言
    let tauntMessage = '';
    if (!isCorrect) {
      const aiPlayer = game.aiPlayers.find(p => p.id === playerId);
      tauntMessage = `哈哈，我是${aiPlayer.modelName}，看来我装人类装得还不错嘛！`;
    }

    // 通知所有玩家结果
    io.to(gameId).emit('roundResult', {
      correct: isCorrect,
      score: game.scores.get(socket.id),
      round: game.round,
      tauntMessage
    });

    if (isCorrect || game.round >= 4) {
      // 游戏结束
      io.to(gameId).emit('gameOver', {
        winner: isCorrect ? 'questioner' : 'answerers',
        finalScore: game.scores.get(socket.id)
      });
      gameState.activeGames.delete(gameId);
    } else {
      // 进入下一轮
      game.round++;
      game.state = 'asking';
      game.answers.clear();
      game.modelGuesses.clear();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
