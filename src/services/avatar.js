// 默认头像列表
const defaultAvatars = [
  '/avatars/avatar1.png',
  '/avatars/avatar2.png',
  '/avatars/avatar3.png',
  '/avatars/avatar4.png',
  '/avatars/avatar5.png',
  '/avatars/avatar6.png'
]

// 已使用的头像集合
const usedAvatars = new Set()

// 获取随机头像
export function getRandomAvatar() {
  const availableAvatars = defaultAvatars.filter(avatar => !usedAvatars.has(avatar))
  
  // 如果所有头像都被使用了，重置使用记录
  if (availableAvatars.length === 0) {
    usedAvatars.clear()
    return defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)]
  }

  const randomAvatar = availableAvatars[Math.floor(Math.random() * availableAvatars.length)]
  usedAvatars.add(randomAvatar)
  return randomAvatar
}

// 释放头像（当玩家离开时调用）
export function releaseAvatar(avatar) {
  usedAvatars.delete(avatar)
}
