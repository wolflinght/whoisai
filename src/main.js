import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { createRouter, createWebHistory } from 'vue-router'
import { createStore } from 'vuex'
import App from './App.vue'
import Home from './views/Home.vue'
import Game from './views/Game.vue'
import gameModule from './store/game'
import { socket } from './socket'

// 创建路由
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/game', component: Game }
  ]
})

// 创建 store
const store = createStore({
  modules: {
    game: gameModule
  }
})

const app = createApp(App)

app.use(ElementPlus)
app.use(router)
app.use(store)

// 将socket实例添加到全局属性
app.config.globalProperties.$socket = socket

app.mount('#app')
