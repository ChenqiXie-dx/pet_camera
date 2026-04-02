package com.petcam.app.webrtc

import android.content.Context
import android.util.Log
import org.webrtc.*
import org.webrtc.audio.AudioDeviceModule
import org.webrtc.audio.JavaAudioDeviceModule

/**
 * WebRTC Peer 客户端
 * 负责管理 RTCPeerConnection，处理视频/音频轨道和 SDP 交换
 */
class PeerClient(
    private val context: Context,
    private val signalingClient: SignalingClient,
    private val eglBase: EglBase
) {
    companion object {
        private const val TAG = "PeerClient"
    }

    interface Listener {
        fun onPeerConnectionConnected()
        fun onPeerConnectionDisconnected()
        fun onPeerConnectionError(message: String)
        fun onRemoteVideoTrack(remoteStream: MediaStream)
    }

    private var listener: Listener? = null
    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var localVideoTrack: VideoTrack? = null
    private var localAudioTrack: AudioTrack? = null
    private var videoCapturer: com.petcam.app.capture.AppCameraCapturer? = null

    private val iceServers = listOf(
        PeerConnection.IceServer.builder("stun:stun.l.google.com:19302")
            .createIceServer(),
        PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302")
            .createIceServer()
    )

    /**
     * 设置监听器
     */
    fun setListener(listener: Listener) {
        this.listener = listener
    }

    /**
     * 初始化 PeerConnectionFactory
     */
    fun initialize() {
        val options = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(false)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)

        val encoderFactory = DefaultVideoEncoderFactory(
            eglBase.eglBaseContext, true, true
        )
        val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)

        val audioDeviceModule: AudioDeviceModule = JavaAudioDeviceModule.builder(context)
            .createAudioDeviceModule()

        peerConnectionFactory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .setAudioDeviceModule(audioDeviceModule)
            .createPeerConnectionFactory()

        Log.d(TAG, "PeerConnectionFactory initialized")
    }

    /**
     * 创建 PeerConnection
     */
    fun createPeerConnection() {
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            tcpCandidatePolicy = PeerConnection.TcpCandidatePolicy.DISABLED
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
            rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
            keyType = PeerConnection.KeyType.ECDSA
        }

        peerConnection = peerConnectionFactory?.createPeerConnection(
            rtcConfig,
            object : PeerConnection.Observer {
                override fun onSignalingChange(state: PeerConnection.SignalingState?) {
                    Log.d(TAG, "Signaling state: $state")
                }

                override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                    Log.d(TAG, "Ice connection state: $state")
                    when (state) {
                        PeerConnection.IceConnectionState.CONNECTED -> {
                            listener?.onPeerConnectionConnected()
                        }
                        PeerConnection.IceConnectionState.DISCONNECTED,
                        PeerConnection.IceConnectionState.FAILED -> {
                            listener?.onPeerConnectionDisconnected()
                        }
                        PeerConnection.IceConnectionState.CLOSED -> {
                            listener?.onPeerConnectionDisconnected()
                        }
                        else -> {}
                    }
                }

                override fun onIceConnectionReceivingChange(receiving: Boolean) {
                    Log.d(TAG, "Ice connection receiving: $receiving")
                }

                override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {
                    Log.d(TAG, "Ice gathering state: $state")
                }

                override fun onIceCandidate(candidate: IceCandidate?) {
                    candidate?.let {
                        Log.d(TAG, "ICE candidate: ${it.sdp}")
                        signalingClient.sendIceCandidate(
                            it.sdpMid ?: "0",
                            it.sdpMLineIndex,
                            it.sdp
                        )
                    }
                }

                override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {
                    // No-op
                }

                override fun onAddStream(stream: MediaStream?) {
                    stream?.let {
                        Log.d(TAG, "Remote stream added")
                        listener?.onRemoteVideoTrack(it)
                    }
                }

                override fun onRemoveStream(stream: MediaStream?) {
                    Log.d(TAG, "Remote stream removed")
                }

                override fun onDataChannel(channel: DataChannel?) {
                    // No-op for now
                }

                override fun onRenegotiationNeeded() {
                    Log.d(TAG, "Renegotiation needed, creating new offer")
                    // 添加视频轨道后需要重新创建 offer
                    createOffer()
                }

                override fun onAddTrack(
                    receiver: RtpReceiver?,
                    streams: Array<out MediaStream>?
                ) {
                    // No-op for video call where we only send
                }
            }
        )

        Log.d(TAG, "PeerConnection created")
    }

    /**
     * 设置本地视频轨道（来自相机采集）
     */
    fun setLocalVideoTrack(videoTrack: VideoTrack) {
        localVideoTrack = videoTrack
        Log.d(TAG, "setLocalVideoTrack called, peerConnection=${peerConnection != null}")
        peerConnection?.addTrack(videoTrack, listOf("stream"))
        Log.d(TAG, "Local video track added to peer connection")
    }

    /**
     * 设置本地音频轨道
     */
    fun setLocalAudioTrack(audioTrack: AudioTrack) {
        localAudioTrack = audioTrack
        peerConnection?.addTrack(audioTrack, listOf("stream"))
        Log.d(TAG, "Local audio track added to peer connection")
    }

    /**
     * 设置视频采集器
     */
    fun setVideoCapturer(capturer: com.petcam.app.capture.AppCameraCapturer) {
        this.videoCapturer = capturer
    }

    /**
     * 创建 Offer（设备端作为推流方）
     */
    fun createOffer() {
        Log.d(TAG, "createOffer called, peerConnection=${peerConnection != null}")
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
        }

        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription?) {
                Log.d(TAG, "createOffer onCreateSuccess, sdp=${sdp?.description?.take(100)}")
                sdp?.let {
                    Log.d(TAG, "Calling setLocalDescription...")
                    peerConnection?.setLocalDescription(object : SdpObserver {
                        override fun onSetSuccess() {
                            Log.d(TAG, "setLocalDescription onSetSuccess!")
                            Log.d(TAG, "Sending offer with sdp length: ${it.description.length}")
                            signalingClient.sendOffer(it.description)
                        }
                        override fun onSetFailure(error: String?) {
                            Log.e(TAG, "setLocalDescription onSetFailure: $error")
                            listener?.onPeerConnectionError("设置本地描述失败: $error")
                        }
                        override fun onCreateSuccess(p0: SessionDescription?) {}
                        override fun onCreateFailure(p0: String?) {}
                    }, it)
                }
            }

            override fun onCreateFailure(error: String?) {
                Log.e(TAG, "Create offer failed: $error")
                listener?.onPeerConnectionError("创建 Offer 失败: $error")
            }

            override fun onSetSuccess() {}
            override fun onSetFailure(error: String?) {}
        }, constraints) ?: Log.e(TAG, "createOffer: peerConnection is null!")
    }

    /**
     * 设置远程描述（Answer）
     */
    fun setRemoteDescription(sdp: String) {
        val sessionDescription = SessionDescription(SessionDescription.Type.ANSWER, sdp)
        peerConnection?.setRemoteDescription(object : SdpObserver {
            override fun onSetSuccess() {
                Log.d(TAG, "Remote description set successfully")
            }
            override fun onSetFailure(error: String?) {
                Log.e(TAG, "Set remote description failed: $error")
                listener?.onPeerConnectionError("设置远程描述失败: $error")
            }
            override fun onCreateSuccess(p0: SessionDescription?) {}
            override fun onCreateFailure(p0: String?) {}
        }, sessionDescription)
    }

    /**
     * 添加 ICE Candidate
     */
    fun addIceCandidate(sdpMid: String, sdpMLineIndex: Int, candidate: String) {
        val iceCandidate = IceCandidate(sdpMid, sdpMLineIndex, candidate)
        peerConnection?.addIceCandidate(iceCandidate)
    }

    /**
     * 释放资源
     * 注意：不要 dispose videoCapturer 和 peerConnectionFactory，它们属于 AppCameraCapturer
     */
    fun release() {
        // 只关闭 peerConnection，不 dispose（它由 factory 管理）
        peerConnection?.close()
        peerConnection = null

        // localVideoTrack 和 localAudioTrack 由 AppCameraCapturer 管理
        localVideoTrack = null
        localAudioTrack = null

        // videoCapturer 和 peerConnectionFactory 由 AppCameraCapturer 管理，不要 dispose
        videoCapturer = null

        Log.d(TAG, "PeerClient released")
    }

    /**
     * 获取本地视频轨道
     */
    fun getLocalVideoTrack(): VideoTrack? = localVideoTrack

    /**
     * 获取 PeerConnectionFactory
     */
    fun getPeerConnectionFactory(): PeerConnectionFactory? = peerConnectionFactory
}