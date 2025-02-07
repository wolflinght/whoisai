import { io } from 'socket.io-client'

const socket = io('http://localhost:3000', {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 20000,
  path: '/socket.io/',
  withCredentials: true,
  forceNew: true
})

socket.on('connect', () => {
  console.log('[Socket] Connected to server, socket id:', socket.id)
})

socket.on('error', (error) => {
  console.error('[Socket] Error:', error)
})

socket.on('disconnect', (reason) => {
  console.log('[Socket] Disconnected from server, reason:', reason)
  // 如果是意外断开连接，尝试重新连接
  if (reason === 'io server disconnect' || reason === 'transport close') {
    console.log('[Socket] Attempting to reconnect...')
    socket.connect()
  }
})

socket.on('connect_error', (error) => {
  console.error('[Socket] Connection error:', error)
})

socket.on('reconnect', (attemptNumber) => {
  console.log('[Socket] Successfully reconnected after', attemptNumber, 'attempts')
})

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('[Socket] Reconnection attempt:', attemptNumber)
})

socket.on('reconnect_error', (error) => {
  console.error('[Socket] Reconnection error:', error)
})

socket.on('reconnect_failed', () => {
  console.error('[Socket] Failed to reconnect after all attempts')
})

export default socket
