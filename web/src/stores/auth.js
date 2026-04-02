import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login, register, logout, getMe } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('token') || null)
  const loading = ref(false)

  const isAuthenticated = computed(() => !!token.value)

  // 初始化时获取用户信息
  async function init() {
    if (token.value) {
      try {
        await fetchUser()
      } catch (error) {
        // Token 无效，清除
        logout()
      }
    }
  }

  // 登录
  async function loginAction(username, password) {
    loading.value = true
    try {
      const response = await login(username, password)
      user.value = response.data.data.user
      token.value = response.data.data.token
      localStorage.setItem('token', token.value)
      return response
    } finally {
      loading.value = false
    }
  }

  // 注册
  async function registerAction(username, password, email) {
    loading.value = true
    try {
      const response = await register(username, password, email)
      user.value = response.data.data.user
      token.value = response.data.data.token
      localStorage.setItem('token', token.value)
      return response
    } finally {
      loading.value = false
    }
  }

  // 获取用户信息
  async function fetchUser() {
    const response = await getMe()
    user.value = response.data.data.user
    return response
  }

  // 登出
  function logoutAction() {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
  }

  return {
    user,
    token,
    loading,
    isAuthenticated,
    init,
    loginAction,
    registerAction,
    fetchUser,
    logout: logoutAction
  }
})
