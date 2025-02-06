import { socket } from '../socket'

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
    state.players = players.map(player => ({
      ...player,
      isReady: false
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
    const player = state.players.find(p => p.id === playerId)
    if (player) {
      player.isReady = true
    }
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
    commit('setGameState', 'intro')
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
