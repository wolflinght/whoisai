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
          </div>
        </div>
      </div>
    </div>

    <div class="role-description">
      <h3>你的角色：{{ isQuestioner ? '提问者' : '回答者' }}</h3>
      <div v-if="isQuestioner">
        <h4>提问者目标：</h4>
        <ul>
          <li>你需要提出问题来区分人类和AI的回答</li>
          <li>每轮游戏中，你将看到所有玩家的回答</li>
          <li>你需要选择最像人类的回答</li>
          <li>你可以在每一轮中标注具体某个AI玩家使用的是什么模型。每标注一个会消耗2点积分，但如果猜中了会获得8点积分，以小博大！</li>
        </ul>
      </div>
      <div v-else>
        <h4>回答者目标：</h4>
        <ul>
          <li>你需要回答提问者的问题</li>
          <li>如果你是人类：尽量自然地回答，让提问者选择你的回答</li>
          <li>如果你是AI：也要尽量自然地回答，避免被提问者识别出来</li>
          <li>当你的回答被选中时，你将获得积分</li>
        </ul>
      </div>
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
import { ref, computed, watch, onMounted } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import socket from '../socket'

const store = useStore()
const router = useRouter()

const players = computed(() => store.state.game.players)
const isQuestioner = computed(() => store.state.game.isQuestioner)
const currentPlayerId = computed(() => store.state.game.socket?.id)
const gameState = computed(() => store.state.game.gameState)
const gameId = computed(() => store.state.game.gameId)

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
    socket.off('playerReady')
    socket.off('gameStart')
  }
})
</script>
