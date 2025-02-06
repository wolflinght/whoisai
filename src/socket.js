import { io } from 'socket.io-client'

const socket = io('http://localhost:3000', {
  transports: ['polling', 'websocket'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
  path: '/socket.io/',
  withCredentials: true,
  forceNew: true
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

socket.on('connect_error', (error) => {
  console.error('Connection error:', error)
})

export default socket
