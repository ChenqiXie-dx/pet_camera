<template>
  <div class="home-container">
    <header class="home-header">
      <div class="header-content">
        <h1>心系宠物</h1>
        <div class="header-actions">
          <span class="username">{{ authStore.user?.username }}</span>
          <button @click="handleLogout" class="logout-btn">退出</button>
        </div>
      </div>
    </header>

    <main class="home-main">
      <div class="main-header">
        <h2>我的设备</h2>
        <button @click="showAddDialog = true" class="add-btn">
          <PlusIcon :size="20" />
          添加设备
        </button>
      </div>

      <div v-if="loading" class="loading">
        加载中...
      </div>

      <div v-else-if="devicesStore.devices.length === 0" class="empty-state">
        <CameraIcon :size="64" />
        <h3>暂无设备</h3>
        <p>点击上方"添加设备"绑定您的宠物摄像头</p>
      </div>

      <div v-else class="device-grid">
        <div
          v-for="device in devicesStore.devices"
          :key="device.id"
          class="device-card"
          @click="goToMonitor(device)"
        >
          <div class="device-thumbnail">
            <CameraIcon :size="48" />
            <span :class="['status-badge', device.status]">
              {{ device.status === 'online' ? '在线' : '离线' }}
            </span>
          </div>
          <div class="device-info">
            <h3>{{ device.name }}</h3>
            <p>{{ device.resolution || '720p' }}</p>
          </div>
        </div>
      </div>
    </main>

    <!-- 添加设备对话框 -->
    <div v-if="showAddDialog" class="dialog-overlay" @click.self="showAddDialog = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>添加设备</h3>
          <button @click="showAddDialog = false" class="close-btn">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>设备名称</label>
            <input
              v-model="newDevice.name"
              type="text"
              placeholder="例如：客厅摄像头"
            />
          </div>
          <div class="form-group">
            <label>设备 ID</label>
            <input
              v-model="newDevice.device_id"
              type="text"
              placeholder="请输入设备ID"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <button @click="showAddDialog = false" class="cancel-btn">取消</button>
          <button @click="handleAddDevice" class="confirm-btn" :disabled="adding">
            {{ adding ? '添加中...' : '确认添加' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { PlusIcon, CameraIcon } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useDevicesStore } from '@/stores/devices'
import { bindDevice } from '@/api/devices'

const router = useRouter()
const authStore = useAuthStore()
const devicesStore = useDevicesStore()

const loading = ref(true)
const showAddDialog = ref(false)
const adding = ref(false)
const newDevice = ref({
  name: '',
  device_id: ''
})

onMounted(async () => {
  try {
    await devicesStore.fetchDevices()
  } finally {
    loading.value = false
  }
})

function goToMonitor(device) {
  router.push({ name: 'Monitor', params: { deviceId: device.id } })
}

async function handleAddDevice() {
  if (!newDevice.value.name || !newDevice.value.device_id) return

  adding.value = true
  try {
    await bindDevice(newDevice.value.device_id, newDevice.value.name)
    await devicesStore.fetchDevices()
    showAddDialog.value = false
    newDevice.value = { name: '', device_id: '' }
  } catch (error) {
    alert(error.response?.data?.message || '添加设备失败')
  } finally {
    adding.value = false
  }
}

async function handleLogout() {
  authStore.logout()
  router.push({ name: 'Login' })
}
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.home-header {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-content h1 {
  font-size: 24px;
  color: #333;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.username {
  color: #666;
  font-size: 14px;
}

.logout-btn {
  padding: 8px 16px;
  background: #f5f5f5;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #666;
}

.logout-btn:hover {
  background: #eee;
}

.home-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.main-header h2 {
  font-size: 20px;
  color: #333;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.add-btn:hover {
  opacity: 0.9;
}

.loading {
  text-align: center;
  padding: 60px;
  color: #666;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  background: white;
  border-radius: 12px;
  color: #999;
}

.empty-state h3 {
  margin: 16px 0 8px;
  color: #666;
}

.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.device-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.device-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.device-thumbnail {
  height: 160px;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ccc;
  position: relative;
}

.status-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  color: white;
}

.status-badge.online {
  background: #4caf50;
}

.status-badge.offline {
  background: #999;
}

.device-info {
  padding: 16px;
}

.device-info h3 {
  font-size: 16px;
  color: #333;
  margin-bottom: 4px;
}

.device-info p {
  font-size: 14px;
  color: #999;
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
}

.dialog-header {
  padding: 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-header h3 {
  font-size: 18px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}

.dialog-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-btn {
  padding: 10px 20px;
  background: #f5f5f5;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.confirm-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.confirm-btn:disabled {
  opacity: 0.6;
}
</style>
