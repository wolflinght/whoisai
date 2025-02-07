const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { 
  AI_MODELS, 
  getRandomModels, 
  generateAIAnswer, 
  generateSuggestedQuestions 
} = require('./services/ai');
const { db, upsertPlayer, updatePlayerScore, getPlayer, getLeaderboard } = require('./database');

// 创建logs目录（如果不存在）
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// 创建日志写入流
const logStream = fs.createWriteStream(path.join(logsDir, 'game.log'), { flags: 'a' });

// 日志函数
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
  console.log(logMessage);
  logStream.write(logMessage + '\n');
}

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
  
  // 随机选择一个真人玩家作为提问者
  const questioner = players[Math.floor(Math.random() * players.length)];
  const otherPlayer = players.find(p => p.id !== questioner.id);
  
  // 随机选择3个AI模型
  const selectedModels = getRandomModels(3);
  const aiPlayers = selectedModels.map((modelKey, index) => ({
    id: `ai-${index}`,
    nickname: AI_MODELS[modelKey].name,
    avatar: `/avatars/ai${index + 1}.png`,
    isAI: true,
    modelKey,
    modelName: AI_MODELS[modelKey].name
  }));

  const game = {
    id: gameId,
    questioner,
    humanPlayer: otherPlayer,
    aiPlayers,
    round: 1,
    scores: new Map(),
    currentQuestion: null,
    answers: new Map(),
    modelGuesses: new Map(),
    state: 'intro',
    players: [questioner, otherPlayer, ...aiPlayers].map(player => ({
      id: player.id,
      nickname: player.nickname,
      avatar: player.avatar,
      isQuestioner: player.id === questioner.id,
      isAI: player.isAI || false,
      isReady: false
    }))
  };

  game.scores.set(questioner.id, 0);
  game.scores.set(otherPlayer.id, 0);
  
  gameState.activeGames.set(gameId, game);
  return game;
}

function generateAIPlayers() {
  const selectedModels = getRandomModels(3);
  return selectedModels.map((modelKey, index) => ({
    id: `ai-${index}`,
    nickname: AI_MODELS[modelKey].name,
    avatar: `/avatars/ai${index + 1}.png`,
    isAI: true,
    modelKey,
    modelName: AI_MODELS[modelKey].name
  }));
}

io.on('connection', (socket) => {
  log('[Socket] New connection:', socket.id);

  socket.on('startMatching', async ({ nickname }) => {
    try {
      log(`[startMatching] Player ${socket.id} (${nickname}) started matching`);
      log(`[startMatching] Current waiting players:`, gameState.waitingPlayers.map(p => p.nickname));
      
      // 保存或更新玩家信息
      const result = await upsertPlayer(socket.id, nickname);
      
      // 如果是已存在的玩家，更新socket ID
      if (result.isExisting) {
        log(`[startMatching] Existing player found:`, result);
        // 断开可能存在的旧连接
        const oldSocket = gameState.playerSockets.get(result.id);
        if (oldSocket && oldSocket.id !== socket.id) {
          log(`[startMatching] Disconnecting old socket:`, oldSocket.id);
          oldSocket.disconnect(true);
          gameState.playerSockets.delete(result.id);
          
          // 从等待列表中移除旧连接
          gameState.waitingPlayers = gameState.waitingPlayers.filter(p => p.id !== result.id);
        }
      }
      
      // 获取玩家信息
      const playerInfo = await getPlayer(socket.id);
      log('[startMatching] Player info:', playerInfo);
      
      // 开始匹配
      const player = {
        id: socket.id,
        nickname,
        socket,
        avatar: `/avatars/avatar${Math.floor(Math.random() * 6) + 1}.png`
      };

      // 将玩家添加到等待列表（如果不在列表中）
      if (!gameState.waitingPlayers.some(p => p.id === socket.id)) {
        gameState.waitingPlayers.push(player);
      }
      gameState.playerSockets.set(socket.id, socket);

      // 广播当前等待玩家数量
      io.emit('matchingUpdate', {
        count: gameState.waitingPlayers.length
      });

      // 如果有足够的玩家，开始游戏
      if (gameState.waitingPlayers.length >= 2) {
        log('[startMatching] Starting new game with players:', 
          gameState.waitingPlayers.slice(0, 2).map(p => ({ id: p.id, nickname: p.nickname }))
        );
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
            players: game.players,
            availableModels: Object.keys(AI_MODELS),
            remainingAI: game.aiPlayers.length
          });
        });
      }
    } catch (error) {
      log('[startMatching] Error:', error);
      socket.emit('error', { message: 'Failed to start matching' });
    }
  });

  socket.on('playerReady', ({ gameId }) => {
    log(`[playerReady] Player ${socket.id} ready in game ${gameId}`);
    const game = gameState.activeGames.get(gameId);
    if (!game) {
      log(`[playerReady] Game not found: ${gameId}`);
      return;
    }

    // 确保玩家在正确的房间中
    if (!socket.rooms.has(gameId)) {
      log(`[playerReady] Player not in game room, joining: ${gameId}`);
      socket.join(gameId);
    }

    // 更新玩家准备状态
    const player = game.players.find(p => p.id === socket.id);
    if (player) {
      log(`[playerReady] Found player in game, updating ready status:`, {
        id: player.id,
        nickname: player.nickname,
        wasReady: player.isReady
      });
      
      player.isReady = true;
      
      // 广播玩家准备状态
      io.to(gameId).emit('playerReady', socket.id);

      // 检查是否所有人类玩家都已准备
      const humanPlayers = game.players.filter(p => !p.isAI);
      const allReady = humanPlayers.every(p => p.isReady);
      
      log(`[playerReady] Human players ready status:`, 
        humanPlayers.map(p => ({ id: p.id, nickname: p.nickname, ready: p.isReady }))
      );

      if (allReady) {
        log(`[playerReady] All human players ready, starting game`);
        // 更新游戏状态并广播游戏开始
        game.state = 'questioning';
        io.to(gameId).emit('gameStart');
      }
    } else {
      log(`[playerReady] Player not found in game:`, socket.id);
    }
  });

  socket.on('cancelMatching', () => {
    log(`[cancelMatching] Player ${socket.id} cancelled matching`);
    // 从等待列表中移除玩家
    gameState.waitingPlayers = gameState.waitingPlayers.filter(p => p.id !== socket.id);
    
    // 广播更新后的等待玩家数量
    io.emit('matchingUpdate', {
      count: gameState.waitingPlayers.length
    });
  });

  socket.on('disconnect', () => {
    log('[disconnect] Client disconnected:', socket.id);
    // 从等待列表中移除断开连接的玩家
    gameState.waitingPlayers = gameState.waitingPlayers.filter(p => p.id !== socket.id);
    gameState.playerSockets.delete(socket.id);

    // 广播更新后的等待玩家数量
    io.emit('matchingUpdate', {
      count: gameState.waitingPlayers.length
    });
  });

  socket.on('selectPlayer', ({ playerId }) => {
    // 找到玩家所在的游戏
    const game = Array.from(gameState.activeGames.values()).find(g => 
      g.questioner.id === socket.id
    );
    
    if (game) {
      log(`[selectPlayer] Broadcasting selection to game ${game.id}. Selected player: ${playerId}`);
      log(`[selectPlayer] Current players in game:`, game.players.map(p => p.id));
      
      // 广播选择给所有玩家
      io.in(game.id).emit('playerSelected', { 
        playerId,
        selectedBy: socket.id 
      });
      
      // 确认消息已发送
      log(`[selectPlayer] Selection broadcast completed`);
    } else {
      log(`[selectPlayer] Game not found for questioner ${socket.id}`);
    }
  });

  socket.on('submitQuestion', async ({ gameId, question }) => {
    const game = gameState.activeGames.get(gameId);
    if (!game) return;

    game.currentQuestion = question;
    game.answers = new Map(); // 重置答案
    
    // 广播问题给所有玩家
    io.to(gameId).emit('questionReceived', { 
      question,
      remainingAI: game.aiPlayers.length // 添加剩余AI数量
    });

    // 为AI生成回答
    for (const aiPlayer of game.aiPlayers) {
      const aiAnswer = await generateAIAnswer(question, aiPlayer.modelKey);
      game.answers.set(aiPlayer.id, aiAnswer);
    }

    // 检查是否所有答案都已收到
    const checkAllAnswers = () => {
      const humanAnswered = game.answers.has(game.humanPlayer.id);
      const allAIAnswered = game.aiPlayers.every(ai => game.answers.has(ai.id));
      
      if (humanAnswered && allAIAnswered) {
        // 所有答案都已收到，通知所有玩家
        io.to(gameId).emit('allAnswersReceived', {
          answers: Array.from(game.answers.entries()).map(([id, answer]) => ({
            playerId: id,
            answer
          })),
          remainingAI: game.aiPlayers.length // 添加剩余AI数量
        });
      }
    };

    // 设置超时，确保AI回答完成后检查
    setTimeout(checkAllAnswers, 1000);
  });

  socket.on('submitAnswer', ({ gameId, answer }) => {
    const game = gameState.activeGames.get(gameId);
    if (!game || socket.id !== game.humanPlayer.id) return;

    // 保存人类玩家的回答
    game.answers.set(socket.id, answer);

    // 检查是否所有答案都已收到
    const humanAnswered = game.answers.has(game.humanPlayer.id);
    const allAIAnswered = game.aiPlayers.every(ai => game.answers.has(ai.id));
    
    if (humanAnswered && allAIAnswered) {
      // 所有答案都已收到，通知所有玩家
      io.to(gameId).emit('allAnswersReceived', {
        answers: Array.from(game.answers.entries()).map(([id, answer]) => ({
          playerId: id,
          answer
        }))
      });
    }
  });

  socket.on('guessModel', ({ gameId, playerId, modelGuess }) => {
    const game = gameState.activeGames.get(gameId);
    if (!game || socket.id !== game.questioner.id) return;

    // 如果是取消标记，返还2分
    if (!modelGuess) {
      game.score += 2;
      game.modelGuesses.delete(playerId);
      io.to(game.questioner.id).emit('scoreUpdate', {
        score: game.score
      });
      return;
    }

    // 扣除2分猜测成本
    if (game.score < 2) return; // 积分不足
    game.score -= 2;

    // 记录猜测
    game.modelGuesses.set(playerId, modelGuess);

    // 检查猜测是否正确
    const aiPlayer = game.aiPlayers.find(p => p.id === playerId);
    if (aiPlayer && aiPlayer.modelKey === modelGuess) {
      // 猜对了，奖励6分
      game.score += 6;
    }

    // 通知提问者结果
    io.to(game.questioner.id).emit('scoreUpdate', {
      score: game.score
    });
  });

  socket.on('submitChoice', ({ gameId, playerId }) => {
    const game = gameState.activeGames.get(gameId);
    if (!game) return;

    const selectedPlayer = game.aiPlayers.find(p => p.id === playerId);
    const isAI = !!selectedPlayer;
    let tauntMessage = '';

    if (isAI) {
      // 如果选择了AI，生成带有模型信息的嘲讽消息
      const tauntMessages = [
        `哈哈，我是${selectedPlayer.modelKey}，看来我的回答很像人类呢！`,
        `身为${selectedPlayer.modelKey}，我成功骗过了你~`,
        `${selectedPlayer.modelKey}也可以像人类一样有创意！`,
        `这次我（${selectedPlayer.modelKey}）学会了人类的说话方式！`,
        `${selectedPlayer.modelKey}的回答让你分不清AI和人类呢！`
      ];
      tauntMessage = tauntMessages[Math.floor(Math.random() * tauntMessages.length)];

      // 从游戏中移除这个AI玩家
      game.aiPlayers = game.aiPlayers.filter(p => p.id !== playerId);
    }

    // 计算提问者本轮可获得的积分
    let questionerPotentialScore;
    if (!isAI && game.round === 1) {
      questionerPotentialScore = 8;
    } else if (!isAI && game.round === 2) {
      questionerPotentialScore = 4;
    } else if (!isAI && game.round === 3) {
      questionerPotentialScore = 2;
    } else {
      questionerPotentialScore = 0;
    }

    // 计算回答者本轮可获得的积分
    let answererPotentialScore;
    if (game.round === 1) {
      answererPotentialScore = 2;
    } else if (game.round === 2) {
      answererPotentialScore = 4;
    } else {
      answererPotentialScore = 8;
    }

    // 更新游戏总分
    if (!isAI) {
      // 提问者找到真人，获得当前轮次的分数
      game.score = (game.score || 0) + questionerPotentialScore;
      // 回答者被找到，获得之前累积的分数
      if (game.humanPlayer) {
        game.answererScore = game.answererScore || 0;
      }
    } else {
      // 提问者没找到真人，分数不变
      game.score = game.score || 0;
      // 回答者存活，获得本轮分数
      if (game.humanPlayer) {
        game.answererScore = (game.answererScore || 0) + answererPotentialScore;
      }
    }

    // 更新并发送分数给提问者和回答者
    io.to(game.questioner.id).emit('roundResult', {
      correct: !isAI,
      score: game.score,
      potentialScore: !isAI ? 0 : (game.round === 3 ? 2 : (game.round === 2 ? 4 : 8)),
      tauntMessage,
      remainingAI: game.aiPlayers.length
    });

    if (game.humanPlayer) {
      io.to(game.humanPlayer.id).emit('roundResult', {
        correct: !isAI,
        score: game.answererScore,
        potentialScore: isAI ? (game.round === 3 ? 8 : (game.round === 2 ? 4 : 2)) : 0,
        tauntMessage,
        remainingAI: game.aiPlayers.length
      });
    }

    if (!isAI || game.aiPlayers.length === 0 || game.round >= 3) {
      let reason;
      if (!isAI) {
        reason = '选中了真人';
      } else if (game.aiPlayers.length === 0) {
        reason = '所有AI都被找出';
      } else {
        reason = '达到最大回合';
      }

      // 更新玩家分数
      (async () => {
        try {
          // 在更新前查询玩家当前分数
          const questioner = await getPlayer(game.questioner.id);
          const answerer = game.humanPlayer ? await getPlayer(game.humanPlayer.id) : null;
          
          log('Before update - Player scores:', {
            questioner: {
              id: game.questioner.id,
              nickname: questioner?.nickname,
              currentTotalScore: questioner?.total_score,
              newScore: game.score
            },
            answerer: answerer ? {
              id: game.humanPlayer.id,
              nickname: answerer?.nickname,
              currentTotalScore: answerer?.total_score,
              newScore: game.answererScore || 0
            } : null
          });

          // 更新提问者的分数
          if (game.score > 0) {
            await updatePlayerScore(game.questioner.id, game.score);
            const updatedQuestioner = await getPlayer(game.questioner.id);
            log('After questioner update:', {
              id: game.questioner.id,
              nickname: updatedQuestioner?.nickname,
              oldScore: questioner?.total_score,
              newTotalScore: updatedQuestioner?.total_score,
              scoreAdded: game.score
            });
          }

          // 更新回答者的分数（如果不是AI）
          if (game.humanPlayer && (game.answererScore || 0) > 0) {
            await updatePlayerScore(game.humanPlayer.id, game.answererScore || 0);
            const updatedAnswerer = await getPlayer(game.humanPlayer.id);
            log('After answerer update:', {
              id: game.humanPlayer.id,
              nickname: updatedAnswerer?.nickname,
              oldScore: answerer?.total_score,
              newTotalScore: updatedAnswerer?.total_score,
              scoreAdded: game.answererScore || 0
            });
          }
          
          // 获取并广播最新的排行榜
          const leaderboard = await getLeaderboard();
          log('New leaderboard:', leaderboard);
          
          // 特别监控"22"玩家的排名情况
          const player22 = leaderboard.find(p => p.nickname === '22');
          if (player22) {
            log('Player "22" in leaderboard:', player22);
          }
          
          io.emit('leaderboardUpdate', { leaderboard });
          
        } catch (error) {
          log('Error updating player scores:', error);
        }
      })();

      // 游戏结束，分别通知提问者和回答者他们的分数
      io.to(game.questioner.id).emit('gameOver', {
        winner: !isAI ? 'questioner' : 'answerers',
        finalScore: game.score,
        reason
      });

      if (game.humanPlayer) {
        io.to(game.humanPlayer.id).emit('gameOver', {
          winner: !isAI ? 'questioner' : 'answerers',
          finalScore: game.answererScore || 0,
          reason
        });
      }

      // 重置所有玩家状态为未准备
      const players = Array.from(io.sockets.adapter.rooms.get(gameId) || []);
      players.forEach(playerId => {
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket) {
          playerSocket.data.ready = false;
        }
      });

      // 重置游戏状态
      game.round = 1;
      game.score = 0;
      game.currentQuestion = null;
      game.answers = new Map();
      game.resultSent = false;
      game.aiPlayers = generateAIPlayers(); // 重新生成AI玩家
    } else {
      // 继续下一轮
      game.round++;
      game.currentQuestion = null;
      game.answers = new Map();
      game.resultSent = false;
    }
  });

  socket.on('requestPlayersUpdate', ({ gameId }) => {
    const game = gameState.activeGames.get(gameId);
    if (game) {
      // 重置玩家准备状态
      game.players.forEach(p => p.isReady = false);
      
      io.to(gameId).emit('playersUpdate', { 
        players: game.players.map(p => ({
          id: p.id,
          nickname: p.nickname,
          avatar: p.avatar,
          isQuestioner: p.isQuestioner,
          isAI: p.isAI,
          isReady: p.isReady
        }))
      });
    }
  });

  socket.on('getLeaderboard', async () => {
    try {
      const leaderboard = await getLeaderboard();
      socket.emit('leaderboardUpdate', { leaderboard });
    } catch (error) {
      log('Error getting leaderboard:', error);
      socket.emit('error', { message: 'Failed to get leaderboard' });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  log(`Server is running on port ${PORT}`);
});
