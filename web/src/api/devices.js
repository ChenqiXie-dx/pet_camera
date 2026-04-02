import apiClient from './index'

export function getDevices() {
  return apiClient.get('/devices')
}

export function getDevice(id) {
  return apiClient.get(`/devices/${id}`)
}

export function updateDevice(id, data) {
  return apiClient.put(`/devices/${id}`, data)
}

export function deleteDevice(id) {
  return apiClient.delete(`/devices/${id}`)
}

export function bindDevice(device_id, name) {
  return apiClient.post('/devices', { device_id, name })
}
