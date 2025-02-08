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
      <div v-if="isQuestioner && gameState !== 'gameOver'" class="questioner-view">
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
          <div class="question-section">
            <h3>问题：{{ currentQuestion }}</h3>
            
            <!-- 可拖拽的模型标签区域 -->
            <div class="model-tags-section">
              <div class="model-tags">
                <div
                  v-for="model in availableModelTags"
                  :key="model"
                  class="model-tag"
                  draggable="true"
                  @dragstart="dragStart($event, model)"
                  @dragend="dragEnd"
                >
                  {{ model }}
                </div>
              </div>
              <div class="model-tags used-tags" v-if="usedModels.size > 0">
                <div
                  v-for="model in usedModels"
                  :key="model"
                  class="model-tag used"
                >
                  {{ model }}
                </div>
              </div>
              <div class="model-tags-hint">
                <div class="hint-primary">主要目标：选择下方哪一条是真人回答，点击确认提交</div>
                <div class="hint-secondary">次要目标：把拖动上方的标签到回答上标记一个AI是什么模型，点击确认提交。每次标记消耗2分，如果正确则会获得8分</div>
              </div>
            </div>
          </div>
          
          <div class="answers-list">
            <h3>所有回答：</h3>
            <el-card 
              v-for="(answer, index) in shuffledAnswers" 
              :key="index"
              class="answer-card"
              :class="{ 
                'selected': answer.playerId === selectedPlayer,
                'highlighted': answer.playerId === selectedPlayer,
                'drag-over': dragOverId === answer.playerId 
              }"
              @click="selectPlayer(answer.playerId)"
              @dragover.prevent="dragOver($event, answer.playerId)"
              @dragleave="dragLeave(answer.playerId)"
              @drop="dropModel($event, answer.playerId)"
            >
              <div class="answer-content">
                <div class="answer-number">{{ index + 1 }}号玩家</div>
                <div class="answer-text">{{ answer.answer }}</div>
                <div 
                  v-if="answer.playerId === selectedPlayer" 
                  class="questioner-choice"
                >
                  提问者当前的选择
                </div>
                <div 
                  v-if="answer.tauntMessage" 
                  class="taunt-bubble"
                >
                  {{ answer.tauntMessage }}
                </div>
                <div 
                  class="model-tag-container"
                  :class="{ 'has-tag': modelGuesses[answer.playerId] }"
                >
                  <div v-if="!modelGuesses[answer.playerId]" class="tag-placeholder">
                    拖放标签到这里
                  </div>
                  <div 
                    v-else
                    class="model-tag attached"
                    draggable="true"
                    @dragstart="dragStart($event, modelGuesses[answer.playerId], answer.playerId)"
                  >
                    {{ modelGuesses[answer.playerId] }}
                    <span class="remove-tag" @click.stop="removeModelGuess(answer.playerId)">×</span>
                  </div>
                </div>
              </div>
            </el-card>
          </div>

          <div class="action-section">
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
      <div v-else-if="!isQuestioner && gameState !== 'gameOver'" class="answerer-view">
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
              :class="{ 
                'selected': answer.playerId === selectedPlayer,
                'highlighted': answer.playerId === selectedPlayer,
              }"
              @dragover.prevent="dragOver($event, answer.playerId)"
              @drop.prevent="dropModel($event, answer.playerId)"
            >
              <div 
                v-if="answer.tauntMessage" 
                class="taunt-bubble"
              >
                {{ answer.tauntMessage }}
              </div>
              <div class="answer-content">
                <div class="answer-number">{{ index + 1 }}号玩家</div>
                <div class="answer-text">{{ answer.answer }}</div>
                <div 
                  v-if="answer.playerId === selectedPlayer" 
                  class="questioner-choice"
                >
                  提问者当前的选择
                </div>
              </div>
            </el-card>
          </div>

          <div class="waiting-text">
            等待提问者选择<span class="loading-dots">{{ loadingDots }}</span>
          </div>
        </div>
      </div>

      <!-- 游戏结束状态 -->
      <div v-else-if="gameState === 'gameOver'" class="game-over-section">
        <el-card class="waiting-card">
          <div class="waiting-content">
            <h3>游戏已结束</h3>
            <p class="waiting-text">请点击"返回大厅"按钮继续</p>
          </div>
        </el-card>
      </div>
    </div>
    <el-dialog
      v-model="showGameOverDialog"
      :title="gameOverTitle"
      width="30%"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      class="game-over-dialog"
    >
      <div class="game-over-content">
        <div class="game-over-message">{{ gameOverMessage }}</div>
        <div class="score-details">
          <div class="final-score">本局得分：{{ roundScore }}</div>
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
const modelGuesses = computed(() => store.state.game.modelGuesses)
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
const roundScore = ref(0)

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

  // 设置初始的潜在分数
  if (isQuestioner.value) {
    // 提问者的潜在分数
    potentialScore.value = currentRound.value === 1 ? 8 : 
                          currentRound.value === 2 ? 4 : 
                          currentRound.value === 3 ? 2 : 0;
  } else {
    // 回答者的潜在分数
    potentialScore.value = currentRound.value === 1 ? 2 : 
                          currentRound.value === 2 ? 4 : 
                          currentRound.value === 3 ? 8 : 0;
  }
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
    console.log('[roundResult] Score update:', {
      oldScore: score.value,
      newScore,
      potentialScore: newPotentialScore,
      remainingAI: aiCount,
      isQuestioner: isQuestioner.value,
      currentRound: currentRound.value
    });
    
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

    // 重置所有模型猜测
    store.commit('game/resetModelGuesses')

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
        if (currentRound.value < 3) {
          currentRound.value++
        }
      }
    }, 1000)
  })

  socket.on('playerSelected', ({ playerId, selectedBy }) => {
    console.log(`[playerSelected] Player selected: ${playerId} by ${selectedBy}`);
    // 更新被选中的玩家
    selectedPlayer.value = playerId;
  })

  socket.on('gameOver', ({ winner, finalScore, reason }) => {
    console.log('[gameOver] Game ended:', {
      winner,
      finalScore,
      reason,
      currentScore: score.value,
      isQuestioner: isQuestioner.value,
      currentRound: currentRound.value
    });
    handleGameOver(reason)
  })
}

const handleGameOver = (message) => {
  showGameOverDialog.value = true
  gameOverTitle.value = isQuestioner.value ? '游戏结束' : '游戏结束'
  
  if (isQuestioner.value) {
    if (message.includes('选中了真人')) {
      gameOverMessage.value = `恭喜！在第${currentRound.value}轮找到了真人玩家！`
    } else if (message.includes('所有AI')) {
      gameOverMessage.value = '所有AI玩家都被找出来了，但真人玩家成功存活到最后！'
    } else {
      gameOverMessage.value = '已达到最大回合数，真人玩家成功隐藏到最后！'
    }
  } else {
    if (message.includes('选中了真人')) {
      gameOverMessage.value = `可惜，在第${currentRound.value}轮被发现了`
    } else if (message.includes('所有AI')) {
      gameOverMessage.value = '恭喜你！所有AI都被找出来了，你成功存活到最后！'
    } else {
      gameOverMessage.value = '恭喜你！成功存活到最后一轮！'
    }
  }
  
  roundScore.value = score.value
  scoreBreakdown.value = ''
  
  // 重置所有模型猜测
  store.commit('game/resetModelGuesses')

  // 设置游戏状态为结束
  store.commit('game/setGameState', 'gameOver')
  gameState.value = 'gameOver'
}

const returnToIntro = () => {
  showGameOverDialog.value = false
  // 重置所有玩家的准备状态
  store.commit('game/resetPlayers')
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

// 拖拽相关的状态
const draggedModel = ref(null)
const draggedFromPlayerId = ref(null)
const dragOverId = ref(null)

// 开始拖拽
const dragStart = (event, model, playerId = null) => {
  draggedModel.value = model
  draggedFromPlayerId.value = playerId
  event.dataTransfer.effectAllowed = 'move'
}

// 结束拖拽
const dragEnd = () => {
  draggedModel.value = null
  draggedFromPlayerId.value = null
  dragOverId.value = null
}

// 拖拽经过
const dragOver = (event, playerId) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  dragOverId.value = playerId
}

// 拖拽离开
const dragLeave = (playerId) => {
  if (dragOverId.value === playerId) {
    dragOverId.value = null
  }
}

// 放置模型
const dropModel = (event, playerId) => {
  event.preventDefault()
  if (!draggedModel.value) return

  // 如果是从其他玩家拖过来的，先还原2分
  if (draggedFromPlayerId.value) {
    store.dispatch('game/guessModel', {
      playerId: draggedFromPlayerId.value,
      modelGuess: null
    })
  }

  // 标记新的猜测
  store.dispatch('game/guessModel', {
    playerId,
    modelGuess: draggedModel.value
  })

  draggedModel.value = null
  draggedFromPlayerId.value = null
  dragOverId.value = null
}

// 移除模型猜测
const removeModelGuess = (playerId) => {
  store.dispatch('game/guessModel', {
    playerId,
    modelGuess: null
  })
}

// 从 store 中获取状态
const usedModels = computed(() => {
  const used = new Set()
  Object.values(modelGuesses.value).forEach(model => {
    if (model) used.add(model)
  })
  return used
})

// 计算可用的模型标签
const availableModelTags = computed(() => {
  return availableModels.value.filter(model => !usedModels.value.has(model))
})
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
  cursor: move;
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

.selected {
  border: 2px solid #409EFF;
  background-color: rgba(64, 158, 255, 0.1);
}

.highlighted {
  border-color: #409EFF;
  background: rgba(64, 158, 255, 0.1);
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
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  background: #409eff;
  color: white;
  border-radius: 4px;
  cursor: move;
  user-select: none;
  position: relative;
  transition: all 0.3s;
}

.model-tag.used {
  background: #909399;
  cursor: not-allowed;
  opacity: 0.6;
}

.model-tag:not(.used):hover {
  transform: translateY(-2px);
}

.model-tag.attached {
  background: #67c23a;
  margin: 0;
}

.model-tag .remove-tag {
  margin-left: 6px;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  opacity: 0;
  transition: opacity 0.3s;
}

.model-tag:hover .remove-tag {
  opacity: 1;
}

.model-tag .remove-tag:hover {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

.answer-card {
  position: relative;
  margin-bottom: 15px;
  transition: all 0.3s;
}

.answer-card.drag-over {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.question-section {
  margin-bottom: 20px;
}

.question-section h3 {
  margin-bottom: 10px;
}

.model-tag-container {
  margin-top: 10px;
  padding: 8px;
  border: 2px dashed #dcdfe6;
  border-radius: 4px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.model-tag-container.has-tag {
  border-style: solid;
  border-color: #67c23a;
  background: rgba(103, 194, 58, 0.1);
}

.tag-placeholder {
  color: #909399;
  font-size: 14px;
}

.answer-card.drag-over .model-tag-container {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.1);
}

.questioner-choice {
  position: absolute;
  top: 10px;
  right: 10px;
  color: #67C23A;
  font-weight: bold;
  font-size: 14px;
}

.model-tags-section {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 15px;
  margin: 10px 0 20px;
}

.model-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.model-tags.used-tags {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #dcdfe6;
}

.model-tags-hint {
  margin-top: 10px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
}

.hint-primary {
  color: #409EFF;
  font-weight: bold;
  margin-bottom: 5px;
}

.hint-secondary {
  color: #606266;
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

.selected .taunt-bubble {
  opacity: 1;
  transform: scale(1);
}

.game-over-dialog :deep(.el-dialog__title) {
  font-size: 24px;
  font-weight: bold;
  color: #000;
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
  text-align: center;
  background-color: #f5f7fa;
  padding: 20px;
  border-radius: 8px;
}

.final-score {
  font-size: 28px;
  color: #67c23a;
  font-weight: bold;
  margin-bottom: 15px;
}

.score-breakdown {
  color: #606266;
  line-height: 1.6;
}
</style>
