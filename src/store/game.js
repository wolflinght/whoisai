import { io } from 'socket.io-client'

const socket = io('http://localhost:3000')

const state = {
  gameId: null,
  isQuestioner: false,
  players: [],
  currentQuestion: null,
  gameState: 'waiting',
  score: 0,
  round: 1,
  availableModels: [],
  answers: []
}

const mutations = {
  setGameId(state, gameId) {
    state.gameId = gameId
  },
  setIsQuestioner(state, isQuestioner) {
    state.isQuestioner = isQuestioner
  },
  setPlayers(state, players) {
    state.players = players
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
  }
}

const actions = {
  startMatching({ commit }, nickname) {
    socket.emit('startMatching', { nickname })
  },

  initializeGame({ commit }, { gameId, isQuestioner, players, availableModels }) {
    commit('setGameId', gameId)
    commit('setIsQuestioner', isQuestioner)
    commit('setPlayers', players)
    commit('setAvailableModels', availableModels)
    commit('setGameState', 'asking')
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

  guessModel({ state }, { playerId, modelGuess }) {
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
    if (score !== undefined) commit('setScore', score)
    if (round) commit('setRound', round)
  }
}

const getters = {
  isGameStarted: state => state.gameState !== 'waiting',
  currentPlayerAnswers: state => state.answers[state.round] || {},
}

// 设置 Socket.IO 事件监听
socket.on('gameStart', ({ isQuestioner, gameId, players, availableModels }) => {
  store.commit('initializeGame', { gameId, isQuestioner, players, availableModels })
})

socket.on('playersUpdate', ({ players }) => {
  store.commit('setPlayers', players)
})

socket.on('questionReceived', ({ question }) => {
  store.commit('setCurrentQuestion', question)
  store.commit('setGameState', 'answering')
})

socket.on('answersReceived', ({ answers }) => {
  store.commit('updateAnswers', answers)
})

socket.on('roundResult', ({ correct, score, round }) => {
  store.commit('updateGameState', { score, round })
})

socket.on('gameOver', ({ winner, finalScore }) => {
  store.commit('setGameState', 'finished')
})

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
