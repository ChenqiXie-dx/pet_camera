package com.petcam.app.data.api

import com.petcam.app.domain.model.ApiResponse
import com.petcam.app.domain.model.BindDeviceRequest
import com.petcam.app.domain.model.Device
import com.petcam.app.domain.model.DeviceListResponse
import com.petcam.app.domain.model.DeviceResponse
import retrofit2.http.*

/**
 * PetCam API 接口
 */
interface PetCamApi {

    /**
     * 获取设备列表
     */
    @GET("api/devices")
    suspend fun getDevices(): ApiResponse<DeviceListResponse>

    /**
     * 获取设备详情
     */
    @GET("api/devices/{id}")
    suspend fun getDevice(@Path("id") id: Int): ApiResponse<Device>



    /**
     * 绑定设备
     */
    @POST("api/devices")
    suspend fun bindDevice(@Body request: BindDeviceRequest): ApiResponse<DeviceResponse>

    /**
     * 解绑设备
     */
    @DELETE("api/devices/{id}")
    suspend fun unbindDevice(@Path("id") id: Int): ApiResponse<Unit>

    /**
     * 更新设备配置
     */
    @PUT("api/devices/{id}")
    suspend fun updateDevice(
        @Path("id") id: Int,
        @Body params: Map<String, Any>
    ): ApiResponse<Device>
}
