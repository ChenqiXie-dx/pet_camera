package com.petcam.app.ui

import android.Manifest
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.petcam.app.R
import com.petcam.app.data.local.PreferencesManager
import com.petcam.app.databinding.ActivityMainBinding
import com.petcam.app.service.CameraService
import com.petcam.app.service.ServiceStateHolder
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import org.webrtc.EglBase
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    companion object {
        const val ACTION_STATUS = "com.petcam.app.STATUS_UPDATE"
        const val EXTRA_STATUS = "status"

        // 静态引用，用于 CameraService 访问本地预览视图
        var localSurfaceView: org.webrtc.SurfaceViewRenderer? = null
            private set

        // 隐藏占位图的回调
        var onHidePlaceholder: (() -> Unit)? = null
    }

    private lateinit var binding: ActivityMainBinding

    @Inject
    lateinit var preferencesManager: PreferencesManager

    @Inject
    lateinit var serviceStateHolder: ServiceStateHolder

    // 保留 BroadcastReceiver 作为后备，但主要使用 StateFlow
    private val statusReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
            val status = intent?.getStringExtra(EXTRA_STATUS) ?: ""
            runOnUiThread {
                binding.tvStatus.text = status
                binding.tvStatus.visibility = if (status.isNotEmpty()) android.view.View.VISIBLE else android.view.View.GONE
            }
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.entries.all { it.value }
        if (!allGranted) {
            Toast.makeText(this, R.string.permission_camera_required, Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // 初始化 EglBase 和 SurfaceViewRenderer
        initSurfaceView()

        // 注册状态广播接收器
        registerReceiver(statusReceiver, android.content.IntentFilter(ACTION_STATUS), RECEIVER_NOT_EXPORTED)

        // 观察 ServiceStateHolder 的状态变化
        observeServiceState()

        checkPermissions()
        setupUI()
        checkDeviceStatus()
    }

    private fun initSurfaceView() {
        // 使用 ServiceStateHolder 共享的 EglBase
        if (serviceStateHolder.eglBase == null) {
            serviceStateHolder.eglBase = EglBase.create()
        }
        binding.localSurfaceView.init(serviceStateHolder.eglBase?.eglBaseContext, null)
        binding.localSurfaceView.setMirror(true)
        binding.localSurfaceView.setEnableHardwareScaler(true)
        localSurfaceView = binding.localSurfaceView

        // 设置隐藏占位图的回调
        onHidePlaceholder = {
            runOnUiThread {
                binding.ivPlaceholder.visibility = android.view.View.GONE
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(statusReceiver)
        } catch (e: Exception) {
            // ignore if not registered
        }
        // 释放 SurfaceView 和 EglBase
        try {
            binding.localSurfaceView.release()
        } catch (e: Exception) {
            // ignore if not initialized
        }
        serviceStateHolder.eglBase?.release()
        serviceStateHolder.eglBase = null
        localSurfaceView = null
    }

    private fun checkPermissions() {
        val permissions = arrayOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.INTERNET,
            Manifest.permission.ACCESS_NETWORK_STATE
        )
        permissionLauncher.launch(permissions)
    }

    private fun setupUI() {
        binding.btnStartService.setOnClickListener {
            startCameraService()
        }

        binding.btnStopService.setOnClickListener {
            stopCameraService()
        }
    }

    private fun observeServiceState() {
        lifecycleScope.launch {
            serviceStateHolder.status.collect { status ->
                if (status.isNotEmpty()) {
                    binding.tvStatus.text = status
                    binding.tvStatus.visibility = android.view.View.VISIBLE
                }
            }
        }
    }

    private fun checkDeviceStatus() {
        lifecycleScope.launch {
            val deviceId = preferencesManager.deviceId.first()
            binding.tvDeviceId.text = if (deviceId.isNullOrEmpty()) {
                "未配对"
            } else {
                "设备ID: $deviceId"
            }
        }
    }

    private fun startCameraService() {
        binding.tvStatus.text = "正在启动服务..."
        binding.tvStatus.visibility = android.view.View.VISIBLE

        val intent = Intent(this, CameraService::class.java)
        startForegroundService(intent)
        Toast.makeText(this, "服务已启动", Toast.LENGTH_SHORT).show()
    }

    private fun stopCameraService() {
        val intent = Intent(this, CameraService::class.java)
        stopService(intent)
        Toast.makeText(this, "服务已停止", Toast.LENGTH_SHORT).show()
    }
}
