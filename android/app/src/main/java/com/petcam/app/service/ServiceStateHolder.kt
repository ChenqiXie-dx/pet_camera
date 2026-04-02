package com.petcam.app.service

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.webrtc.EglBase
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 共享服务状态 Holder
 * 使用 StateFlow 在 CameraService 和 MainActivity 之间共享状态
 */
@Singleton
class ServiceStateHolder @Inject constructor() {

    // 服务状态
    private val _status = MutableStateFlow("")
    val status: StateFlow<String> = _status.asStateFlow()

    // 服务是否正在运行
    private val _isRunning = MutableStateFlow(false)
    val isRunning: StateFlow<Boolean> = _isRunning.asStateFlow()

    // 设备ID
    private val _deviceId = MutableStateFlow("")
    val deviceId: StateFlow<String> = _deviceId.asStateFlow()

    // EglBase 实例，供 MainActivity 和 CameraService 共享使用
    var eglBase: EglBase? = null

    /**
     * 更新状态
     */
    fun updateStatus(status: String) {
        _status.value = status
    }

    /**
     * 设置服务运行状态
     */
    fun setRunning(running: Boolean) {
        _isRunning.value = running
    }

    /**
     * 更新设备ID
     */
    fun updateDeviceId(deviceId: String) {
        _deviceId.value = deviceId
    }
}
