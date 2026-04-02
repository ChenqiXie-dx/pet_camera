package com.petcam.app.webrtc

import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URI

/**
 * Socket.IO 信令客户端
 * 负责与后端信令服务器通信，处理设备认证和 WebRTC 信令交换
 */
class SignalingClient(
    private val serverUrl: String,
    private val deviceId: String,
    private val token: String
) {
    companion object {
        private const val TAG = "SignalingClient"
    }

    interface Listener {
        fun onAuthSuccess()
        fun onAuthError(message: String)
        fun onViewerJoined(viewerId: String)
        fun onViewerLeft(viewerId: String)
        fun onOfferReceived(targetId: String, sdp: String)
        fun onAnswerReceived(sdp: String)
        fun onIceCandidateReceived(sdpMid: String, sdpMLineIndex: Int, candidate: String)
        fun onConnected()
        fun onDisconnected()
        fun onError(error: String)
    }

    private var socket: Socket? = null
    private var listener: Listener? = null
    private var targetSocketId: String? = null  // 保存观众的 socket ID

    fun setListener(listener: Listener) {
        this.listener = listener
    }

    /**
     * 连接信令服务器
     */
    fun connect() {
        try {
            val uri = URI(serverUrl)
            val options = IO.Options().apply {
                transports = arrayOf("websocket", "polling")
                reconnection = true
                reconnectionAttempts = 5
                reconnectionDelay = 1000
            }

            socket = IO.socket(uri, options)
            setupListeners()
            socket?.connect()
        } catch (e: Exception) {
            Log.e(TAG, "连接失败: ${e.message}")
            listener?.onError("连接失败: ${e.message}")
        }
    }

    /**
     * 断开连接（非阻塞）
     */
    fun disconnect() {
        try {
            socket?.disconnect()
        } catch (e: Exception) {
            Log.e(TAG, "Socket disconnect error: ${e.message}")
        }
        try {
            socket?.off()
        } catch (e: Exception) {
            Log.e(TAG, "Socket off error: ${e.message}")
        }
        socket = null
        targetSocketId = null
    }

    /**
     * 设置监听器
     */
    private fun setupListeners() {
        socket?.on(Socket.EVENT_CONNECT) {
            Log.d(TAG, "Socket connected")
            authenticate()
        }

        socket?.on(Socket.EVENT_DISCONNECT) {
            Log.d(TAG, "Socket disconnected")
            listener?.onDisconnected()
        }

        socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
            val error = args.firstOrNull()?.toString() ?: "Unknown error"
            Log.e(TAG, "Socket connect error: $error")
            listener?.onError("连接错误: $error")
        }

        // 认证成功
        socket?.on("auth-success") { args ->
            Log.d(TAG, "Auth success")
            listener?.onAuthSuccess()
        }

        // 认证失败
        socket?.on("auth-error") { args ->
            val message = (args.firstOrNull() as? JSONObject)?.optString("message") ?: "认证失败"
            Log.e(TAG, "Auth error: $message")
            listener?.onAuthError(message)
        }

        // 观众加入
        socket?.on("viewer-joined") { args ->
            val data = args.firstOrNull() as? JSONObject
            val viewerId = data?.optString("viewer_id") ?: ""
            targetSocketId = viewerId  // 保存观众的 socket ID
            Log.d(TAG, "Viewer joined: $viewerId, targetSocketId set to: $viewerId")
            listener?.onViewerJoined(viewerId)
        }

        // 观众离开
        socket?.on("viewer-left") { args ->
            val data = args.firstOrNull() as? JSONObject
            val viewerId = data?.optString("viewer_id") ?: ""
            Log.d(TAG, "Viewer left: $viewerId")
            listener?.onViewerLeft(viewerId)
        }

        // 收到 Web 端的 Answer
        socket?.on("answer-received") { args ->
            val data = args.firstOrNull() as? JSONObject
            val sdp = data?.optString("sdp") ?: ""
            targetSocketId = data?.optString("from_id")
            Log.d(TAG, "Answer received from: $targetSocketId")
            listener?.onAnswerReceived(sdp)
        }

        // 收到 ICE Candidate
        socket?.on("ice-candidate-received") { args ->
            val data = args.firstOrNull() as? JSONObject
            val sdpMid = data?.optString("sdpMid") ?: ""
            val sdpMLineIndex = data?.optInt("sdpMLineIndex") ?: 0
            val candidate = data?.optString("candidate") ?: ""
            Log.d(TAG, "ICE candidate received")
            listener?.onIceCandidateReceived(sdpMid, sdpMLineIndex, candidate)
        }

        // 错误
        socket?.on("error") { args ->
            val message = (args.firstOrNull() as? JSONObject)?.optString("message") ?: "Unknown error"
            Log.e(TAG, "Error: $message")
            listener?.onError(message)
        }
    }

    /**
     * 设备认证
     */
    private fun authenticate() {
        val data = JSONObject().apply {
            put("device_id", deviceId)
            put("token", token)
        }
        Log.d(TAG, "Sending device-auth: device_id=$deviceId")
        socket?.emit("device-auth", data)
    }

    /**
     * 发送 Offer (设备端作为推流端，创建 offer)
     */
    fun sendOffer(sdp: String) {
        targetSocketId?.let { target ->
            val data = JSONObject().apply {
                put("target_id", target)
                put("type", "offer")  // 添加 type，WebRTC 需要这个
                put("sdp", sdp)
            }
            Log.d(TAG, "Sending offer to: $target, sdp length: ${sdp.length}")
            socket?.emit("offer", data)
        }
    }

    /**
     * 发送 ICE Candidate
     */
    fun sendIceCandidate(sdpMid: String, sdpMLineIndex: Int, candidate: String) {
        targetSocketId?.let { target ->
            val data = JSONObject().apply {
                put("target_id", target)
                put("candidate", JSONObject().apply {
                    put("sdpMid", sdpMid)
                    put("sdpMLineIndex", sdpMLineIndex)
                    put("candidate", candidate)
                })
            }
            socket?.emit("ice-candidate", data)
        }
    }

    /**
     * 获取当前 socket ID
     */
    fun getSocketId(): String? = socket?.id()
}
