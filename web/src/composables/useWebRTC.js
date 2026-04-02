import { ref, onUnmounted } from 'vue'
import { io } from 'socket.io-client'
import { useAuthStore } from '@/stores/auth'

// STUN 服务器配置
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
}

// 信令服务器地址 - 开发环境使用相对路径（通过 Nginx 代理）
const SIGNALING_URL = window.location.origin

/**
 * WebRTC Composable
 * 管理 Socket.IO 信令连接和 WebRTC peer connection
 */
export function useWebRTC() {
  const authStore = useAuthStore()

  // 连接状态
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const error = ref(null)
  const connectionStatus = ref('等待连接...')

  // 远程视频流
  const remoteStream = ref(null)

  // Socket.IO 连接
  let socket = null

  // RTCPeerConnection
  let peerConnection = null

  // 目标设备 socket id（用于路由 offer/answer）
  let targetSocketId = null

  // Demo 模式：用本地流替代远程流
  let localStream = null
  const isDemoMode = ref(false)

  /**
   * 连接到信令服务器并观看设备
   * @param {string} deviceId - 设备 ID
   * @param {object} device - 设备对象（包含 device_id）
   */
  async function connect(deviceId, device) {
    if (isConnecting.value || isConnected.value) {
      return
    }

    isConnecting.value = true
    error.value = null
    connectionStatus.value = '正在连接...'

    try {
      // 1. 创建 Socket.IO 连接
      socket = io(SIGNALING_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      })

      // 2. 等待 socket 连接建立
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('连接超时'))
        }, 10000)

        socket.on('connect', () => {
          clearTimeout(timeout)
          resolve()
        })

        socket.on('connect_error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      })

      connectionStatus.value = '正在验证身份...'

      // 3. 用户认证
      await authenticate()

      // 4. 创建 RTCPeerConnection
      createPeerConnection()

      // 5. 请求观看设备
      connectionStatus.value = '正在请求视频流...'
      const watchResult = await requestWatch(deviceId)

      if (!watchResult.success) {
        // 设备不在线，启用 Demo 模式
        console.log('[WebRTC] 设备不在线，启用 Demo 模式')
        await startDemoMode()
        return
      }

      // 6. 等待设备发送 offer
      connectionStatus.value = '等待视频流...'

    } catch (err) {
      console.error('[WebRTC] 连接失败:', err)
      error.value = err.message || '连接失败'
      connectionStatus.value = '连接失败'
      cleanup()
    } finally {
      isConnecting.value = false
    }
  }

  /**
   * 用户认证
   */
  function authenticate() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('认证超时'))
      }, 10000)

      socket.emit('user-auth', {
        user_id: authStore.user.id,
        token: authStore.token
      })

      socket.once('auth-success', () => {
        clearTimeout(timeout)
        console.log('[WebRTC] 用户认证成功')
        resolve()
      })

      socket.once('auth-error', (data) => {
        clearTimeout(timeout)
        reject(new Error(data.message || '认证失败'))
      })
    })
  }

  /**
   * 创建 RTCPeerConnection
   */
  function createPeerConnection() {
    peerConnection = new RTCPeerConnection(ICE_SERVERS)

    // 当收到远程视频流时
    peerConnection.ontrack = (event) => {
      console.log('[WebRTC] 收到远程视频轨道:', event.track.kind, 'stream:', event.streams[0])
      console.log('[WebRTC] stream.videoTracks:', event.streams[0]?.getVideoTracks()?.length)
      remoteStream.value = event.streams[0]
      console.log('[WebRTC] remoteStream.value 设置完成:', remoteStream.value)
      isConnected.value = true
      connectionStatus.value = '已连接'
    }

    // 当 ICE 候选可用时，发送给对端
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && targetSocketId) {
        socket.emit('ice-candidate', {
          target_id: targetSocketId,
          candidate: event.candidate
        })
      }
    }

    // ICE 连接状态变化
    peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE 连接状态:', peerConnection.iceConnectionState)
      if (peerConnection.iceConnectionState === 'connected') {
        isConnected.value = true
        connectionStatus.value = '已连接'
      } else if (peerConnection.iceConnectionState === 'disconnected' ||
                 peerConnection.iceConnectionState === 'failed') {
        connectionStatus.value = '连接断开'
        isConnected.value = false
      }
    }

    // 添加本地流（用于 demo 模式）
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream)
      })
    }
  }

  /**
   * 请求观看设备
   */
  function requestWatch(deviceId) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[WebRTC] 等待设备响应超时')
        resolve({ success: false, reason: 'timeout' })
      }, 5000)

      // 监听设备响应
      socket.once('watch-started', (data) => {
        clearTimeout(timeout)
        console.log('[WebRTC] 开始观看设备:', data)
        resolve({ success: true })
      })

      socket.once('error', (data) => {
        clearTimeout(timeout)
        console.error('[WebRTC] 观看设备错误:', data.message)
        resolve({ success: false, reason: data.message })
      })

      // 监听 offer（设备主动发送）- 使用 on 而不是 once 以处理多个 offer
      socket.on('offer-received', async (data) => {
        console.log('[WebRTC] 收到设备 offer, type:', data.type, 'signalingState:', peerConnection.signalingState)
        targetSocketId = data.from_id

        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription({
            type: data.type || 'offer',
            sdp: data.sdp
          }))

          // 无论什么状态都发送 answer（除非已经是 stable）
          if (peerConnection.signalingState === 'stable') {
            console.log('[WebRTC] 稳定状态，跳过发送 answer')
          } else {
            const answer = await peerConnection.createAnswer()
            await peerConnection.setLocalDescription(answer)
            socket.emit('answer', {
              target_id: data.from_id,
              type: 'answer',
              sdp: answer.sdp
            })
            console.log('[WebRTC] 已发送 answer')
          }

          isConnected.value = true
          connectionStatus.value = '已连接'
        } catch (err) {
          console.error('[WebRTC] 处理 offer 失败:', err)
        }
      })

      // 监听 ICE candidate
      socket.on('ice-candidate-received', async (data) => {
        if (peerConnection && data.candidate) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate({
              candidate: data.candidate,
              sdpMid: data.sdpMid,
              sdpMLineIndex: data.sdpMLineIndex
            }))
          } catch (err) {
            console.error('[WebRTC] 添加 ICE candidate 失败:', err)
          }
        }
      })

      // 发送观看请求
      socket.emit('watch-device', { device_id: deviceId })
    })
  }

  /**
   * 启动 Demo 模式（使用本地摄像头）
   */
  async function startDemoMode() {
    try {
      console.log('[WebRTC] 正在启动 Demo 模式...')
      connectionStatus.value = 'Demo 模式（设备不在线）'

      // 获取本地摄像头
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })

      // 创建 peer connection（用于本地预览）
      if (!peerConnection) {
        createPeerConnection()
      }

      // 在 demo 模式下，直接显示本地流
      remoteStream.value = localStream
      isConnected.value = true
      isDemoMode.value = true
      connectionStatus.value = 'Demo 模式（本地摄像头）'

      console.log('[WebRTC] Demo 模式已启动')
    } catch (err) {
      console.error('[WebRTC] Demo 模式启动失败:', err)
      error.value = '无法访问摄像头: ' + err.message
      connectionStatus.value = 'Demo 模式失败'
    }
  }

  /**
   * 断开连接
   */
  function disconnect() {
    if (isDemoMode.value && localStream) {
      localStream.getTracks().forEach(track => track.stop())
      localStream = null
    }

    if (peerConnection) {
      peerConnection.close()
      peerConnection = null
    }

    if (socket) {
      socket.emit('stop-watching')
      socket.disconnect()
      socket = null
    }

    isConnected.value = false
    isConnecting.value = false
    remoteStream.value = null
    targetSocketId = null
    isDemoMode.value = false
    connectionStatus.value = '已断开'
  }

  /**
   * 切换静音
   */
  function toggleMute(stream) {
    if (!stream) return false
    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      return !audioTrack.enabled // 返回是否静音
    }
    return false
  }

  /**
   * 清理资源
   */
  function cleanup() {
    disconnect()
    isConnected.value = false
    isConnecting.value = false
  }

  // 组件卸载时自动清理
  onUnmounted(() => {
    cleanup()
  })

  return {
    // 状态
    isConnected,
    isConnecting,
    isDemoMode,
    error,
    connectionStatus,
    remoteStream,

    // 方法
    connect,
    disconnect,
    toggleMute
  }
}
