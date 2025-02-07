<template>
  <div class="game-intro">
    <h2 class="title">游戏介绍</h2>
    
    <div class="players-section">
      <div class="players-list">
        <div v-for="player in players" :key="player.id" 
             class="player-avatar"
             :class="{ 'self': player.id === currentPlayerId }">
          <div class="avatar-wrapper">
            <img :src="player.avatar" :alt="player.nickname">
            <div class="ready-indicator" :class="{ 'ready': player.isReady }"></div>
            <div class="player-role" :class="{ 'questioner': player.isQuestioner }">
              {{ player.isQuestioner ? '提问者' : '回答者' }}
            </div>
            <div class="player-name">{{ player.nickname }}</div>
            <div v-if="player.isAI" class="status-dot online"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="role-description">
      <h3>你的角色：{{ isQuestioner ? '提问者' : '回答者' }}</h3>
      <div v-if="isQuestioner">
        <h4>提问者目标：</h4>
        <ul>
          <li>游戏一共有3轮，每一轮你需要向AI和人类玩家提出一个问题，观察他们的回答</li>
          <li>选中你觉得最像人类的回答，淘汰他，越早淘汰你能获得越高的积分</li>
          <li>如果有把握看出某个AI使用了什么模型，你也可以直接标记他的模型，注意这个行为会消耗你2点积分，如果标记正确则会获得4倍的回报</li>
        </ul>
      </div>
      <div v-else>
        <h4>回答者目标：</h4>
        <ul>
          <li>游戏一共有3轮，每一轮你和AI会同时收到提问者的问题，请假装你是一个AI，回答这个问题</li>
          <li>提问者会选择他觉得最像真人的回答者，让他出局。你生存的轮数越久，就会获得成倍的奖励</li>
        </ul>
      </div>
    </div>

    <div class="leaderboard-section">
      <Leaderboard />
    </div>

    <div class="ready-section">
      <button 
        class="ready-button" 
        :class="{ 'ready': isReady }"
        @click="toggleReady"
        :disabled="isReady"
      >
        {{ isReady ? '已准备' : '我准备好了' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.game-intro {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.title {
  text-align: center;
  color: #2c3e50;
  margin-bottom: 30px;
  font-size: 28px;
}

.players-section {
  background: white;
  border-radius: 12px;
  padding: 40px 20px;
  margin-bottom: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.players-list {
  display: flex;
  justify-content: center;
  gap: 30px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.player-avatar {
  position: relative;
  margin-bottom: 45px;
}

.player-avatar.self .avatar-wrapper {
  border: 3px solid #ffd700;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
}

.avatar-wrapper {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: white;
  padding: 3px;
  transition: all 0.3s ease;
}

.avatar-wrapper img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.ready-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid white;
  background-color: #e0e0e0;
  transition: all 0.3s ease;
  z-index: 2;
}

.ready-indicator.ready {
  background-color: #4CAF50;
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.5);
}

.player-role {
  position: absolute;
  bottom: -22px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  padding: 2px 8px;
  border-radius: 10px;
  background-color: #e8f5e9;
  transition: all 0.3s ease;
}

.player-role.questioner {
  background-color: #fff3cd;
  color: #856404;
}

.player-name {
  position: absolute;
  bottom: -45px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
  white-space: nowrap;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.status-dot {
  position: absolute;
  bottom: 5px;
  right: 5px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
  background-color: #67C23A;
}

.role-description {
  background: white;
  padding: 25px;
  border-radius: 8px;
  margin-bottom: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.role-description h3 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.role-description h4 {
  color: #495057;
  margin-bottom: 15px;
}

.role-description ul {
  list-style-type: disc;
  padding-left: 20px;
}

.role-description li {
  margin-bottom: 10px;
  line-height: 1.5;
  color: #495057;
}

.leaderboard-section {
  background: white;
  padding: 25px;
  border-radius: 8px;
  margin-bottom: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.ready-section {
  text-align: center;
  margin-top: 30px;
}

.ready-button {
  padding: 12px 30px;
  font-size: 16px;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: #4CAF50;
  color: white;
  min-width: 200px;
}

.ready-button:not(.ready):hover {
  background-color: #45a049;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.ready-button.ready {
  background-color: #45a049;
  cursor: not-allowed;
}

.ready-button:disabled {
  opacity: 0.7;
}
</style>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import socket from '../socket'
import Leaderboard from '../components/Leaderboard.vue'

const store = useStore()
const router = useRouter()

const players = computed(() => store.state.game.players)
const isQuestioner = computed(() => store.state.game.isQuestioner)
const currentPlayerId = computed(() => store.state.game.socket?.id)
const gameState = computed(() => store.state.game.gameState)
const gameId = computed(() => store.state.game.gameId)

const gameDescription = computed(() => {
  if (isQuestioner.value) {
    return `1. 游戏一共有3轮，每一轮你需要向AI和人类玩家提出一个问题，观察他们的回答
2. 选中你觉得最像人类的回答，淘汰他，越早淘汰你能获得越高的积分
3. 如果有把握看出某个AI使用了什么模型，你也可以直接标记他的模型，注意这个行为会消耗你2点积分，如果标记正确则会获得4倍的回报`
  } else {
    return `1. 游戏一共有3轮，每一轮你和AI会同时收到提问者的问题，请假装你是一个AI，回答这个问题
2. 提问者会选择他觉得最像真人的回答者，让他出局。你生存的轮数越久，就会获得成倍的奖励`
  }
})

// 监听游戏状态变化
watch(gameState, (newState) => {
  if (newState === 'questioning') {
    router.push('/game')
  }
})

// 获取当前玩家的准备状态
const isReady = computed(() => {
  const currentPlayer = players.value.find(p => p.id === currentPlayerId.value)
  return currentPlayer?.isReady || false
})

const toggleReady = () => {
  if (!isReady.value) {
    console.log('Toggling ready state, gameId:', gameId.value)
    store.dispatch('game/setPlayerReady', gameId.value)
  }
}

// 监听玩家准备状态更新
onMounted(() => {
  // 如果有游戏ID，请求更新玩家列表
  const currentGameId = store.state.game.gameId
  console.log('Current game ID:', currentGameId)
  console.log('Current players:', store.state.game.players)
  
  if (currentGameId) {
    console.log('Requesting players update for game:', currentGameId)
    socket.emit('requestPlayersUpdate', { gameId: currentGameId })
  }

  // 监听玩家列表更新
  socket.on('playersUpdate', ({ players }) => {
    console.log('Received players update:', players)
    store.commit('game/setPlayers', players)
  })

  socket.on('playerReady', (playerId) => {
    console.log('Player ready:', playerId)
    store.dispatch('game/updatePlayerReadyStatus', playerId)
  })

  socket.on('gameStart', () => {
    console.log('Game starting')
    store.dispatch('game/updateGameState', { gameState: 'questioning' })
  })

  // 清理事件监听器
  return () => {
    socket.off('playersUpdate')
    socket.off('playerReady')
    socket.off('gameStart')
  }
})
</script>
