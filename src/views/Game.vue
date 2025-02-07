<template>
  <div class="game">
    <div class="game-container">
      <div class="game-header">
        <div class="header-top">
          <h2>第{{ currentRound }}轮</h2>
          <div class="game-info">
            <div class="remaining-ai">剩余AI: {{ remainingAI }}</div>
          </div>
        </div>
        <div class="header-bottom">
          <div class="score">本局积分: {{ score || 0 }}{{ potentialScore ? ` (本轮${isQuestioner ? '胜利' : '生存'}可获得${potentialScore}分)` : '' }}</div>
          <div v-if="nextRoundTimer > 0" class="next-round-timer">
            {{ nextRoundTimer }}秒后开始下一轮
          </div>
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
              </div>
            </el-card>
          </div>

          <div class="waiting-text">
            等待提问者选择<span class="loading-dots">{{ loadingDots }}</span>
          </div>
        </div>
      </div>
    </div>
    <el-dialog
      v-model="showGameOverDialog"
      :title="gameOverTitle"
      width="30%"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div class="game-over-content">
        <div class="game-over-message">{{ gameOverMessage }}</div>
        <div class="score-details">
          <div class="final-score">最终得分：{{ finalScore || 0 }}</div>
          <div class="score-breakdown">{{ scoreBreakdown }}</div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="returnToIntro">返回大厅</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { ElMessage, ElDialog, ElButton } from 'element-plus'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import socket from '../socket'

const store = useStore()
const router = useRouter()

// 游戏状态
const currentRound = ref(1)
const score = ref(0)
const potentialScore = ref(0)
const gameState = ref('asking')
const isQuestioner = ref(false)
const currentQuestion = ref('')
const nextRoundTimer = ref(0)
const remainingAI = ref(0) // 默认0个AI
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

// 使用固定顺序显示回答列表
const shuffledAnswers = computed(() => {
  return answers.value;
});

// 游戏结束相关状态
const showGameOverDialog = ref(false)
const gameOverTitle = ref('')
const gameOverMessage = ref('')
const finalScore = ref(0)
const scoreBreakdown = ref('')

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
  remainingAI.value = store.state.game.remainingAI
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

  socket.on('roundResult', ({ correct, score: newScore, potentialScore: newPotentialScore, tauntMessage, remainingAI: aiCount }) => {
    score.value = newScore
    potentialScore.value = newPotentialScore
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

  socket.on('playerSelected', ({ playerId, selectedBy }) => {
    console.log(`[playerSelected] Player selected: ${playerId} by ${selectedBy}`);
    // 更新被选中的玩家
    selectedPlayer.value = playerId;
  })

  socket.on('gameOver', ({ winner, finalScore, reason }) => {
    handleGameOver(reason)
  })
}

const handleGameOver = (message) => {
  showGameOverDialog.value = true
  gameOverTitle.value = isQuestioner.value ? '提问者游戏结束' : '回答者游戏结束'
  
  if (isQuestioner.value) {
    if (message.includes('选中了真人')) {
      gameOverMessage.value = '恭喜你找出了真人玩家！'
    } else if (message.includes('所有AI')) {
      gameOverMessage.value = '所有AI玩家都被找出来了，但真人玩家成功存活到最后！'
    } else {
      gameOverMessage.value = '已达到最大回合数，真人玩家成功隐藏到最后！'
    }
  } else {
    if (message.includes('选中了真人')) {
      gameOverMessage.value = '很遗憾，你被提问者找出来了！'
    } else if (message.includes('所有AI')) {
      gameOverMessage.value = '恭喜你！所有AI都被找出来了，你成功存活到最后！'
    } else {
      gameOverMessage.value = '恭喜你！成功存活到最后一轮！'
    }
  }
  
  finalScore.value = score.value
  scoreBreakdown.value = isQuestioner.value ? 
    '每轮找出真人的得分：第1轮8分，第2轮4分，第3轮2分，第4轮0分\n猜对AI模型：+4分（消耗2分）' :
    '存活得分：第1轮2分，第2轮4分，第3轮8分'

  // 设置游戏状态为等待，但保持玩家列表
  store.commit('game/setGameState', 'waiting')
}

const returnToIntro = () => {
  showGameOverDialog.value = false
  router.push('/game-intro')
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
  console.log(`[selectPlayer] Selecting player: ${playerId}`);
  selectedPlayer.value = playerId;
  socket.emit('selectPlayer', { playerId });
  console.log(`[selectPlayer] Selection event emitted`);
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
  background-color: #f5f7fa;
  padding: 15px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.header-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 30px;
}

.game-info {
  display: flex;
  gap: 20px;
  align-items: center;
}

.score {
  font-size: 16px;
  color: #409EFF;
  font-weight: bold;
}

.remaining-ai {
  font-size: 16px;
  color: #67c23a;
  font-weight: bold;
}

.next-round-timer {
  color: #E6A23C;
  font-weight: bold;
  font-size: 16px;
  padding: 4px 12px;
  background-color: #fdf6ec;
  border-radius: 4px;
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
  overflow: visible;
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

.selected-answer-answerer .taunt-bubble {
  opacity: 1;
  transform: scale(1);
}

.answer-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 15px;
  position: relative;
}

.answer-number {
  font-weight: bold;
  color: #409EFF;
  margin-bottom: 10px;
}

.answer-text {
  font-size: 1.1em;
  line-height: 1.5;
  white-space: pre-wrap;
  color: #2c3e50;
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
  right: 20px;
  background: #ff4757;
  color: white;
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 14px;
  max-width: 300px;
  z-index: 10;
  opacity: 0;
  transform-origin: bottom right;
  transform: scale(0.8);
  transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3);
}

.taunt-bubble::after {
  content: '';
  position: absolute;
  bottom: -8px;
  right: 20px;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid #ff4757;
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

.game-over-content {
  text-align: center;
  padding: 20px 0;
}

.game-over-message {
  font-size: 18px;
  color: #409EFF;
  margin-bottom: 20px;
}

.score-details {
  text-align: left;
  background-color: #f5f7fa;
  padding: 15px;
  border-radius: 8px;
}

.final-score {
  font-size: 20px;
  color: #67c23a;
  font-weight: bold;
  margin-bottom: 10px;
}

.score-breakdown {
  color: #606266;
  white-space: pre-line;
  line-height: 1.5;
}
</style>
