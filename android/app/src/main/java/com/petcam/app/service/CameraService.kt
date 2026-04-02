package com.petcam.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.petcam.app.R
import com.petcam.app.capture.AppCameraCapturer
import com.petcam.app.data.api.PetCamApi
import com.petcam.app.data.local.PreferencesManager
import com.petcam.app.domain.model.BindDeviceRequest
import com.petcam.app.ui.MainActivity
import com.petcam.app.webrtc.PeerClient
import com.petcam.app.webrtc.SignalingClient
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@AndroidEntryPoint
class CameraService : Service() {

    companion object {
        private const val TAG = "CameraService"
        const val CHANNEL_ID = "petcam_camera_channel"
        const val NOTIFICATION_ID = 1001
    }

    @Inject
    lateinit var preferencesManager: PreferencesManager

    @Inject
    lateinit var petCamApi: PetCamApi

    @Inject
    lateinit var serviceStateHolder: ServiceStateHolder

    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private var signalingClient: SignalingClient? = null
    private var peerClient: PeerClient? = null
    private var cameraCapturer: AppCameraCapturer? = null

    private var deviceId: String? = null
    private var deviceToken: String? = null
    private var serverUrl: String? = null

    private var isStreaming = false

    /**
     * 更新状态（同时写入 StateHolder 和发送广播）
     */
    private fun updateStatus(status: String) {
        serviceStateHolder.updateStatus(status)
        // 仍然发送广播，作为后备
        val intent = Intent(MainActivity.ACTION_STATUS).apply {
            putExtra(MainActivity.EXTRA_STATUS, status)
        }
        sendBroadcast(intent)
        Log.d(TAG, "Status: $status")
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        Log.d(TAG, "CameraService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createNotification("正在启动..."))
        updateStatus("正在启动...")
        Log.d(TAG, "=== onStartCommand 开始 ===")

        serviceScope.launch {
            Log.d(TAG, ">>> 执行 loadPreferences()")
            loadPreferences()
            Log.d(TAG, ">>> 执行 initializeComponents()")
            initializeComponents()
            Log.d(TAG, ">>> 执行 startStreaming()")
            startStreaming()
            Log.d(TAG, ">>> 所有初始化完成")
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        stopStreaming()
        releaseResources()
        serviceScope.cancel()
        Log.d(TAG, "CameraService destroyed")
    }

    /**
     * 加载配置
     */
    private suspend fun loadPreferences() {
        deviceId = preferencesManager.deviceId.first()
        deviceToken = preferencesManager.deviceToken.first()
        serverUrl = preferencesManager.serverUrl.first()

        // 如果设备未绑定，自动绑定
        if (deviceId.isNullOrEmpty() || deviceToken.isNullOrEmpty()) {
            Log.d(TAG, "设备未绑定，自动绑定中...")
            updateStatus("正在自动绑定设备...")
            updateNotification("正在自动绑定设备...")

            try {
                // 生成新的设备ID
                val newDeviceId = UUID.randomUUID().toString()
                val deviceName = "宠物摄像头-${newDeviceId.take(6)}"

                Log.d(TAG, "创建设备: id=$newDeviceId, name=$deviceName")

                // 调用 API 绑定设备
                val response = petCamApi.bindDevice(
                    BindDeviceRequest(
                        device_id = newDeviceId,
                        name = deviceName
                    )
                )

                if (response.success && response.data != null) {
                    // 保存设备凭证
                    preferencesManager.saveDeviceCredentials(
                        deviceId = response.data.device.device_id,
                        token = response.data.token ?: ""
                    )
                    deviceId = response.data.device.device_id
                    deviceToken = response.data.token
                    Log.d(TAG, "设备自动绑定成功: ${response.data.device.device_id}")
                    updateStatus("设备绑定成功: ${response.data.device.name}")
                } else {
                    Log.e(TAG, "设备绑定失败: ${response.message}")
                    updateStatus("错误：设备绑定失败")
                    updateNotification("错误：设备绑定失败")
                    return
                }
            } catch (e: Exception) {
                Log.e(TAG, "设备绑定异常", e)
                updateStatus("错误：${e.message}")
                updateNotification("错误：${e.message}")
                return
            }
        }

        Log.d(TAG, "Loaded preferences: deviceId=$deviceId, serverUrl=$serverUrl")
        updateStatus("配置加载完成: $serverUrl")
    }

    /**
     * 初始化 WebRTC 组件
     */
    private fun initializeComponents() {
        Log.d(TAG, ">>> 获取共享 EGL")
        // 使用 ServiceStateHolder 共享的 EGL 上下文
        val eglBase = serviceStateHolder.eglBase
            ?: throw IllegalStateException("EglBase not initialized in ServiceStateHolder")
        Log.d(TAG, ">>> EGL 获取完成")

        // 创建信令客户端
        Log.d(TAG, ">>> 创建信令客户端")
        signalingClient = SignalingClient(
            serverUrl = serverUrl ?: "http://101.200.132.120:3000",
            deviceId = deviceId ?: "",
            token = deviceToken ?: ""
        ).apply {
            setListener(signalingListener)
        }

        // 创建 PeerClient
        peerClient = PeerClient(this, signalingClient!!, eglBase).apply {
            setListener(peerListener)
            initialize()
        }

        // 创建相机采集器
        cameraCapturer = AppCameraCapturer(this, eglBase).apply {
            setListener(cameraListener)
        }

        Log.d(TAG, "Components initialized")
    }

    /**
     * 开始推流
     */
    private fun startStreaming() {
        if (deviceId.isNullOrEmpty()) {
            Log.e(TAG, "无法开始推流：设备未配对")
            updateStatus("无法开始推流：设备未配对")
            return
        }

        updateStatus("正在连接服务器...")
        updateNotification("正在连接服务器...")

        // 启动相机采集
        cameraCapturer?.startCapture()

        // 连接信令服务器
        signalingClient?.connect()
    }

    /**
     * 停止推流
     */
    private fun stopStreaming() {
        isStreaming = false
        updateStatus("服务已停止")
        signalingClient?.disconnect()
        cameraCapturer?.stopCapture()
        updateNotification("已停止推流")
        Log.d(TAG, "Streaming stopped")
    }

    /**
     * 释放资源
     */
    private fun releaseResources() {
        cameraCapturer?.dispose()
        peerClient?.release()

        cameraCapturer = null
        peerClient = null
        signalingClient = null
        // 注意：不释放 eglBase，因为它是由 MainActivity 共享持有的

        Log.d(TAG, "Resources released")
    }

    /**
     * 创建通知渠道
     */
    private fun createNotificationChannel() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "相机监控服务",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "心系宠物相机监控服务正在运行"
                setShowBadge(false)
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * 创建通知
     */
    private fun createNotification(status: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("心系宠物")
            .setContentText(status)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    /**
     * 更新通知
     */
    private fun updateNotification(status: String) {
        val notification = createNotification(status)
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    // ==================== 信令监听器 ====================

    private val signalingListener = object : SignalingClient.Listener {
        override fun onAuthSuccess() {
            Log.d(TAG, "Device authenticated successfully")
            updateStatus("认证成功！")
            updateNotification("认证成功，等待用户连接...")

            // 认证成功后创建 PeerConnection
            peerClient?.createPeerConnection()

            // 如果相机已就绪，添加视频轨道到 PeerConnection
            cameraCapturer?.getLocalVideoTrack()?.let { videoTrack ->
                peerClient?.setLocalVideoTrack(videoTrack)
                Log.d(TAG, "Video track added after peerConnection created")
            }
        }

        override fun onAuthError(message: String) {
            Log.e(TAG, "Auth error: $message")
            updateStatus("认证失败: $message")
            updateNotification("认证失败: $message")
        }

        override fun onViewerJoined(viewerId: String) {
            Log.d(TAG, "Viewer joined: $viewerId, creating offer...")
            updateStatus("有用户观看，正在建立连接...")
            updateNotification("有用户观看，正在建立连接...")

            // 等视频轨道就绪后再创建 offer
            // 如果视频轨道已经就绪，onCameraReady 会触发 setLocalVideoTrack
            // 这会触发 onRenegotiationNeeded，从而创建带视频的 offer
            // 但为了尽快响应，我们先创建一次 offer（可能没视频）
            // 然后在 onCameraReady 中重新创建带视频的 offer
            peerClient?.createOffer()
        }

        override fun onViewerLeft(viewerId: String) {
            Log.d(TAG, "Viewer left: $viewerId")
            updateStatus("用户已离开")
            updateNotification("用户已离开")
        }

        override fun onOfferReceived(targetId: String, sdp: String) {
            Log.d(TAG, "Offer received from: $targetId")
            // Android 端作为推流端，不应该收到 offer
        }

        override fun onAnswerReceived(sdp: String) {
            Log.d(TAG, "Answer received")
            updateStatus("连接已建立！正在推流")
            peerClient?.setRemoteDescription(sdp)
            updateNotification("连接已建立")
        }

        override fun onIceCandidateReceived(sdpMid: String, sdpMLineIndex: Int, candidate: String) {
            Log.d(TAG, "ICE candidate received")
            peerClient?.addIceCandidate(sdpMid, sdpMLineIndex, candidate)
        }

        override fun onConnected() {
            Log.d(TAG, "Signaling connected")
            updateStatus("已连接到服务器")
            updateNotification("已连接到服务器")
        }

        override fun onDisconnected() {
            Log.d(TAG, "Signaling disconnected")
            isStreaming = false
            updateStatus("已断开连接")
            updateNotification("已断开连接")
        }

        override fun onError(error: String) {
            Log.e(TAG, "Signaling error: $error")
            updateNotification("错误: $error")
        }
    }

    // ==================== Peer 监听器 ====================

    private val peerListener = object : PeerClient.Listener {
        override fun onPeerConnectionConnected() {
            Log.d(TAG, "Peer connection connected")
            isStreaming = true
            updateNotification("推流中...")
        }

        override fun onPeerConnectionDisconnected() {
            Log.d(TAG, "Peer connection disconnected")
            isStreaming = false
            updateNotification("连接已断开")
        }

        override fun onPeerConnectionError(message: String) {
            Log.e(TAG, "Peer connection error: $message")
            updateNotification("连接错误: $message")
        }

        override fun onRemoteVideoTrack(remoteStream: org.webrtc.MediaStream) {
            Log.d(TAG, "Remote video track received")
        }
    }

    // ==================== 相机监听器 ====================

    private val cameraListener = object : AppCameraCapturer.Listener {
        override fun onCameraReady() {
            Log.d(TAG, "Camera ready")
            updateNotification("相机已就绪")
            updateStatus("相机已就绪")

            // 隐藏占位图
            MainActivity.onHidePlaceholder?.invoke()

            // 添加本地预览（这个不需要 peerConnection）
            cameraCapturer?.getLocalVideoTrack()?.let { videoTrack ->
                MainActivity.localSurfaceView?.let { surfaceView ->
                    videoTrack.addSink(surfaceView)
                    Log.d(TAG, "Local preview added to SurfaceView")
                }
            }
        }

        override fun onCameraError(error: String) {
            Log.e(TAG, "Camera error: $error")
            updateNotification("相机错误: $error")
        }
    }
}
