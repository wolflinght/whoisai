// 首先加载环境变量
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { 
  AI_MODELS, 
  getRandomModels, 
  generateAIAnswer, 
  generateSuggestedQuestions,
  generateTauntMessage
} from './services/ai.js';
import { db, upsertPlayer, updatePlayerScore, getPlayer, getLeaderboard } from './database.js';
import logger from './logger.js';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
const envPath = join(__dirname, '../../.env');
console.log('Loading environment variables from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

const app = express();
app.use(cors());

const server = createServer(app);

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
    nickname: `AI玩家${index + 1}`,
    avatar: `/avatars/ai${index + 1}.png`,
    isAI: true,
    modelKey,
    modelName: AI_MODELS[modelKey].name
  }));

  // 游戏初始化状态
  const initialGameState = {
    id: gameId,
    questioner,
    humanPlayer: otherPlayer,
    aiPlayers,
    round: 1,
    score: 0,  // 明确初始化分数为0
    modelGuessScore: 0,  // 初始化模型猜测分数为0
    answererScore: 0,
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

  // 为提问者和回答者初始化分数
  initialGameState.scores.set(questioner.id, 0);
  initialGameState.scores.set(otherPlayer.id, 0);

  // 使用logger监控分数变化
  const game = {
    ...initialGameState,
    score: logger.monitorVariable('game.score', 0).value,
    modelGuessScore: logger.monitorVariable('game.modelGuessScore', 0).value,
    answererScore: logger.monitorVariable('game.answererScore', 0).value,
    scores: logger.monitorVariable('game.scores', initialGameState.scores).value
  };

  // 记录游戏初始化日志
  logger.info('[createNewGame] Game Initialization Details:', {
    gameId: game.id,
    questioner: {
      id: questioner.id,
      nickname: questioner.nickname
    },
    humanPlayer: {
      id: otherPlayer.id,
      nickname: otherPlayer.nickname
    },
    initialScores: {
      score: game.score,
      answererScore: game.answererScore,
      playerScores: Object.fromEntries(game.scores)
    }
  });

  gameState.activeGames.set(gameId, game);
  
  // 增加详细日志
  logger.info('[createNewGame] Game Initialization Details:', {
    gameId: game.id,
    questioner: {
      id: questioner.id,
      nickname: questioner.nickname
    },
    humanPlayer: {
      id: otherPlayer.id,
      nickname: otherPlayer.nickname
    },
    aiPlayers: aiPlayers.map(ai => ({
      id: ai.id,
      modelKey: ai.modelKey,
      nickname: ai.nickname
    })),
    initialScores: {
      questioner: game.scores.get(questioner.id),
      answerer: game.scores.get(otherPlayer.id),
      gameScore: game.score,
      answererScore: game.answererScore
    }
  });

  return game;
}

function generateAIPlayers() {
  const selectedModels = getRandomModels(3);
  return selectedModels.map((modelKey, index) => ({
    id: `ai-${index}`,
    nickname: `AI玩家${index + 1}`,
    avatar: `/avatars/ai${index + 1}.png`,
    isAI: true,
    modelKey,
    modelName: AI_MODELS[modelKey].name
  }));
}

io.on('connection', (socket) => {
  logger.info('[Socket] New connection:', socket.id);

  socket.on('startMatching', async ({ nickname }) => {
    try {
      logger.info(`[startMatching] Player ${socket.id} (${nickname}) started matching`);
      logger.info(`[startMatching] Current waiting players:`, gameState.waitingPlayers.map(p => p.nickname));
      
      // 保存或更新玩家信息
      const result = await upsertPlayer(socket.id, nickname);
      
      // 如果是已存在的玩家，更新socket ID
      if (result.isExisting) {
        logger.info(`[startMatching] Existing player found:`, result);
        // 断开可能存在的旧连接
        const oldSocket = gameState.playerSockets.get(result.id);
        if (oldSocket && oldSocket.id !== socket.id) {
          logger.info(`[startMatching] Disconnecting old socket:`, oldSocket.id);
          oldSocket.disconnect(true);
          gameState.playerSockets.delete(result.id);
          
          // 从等待列表中移除旧连接
          gameState.waitingPlayers = gameState.waitingPlayers.filter(p => p.id !== result.id);
        }
      }
      
      // 获取玩家信息
      const playerInfo = await getPlayer(socket.id);
      logger.info('[startMatching] Player info:', playerInfo);
      
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
        logger.info('[startMatching] Starting new game with players:', 
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
      logger.error('[startMatching] Error:', error);
      socket.emit('error', { message: 'Failed to start matching' });
    }
  });

  socket.on('playerReady', ({ gameId }) => {
    logger.info(`[playerReady] Player ${socket.id} ready in game ${gameId}`);
    const game = gameState.activeGames.get(gameId);
    if (!game) {
      logger.info(`[playerReady] Game not found: ${gameId}`);
      return;
    }

    // 确保玩家在正确的房间中
    if (!socket.rooms.has(gameId)) {
      logger.info(`[playerReady] Player not in game room, joining: ${gameId}`);
      socket.join(gameId);
    }

    // 更新玩家准备状态
    const player = game.players.find(p => p.id === socket.id);
    if (player) {
      logger.info(`[playerReady] Found player in game, updating ready status:`, {
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
      
      logger.info(`[playerReady] Human players ready status:`, 
        humanPlayers.map(p => ({ id: p.id, nickname: p.nickname, ready: p.isReady }))
      );

      if (allReady) {
        logger.info(`[playerReady] All human players ready, starting game`);
        // 更新游戏状态并广播游戏开始
        game.state = 'questioning';
        io.to(gameId).emit('gameStart');
      }
    } else {
      logger.info(`[playerReady] Player not found in game:`, socket.id);
    }
  });

  socket.on('cancelMatching', () => {
    logger.info(`[cancelMatching] Player ${socket.id} cancelled matching`);
    // 从等待列表中移除玩家
    gameState.waitingPlayers = gameState.waitingPlayers.filter(p => p.id !== socket.id);
    
    // 广播更新后的等待玩家数量
    io.emit('matchingUpdate', {
      count: gameState.waitingPlayers.length
    });
  });

  socket.on('disconnect', () => {
    logger.info('[disconnect] Client disconnected:', socket.id);
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
      logger.info(`[selectPlayer] Broadcasting selection to game ${game.id}. Selected player: ${playerId}`);
      logger.info(`[selectPlayer] Current players in game:`, game.players.map(p => p.id));
      
      // 广播选择给所有玩家
      io.in(game.id).emit('playerSelected', { 
        playerId,
        selectedBy: socket.id 
      });
      
      // 确认消息已发送
      logger.info(`[selectPlayer] Selection broadcast completed`);
    } else {
      logger.info(`[selectPlayer] Game not found for questioner ${socket.id}`);
    }
  });

  socket.on('submitQuestion', async ({ gameId, question }) => {
    const game = gameState.activeGames.get(gameId);
    if (!game || socket.id !== game.questioner.id) return;

    // 清除之前的答案
    game.answers.clear();
    game.currentQuestion = question;

    // 广播问题给所有玩家
    io.to(gameId).emit('questionReceived', { question });

    // 为每个AI玩家生成答案
    try {
      console.log('Generating AI answers for question:', question);
      const aiAnswerPromises = game.aiPlayers.map(async (ai) => {
        try {
          const answer = await generateAIAnswer(question, ai.modelKey);
          game.answers.set(ai.id, answer);
          console.log(`AI ${ai.modelKey} answered:`, answer);
          return true;
        } catch (error) {
          console.error(`Error generating answer for AI ${ai.modelKey}:`, error);
          // 在出错时使用默认回答
          const fallbackAnswer = "抱歉，我需要一点时间思考这个问题...";
          game.answers.set(ai.id, fallbackAnswer);
          return true;
        }
      });

      // 等待所有AI回答完成
      await Promise.all(aiAnswerPromises);

      // 检查是否所有答案都已收到
      const allAIAnswered = game.aiPlayers.every(ai => game.answers.has(ai.id));
      const humanAnswered = game.answers.has(game.humanPlayer.id);
      
      if (allAIAnswered && humanAnswered) {
        // 所有答案都已收到，通知所有玩家
        io.to(gameId).emit('allAnswersReceived', {
          answers: Array.from(game.answers.entries()).map(([id, answer]) => ({
            playerId: id,
            answer
          }))
        });
      }
    } catch (error) {
      console.error('Error handling question submission:', error);
      socket.emit('error', { message: '处理问题时出错，请重试' });
    }
  });

  socket.on('submitAnswer', async ({ gameId, answer }) => {
    const game = gameState.activeGames.get(gameId);
    if (!game || socket.id !== game.humanPlayer.id) return;

    try {
      // 检查答案长度
      if (answer.length > 30) {
        socket.emit('error', { message: '回答不能超过30个字' });
        return;
      }

      // 保存人类玩家的回答
      game.answers.set(socket.id, answer);
      console.log('Human player answered:', answer);

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
    } catch (error) {
      console.error('Error handling answer submission:', error);
      socket.emit('error', { message: '提交答案时出错，请重试' });
    }
  });

  socket.on('guessModel', ({ gameId, playerId, modelGuess }) => {
    const game = gameState.activeGames.get(gameId);
    if (!game || socket.id !== game.questioner.id) return;

    // 增加详细日志
    logger.info('[guessModel] Guess Model Event Details:', {
      gameId,
      playerId,
      modelGuess,
      currentScore: game.score,
      questionerId: game.questioner.id,
      currentSocketId: socket.id,
      gameScores: Object.fromEntries(game.scores),
      gameState: {
        round: game.round,
        aiPlayers: game.aiPlayers.map(ai => ai.id)
      }
    });

    // 如果是取消标记，返还2分
    if (!modelGuess) {
      game.modelGuessScore += 2;
      game.modelGuesses.delete(playerId);
      
      logger.info('[guessModel] Cancelling Model Guess:', {
        playerId,
        oldScore: game.modelGuessScore - 2,
        newScore: game.modelGuessScore,
        scoreChange: 2
      });

      io.to(game.questioner.id).emit('scoreUpdate', {
        score: game.score,
        modelGuessScore: game.modelGuessScore,
        totalScore: game.score + game.modelGuessScore
      });
      return;
    }

    // 扣除2分猜测成本
    game.modelGuessScore -= 2;
    logger.info('[guessModel] Deducting Score for Guess:', {
      oldScore: game.modelGuessScore + 2,
      newScore: game.modelGuessScore,
      scoreChange: -2
    });

    // 记录猜测
    game.modelGuesses.set(playerId, modelGuess);

    // 检查猜测是否正确
    const aiPlayer = game.aiPlayers.find(p => p.id === playerId);
    
    logger.info('[guessModel] AI Player Check:', {
      playerId,
      aiPlayer: aiPlayer ? {
        id: aiPlayer.id,
        modelKey: aiPlayer.modelKey
      } : null,
      modelGuess
    });

    if (aiPlayer && aiPlayer.modelKey === modelGuess) {
      // 猜对了，加8分
      const oldScore = game.modelGuessScore;
      game.modelGuessScore += 8;
      
      logger.info('[guessModel] Correct Guess Detected:', {
        playerId,
        modelKey: aiPlayer.modelKey,
        scoreBeforeBonus: oldScore,
        scoreAfterBonus: game.modelGuessScore,
        bonus: 8
      });
    }

    // 通知提问者结果
    logger.info('[guessModel] Score Update Notification:', {
      questionerId: game.questioner.id,
      modelGuessScore: game.modelGuessScore,
      totalScore: game.score + game.modelGuessScore
    });

    io.to(game.questioner.id).emit('scoreUpdate', {
      score: game.score,
      modelGuessScore: game.modelGuessScore,
      totalScore: game.score + game.modelGuessScore
    });
  });

  socket.on('submitChoice', async ({ gameId, playerId }) => {
    const game = gameState.activeGames.get(gameId);
    if (!game) return;

    // 增加详细日志
    logger.info('[submitChoice] Choice Submission Details:', {
      gameId,
      playerId,
      currentRound: game.round,
      questionerNickname: game.questioner.nickname,
      initialQuestionerScore: game.score,
      initialAnswererScore: game.answererScore,
      gameScores: Object.fromEntries(game.scores)
    });

    const selectedPlayer = game.aiPlayers.find(p => p.id === playerId);
    const isAI = !!selectedPlayer;
    let tauntMessage = '';

    logger.info('[submitChoice] Player Selection:', {
      selectedPlayerId: playerId,
      isAI,
      aiPlayerDetails: selectedPlayer ? {
        id: selectedPlayer.id,
        modelKey: selectedPlayer.modelKey,
        nickname: selectedPlayer.nickname
      } : null
    });

    if (isAI) {
      // 如果选中的是AI，生成嘲讽消息
      try {
        tauntMessage = await generateTauntMessage(selectedPlayer.modelKey, game.currentQuestion);
      } catch (error) {
        console.error('Error generating taunt message:', error);
        tauntMessage = '看来我的回答很有说服力呢～';
      }

      // 从游戏中移除这个AI玩家
      game.aiPlayers = game.aiPlayers.filter(p => p.id !== playerId);
    }

    // 计算本轮分数
    const scores = {
      // 提问者在不同轮次找到真人的得分
      questioner: {
        1: 8,  // 第1轮找到真人得8分
        2: 4,  // 第2轮找到真人得4分
        3: 2   // 第3轮找到真人得2分
      },
      // 回答者在不同轮次的得分
      answerer: {
        found: {  // 被找到时的得分
          1: 0,   // 第1轮被找到得0分
          2: 2,   // 第2轮被找到得2分
          3: 4    // 第3轮被找到得4分
        },
        survive: {  // 存活时的得分
          1: 2,    // 第1轮存活得2分
          2: 4,    // 第2轮存活得4分
          3: 8     // 第3轮存活得8分
        }
      }
    };

    // 计算并更新分数
    const oldQuestionerScore = game.score;
    const oldAnswererScore = game.answererScore;

    if (!isAI) {
      // 提问者找到真人
      game.score = scores.questioner[game.round] || 0;
      // 回答者被找到
      game.answererScore = game.humanPlayer ? scores.answerer.found[game.round] || 0 : 0;
    } else {
      // 提问者没找到真人
      game.score = 0;
      // 回答者继续存活
      game.answererScore = game.humanPlayer ? scores.answerer.survive[game.round] || 0 : 0;
    }

    // 记录分数更新详细日志
    logger.info('[submitChoice] Score Calculation Details:', {
      isAI,
      round: game.round,
      questionerScoreCalculation: {
        baseScore: scores.questioner[game.round] || 0,
        oldScore: oldQuestionerScore,
        finalScore: game.score,
        modelGuessScore: game.modelGuessScore,
        totalScore: game.score + game.modelGuessScore,
        scoreChange: game.score - oldQuestionerScore
      },
      answererScoreCalculation: {
        baseScore: isAI 
          ? scores.answerer.survive[game.round] || 0 
          : scores.answerer.found[game.round] || 0,
        oldScore: oldAnswererScore,
        finalScore: game.answererScore,
        scoreChange: game.answererScore - oldAnswererScore
      },
      potentialNextRoundScores: {
        questioner: scores.questioner[game.round + 1] || 0,
        answerer: {
          found: scores.answerer.found[game.round + 1] || 0,
          survive: scores.answerer.survive[game.round + 1] || 0
        }
      }
    });

    // 更新并发送分数给提问者和回答者
    io.to(game.questioner.id).emit('roundResult', {
      correct: !isAI,
      score: game.score,
      modelGuessScore: game.modelGuessScore,
      totalScore: game.score + game.modelGuessScore,
      potentialScore: scores.questioner[game.round + 1] || 0,  
      tauntMessage,
      remainingAI: game.aiPlayers.length,
      round: game.round + 1
    });

    if (game.humanPlayer) {
      io.to(game.humanPlayer.id).emit('roundResult', {
        correct: !isAI,
        score: game.answererScore,
        modelGuessScore: 0,
        totalScore: game.answererScore,
        potentialScore: scores.answerer.survive[game.round + 1] || 0,  
        tauntMessage,
        remainingAI: game.aiPlayers.length,
        round: game.round + 1
      });
    }

    // 额外发送一个scoreUpdate事件来确保分数显示正确
    io.to(game.questioner.id).emit('scoreUpdate', {
      score: game.score,
      modelGuessScore: game.modelGuessScore,
      totalScore: game.score + game.modelGuessScore
    });

    if (!isAI || game.aiPlayers.length === 0 || game.round >= 3) {
      let reason;
      if (!isAI) {
        reason = '选中了真人';
      } else if (game.aiPlayers.length === 0) {
        reason = '所有AI都被找出';
      } else {
        reason = '达到最大回合';
      }

      // 创建一个Promise来处理数据库更新
      const updateScoresPromise = (async () => {
        try {
          // 在更新前查询玩家当前分数
          const questioner = await getPlayer(game.questioner.nickname);
          const answerer = game.humanPlayer ? await getPlayer(game.humanPlayer.nickname) : null;

          logger.info('[submitChoice] Starting database update:', {
            questioner: game.questioner.nickname,
            score: game.score,
            reason
          });

          logger.info('[submitChoice] Current questioner data:', questioner);

          // 更新提问者的分数
          if (game.score > 0) {
            logger.info('Updating questioner score:', {
              id: game.questioner.id,
              nickname: game.questioner.nickname,
              scoreToAdd: game.score,
              updateParams: {
                id: game.questioner.id,
                score: game.score,
                nickname: game.questioner.nickname
              }
            });
            await updatePlayerScore(game.questioner.id, game.score, game.questioner.nickname);
            const updatedQuestioner = await getPlayer(game.questioner.nickname);
            logger.info('After questioner update:', {
              id: game.questioner.id,
              nickname: updatedQuestioner?.nickname,
              oldScore: questioner?.total_score,
              newTotalScore: updatedQuestioner?.total_score,
              scoreAdded: game.score,
              updateSuccess: updatedQuestioner?.total_score === (questioner?.total_score || 0) + game.score
            });
          } else {
            logger.info('Skipping questioner score update - no score to add', {
              id: game.questioner.id,
              nickname: game.questioner.nickname,
              currentScore: game.score
            });
          }

          // 更新回答者的分数（如果不是AI）
          if (game.humanPlayer && (game.answererScore || 0) > 0) {
            logger.info('Updating answerer score:', {
              id: game.humanPlayer.id,
              nickname: game.humanPlayer.nickname,
              scoreToAdd: game.answererScore,
              updateParams: {
                id: game.humanPlayer.id,
                score: game.answererScore,
                nickname: game.humanPlayer.nickname
              }
            });
            await updatePlayerScore(game.humanPlayer.id, game.answererScore || 0, game.humanPlayer.nickname);
            const updatedAnswerer = await getPlayer(game.humanPlayer.nickname);
            logger.info('After answerer update:', {
              id: game.humanPlayer.id,
              nickname: updatedAnswerer?.nickname,
              oldScore: answerer?.total_score,
              newTotalScore: updatedAnswerer?.total_score,
              scoreAdded: game.answererScore,
              updateSuccess: updatedAnswerer?.total_score === (answerer?.total_score || 0) + (game.answererScore || 0)
            });
          } else {
            logger.info('Skipping answerer score update:', {
              hasHumanPlayer: !!game.humanPlayer,
              answererScore: game.answererScore,
              humanPlayerId: game.humanPlayer?.id,
              humanPlayerNickname: game.humanPlayer?.nickname
            });
          }
          
          // 获取并广播最新的排行榜
          const leaderboard = await getLeaderboard();
          logger.info('New leaderboard:', leaderboard);
          
          // 特别监控"22"玩家的排名情况
          const player22 = leaderboard.find(p => p.nickname === '22');
          if (player22) {
            logger.info('Player "22" in leaderboard:', player22);
          }
          
          io.emit('leaderboardUpdate', { leaderboard });
          
        } catch (error) {
          logger.error('Error updating player scores:', error);
          logger.error('Error details:', {
            error: error.message,
            stack: error.stack
          });
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

      // 等待数据库更新和玩家状态重置完成
      await Promise.all([
        updateScoresPromise,
        // Reset all players' ready state
        ...Array.from(io.sockets.adapter.rooms.get(gameId) || []).map(playerId => {
          const playerSocket = io.sockets.sockets.get(playerId);
          if (playerSocket) {
            playerSocket.data.ready = false;
          }
          return Promise.resolve();
        })
      ]);

      // 只有在所有更新完成后才重置游戏状态
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
      logger.error('Error getting leaderboard:', error);
      socket.emit('error', { message: 'Failed to get leaderboard' });
    }
  });

  socket.on('requestSuggestedQuestions', async () => {
    try {
      const questions = await generateSuggestedQuestions();
      socket.emit('suggestedQuestions', questions);
    } catch (error) {
      console.error('Error generating questions:', error);
      socket.emit('error', { message: '生成推荐问题时出错' });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
