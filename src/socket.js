import { io } from 'socket.io-client'

export const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  autoConnect: true
})

socket.on('connect', () => {
  console.log('Connected to server')
})

socket.on('error', (error) => {
  console.error('Socket error:', error)
})

socket.on('disconnect', () => {
  console.log('Disconnected from server')
})

export default socket
