<template>
  <div class="monitor-container">
    <header class="monitor-header">
      <button @click="goBack" class="back-btn">
        <ArrowLeftIcon :size="20" />
        返回
      </button>
      <h2>{{ device?.name || '监控' }}</h2>
      <div class="header-placeholder"></div>
    </header>

    <main class="monitor-main">
      <div class="video-container">
        <div v-if="!isConnected" class="video-placeholder">
          <VideoIcon :size="64" />
          <p>{{ connectionStatus }}</p>
          <p v-if="error" class="error-text">{{ error }}</p>
          <p v-if="isDemoMode" class="demo-text">Demo 模式</p>
          <button
            v-if="!isConnecting"
            @click="handleConnect"
            class="connect-btn"
            :disabled="!device"
          >
            连接设备
          </button>
          <div v-else class="loading-spinner"></div>
        </div>
        <div v-else class="video-wrapper">
          <video ref="videoElement" autoplay playsinline></video>
          <div v-if="isDemoMode" class="demo-badge">Demo</div>
        </div>
      </div>

      <div class="controls">
        <button v-if="isConnected" @click="handleDisconnect" class="control-btn disconnect-btn">
          <VideoOffIcon :size="20" />
        </button>
        <button @click="toggleFullscreen" class="control-btn">
          <MaximizeIcon :size="20" />
        </button>
        <button @click="toggleMute" :class="['control-btn', { active: isMuted }]">
          <MicIcon v-if="!isMuted" :size="20" />
          <MicOffIcon v-else :size="20" />
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, watchEffect, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeftIcon, VideoIcon, VideoOffIcon, MaximizeIcon, MicIcon, MicOffIcon } from 'lucide-vue-next'
import { useDevicesStore } from '@/stores/devices'
import { useWebRTC } from '@/composables/useWebRTC'

const router = useRouter()
const route = useRoute()
const devicesStore = useDevicesStore()

const videoElement = ref(null)
const device = ref(null)
const isMuted = ref(false)

// WebRTC composable
const {
  isConnected,
  isConnecting,
  isDemoMode,
  error,
  connectionStatus,
  remoteStream,
  connect,
  disconnect,
  toggleMute: toggleMuteFn
} = useWebRTC()

// 将远程流绑定到 video 元素 - 使用 watchEffect 更可靠
watchEffect(() => {
  const stream = remoteStream.value
  const videoEl = videoElement.value
  console.log('[Monitor] watchEffect 触发, stream:', stream, 'videoEl:', videoEl)
  if (videoEl && stream) {
    console.log('[Monitor] 设置 videoElement.srcObject')
    videoEl.srcObject = stream
    videoEl.play().then(() => {
      console.log('[Monitor] 视频播放成功')
    }).catch(err => {
      console.error('[Monitor] 播放失败:', err)
    })
  }
})

onMounted(async () => {
  const deviceId = parseInt(route.params.deviceId)
  device.value = devicesStore.getDeviceById(deviceId)
  if (!device.value) {
    await devicesStore.fetchDevice(deviceId)
    device.value = devicesStore.currentDevice
  }
})

onUnmounted(() => {
  disconnect()
})

function goBack() {
  disconnect()
  router.push({ name: 'Home' })
}

async function handleConnect() {
  if (device.value) {
    await connect(device.value.device_id, device.value)
  }
}

function handleDisconnect() {
  disconnect()
}

function toggleFullscreen() {
  if (videoElement.value) {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      videoElement.value.requestFullscreen()
    }
  }
}

function toggleMute() {
  isMuted.value = toggleMuteFn(remoteStream.value)
  if (videoElement.value) {
    videoElement.value.muted = isMuted.value
  }
}
</script>

<style scoped>
.monitor-container {
  min-height: 100vh;
  background: #1a1a1a;
  color: white;
}

.monitor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.5);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.monitor-header h2 {
  font-size: 18px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: white;
  cursor: pointer;
}

.header-placeholder {
  width: 60px;
}

.monitor-main {
  padding-top: 70px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.video-container {
  width: 100%;
  max-width: 960px;
  aspect-ratio: 16/9;
  background: #000;
  margin-top: 20px;
  border-radius: 12px;
  overflow: hidden;
}

.video-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #666;
}

.video-placeholder p {
  margin: 16px 0;
}

.error-text {
  color: #e74c3c;
  font-size: 14px;
}

.demo-text {
  color: #f39c12;
  font-size: 14px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 20px auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.connect-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.connect-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.disconnect-btn {
  background: rgba(231, 76, 60, 0.8);
}

.disconnect-btn:hover {
  background: #e74c3c;
}

.video-wrapper {
  height: 100%;
}

.video-wrapper video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-wrapper {
  position: relative;
}

.demo-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(243, 156, 18, 0.9);
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.controls {
  display: flex;
  gap: 16px;
  margin-top: 24px;
  padding-bottom: 40px;
}

.control-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.control-btn.active {
  background: #e74c3c;
}
</style>
