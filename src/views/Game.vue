<template>
  <div class="game">
    <div class="game-container">
      <div class="game-header">
        <h2>第{{ currentRound }}轮</h2>
        <div class="score">积分: {{ score }}</div>
      </div>

      <!-- 提问者界面 -->
      <div v-if="isQuestioner" class="questioner-view">
        <div v-if="gameState === 'asking'" class="question-section">
          <h3>请选择或输入一个问题：</h3>
          <div class="suggested-questions">
            <el-radio-group v-model="selectedQuestion">
              <el-radio 
                v-for="(q, index) in suggestedQuestions" 
                :key="index" 
                :label="q"
                class="question-option"
              >
                {{ q }}
              </el-radio>
            </el-radio-group>
          </div>
          <div class="custom-question">
            <el-input
              v-model="customQuestion"
              type="textarea"
              placeholder="或者输入自定义问题"
              :rows="2"
            />
          </div>
          <el-button 
            type="primary" 
            @click="submitQuestion"
            :disabled="!selectedQuestion && !customQuestion"
          >
            提交问题
          </el-button>
        </div>

        <div v-if="gameState === 'choosing'" class="answers-section">
          <h3>请选择你认为是真人的玩家：</h3>
          <div class="available-models" v-if="availableModels.length">
            <h4>本局参与的AI模型：</h4>
            <el-tag 
              v-for="model in availableModels" 
              :key="model"
              class="model-tag"
            >
              {{ model }}
            </el-tag>
          </div>
          <div class="players-grid">
            <div 
              v-for="player in players" 
              :key="player.id" 
              class="player-card"
              :class="{ selected: selectedPlayer === player.id }"
            >
              <el-avatar :size="50">{{ player.nickname.charAt(0) }}</el-avatar>
              <div class="player-name">{{ player.nickname }}</div>
              <div class="player-answer">{{ player.answer }}</div>
              <div class="model-guess" v-if="isQuestioner">
                <el-select 
                  v-model="modelGuesses[player.id]" 
                  placeholder="标记AI模型"
                  @change="guessModel(player.id)"
                >
                  <el-option
                    v-for="model in availableModels"
                    :key="model"
                    :label="model"
                    :value="model"
                  />
                </el-select>
              </div>
            </div>
          </div>
          <el-button 
            type="primary" 
            @click="submitChoice"
            :disabled="!selectedPlayer"
          >
            确认选择
          </el-button>
        </div>
      </div>

      <!-- 回答者界面 -->
      <div v-else class="answerer-view">
        <div v-if="gameState === 'asking'">
          <h3>等待提问者提问...</h3>
          <div class="suggested-questions disabled">
            <div 
              v-for="(q, index) in suggestedQuestions" 
              :key="index" 
              class="question-preview"
            >
              {{ q }}
            </div>
          </div>
        </div>

        <div v-if="gameState === 'answering'">
          <h3>请回答问题：</h3>
          <div class="current-question">{{ currentQuestion }}</div>
          <el-input
            v-model="answer"
            type="textarea"
            placeholder="输入你的回答"
            :rows="3"
          />
          <div class="timer">剩余时间：{{ timer }}秒</div>
          <el-button 
            type="primary" 
            @click="submitAnswer"
            :disabled="!answer"
          >
            提交回答
          </el-button>
        </div>

        <div v-if="gameState === 'choosing'">
          <h3>等待提问者选择...</h3>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'

const store = useStore()

// 游戏状态
const currentRound = ref(1)
const score = ref(0)
const gameState = ref('asking') // asking, answering, choosing
const isQuestioner = ref(false)
const suggestedQuestions = ref([
  "你最喜欢的一本书是什么？为什么？",
  "如果可以选择一个超能力，你会选择什么？",
  "你认为人工智能会在未来取代人类吗？为什么？"
])
const selectedQuestion = ref('')
const customQuestion = ref('')
const currentQuestion = ref('')
const answer = ref('')
const timer = ref(10)
const players = ref([])
const selectedPlayer = ref(null)
const availableModels = ref([])
const modelGuesses = ref({})

let timerInterval

onMounted(() => {
  // 初始化游戏状态
  initializeGame()
  
  // 设置Socket.IO监听器
  setupSocketListeners()
})

onUnmounted(() => {
  clearInterval(timerInterval)
})

const initializeGame = () => {
  // 从store获取初始游戏状态
  isQuestioner.value = store.state.game.isQuestioner
  availableModels.value = store.state.game.availableModels || []
  score.value = store.state.game.score
}

const setupSocketListeners = () => {
  // 设置Socket.IO事件监听
  socket.on('modelGuessResult', ({ correct, score: newScore }) => {
    score.value = newScore
    ElMessage({
      type: correct ? 'success' : 'error',
      message: correct ? '标记正确！获得4积分' : '标记错误，扣除2积分'
    })
  })

  socket.on('roundResult', ({ correct, score: newScore, tauntMessage }) => {
    score.value = newScore
    if (tauntMessage) {
      ElMessage({
        type: 'warning',
        message: tauntMessage,
        duration: 5000
      })
    }
  })
}

const submitQuestion = () => {
  const question = customQuestion.value || selectedQuestion.value
  store.dispatch('game/submitQuestion', question)
  gameState.value = 'answering'
}

const submitAnswer = () => {
  store.dispatch('game/submitAnswer', answer.value)
  gameState.value = 'choosing'
}

const selectPlayer = (playerId) => {
  selectedPlayer.value = playerId
}

const submitChoice = () => {
  store.dispatch('game/submitChoice', selectedPlayer.value)
}

const guessModel = (playerId) => {
  if (score.value < 2) {
    ElMessage.warning('积分不足，需要2积分才能标记模型')
    return
  }
  
  store.dispatch('game/guessModel', {
    playerId,
    modelGuess: modelGuesses.value[playerId]
  })
}
</script>

<style scoped>
.game {
  min-height: 100vh;
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.game-container {
  background: rgba(255, 255, 255, 0.95);
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 800px;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.score {
  font-size: 1.2em;
  font-weight: bold;
  color: #409EFF;
}

.question-section,
.answers-section {
  margin-bottom: 30px;
}

.suggested-questions {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin: 20px 0;
}

.question-option {
  text-align: left;
  padding: 10px;
  border: 1px solid #DCDFE6;
  border-radius: 4px;
}

.custom-question {
  margin: 20px 0;
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

.player-card {
  padding: 20px;
  border: 1px solid #DCDFE6;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.player-card:hover {
  border-color: #409EFF;
}

.player-card.selected {
  border-color: #409EFF;
  background-color: #ecf5ff;
}

.player-name {
  margin: 10px 0;
  font-weight: bold;
}

.player-answer {
  font-size: 0.9em;
  color: #606266;
}

.timer {
  margin: 15px 0;
  font-weight: bold;
  color: #F56C6C;
}

.current-question {
  margin: 15px 0;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
  font-weight: bold;
}

.disabled {
  opacity: 0.7;
  pointer-events: none;
}

.question-preview {
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 10px;
}

.available-models {
  margin: 20px 0;
  text-align: left;
}

.model-tag {
  margin: 5px;
}

.model-guess {
  margin-top: 10px;
}
</style>
