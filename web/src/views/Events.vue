<template>
  <div class="events-container">
    <header class="page-header">
      <button @click="goBack" class="back-btn">
        <ArrowLeftIcon :size="20" />
        返回
      </button>
      <h2>动作事件</h2>
      <div class="header-placeholder"></div>
    </header>

    <main class="events-main">
      <div v-if="loading" class="loading">加载中...</div>

      <div v-else-if="events.length === 0" class="empty-state">
        <AlertCircleIcon :size="64" />
        <p>暂无事件记录</p>
      </div>

      <div v-else class="events-list">
        <div
          v-for="event in events"
          :key="event.id"
          class="event-item"
        >
          <div class="event-thumbnail">
            <img v-if="event.thumbnail_url" :src="event.thumbnail_url" alt="事件缩略图" />
            <AlertCircleIcon v-else :size="32" />
          </div>
          <div class="event-info">
            <h4>{{ event.event_type }}</h4>
            <p>{{ formatDate(event.created_at) }}</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeftIcon, AlertCircleIcon } from 'lucide-vue-next'
import dayjs from 'dayjs'

const router = useRouter()
const events = ref([])
const loading = ref(false)

onMounted(() => {
  fetchEvents()
})

function goBack() {
  router.push({ name: 'Home' })
}

async function fetchEvents() {
  loading.value = true
  try {
    // TODO: 调用 API 获取事件列表
    events.value = []
  } finally {
    loading.value = false
  }
}

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}
</script>

<style scoped>
.events-container {
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

.events-main {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
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

.events-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: white;
  border-radius: 12px;
}

.event-thumbnail {
  width: 80px;
  height: 60px;
  background: #f0f0f0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ccc;
  overflow: hidden;
}

.event-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.event-info h4 {
  font-size: 14px;
  color: #333;
  margin-bottom: 4px;
}

.event-info p {
  font-size: 12px;
  color: #999;
}
</style>
