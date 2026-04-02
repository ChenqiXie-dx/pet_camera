package com.petcam.app.domain.model

/**
 * API 响应基础结构
 */
data class ApiResponse<T>(
    val success: Boolean,
    val message: String?,
    val data: T?
)

/**
 * 设备信息
 */
data class Device(
    val id: Int,
    val device_id: String,
    val name: String,
    val status: String,
    val resolution: String? = null,
    val bitrate: Int? = null,
    val motion_sensitivity: Float? = null,
    val last_seen: String? = null,
    val created_at: String? = null
)

/**
 * 设备绑定请求
 */
data class BindDeviceRequest(
    val device_id: String,
    val name: String
)

/**
 * 设备列表响应
 */
data class DeviceListResponse(
    val devices: List<Device>
)

/**
 * 单个设备响应
 */
data class DeviceResponse(
    val device: Device,
    val token: String? = null
)
