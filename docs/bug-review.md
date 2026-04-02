# Bug 复盘记录

## Bug 1: bcrypt 编译失败

### 问题描述
服务器部署后启动失败，错误信息：
```
Error: bcrypt@5.1.0 has unmet node-gyp dependencies
```

### 根本原因
`bcrypt` 库依赖 native compilation，需要 Python 和 node-gyp 构建工具。服务器上的 Python 版本是 3.6.8，语法不兼容导致编译失败。

### 修复方案
将依赖从 `bcrypt` 改为纯 JavaScript 实现的 `bcryptjs`。

**修改文件：**
- `server/package.json`: `"bcrypt"` → `"bcryptjs"`
- `server/src/utils/password.js`: `require('bcrypt')` → `require('bcryptjs')`

### 经验教训
- 生产环境避免使用依赖 native compilation 的 npm 包
- 优先使用纯 JavaScript 实现或预先编译好的二进制包
- 或在本地编译好二进制再上传

---

## Bug 2: 登录后无法跳转首页

### 问题描述
用户登录成功（API 返回 200），但页面没有跳转到首页，仍然停留在登录页面。

### 调试过程
1. Console 无报错
2. API 请求正常，返回 200
3. `localStorage.setItem('token', ...)` 执行后读取为 `null`
4. 后来发现 `localStorage` 能正常工作，但 token 就是没保存
5. 检查 `loginAction` 返回结果，发现 `response.data.token` 是 `undefined`

### 根本原因
API 响应结构是：
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "user": {...},
    "token": "..."
  }
}
```

代码错误地访问 `response.data.token`，实际应该是 `response.data.data.token`。

### 修复方案
修正 authStore 中的数据访问路径：

**`server/src/stores/auth.js`：**
```javascript
// 修复前
user.value = response.data.user
token.value = response.data.token

// 修复后
user.value = response.data.data.user
token.value = response.data.data.token
```

### 经验教训
- API 响应结构必须与前端访问路径完全匹配
- 前端开发时务必验证完整的响应数据路径
- 添加调试日志时检查 `response.data.data.xxx` 而不只是 `response.data.xxx`
- 建议后端统一响应格式，避免 `data.data` 这种嵌套

---

## Bug 3: API 路径重复导致 404

### 问题描述
登录时请求 `POST /api/api/auth/login`，返回 404。

### 根本原因
- `.env.production` 中 `VITE_API_BASE_URL=/api`
- `auth.js` 中 API 路径定义为 `/auth/login`
- 拼接后变成 `/api/auth/login` ✓ 正确

但后来调试时改成了 `VITE_API_BASE_URL=http://101.200.132.120:3000/api`，同时 `auth.js` 路径仍是 `/auth/login`，导致拼接成 `http://101.200.132.120:3000/api/auth/login`。

之后又改回 `/api`，但 `auth.js` 没改回来，导致路径变成了 `/api/api/auth/login`。

### 修复方案
统一 API 路径约定：
- `baseURL`: `/api`
- API 方法路径: `/auth/login`（不带 `/api` 前缀）

### 经验教训
- baseURL 和 API 方法路径不能同时包含 `/api`
- 保持统一的 API 路径风格
- 建议在 API 模块开头注释说明路径约定

---

## Bug 4: devicesStore.devices 为 undefined 导致首页报错

### 问题描述
登录成功后跳转到首页，但页面空白，Console 报错：
```
TypeError: Cannot read properties of undefined (reading 'length')
```

### 根本原因
`fetchDevices()` API 调用失败时，`devices.value` 没有被初始化，导致后续访问 `.length` 报错。

### 修复方案
确保 `devices` 始终被初始化：
```javascript
async function fetchDevices() {
  loading.value = true
  try {
    const response = await getDevices()
    devices.value = response.data.data.devices || []
    return response
  } catch (error) {
    devices.value = []  // 确保失败时也初始化为空数组
    throw error
  } finally {
    loading.value = false
  }
}
```

### 经验教训
- Store 中的数组/对象必须保证初始值
- API 调用失败时也要确保状态一致
- 前端组件应做好防护，避免访问 undefined 属性

---

## Bug 5: CORS 跨域问题导致 OPTIONS 预检失败

### 问题描述
浏览器发送 OPTIONS 预检请求到 `http://101.200.132.120:3000/api/auth/login`，但响应没有正确的 CORS 头。

### 根本原因
前端直接请求后端 3000 端口，但浏览器认为这是跨域请求（前端在 80 端口）。

### 修复方案
通过 Nginx 反向代理，前端请求 `/api` 转发到 `127.0.0.1:3000`，避免跨域：
```nginx
location /api {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### 经验教训
- 生产环境务必通过 Nginx 代理避免跨域
- 开发环境也建议使用代理，保持与生产一致
- 不要让前端直接请求后端端口

---

## Bug 6: PeerClient SdpObserver 重复方法

### 问题描述
编译时报错：`'onCreateSuccess' hides inherited member`

### 根本原因
SdpObserver 接口有 2 个 `onCreateSuccess` 方法定义，代码中重复实现了。

### 修复方案
移除重复的 `onCreateSuccess` 方法，保留一个完整的实现。

### 经验教训
- 接口方法实现要注意继承关系
- 匿名内部类实现接口时要确保方法不重复

---

## Bug 7: CameraCapturer 生命周期管理问题

### 问题描述
相机启动失败，报空指针异常。

### 根本原因
`CameraCapturer` 使用了 lifecycleOwner 绑定生命周期，但传入的 lifecycleOwner 可能与预期不符。

### 修复方案
简化生命周期管理，直接使用 ExecutorService 而不是与 Activity/Service 生命周期绑定。

### 经验教训
- 前台服务的生命周期管理要清晰
- 不要过度依赖 lifecycleOwner，直接管理资源更可控

---

## Bug 8: 设备绑定后 token 未保存

### 问题描述
设备绑定 API 返回了 token，但 PairingActivity 没有正确保存。

### 根本原因
API 响应结构理解错误：`response.data.data.token` vs `response.data.token`

### 修复方案
修正数据访问路径：
```kotlin
// 修复后
preferencesManager.saveDeviceCredentials(
    deviceId = response.data.device.device_id,
    token = response.token ?: ""  // token 在 DeviceResponse 层级
)
```

### 经验教训
- API 响应结构要与代码访问路径严格匹配
- 绑定设备返回的 token 是在外层 DeviceResponse，不是在内层 Device

---

## Bug 9: Android 端 device_id 需要手动输入

### 问题描述
设备配对时需要用户手动输入 device_id，用户体验差且容易出错。

### 修复方案
在 PreferencesManager 中添加 `getOrCreateDeviceId()` 方法：
- 首次运行时自动生成 UUID 并保存
- 后续直接读取已保存的值
- PairingActivity 自动填充设备 ID（只读显示）

### 经验教训
- 移动端设备 ID 应自动生成，用户无感知
- 首次安装时就应该生成并持久化

---

## Bug 10: Android 编译错误 - 多个 API 问题 (2026-04-01)

### 问题描述
Android Studio 编译时报错：
1. `CameraCapturer` 与 `org.webrtc.CameraVideoCapturer` 命名冲突
2. `VideoSource` 构造函数参数类型错误
3. `VideoTrack` 没有 `createVideoTrack()` 方法
4. `MediaStream.label` 不存在
5. `SdpObserver` 缺少 `onCreateFailure` 方法
6. API 返回类型 `DeviceResponse` 未导入
7. `PairingActivity` 中 `token` 访问路径错误
8. 缺少 launcher 图标资源

### 修复方案
1. 重命名 `CameraCapturer` 为 `AppCameraCapturer`
2. 使用 `PeerConnectionFactory.createVideoSource()` 和 `createVideoTrack()` 创建视频轨道
3. 移除 `MediaStream.label` 引用
4. 补全 `SdpObserver` 所有抽象方法
5. 导入 `DeviceResponse` 并修正 API 返回类型
6. 修正 `PairingActivity` 中 token 访问路径 `response.data.token`
7. 创建 adaptive icon 资源文件

### 经验教训
- WebRTC API 与自定义类命名冲突时需要重命名
- WebRTC 库 API 变更时需要参考对应版本文档
- Kotlin 匿名对象实现接口时必须实现所有抽象方法

---

## 总结

### 预防措施
1. **API 路径约定**：前端 baseURL + API 方法路径要统一，避免重复
2. **响应结构验证**：后端和前端要对齐 API 响应结构
3. **状态初始化**：Store 中的数据要有初始值，失败时也要保证状态一致
4. **跨域处理**：通过 Nginx 代理，不直接暴露后端端口
5. **调试日志**：关键路径添加 console.log 便于定位问题
6. **接口实现检查**：实现接口时注意方法签名和继承关系
7. **资源文件**：Android 项目必须包含 launcher 图标

### 部署检查清单
- [x] npm 依赖使用纯 JavaScript 实现或预编译包
- [x] API baseURL 配置正确（通过 Nginx 代理用相对路径）
- [x] Store 中的数组/对象有初始值
- [x] API 响应路径与前端访问路径一致
- [x] Android 设备 ID 自动生成
- [x] Android APK 构建成功

### 最近更新 (2026-04-01)

**已完成：**
- Android Gradle Wrapper 生成
- Android APK 构建成功 (63MB)
- 修复多个编译错误（命名冲突、API 用法错误、资源缺失）

**待完善：**
- 端到端 WebRTC 推流测试
- Android 双向语音对讲
- Android 视频录制和 OSS 上传
- Android 动作检测（TensorFlow Lite）
- Android 设备配置页面

---

## Bug 10: 设备绑定返回 401 Unauthorized

### 问题描述
Android 端设备配对时提示"绑定失败：HTTP 401 Unauthorized"

### 根本原因
`POST /api/devices` 需要用户认证，但：
1. Android 端没有登录功能来获取用户 token
2. NetworkModule 给所有请求都加了 deviceToken 而不是用户 token

### 修复方案
修改后端 `server/src/routes/devices.js`，移除设备绑定 API 的 `authenticate` 中间件：
```javascript
// 修改前
router.post('/', authenticate, [...])

// 修改后
router.post('/', [...])  // 无需认证
```

同时修改逻辑，未登录时使用默认用户 ID 1：
```javascript
const userId = req.userId || 1; // 未登录时使用默认用户ID 1
```

### 经验教训
- 设备绑定流程需要明确是否需要用户认证
- 如需用户认证，Android 端必须实现登录功能

---

## Bug 11: 设备绑定返回 400 Bad Request (user_id cannot be null)

### 问题描述
移除设备绑定 API 的用户认证后，返回 400 Bad Request

### 错误信息
```
ValidationError [SequelizeValidationError]: notNull Violation: Device.user_id cannot be null
```

### 根本原因
移除认证后 `req.userId` 为 undefined，但数据库字段 `user_id` 有 notNull 约束

### 修复方案
在 `devices.js` 中使用默认用户 ID：
```javascript
const userId = req.userId || 1; // 未登录时使用默认用户ID 1
```

### 经验教训
- 移除认证中间件时要考虑数据库约束
- 开放 API 需要考虑降级处理

---

## Bug 12: Web 端用户认证后 user 对象为 undefined

### 问题描述
Web 端登录成功（有 token），但在 Socket.IO 认证时显示"用户 undefined"

### 根本原因
`authStore.init()` 从未被调用，导致：
- `localStorage` 中有 token
- 但 `user` 对象从未被填充
- `useWebRTC.js` 中 `authStore.user.id` 为 undefined

### 修复方案
在 `web/src/App.vue` 中调用 `authStore.init()`：
```javascript
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

onMounted(() => {
  authStore.init()
})
```

### 经验教训
- Store 初始化后需要主动调用才能加载用户信息
- 路由守卫只检查 token 存在与否，不填充 user 对象

---

## Bug 13: HTTP 环境下无法访问摄像头 (getUserMedia blocked)

### 问题描述
Web 端点击连接设备后，提示"无法访问摄像头: Cannot read properties of undefined (reading 'getUserMedia')"

### 根本原因
浏览器安全策略限制：
- `navigator.mediaDevices.getUserMedia` 需要 HTTPS 才能使用
- 服务器部署在 HTTP://101.200.132.120，非 HTTPS

### 当前状态
**待解决**

### 可能的解决方案

**方案 1：本地开发测试**
在本地运行 Web 前端（绕过 HTTPS 限制）：
```bash
cd d:\software\pet_camera_project\web
npm run dev
```
然后访问 http://localhost:5173

**方案 2：配置 HTTPS（推荐生产环境）**
1. 在阿里云申请免费 SSL 证书（或使用 Let's Encrypt）
2. 配置 Nginx HTTPS
3. 修改 WebRTC 相关代码支持 HTTPS

### 经验教训
- 生产环境 WebRTC 必须使用 HTTPS
- 开发阶段可用 localhost 测试

---

## 最近更新 (2026-04-01)

**已完成：**
- 修复设备绑定 401 问题（移除用户认证）
- 修复设备绑定 400 问题（添加默认用户ID）
- 修复 Web 端 authStore 未初始化问题
- Web 端登录功能正常
- APK 已构建并上传

**待解决：**
- HTTPS 配置（摄像头访问需要）
- 端到端 WebRTC 推流测试
- Android 双向语音对讲
- Android 视频录制和 OSS 上传
- Android 动作检测（TensorFlow Lite）

---

## Bug 14: App 状态文字不更新 (2026-04-02)

### 问题描述
Android 端点击启动监控后，状态一直显示"正在启动服务..."，即使日志显示"认证成功"。

### 根本原因
MainActivity 通过 BroadcastReceiver 接收 CameraService 发送的状态广播，但时序问题导致部分广播丢失：
1. CameraService 在 `onStartCommand` 中发送"正在启动..."
2. MainActivity 的 BroadcastReceiver 可能在服务发送广播时还没注册完成
3. 导致状态永远停在"正在启动..."

### 修复方案
使用 Hilt 管理的单例 `ServiceStateHolder` 通过 StateFlow 共享状态：
1. 创建 `ServiceStateHolder` 类，使用 `@Singleton` 注解
2. CameraService 更新状态时同时写入 StateHolder
3. MainActivity 观察 StateHolder 的 StateFlow
4. 保留 BroadcastReceiver 作为后备兼容

**修改文件：**
- 新增 `android/app/src/main/java/com/petcam/app/service/ServiceStateHolder.kt`
- 修改 `MainActivity.kt` - 注入 ServiceStateHolder，观察状态变化
- 修改 `CameraService.kt` - 注入 ServiceStateHolder，更新状态

### 经验教训
- 跨组件状态共享优先使用响应式方案（StateFlow/LiveData）
- 广播接收有时序问题，不可靠
- Hilt 单例是共享状态的好方式

---

## Bug 15: App 本地预览不显示 (2026-04-02)

### 问题描述
Android 端本地预览（localSurfaceView）不显示画面，但日志显示"Local preview added to SurfaceView"。

### 根本原因
EGL 上下文不匹配：
1. MainActivity 创建自己的 `EglBase` 并初始化 `SurfaceViewRenderer`
2. CameraService 也创建自己的 `EglBase` 驱动 `AppCameraCapturer`
3. 视频帧来自 Service 的 EGL context，但 SurfaceView 用的是 Activity 的 EGL context
4. 不同的 EGL context 无法共享纹理，导致画面无法渲染

### 修复方案
共享 EglBase 实例：
1. `ServiceStateHolder` 增加 `eglBase` 属性
2. MainActivity 在 `initSurfaceView()` 中创建 EglBase 并保存到 ServiceStateHolder
3. CameraService 从 ServiceStateHolder 获取共享的 EglBase
4. 视频采集和预览使用相同的 EGL context

**修改文件：**
- `ServiceStateHolder.kt` - 添加 `var eglBase: EglBase?`
- `MainActivity.kt` - 使用共享 EglBase，onDestroy 时释放
- `CameraService.kt` - 从 ServiceStateHolder 获取 EglBase

### 经验教训
- WebRTC 多组件间必须共享同一个 EGL context
- SurfaceViewRenderer 和 VideoSource 必须使用相同的 EglBase.eglBaseContext

---

## Bug 16: App 默认使用前置摄像头 (2026-04-02)

### 问题描述
用户希望使用后置摄像头，但 App 默认启用了前置摄像头（自拍角度）。

### 修复方案
修改 `AppCameraCapturer.kt`：
```kotlin
// 修改前
private var isFrontCamera = true

// 修改后
private var isFrontCamera = false  // false = 后置摄像头
```

---

## Bug 17: WebRTC 信令 - viewer-joined 使用错误的 ID (2026-04-02)

### 问题描述
Android 设备收到 `viewer-joined` 事件后，`targetSocketId` 被设置为用户 ID（数字），但发送 offer 时需要的是 socket ID（字符串）。导致 `sendOffer()` 中的 `targetSocketId?.let { ... }` 直接跳过发送。

### 根本原因
服务器 `signaling.js` 发送 `viewer-joined` 时使用 `currentUser.user_id`（用户数据库 ID），但 Socket.IO 的 `io.to(target_id)` 需要 socket ID 才能正确路由。

### 修复方案

**服务器端：**
```javascript
// 修改前
io.to(roomId).emit('viewer-joined', {
  viewer_id: currentUser.user_id,  // 错误：用户数据库 ID
  ...
});

// 修改后
io.to(roomId).emit('viewer-joined', {
  viewer_id: socket.id,  // 正确：socket ID
  ...
});
```

**Android 端：**
```kotlin
// 修改前
val viewerId = data?.optInt("viewer_id") ?: 0  // 错误：optInt 返回 0

// 修改后
val viewerId = data?.optString("viewer_id") ?: ""  // 正确：socket ID 是字符串
targetSocketId = viewerId
```

**同时修改接口：**
```kotlin
// Listener 接口
fun onViewerJoined(viewerId: String)  // 原来是 Int
fun onViewerLeft(viewerId: String)    // 原来是 Int
```

---

## Bug 18: WebRTC 信令 - RTCSessionDescription 构造失败 (2026-04-02)

### 问题描述
Web 端收到 Android 发送的 offer 后，构造 `RTCSessionDescription` 失败：
```
TypeError: Failed to construct 'RTCSessionDescription': The provided value is not of type 'RTCSessionDescriptionInit'
```

### 根本原因
WebRTC 标准要求 `RTCSessionDescription` 构造时传入对象 `{ type: string, sdp: string }`，但：
1. Android 端发送的是纯 SDP 字符串：`socket.emit("offer", { target_id, sdp })`
2. 服务器直接转发 `data.sdp`（纯字符串）
3. Web 端收到后直接传给 `new RTCSessionDescription(data.sdp)`

### 修复方案

**Android 端 - 发送完整的 offer 对象：**
```kotlin
// 修改前
val data = JSONObject().apply {
    put("target_id", target)
    put("sdp", sdp)  // 纯字符串
}

// 修改后
val data = JSONObject().apply {
    put("target_id", target)
    put("type", "offer")  // 添加 type
    put("sdp", sdp)
}
```

**Web 端 - 正确构造 RTCSessionDescription：**
```javascript
// 修改前
await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))

// 修改后
await peerConnection.setRemoteDescription(new RTCSessionDescription({
    type: data.type || 'offer',
    sdp: data.sdp
}))
```

**服务器端 - 转发 answer 时添加 type：**
```javascript
// 修改前
io.to(target_id).emit('answer-received', { from_id: socket.id, sdp });

// 修改后
io.to(target_id).emit('answer-received', { from_id: socket.id, type: 'answer', sdp });
```

---

## Bug 19: 服务器 stop-watching 处理 data 为 undefined (2026-04-02)

### 问题描述
服务器日志显示大量错误：`TypeError: Cannot destructure property 'device_id' of 'data' as it is undefined`

### 修复方案
增加空值检查：
```javascript
// 修改前
socket.on('stop-watching', (data) => {
    const { device_id } = data;  // data 可能为 undefined
    ...
});

// 修改后
socket.on('stop-watching', (data) => {
    if (!data) return;
    const device_id = data.device_id;
    if (!device_id) return;
    ...
});
```

---

## Bug 20: WebRTC 视频接收成功但显示黑屏 (2026-04-02)

### 问题描述
Android 端显示"连接已建立！正在推流"，Web 端控制台显示：
```
[WebRTC] 收到远程视频轨道: video stream: MediaStream
stream.videoTracks: 1
```
但网页视频区域为黑屏，没有实际画面显示。

### 根本原因
`remoteStream.value` 赋值后，Vue 的 `watch` 没有正确触发 video 元素的 srcObject 更新。可能是响应式追踪问题。

### 修复方案

**Monitor.vue - 使用 watchEffect 替代 watch：**
```javascript
// 修改前
watch(remoteStream, (stream) => {
  if (videoElement.value && stream) {
    videoElement.value.srcObject = stream
  }
})

// 修改后
watchEffect(() => {
  const stream = remoteStream.value
  const videoEl = videoElement.value
  if (videoEl && stream) {
    videoEl.srcObject = stream
    videoEl.play().then(() => {
      console.log('[Monitor] 视频播放成功')
    }).catch(err => {
      console.error('[Monitor] 播放失败:', err)
    })
  }
})
```

**useWebRTC.js - 修复 offer 处理（socket.once 改为 socket.on）：**
```javascript
// 修改前
socket.once('offer-received', async (data) => { ... })

// 修改后 - 使用 socket.on 监听多个 offer
socket.on('offer-received', async (data) => { ... })
```

### 经验教训
- Vue 中 watch ref 对象时，watchEffect 比 watch 更可靠
- WebRTC offer/answer 交换可能有重试，需要使用 `socket.on` 而非 `socket.once`
- 视频播放失败时调用 `play()` 并处理 Promise

---

## 最近更新 (2026-04-02)

**已完成：**
- [x] App 状态文字更新问题（ServiceStateHolder + StateFlow）
- [x] App 本地预览不显示（共享 EglBase）
- [x] App 默认使用后置摄像头
- [x] WebRTC 信令 - viewer-joined/left 使用 socket.id
- [x] WebRTC 信令 - RTCSessionDescription 构造修复
- [x] 服务器 stop-watching 空值检查
- [x] **WebRTC 端到端视频流传输（2026-04-02 验证通过）**

**待测试/待解决：**
- [ ] HTTPS 配置（摄像头访问需要）
- [ ] Android 双向语音对讲
- [ ] Android 视频录制和 OSS 上传
- [ ] Android 动作检测（TensorFlow Lite）
