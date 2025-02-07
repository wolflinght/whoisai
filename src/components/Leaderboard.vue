<template>
  <div class="leaderboard">
    <h2>排行榜</h2>
    <el-table :data="leaderboard" style="width: 100%">
      <el-table-column type="index" label="排名" width="80" align="center" />
      <el-table-column prop="nickname" label="玩家" align="center" />
      <el-table-column prop="total_score" label="总分" width="100" align="center" />
      <el-table-column prop="highest_score" label="单场最高分" width="120" align="center" />
    </el-table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import socket from '../socket'

const leaderboard = ref([])

// 请求更新排行榜
const requestLeaderboard = () => {
  socket.emit('getLeaderboard')
}

// 监听排行榜更新
socket.on('leaderboardUpdate', ({ leaderboard: data }) => {
  leaderboard.value = data
})

onMounted(() => {
  requestLeaderboard()
})
</script>

<style scoped>
.leaderboard {
  margin: 20px;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
}

h2 {
  margin-bottom: 20px;
  color: #409EFF;
  text-align: center;
}

:deep(.el-table) {
  --el-table-border-color: #ebeef5;
  --el-table-header-bg-color: #f5f7fa;
}

:deep(.el-table__header) {
  font-weight: bold;
  color: #606266;
}

:deep(.el-table__row) {
  cursor: default;
}

:deep(.el-table__row:hover) {
  background-color: #f5f7fa;
}
</style>
