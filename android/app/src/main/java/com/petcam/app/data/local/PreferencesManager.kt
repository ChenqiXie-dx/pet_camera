package com.petcam.app.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "petcam_prefs")

@Singleton
class PreferencesManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private val KEY_DEVICE_ID = stringPreferencesKey("device_id")
        private val KEY_DEVICE_TOKEN = stringPreferencesKey("device_token")
        private val KEY_SERVER_URL = stringPreferencesKey("server_url")
        private val KEY_RESOLUTION = stringPreferencesKey("resolution")
        private val KEY_BITRATE = stringPreferencesKey("bitrate")
        private val KEY_MOTION_SENSITIVITY = stringPreferencesKey("motion_sensitivity")
    }

    val deviceId: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[KEY_DEVICE_ID]
    }

    /**
     * 获取或创建设备ID
     * 如果不存在，则自动生成UUID并保存
     */
    suspend fun getOrCreateDeviceId(): String {
        val existing = context.dataStore.data.first()[KEY_DEVICE_ID]
        if (existing != null && existing.isNotEmpty()) {
            return existing
        }
        val newId = UUID.randomUUID().toString()
        context.dataStore.edit { prefs ->
            prefs[KEY_DEVICE_ID] = newId
        }
        return newId
    }

    val deviceToken: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[KEY_DEVICE_TOKEN]
    }

    val serverUrl: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[KEY_SERVER_URL] ?: "http://101.200.132.120:3000"
    }

    val resolution: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[KEY_RESOLUTION] ?: "720p"
    }

    val bitrate: Flow<Int> = context.dataStore.data.map { prefs ->
        prefs[KEY_BITRATE]?.toIntOrNull() ?: 2000
    }

    val motionSensitivity: Flow<Float> = context.dataStore.data.map { prefs ->
        prefs[KEY_MOTION_SENSITIVITY]?.toFloatOrNull() ?: 0.5f
    }

    suspend fun saveDeviceCredentials(deviceId: String, token: String) {
        context.dataStore.edit { prefs ->
            prefs[KEY_DEVICE_ID] = deviceId
            prefs[KEY_DEVICE_TOKEN] = token
        }
    }

    suspend fun saveSettings(
        resolution: String? = null,
        bitrate: Int? = null,
        motionSensitivity: Float? = null
    ) {
        context.dataStore.edit { prefs ->
            resolution?.let { prefs[KEY_RESOLUTION] = it }
            bitrate?.let { prefs[KEY_BITRATE] = it.toString() }
            motionSensitivity?.let { prefs[KEY_MOTION_SENSITIVITY] = it.toString() }
        }
    }

    suspend fun clearDeviceCredentials() {
        context.dataStore.edit { prefs ->
            prefs.remove(KEY_DEVICE_ID)
            prefs.remove(KEY_DEVICE_TOKEN)
        }
    }
}
