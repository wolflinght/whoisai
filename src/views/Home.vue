<template>
  <div class="home">
    <h1>谁是AI</h1>
    <div v-if="!isMatching" class="start-section">
      <el-input
        v-model="nickname"
        placeholder="请输入你的昵称"
        :maxlength="10"
        show-word-limit
      />
      <el-button 
        type="primary" 
        @click="startMatching"
        :disabled="!nickname"
      >
        开始匹配
      </el-button>
    </div>
    <div v-else class="matching-section">
      <el-progress 
        type="circle" 
        :percentage="matchingProgress"
        :status="matchingProgress >= 90 ? 'warning' : ''"
      />
      <p>正在匹配玩家... {{ waitingCount }}/2</p>
      <el-button @click="cancelMatching">取消匹配</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { socket } from '../socket'
import { ElMessage } from 'element-plus'

const router = useRouter()
const store = useStore()

const nickname = ref('')
const isMatching = ref(false)
const matchingProgress = ref(0)
const waitingCount = ref(0)
let progressInterval

const startMatching = () => {
  if (!nickname.value) {
    ElMessage.warning('请输入昵称')
    return
  }
  
  if (!socket.connected) {
    ElMessage.error('无法连接到服务器，请刷新页面重试')
    return
  }

  console.log('Starting matching with nickname:', nickname.value)
  isMatching.value = true
  matchingProgress.value = 0
  waitingCount.value = 1 // 设置初始等待人数为1（当前玩家）
  
  socket.emit('startMatching', { nickname: nickname.value })
  
  // 启动进度条动画
  progressInterval = setInterval(() => {
    if (matchingProgress.value < 90) {
      matchingProgress.value += 2
    }
  }, 100)
}

const cancelMatching = () => {
  console.log('Cancelling matching')
  isMatching.value = false
  matchingProgress.value = 0
  waitingCount.value = 0
  clearInterval(progressInterval)
  socket.emit('cancelMatching')
}

const setupSocketListeners = () => {
  // 监听匹配状态更新
  socket.on('matchingUpdate', ({ count }) => {
    console.log('Matching update received:', count)
    waitingCount.value = count
  })

  // 监听游戏开始
  socket.on('gameStart', (gameData) => {
    console.log('Game start received:', gameData)
    clearInterval(progressInterval)
    store.dispatch('game/initializeGame', gameData)
    router.push('/game-intro')
  })

  // 监听错误
  socket.on('matchingError', ({ message }) => {
    console.error('Matching error:', message)
    ElMessage.error(message)
    isMatching.value = false
    matchingProgress.value = 0
    clearInterval(progressInterval)
  })
}

onMounted(() => {
  setupSocketListeners()
})

onUnmounted(() => {
  clearInterval(progressInterval)
  // 清理所有事件监听
  socket.off('matchingUpdate')
  socket.off('gameStart')
  socket.off('matchingError')
})
</script>

<style scoped>
.home {
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 20px;
  text-align: center;
}

h1 {
  color: #409EFF;
  margin-bottom: 40px;
}

.start-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 300px;
  margin: 0 auto;
}

.matching-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.el-progress {
  margin: 20px 0;
}
</style>
