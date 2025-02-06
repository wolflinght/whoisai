import { createStore } from 'vuex'
import game from './game'
import { socket } from '../socket'

const store = createStore({
  modules: {
    game
  }
})

// 设置 Socket.IO 事件监听
socket.on('gameStart', ({ isQuestioner, gameId, players, availableModels }) => {
  store.dispatch('game/initializeGame', { gameId, isQuestioner, players, availableModels })
})

socket.on('playersUpdate', ({ players }) => {
  store.commit('game/setPlayers', players)
})

socket.on('questionReceived', ({ question }) => {
  store.commit('game/setCurrentQuestion', question)
  store.commit('game/setGameState', 'answering')
})

socket.on('answersReceived', ({ answers }) => {
  store.dispatch('game/updateAnswers', answers)
})

socket.on('roundResult', ({ correct, score, round }) => {
  store.dispatch('game/updateGameState', { score, round })
})

socket.on('gameOver', ({ winner, finalScore }) => {
  store.commit('game/setGameState', 'finished')
})

socket.on('playerReady', (playerId) => {
  console.log('Received playerReady event:', playerId)
  store.dispatch('game/updatePlayerReadyStatus', playerId)
})

export default store
