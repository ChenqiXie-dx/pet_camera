package com.petcam.app.capture

import android.content.Context
import android.util.Log
import org.webrtc.*
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * 相机采集管理器
 * 使用 Camera2 进行视频采集，提供 VideoTrack 给 WebRTC
 */
class AppCameraCapturer(
    private val context: Context,
    private val eglBase: EglBase
) {
    companion object {
        private const val TAG = "AppCameraCapturer"
        private const val CAMERA_WIDTH = 1280
        private const val CAMERA_HEIGHT = 720
        private const val CAMERA_FPS = 30
    }

    interface Listener {
        fun onCameraReady()
        fun onCameraError(error: String)
    }

    private var listener: Listener? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var cameraVideoCapturer: org.webrtc.CameraVideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var peerConnectionFactory: PeerConnectionFactory? = null

    private var isFrontCamera = false  // false = 后置摄像头
    private var isReleased = false  // 防止重复释放

    /**
     * 设置监听器
     */
    fun setListener(listener: Listener) {
        this.listener = listener
    }

    /**
     * 初始化并开始采集
     */
    fun startCapture() {
        cameraExecutor.execute {
            try {
                initializeCapture()
                listener?.onCameraReady()
            } catch (e: Exception) {
                Log.e(TAG, "启动采集失败: ${e.message}")
                listener?.onCameraError("启动采集失败: ${e.message}")
            }
        }
    }

    /**
     * 初始化视频采集
     */
    private fun initializeCapture() {
        // 初始化 PeerConnectionFactory
        val options = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(false)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)

        // 创建 PeerConnectionFactory
        val encoderFactory = DefaultVideoEncoderFactory(
            eglBase.eglBaseContext, true, true
        )
        val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)

        peerConnectionFactory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()

        // 创建 SurfaceTextureHelper
        surfaceTextureHelper = SurfaceTextureHelper.create(
            "CaptureThread",
            eglBase.eglBaseContext
        )

        // 创建 CameraVideoCapturer
        val enumerator = Camera2Enumerator(context)
        val deviceNames = enumerator.deviceNames

        val cameraName = if (isFrontCamera) {
            deviceNames.find { enumerator.isFrontFacing(it) }
        } else {
            deviceNames.find { enumerator.isBackFacing(it) }
        } ?: deviceNames.firstOrNull()

        if (cameraName == null) {
            throw RuntimeException("未找到可用相机")
        }

        Log.d(TAG, "使用相机: $cameraName (前置: $isFrontCamera)")

        cameraVideoCapturer = enumerator.createCapturer(cameraName, null)

        // 创建 VideoSource 和 VideoTrack
        videoSource = peerConnectionFactory?.createVideoSource(false)
        videoTrack = peerConnectionFactory?.createVideoTrack("video_track", videoSource!!)
        videoTrack?.setEnabled(true)

        // 初始化相机 capturer
        cameraVideoCapturer?.initialize(surfaceTextureHelper, context, videoSource?.capturerObserver)
        cameraVideoCapturer?.startCapture(CAMERA_WIDTH, CAMERA_HEIGHT, CAMERA_FPS)

        Log.d(TAG, "VideoTrack 创建成功: ${videoTrack?.id()}")
    }

    /**
     * 切换前后相机
     */
    fun switchCamera() {
        isFrontCamera = !isFrontCamera
        cameraVideoCapturer?.switchCamera(null)
    }

    /**
     * 获取本地视频轨道
     */
    fun getLocalVideoTrack(): VideoTrack? = videoTrack

    /**
     * 获取视频源
     */
    fun getVideoSource(): VideoSource? = videoSource

    /**
     * 停止采集
     */
    fun stopCapture() {
        if (isReleased) {
            Log.d(TAG, "已释放，跳过 stopCapture")
            return
        }
        try {
            cameraVideoCapturer?.stopCapture()
        } catch (e: Exception) {
            Log.e(TAG, "stopCapture 失败: ${e.message}")
        }
        try {
            cameraVideoCapturer?.dispose()
        } catch (e: Exception) {
            Log.e(TAG, "cameraVideoCapturer dispose 失败: ${e.message}")
        }
        cameraVideoCapturer = null
        try {
            surfaceTextureHelper?.dispose()
        } catch (e: Exception) {
            Log.e(TAG, "surfaceTextureHelper dispose 失败: ${e.message}")
        }
        surfaceTextureHelper = null
        try {
            videoSource?.dispose()
        } catch (e: Exception) {
            Log.e(TAG, "videoSource dispose 失败: ${e.message}")
        }
        videoSource = null
        try {
            videoTrack?.setEnabled(false)
            videoTrack?.dispose()
        } catch (e: Exception) {
            Log.e(TAG, "videoTrack dispose 失败: ${e.message}")
        }
        videoTrack = null
        // 注意：peerConnectionFactory 由 PeerClient 管理，不要在这里 dispose
        Log.d(TAG, "采集已停止")
    }

    /**
     * 释放资源
     */
    fun dispose() {
        if (isReleased) {
            Log.d(TAG, "已释放，跳过 dispose")
            return
        }
        isReleased = true
        stopCapture()
        try {
            cameraExecutor.shutdown()
        } catch (e: Exception) {
            Log.e(TAG, "cameraExecutor shutdown 失败: ${e.message}")
        }
        listener = null
        Log.d(TAG, "AppCameraCapturer 已释放")
    }

    /**
     * 是否使用前置相机
     */
    fun isFrontCamera(): Boolean = isFrontCamera
}