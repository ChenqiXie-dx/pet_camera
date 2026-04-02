import apiClient from './index'

export function login(username, password) {
  return apiClient.post('/auth/login', { username, password })
}

export function register(username, password, email) {
  return apiClient.post('/auth/register', { username, password, email })
}

export function logout() {
  return apiClient.post('/auth/logout')
}

export function getMe() {
  return apiClient.get('/auth/me')
}
