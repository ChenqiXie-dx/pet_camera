<template>
  <div class="playback-container">
    <header class="page-header">
      <button @click="goBack" class="back-btn">
        <ArrowLeftIcon :size="20" />
        返回
      </button>
      <h2>录像回放</h2>
      <div class="header-placeholder"></div>
    </header>

    <main class="playback-main">
      <div class="date-selector">
        <input type="date" v-model="selectedDate" @change="fetchRecordings" />
      </div>

      <div v-if="loading" class="loading">加载中...</div>

      <div v-else-if="recordings.length === 0" class="empty-state">
        <VideoIcon :size="64" />
        <p>暂无录像</p>
      </div>

      <div v-else class="recording-list">
        <div
          v-for="recording in recordings"
          :key="recording.id"
          class="recording-item"
          @click="playRecording(recording)"
        >
          <VideoIcon :size="24" />
          <div class="recording-info">
            <h4>{{ recording.filename }}</h4>
            <p>{{ formatDate(recording.created_at) }} · {{ formatDuration(recording.duration) }}</p>
          </div>
          <span class="size">{{ formatSize(recording.size) }}</span>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeftIcon, VideoIcon } from 'lucide-vue-next'
import dayjs from 'dayjs'

const router = useRouter()
const selectedDate = ref(dayjs().format('YYYY-MM-DD'))
const recordings = ref([])
const loading = ref(false)

onMounted(() => {
  fetchRecordings()
})

function goBack() {
  router.push({ name: 'Home' })
}

async function fetchRecordings() {
  loading.value = true
  try {
    // TODO: 调用 API 获取录像列表
    recordings.value = []
  } finally {
    loading.value = false
  }
}

function playRecording(recording) {
  // TODO: 播放录像
  console.log('播放:', recording)
}

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}
</script>

<style scoped>
.playback-container {
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

.playback-main {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.date-selector {
  margin-bottom: 24px;
}

.date-selector input {
  padding: 10px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
}

.loading {
  text-align: center;
  padding: 60px;
  color: #666;
}

.empty-state {
  text-align: center;
  padding: 80px;
  background: white;
  border-radius: 12px;
  color: #999;
}

.recording-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recording-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.recording-item:hover {
  background: #f9f9f9;
}

.recording-info {
  flex: 1;
}

.recording-info h4 {
  font-size: 14px;
  color: #333;
  margin-bottom: 4px;
}

.recording-info p {
  font-size: 12px;
  color: #999;
}

.size {
  font-size: 12px;
  color: #999;
}
</style>
