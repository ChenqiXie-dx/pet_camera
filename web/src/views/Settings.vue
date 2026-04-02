<template>
  <div class="settings-container">
    <header class="page-header">
      <button @click="goBack" class="back-btn">
        <ArrowLeftIcon :size="20" />
        返回
      </button>
      <h2>设置</h2>
      <div class="header-placeholder"></div>
    </header>

    <main class="settings-main">
      <div class="settings-section">
        <h3>个人信息</h3>
        <div class="setting-item">
          <label>用户名</label>
          <span>{{ authStore.user?.username }}</span>
        </div>
        <div class="setting-item">
          <label>邮箱</label>
          <span>{{ authStore.user?.email || '未设置' }}</span>
        </div>
      </div>

      <div class="settings-section">
        <h3>应用信息</h3>
        <div class="setting-item">
          <label>版本</label>
          <span>1.0.0</span>
        </div>
      </div>

      <div class="settings-section">
        <button @click="handleLogout" class="logout-btn">退出登录</button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { ArrowLeftIcon } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

function goBack() {
  router.push({ name: 'Home' })
}

function handleLogout() {
  authStore.logout()
  router.push({ name: 'Login' })
}
</script>

<style scoped>
.settings-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.page-header h2 {
  font-size: 18px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: #333;
}

.header-placeholder {
  width: 60px;
}

.settings-main {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px;
}

.settings-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.settings-section h3 {
  font-size: 14px;
  color: #999;
  margin-bottom: 16px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item label {
  font-size: 14px;
  color: #333;
}

.setting-item span {
  font-size: 14px;
  color: #666;
}

.logout-btn {
  width: 100%;
  padding: 14px;
  background: #f5f5f5;
  border: none;
  border-radius: 8px;
  color: #e74c3c;
  font-size: 16px;
  cursor: pointer;
}

.logout-btn:hover {
  background: #eee;
}
</style>
