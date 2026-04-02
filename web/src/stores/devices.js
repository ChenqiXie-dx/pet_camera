import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDevices, getDevice, updateDevice, deleteDevice } from '@/api/devices'

export const useDevicesStore = defineStore('devices', () => {
  const devices = ref([])
  const currentDevice = ref(null)
  const loading = ref(false)

  // 获取设备列表
  async function fetchDevices() {
    loading.value = true
    try {
      const response = await getDevices()
      devices.value = response.data.data.devices || []
      return response
    } catch (error) {
      devices.value = []
      throw error
    } finally {
      loading.value = false
    }
  }

  // 获取设备详情
  async function fetchDevice(id) {
    loading.value = true
    try {
      const response = await getDevice(id)
      currentDevice.value = response.data.data.device
      return response
    } finally {
      loading.value = false
    }
  }

  // 更新设备
  async function updateDeviceAction(id, data) {
    const response = await updateDevice(id, data)
    const index = devices.value.findIndex(d => d.id === id)
    if (index !== -1) {
      devices.value[index] = { ...devices.value[index], ...response.data.data.device }
    }
    return response
  }

  // 删除设备
  async function deleteDeviceAction(id) {
    await deleteDevice(id)
    devices.value = devices.value.filter(d => d.id !== id)
  }

  // 根据 ID 查找设备
  function getDeviceById(id) {
    return devices.value.find(d => d.id === id)
  }

  return {
    devices,
    currentDevice,
    loading,
    fetchDevices,
    fetchDevice,
    updateDevice: updateDeviceAction,
    deleteDevice: deleteDeviceAction,
    getDeviceById
  }
})
