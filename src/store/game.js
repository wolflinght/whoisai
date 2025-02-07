import socket from '../socket'

const state = {
  gameId: null,
  isQuestioner: false,
  players: [],
  currentQuestion: null,
  gameState: 'waiting',
  score: 0,
  round: 1,
  availableModels: [],
  answers: [],
  modelGuesses: {},
  remainingAI: 0
}

const mutations = {
  setGameId(state, gameId) {
    state.gameId = gameId
  },
  setIsQuestioner(state, isQuestioner) {
    state.isQuestioner = isQuestioner
  },
  setPlayers(state, players) {
    // 保持现有玩家的准备状态
    const readyStates = new Map(state.players.map(p => [p.id, p.isReady]))
    state.players = players.map(player => ({
      ...player,
      isReady: readyStates.get(player.id) || false
    }))
  },
  setCurrentQuestion(state, question) {
    state.currentQuestion = question
  },
  setGameState(state, gameState) {
    state.gameState = gameState
  },
  setScore(state, score) {
    state.score = score
  },
  setRound(state, round) {
    state.round = round
  },
  setAvailableModels(state, models) {
    state.availableModels = models
  },
  setAnswers(state, answers) {
    state.answers = answers
  },
  updatePlayerReady(state, playerId) {
    console.log('[Store] Updating player ready status:', playerId)
    const player = state.players.find(p => p.id === playerId)
    if (player) {
      console.log('[Store] Found player, setting ready status:', player.nickname)
      player.isReady = true
    } else {
      console.log('[Store] Player not found in store:', playerId)
    }
  },
  setRemainingAI(state, count) {
    state.remainingAI = count
  },
  resetGame(state) {
    state.gameId = null
    state.players = []
    state.currentQuestion = null
    state.gameState = 'waiting'
    state.score = 0
    state.round = 1
    state.availableModels = []
    state.answers = []
    state.modelGuesses = {}
    state.remainingAI = 0
  },
  resetPlayers(state) {
    // 重置所有玩家的准备状态
    state.players = state.players.map(player => ({
      ...player,
      isReady: false
    }))
  },
  updateScore(state, { score }) {
    state.score = score
  },
  updateModelGuess(state, { playerId, modelGuess }) {
    if (modelGuess === null) {
      delete state.modelGuesses[playerId]
    } else {
      state.modelGuesses[playerId] = modelGuess
    }
  },
}

const actions = {
  startMatching({ commit }, nickname) {
    socket.emit('startMatching', { nickname })
  },

  initializeGame({ commit }, { gameId, isQuestioner, players, availableModels, remainingAI }) {
    commit('setGameId', gameId)
    commit('setIsQuestioner', isQuestioner)
    commit('setPlayers', players || [])
    commit('setAvailableModels', availableModels || [])
    commit('setGameState', 'waiting')
    commit('setScore', 0)
    commit('setRound', 1)
    commit('setRemainingAI', remainingAI || 0)
  },

  submitQuestion({ state, commit }, question) {
    socket.emit('submitQuestion', {
      gameId: state.gameId,
      question
    })
    commit('setCurrentQuestion', question)
    commit('setGameState', 'answering')
  },

  submitAnswer({ state }, answer) {
    socket.emit('submitAnswer', {
      gameId: state.gameId,
      answer
    })
  },

  submitChoice({ state }, playerId) {
    socket.emit('submitChoice', {
      gameId: state.gameId,
      playerId
    })
  },

  guessModel({ commit, state }, { playerId, modelGuess }) {
    commit('updateModelGuess', { playerId, modelGuess })
    socket.emit('guessModel', {
      gameId: state.gameId,
      playerId,
      modelGuess
    })
  },

  updateAnswers({ commit }, answers) {
    commit('setAnswers', answers)
    commit('setGameState', 'choosing')
  },

  updateGameState({ commit }, { gameState, score, round }) {
    if (gameState) commit('setGameState', gameState)
    if (score !== undefined) commit('updateScore', { score })
    if (round) commit('setRound', round)
  },

  setPlayerReady({ state }, gameId) {
    console.log('Setting player ready, gameId:', gameId)
    socket.emit('playerReady', {
      gameId: gameId
    })
  },

  updatePlayerReadyStatus({ commit }, playerId) {
    commit('updatePlayerReady', playerId)
  }
}

const getters = {
  isGameStarted: state => state.gameState !== 'waiting',
  currentPlayerAnswers: state => state.answers[state.round] || {},
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
