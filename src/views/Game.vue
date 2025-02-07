<template>
  <div class="game">
    <div class="game-container">
      <div class="game-header">
        <h2>第{{ currentRound }}轮</h2>
        <div v-if="nextRoundTimer > 0" class="next-round-timer">
          {{ nextRoundTimer }}秒后开始下一轮
        </div>
        <div class="game-info">
          <div class="score">积分: {{ score }}</div>
          <div class="remaining-ai">剩余AI: {{ remainingAI }}</div>
        </div>
      </div>

      <!-- 提问者界面 -->
      <div v-if="isQuestioner" class="questioner-view">
        <div v-if="gameState === 'asking'" class="question-section">
          <h3>请输入或选择一个问题：</h3>
          <div class="custom-question">
            <el-input
              v-model="customQuestion"
              type="textarea"
              placeholder="请输入问题或点击下方推荐问题"
              :rows="3"
            />
            <el-button 
              type="primary" 
              @click="submitQuestion"
              :disabled="!customQuestion"
              class="submit-button"
            >
              提交问题
            </el-button>
          </div>
          <div class="suggested-questions">
            <h4>推荐问题：</h4>
            <div class="question-tags">
              <el-tag
                v-for="(q, index) in suggestedQuestions"
                :key="index"
                class="question-tag"
                @click="selectSuggestedQuestion(q)"
                :effect="customQuestion === q ? 'dark' : 'plain'"
              >
                {{ q }}
              </el-tag>
            </div>
          </div>
        </div>

        <div v-if="gameState === 'waiting'" class="waiting-section">
          <el-card class="waiting-card">
            <div class="waiting-content">
              <h3>等待回答中<span class="loading-dots">{{ loadingDots }}</span></h3>
              <p class="waiting-text">等待碳基生物和硅基生物回答...</p>
            </div>
          </el-card>
        </div>

        <div v-if="gameState === 'choosing'" class="answers-section">
          <div class="question-display">
            <h3>问题：{{ currentQuestion }}</h3>
          </div>
          
          <div class="answers-list">
            <h3>所有回答：</h3>
            <el-card 
              v-for="(answer, index) in shuffledAnswers" 
              :key="index"
              class="answer-card"
              :class="{ 'selected-answer-questioner': selectedPlayer === answer.playerId }"
              @click="selectPlayer(answer.playerId)"
            >
              <div 
                v-if="answer.tauntMessage" 
                class="taunt-bubble"
                :style="{ opacity: selectedPlayer === answer.playerId ? 1 : 0 }"
              >
                {{ answer.tauntMessage }}
              </div>
              <div class="answer-content">
                <div class="answer-number">{{ index + 1 }}号玩家</div>
                <div class="answer-text">{{ answer.answer }}</div>
                <div class="model-guess">
                  <el-select 
                    v-model="modelGuesses[answer.playerId]" 
                    placeholder="标记AI模型"
                    @change="guessModel(answer.playerId)"
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
            </el-card>
          </div>

          <div class="action-section">
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
            <el-button 
              type="primary" 
              @click="submitChoice"
              :disabled="!selectedPlayer"
              class="submit-button"
            >
              确认选择
            </el-button>
          </div>
        </div>
      </div>

      <!-- 回答者界面 -->
      <div v-else class="answerer-view">
        <div v-if="gameState === 'asking'">
          <h3>等待提问者提问<span class="loading-dots">{{ loadingDots }}</span></h3>
          <div class="suggested-questions-hint">本轮的建议问题是：</div>
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

        <div v-if="gameState === 'answering'" class="answering-section">
          <h3>请回答问题：</h3>
          <div class="current-question">{{ currentQuestion }}</div>
          <el-input
            v-model="answer"
            type="textarea"
            placeholder="输入你的回答"
            :rows="3"
            class="answer-input"
          />
          <div class="button-container">
            <el-button 
              type="primary" 
              @click="submitAnswer"
              :disabled="!answer"
              class="submit-answer-button"
            >
              提交回答
            </el-button>
          </div>
        </div>

        <div v-if="gameState === 'choosing'" class="answers-section">
          <div class="question-display">
            <h3>问题：{{ currentQuestion }}</h3>
          </div>
          
          <div class="answers-list">
            <h3>所有回答<span class="hint-text">（提问者正在选择最像真人的回答）</span></h3>
            <el-card 
              v-for="(answer, index) in shuffledAnswers" 
              :key="index"
              class="answer-card non-clickable"
              :class="{ 'selected-answer-answerer': selectedPlayer === answer.playerId }"
            >
              <div class="answer-content">
                <div class="answer-number">{{ index + 1 }}号玩家</div>
                <div class="answer-text">{{ answer.answer }}</div>
              </div>
            </el-card>
          </div>

          <div class="waiting-text">
            等待提问者选择<span class="loading-dots">{{ loadingDots }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import socket from '../socket'

const store = useStore()
const router = useRouter()

// 游戏状态
const currentRound = ref(1)
const score = ref(0)
const gameState = ref('asking')
const isQuestioner = ref(false)
const currentQuestion = ref('')
const nextRoundTimer = ref(0)
const remainingAI = ref(3) // 默认3个AI
const suggestedQuestions = ref([
  "你最喜欢的一本书是什么？为什么？",
  "如果可以选择一个超能力，你会选择什么？",
  "你认为人工智能会在未来取代人类吗？为什么？"
])
const selectedQuestion = ref('')
const customQuestion = ref('')
const answer = ref('')
const timer = ref(10)
const players = ref([])
const selectedPlayer = ref(null)
const availableModels = ref([])
const modelGuesses = ref({})
const waitingProgress = ref(0)
const loadingDots = ref('...')
let timerInterval = null
let loadingInterval = null

const answers = ref([])

const shuffledAnswers = computed(() => {
  if (!answers.value.length) return [];
  return [...answers.value].sort(() => Math.random() - 0.5);
});

onMounted(() => {
  // 初始化游戏状态
  initializeGame()
  
  // 设置Socket.IO监听器
  setupSocketListeners()
})

onUnmounted(() => {
  if (loadingInterval) {
    clearInterval(loadingInterval)
  }
  if (timerInterval) {
    clearInterval(timerInterval)
  }
})

const initializeGame = () => {
  // 从store获取初始游戏状态
  isQuestioner.value = store.state.game.isQuestioner
  availableModels.value = store.state.game.availableModels || []
  score.value = store.state.game.score
  currentQuestion.value = store.state.game.currentQuestion
  answers.value = store.state.game.answers
}

const setupSocketListeners = () => {
  // 设置Socket.IO事件监听
  socket.on('questionReceived', ({ question, remainingAI: aiCount }) => {
    currentQuestion.value = question
    remainingAI.value = aiCount
    if (!isQuestioner.value) {
      gameState.value = 'answering'
    }
  })

  socket.on('allAnswersReceived', ({ answers: receivedAnswers, remainingAI: aiCount }) => {
    answers.value = receivedAnswers
    remainingAI.value = aiCount
    gameState.value = 'choosing'
    if (loadingInterval) {
      clearInterval(loadingInterval)
    }
  })

  socket.on('roundResult', ({ correct, score: newScore, tauntMessage, remainingAI: aiCount }) => {
    score.value = newScore
    remainingAI.value = aiCount
    
    // 更新答案的嘲讽消息
    if (tauntMessage) {
      const selectedAnswer = answers.value.find(a => a.playerId === selectedPlayer.value)
      if (selectedAnswer) {
        selectedAnswer.tauntMessage = tauntMessage
      }
    }

    // 开始倒计时
    nextRoundTimer.value = 5
    const timerInterval = setInterval(() => {
      nextRoundTimer.value--
      if (nextRoundTimer.value <= 0) {
        clearInterval(timerInterval)
        // 重置游戏状态
        gameState.value = 'asking'
        currentQuestion.value = ''
        answers.value = []
        selectedPlayer.value = null
        currentRound.value++
      }
    }, 1000)
  })

  socket.on('gameOver', ({ winner, finalScore, reason }) => {
    let message = '';
    if (reason === 'humanFound') {
      message = '游戏结束！你选中了真人玩家';
    } else if (reason === 'allAIFound') {
      message = '游戏结束！所有AI玩家都被找出来了';
    } else {
      message = '游戏结束！已达到最大回合数';
    }

    message += `\n最终得分：${finalScore}`;
    handleGameOver(message)
  })
}

const handleGameOver = (message) => {
  ElMessage({
    type: 'success',
    message,
    duration: 5000,
    showClose: true
  })

  // 设置游戏状态为等待，但保持玩家列表
  store.commit('game/setGameState', 'waiting')

  // 延迟2秒后返回介绍页面
  setTimeout(() => {
    router.push('/game-intro')
  }, 2000)
}

const submitQuestion = () => {
  const question = customQuestion.value
  currentQuestion.value = question
  store.dispatch('game/submitQuestion', question)
  gameState.value = 'waiting'
  startLoadingAnimation()
}

const startLoadingAnimation = () => {
  let count = 0
  loadingInterval = setInterval(() => {
    count = (count + 1) % 4
    loadingDots.value = '.'.repeat(count)
  }, 500)
}

const submitAnswer = () => {
  store.dispatch('game/submitAnswer', answer.value)
  gameState.value = 'choosing'
}

const selectPlayer = (playerId) => {
  if (!isQuestioner.value) return
  selectedPlayer.value = playerId
  // 广播选择给其他玩家
  socket.emit('selectPlayer', { playerId })
}

const submitChoice = () => {
  store.dispatch('game/submitChoice', selectedPlayer.value)
}

const guessModel = (playerId) => {
  if (score.value < 2) {
    return
  }
  
  store.dispatch('game/guessModel', {
    playerId,
    modelGuess: modelGuesses.value[playerId]
  })
}

const selectSuggestedQuestion = (q) => {
  customQuestion.value = q
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
  margin-bottom: 20px;
  position: relative;
}

.game-info {
  display: flex;
  gap: 20px;
  align-items: center;
}

.score, .remaining-ai {
  font-weight: bold;
  color: #409EFF;
}

.next-round-timer {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  color: #409EFF;
  font-size: 1.2em;
  font-weight: bold;
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

.question-tag {
  cursor: pointer;
  margin: 5px;
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

.submit-button {
  margin-top: 10px;
}

.waiting-section {
  margin: 20px 0;
}

.waiting-card {
  margin: 20px 0;
}

.waiting-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  text-align: center;
}

.loading-dots {
  display: inline-block;
  min-width: 24px;
  text-align: left;
}

.waiting-text {
  margin: 20px 0;
  color: #606266;
}

.answers-section {
  padding: 20px;
}

.question-display {
  margin-bottom: 20px;
  text-align: center;
}

.answers-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 20px;
}

.answer-card {
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.answer-card:not(.non-clickable):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.non-clickable {
  cursor: default;
}

.selected-answer-questioner {
  border: 2px solid #409EFF;
}

.selected-answer-answerer {
  border: 2px solid #E6A23C;
  background-color: rgba(230, 162, 60, 0.1);
}

.answer-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.answer-number {
  font-weight: bold;
  color: #409EFF;
}

.answer-text {
  font-size: 1.1em;
  line-height: 1.5;
  white-space: pre-wrap;
}

.action-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  margin-top: 20px;
}

.model-guess {
  margin-top: 10px;
}

.available-models {
  text-align: center;
  margin-bottom: 20px;
}

.model-tag {
  margin: 0 5px;
}

.waiting-text {
  text-align: center;
  color: #606266;
  margin-top: 20px;
  font-size: 1.1em;
}

.suggested-questions-hint {
  margin: 20px 0 10px;
  color: #606266;
  font-size: 1.1em;
}

.loading-dots {
  display: inline-block;
  min-width: 24px;
}

.hint-text {
  font-size: 0.9em;
  color: #909399;
  font-weight: normal;
  margin-left: 8px;
}

.taunt-bubble {
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #F56C6C;
  color: white;
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 0.9em;
  max-width: 200px;
  text-align: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 1;
}

.taunt-bubble::after {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid #F56C6C;
}

@keyframes loading {
  0% { content: ''; }
  25% { content: '.'; }
  50% { content: '..'; }
  75% { content: '...'; }
  100% { content: ''; }
}

.loading-dots::after {
  content: '';
  animation: loading 2s infinite steps(4);
}

.answering-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.answer-input {
  margin: 20px 0;
}

.button-container {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.submit-answer-button {
  min-width: 120px;
}
</style>
