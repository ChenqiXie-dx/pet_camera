# 心系宠物 - 技术设计文档

## 1. 系统架构设计

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              阿里云服务器                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                           Node.js 后端服务                            │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │    │
│  │  │  REST API   │  │  信令服务    │  │  文件服务    │  │  定时任务    │ │    │
│  │  │  (Express)  │  │ (Socket.IO) │  │  (Multer)   │  │  (node-cron)│ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                      │                                      │
│  ┌──────────────────────────────────┐ │ ┌──────────────────────────────────┐  │
│  │         MariaDB 数据库            │ │ │         阿里云 OSS              │  │
│  │  - users, devices               │ │ │   录像文件存储 (50GB)            │  │
│  │  - recordings, events            │ │ │   - /recordings/                │  │
│  └──────────────────────────────────┘ │ │   - /events/                     │  │
│                                       │ │   - /thumbnails/                 │  │
│                                       │ └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
              ▲                                    ▲
              │ WebRTC                            │ WebRTC
              │ (DTLS)                            │ (DTLS)
┌─────────────┴─────────────┐       ┌─────────────┴─────────────┐
│      安卓采集端 APP        │       │        Web 客户端          │
│  ┌───────────────────┐   │       │  ┌───────────────────┐   │
│  │  相机采集 (Camera2) │   │       │  │   Vue.js 3 SPA    │   │
│  │  音频采集 (AAudio)  │   │       │  │   WebRTC API      │   │
│  │  WebRTC Mobile SDK │   │       │  │   HLS.js 播放器   │   │
│  │  TFLite 动作检测    │   │       │  └───────────────────┘   │
│  │  本地录像 (MediaMux)│   │       │                           │
│  └───────────────────┘   │       │                           │
└───────────────────────────┘       └───────────────────────────┘
```

### 1.2 模块设计

#### 1.2.1 安卓采集端模块

```
com.petcam.app
├── capture/                  # 视频采集模块
│   ├── CameraManager.kt      # 相机管理（Camera2 API）
│   ├── VideoSource.kt        # 视频源封装
│   └── ResolutionSelector.kt # 分辨率选择器
│
├── webrtc/                   # WebRTC 模块
│   ├── PeerClient.kt         # WebRTC 客户端
│   ├── SignalingClient.kt    # 信令客户端（Socket.IO）
│   ├── VideoTrackAdapter.kt  # 视频轨道适配
│   └── AudioTrackAdapter.kt  # 音频轨道适配
│
├── recording/                 # 录像模块
│   ├── MediaRecorder.kt      # 录像录制
│   ├── UploadManager.kt      # 上传管理（断点续传）
│   └── LocalStorage.kt       # 本地存储
│
├── detection/                 # 动作检测模块
│   ├── MotionDetector.kt     # 动作检测器
│   ├── TFLiteClassifier.kt   # TFLite 分类器
│   └── EventNotifier.kt      # 事件通知
│
├── device/                   # 设备模块
│   ├── DeviceManager.kt      # 设备管理
│   ├── QRCodeGenerator.kt    # 二维码生成
│   └── ConfigManager.kt      # 配置管理
│
└── data/                      # 数据模块
    ├── ApiService.kt         # API 服务
    ├── Database.kt           # 本地数据库
    └── Preferences.kt       # 偏好设置
```

#### 1.2.2 后端服务模块

```
server/
├── src/
│   ├── index.js              # 入口文件
│   ├── config/
│   │   ├── database.js       # MariaDB 配置
│   │   ├── oss.js            # 阿里云 OSS 配置
│   │   └── webrtc.js         # WebRTC 配置
│   │
│   ├── middleware/
│   │   ├── auth.js           # JWT 认证中间件
│   │   ├── validator.js      # 请求验证中间件
│   │   └── errorHandler.js   # 错误处理中间件
│   │
│   ├── routes/
│   │   ├── auth.js           # 认证路由
│   │   ├── users.js          # 用户路由
│   │   ├── devices.js        # 设备路由
│   │   ├── recordings.js     # 录像路由
│   │   └── events.js         # 事件路由
│   │
│   ├── controllers/
│   │   ├── AuthController.js
│   │   ├── UserController.js
│   │   ├── DeviceController.js
│   │   ├── RecordingController.js
│   │   └── EventController.js
│   │
│   ├── models/
│   │   ├── User.js           # 用户模型
│   │   ├── Device.js         # 设备模型
│   │   ├── Recording.js      # 录像模型
│   │   └── Event.js          # 事件模型
│   │
│   ├── services/
│   │   ├── AuthService.js
│   │   ├── DeviceService.js
│   │   ├── RecordingService.js
│   │   ├── StorageService.js # OSS 操作
│   │   └── CleanupService.js # 清理服务
│   │
│   ├── socket/
│   │   ├── signaling.js      # WebRTC 信令处理
│   │   └── rooms.js          # 房间管理
│   │
│   └── utils/
│       ├── jwt.js            # JWT 工具
│       ├── password.js       # 密码加密
│       └── response.js       # 响应封装
│
├── uploads/                   # 上传文件临时目录
└── tests/                    # 测试文件
```

#### 1.2.3 Web 前端模块

```
web/
├── src/
│   ├── main.js               # 入口文件
│   ├── App.vue               # 根组件
│   │
│   ├── router/
│   │   └── index.js         # 路由配置
│   │
│   ├── stores/              # Pinia 状态管理
│   │   ├── auth.js           # 认证状态
│   │   ├── devices.js        # 设备状态
│   │   └── recordings.js     # 录像状态
│   │
│   ├── api/                  # API 调用
│   │   ├── index.js          # API 封装
│   │   ├── auth.js
│   │   ├── devices.js
│   │   ├── recordings.js
│   │   └── events.js
│   │
│   ├── components/           # 公共组件
│   │   ├── Header.vue
│   │   ├── DeviceCard.vue
│   │   ├── VideoPlayer.vue
│   │   └── EventList.vue
│   │
│   ├── views/
│   │   ├── Login.vue         # 登录页
│   │   ├── Register.vue      # 注册页
│   │   ├── Home.vue          # 首页（设备列表）
│   │   ├── Monitor.vue       # 监控页（实时视频）
│   │   ├── Playback.vue      # 回放页
│   │   ├── Events.vue        # 事件列表页
│   │   └── Settings.vue      # 设置页
│   │
│   ├── composables/          # 组合式函数
│   │   ├── useWebRTC.js      # WebRTC 逻辑
│   │   ├── useMediaStream.js # 媒体流
│   │   └── useRecorder.js    # 录像
│   │
│   └── utils/
│       ├── webrtc.js         # WebRTC 工具
│       └── format.js         # 格式化工具
│
├── public/
│   └── index.html
├── package.json
└── vite.config.js
```

---

## 2. 数据库设计

### 2.1 ER 图

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   devices   │       │  recordings │       │   events    │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │◄──┐   │ id (PK)     │       │ id (PK)     │
│ device_id   │   │   │ device_id(FK)│       │ device_id(FK)│
│ user_id     │   └───│ filename    │       │ type        │
│ name        │       │ filepath    │       │ video_id(FK) │
│ status      │       │ duration    │       │ thumbnail   │
│ config      │       │ size        │       │ created_at  │
│ created_at  │       │ created_at  │       └─────────────┘
└─────────────┘       └─────────────┘
                             │
                             │ 1:N (optional)
                             ▼
                      ┌─────────────┐
                      │  recordings │
                      │ (events_video)│
                      └─────────────┘
```

> **说明**：单用户设计，user_id 固定为 1。无需 users 表。

### 2.2 表结构详细设计

#### users 用户表

```sql
CREATE TABLE users (
    id              INT UNSIGNED        AUTO_INCREMENT  PRIMARY KEY,
    username        VARCHAR(50)         NOT NULL        UNIQUE,
    password_hash   VARCHAR(255)        NOT NULL,
    email           VARCHAR(100)       NULL,
    avatar_url      VARCHAR(500)        NULL,
    created_at      DATETIME            DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME            DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### devices 设备表

```sql
CREATE TABLE devices (
    id              INT UNSIGNED        AUTO_INCREMENT  PRIMARY KEY,
    device_id       VARCHAR(64)         NOT NULL        UNIQUE,  -- 设备生成的唯一ID
    user_id         INT UNSIGNED        NOT NULL,
    name            VARCHAR(100)        NOT NULL,
    status          ENUM('online','offline','busy') DEFAULT 'offline',
    resolution      ENUM('480p','720p','1080p') DEFAULT '720p',
    bitrate         INT UNSIGNED        DEFAULT 2000,   -- kbps
    motion_sensitivity FLOAT           DEFAULT 0.5,    -- 0.0-1.0
    last_seen       DATETIME            NULL,
    created_at      DATETIME            DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_device_id (device_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### recordings 录像表

```sql
CREATE TABLE recordings (
    id              INT UNSIGNED        AUTO_INCREMENT  PRIMARY KEY,
    device_id       INT UNSIGNED        NOT NULL,
    filename        VARCHAR(255)       NOT NULL,
    filepath        VARCHAR(500)       NOT NULL,        -- OSS 路径
    file_size       BIGINT UNSIGNED     NOT NULL,        -- bytes
    duration        INT UNSIGNED        NOT NULL,        -- seconds
    recording_type  ENUM('continuous','motion') DEFAULT 'continuous',
    created_at      DATETIME            DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    INDEX idx_device_created (device_id, created_at),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### events 事件表

```sql
CREATE TABLE events (
    id              INT UNSIGNED        AUTO_INCREMENT  PRIMARY KEY,
    device_id       INT UNSIGNED        NOT NULL,
    event_type      VARCHAR(50)         NOT NULL,        -- 'motion_detected', 'pet_seen', etc.
    confidence      FLOAT               NULL,            -- 检测置信度
    video_id        INT UNSIGNED        NULL,            -- 关联的短视频
    thumbnail_path  VARCHAR(500)        NULL,
    description     VARCHAR(255)        NULL,
    created_at      DATETIME            DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES recordings(id) ON DELETE SET NULL,
    INDEX idx_device_created (device_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 3. API 接口设计

### 3.1 认证接口

#### POST /api/auth/register - 用户注册

**Request:**
```json
{
  "username": "petlover123",
  "password": "SecurePass123",
  "email": "pet@example.com"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "petlover123",
      "email": "pet@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### POST /api/auth/login - 用户登录

**Request:**
```json
{
  "username": "petlover123",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "petlover123",
      "email": "pet@example.com",
      "avatar_url": null
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### 3.2 设备接口

#### GET /api/devices - 获取设备列表

**Headers:** `Authorization: Bearer <token>` (可选，未登录时使用默认用户)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "id": 1,
        "device_id": "device_abc123",
        "name": "客厅摄像头",
        "status": "online",
        "resolution": "720p",
        "last_seen": "2026-03-31T10:30:00Z"
      }
    ]
  }
}
```

#### POST /api/devices - 设备配对/创建

**说明**：设备端调用，用于首次配对。无需登录，设备自动绑定到默认用户（user_id=1）。

**Request:**
```json
{
  "device_id": "device_abc123",
  "name": "客厅摄像头"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "device": {
      "id": 1,
      "device_id": "device_abc123",
      "name": "客厅摄像头",
      "status": "offline"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."  // 设备Token，用于Socket.IO认证
  },
  "message": "设备绑定成功"
}
```

#### POST /api/devices/:id/status - 更新设备状态

**说明**：由设备端调用，更新设备在线状态。

**Request:**
```json
{
  "status": "online"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "online"
  },
  "message": "状态更新成功"
}
```

### 3.3 录像接口

#### GET /api/recordings - 获取录像列表

**Query Params:** `?device_id=1&date=2026-03-31&page=1&limit=20`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "recordings": [
      {
        "id": 1,
        "filename": "rec_20260331_103000.mp4",
        "duration": 3600,
        "size": 104857600,
        "recording_type": "continuous",
        "created_at": "2026-03-31T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "total_pages": 3
    }
  }
}
```

#### GET /api/recordings/:id/stream - 流式播放录像

**Response (200):** `video/mp4` 流

### 3.4 事件接口

#### GET /api/events - 获取事件列表

**Query Params:** `?device_id=1&start_date=2026-03-01&end_date=2026-03-31`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": 1,
        "event_type": "motion_detected",
        "confidence": 0.92,
        "thumbnail_url": "/uploads/thumbnails/evt_001.jpg",
        "video_url": "/api/events/1/video",
        "created_at": "2026-03-31T10:25:00Z"
      }
    ]
  }
}
```

---

## 4. WebRTC 信令设计

### 4.1 信令流程

```
┌─────────┐                                    ┌─────────┐
│  设备   │                                    │  Web    │
│  端     │                                    │  端     │
└────┬────┘                                    └────┬────┘
     │                                             │
     │  1. 连接信令服务器                             │
     │  ─────────────────────────────────────────► │
     │                                             │
     │  2. 加入房间 (device_abc123)                  │
     │  ─────────────────────────────────────────► │
     │                                             │
     │  3. 设备端创建 offer, 发送 SDP                 │
     │  ─────────────────────────────────────────► │
     │                                             │
     │  4. Web 端收到 offer, 创建 answer, 发送 SDP   │
     │  ◄───────────────────────────────────────── │
     │                                             │
     │  5. 双方交换 ICE Candidates                  │
     │  ◄────────────────────────────────────────► │
     │  ─────────────────────────────────────────► │
     │                                             │
     │  6. WebRTC 连接建立，开始传输音视频            │
     │  ════════════════════════════════════════► │
     │  ◄═══════════════════════════════════════ │
     │                                             │
     │  7. 对讲时: Web 端发送 audio track            │
     │  ─────────────────────────────────────────► │
```

### 4.2 Socket.IO 事件定义

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `join-room` | Client → Server | 客户端加入房间 |
| `leave-room` | Client → Server | 客户端离开房间 |
| `offer` | Client → Server | WebRTC Offer SDP |
| `answer` | Client → Server | WebRTC Answer SDP |
| `ice-candidate` | Client → Server | ICE Candidate |
| `room-joined` | Server → Client | 加入房间成功 |
| `peer-joined` | Server → Client | 对端加入房间 |
| `peer-left` | Server → Client | 对端离开房间 |
| `offer-received` | Server → Client | 收到 Offer |
| `answer-received` | Server → Client | 收到 Answer |
| `ice-candidate-received` | Server → Client | 收到 ICE Candidate |

### 4.3 房间管理策略

- 房间 ID = `device_{device_id}`
- 每个房间最多 2 人（设备端 + Web 端）
- 设备端优先加入作为 host
- Web 端后加入
- 连接超时: 30 秒
- 心跳间隔: 15 秒
- 断线重连: 最多 5 次，间隔 2 秒

---

## 5. 存储设计

### 5.1 本地存储结构

```
/data/
├── recordings/
│   ├── {device_id}/
│   │   ├── {year}/
│   │   │   └── {month}/
│   │   │       └── {day}/
│   │   │           └── rec_{timestamp}_{duration}.mp4
├── events/
│   ├── {device_id}/
│   │   └── evt_{timestamp}_{event_id}.mp4
├── thumbnails/
│   ├── {device_id}/
│   │   └── evt_{timestamp}_{event_id}.jpg
├── uploads/
│   └── temp/
│       └── upload_{session_id}.tmp  # 上传临时文件
└── logs/
    └── cleanup.log  # 清理日志
```

### 5.2 存储容量规划

| 类型 | 单文件大小 | 每天数量 | 每天存储 | 3 天存储 |
|------|-----------|---------|---------|---------|
| 连续录像 (720p@2Mbps) | ~100 MB/小时 | 24 小时 | 2.4 GB | 7.2 GB |
| 事件短视频 (10秒) | ~2.5 MB | ~20 个 | 50 MB | 150 MB |
| 缩略图 | ~50 KB | ~20 个 | 1 MB | 3 MB |
| **总计** | - | - | **~2.45 GB** | **~7.35 GB** |

> **磁盘空间建议：** 预留 50GB 存储空间，可支持约 20 天录像存储。
> 可通过 `df -h` 查看磁盘使用情况。

### 5.3 自动清理策略

- 定时任务: 每天凌晨 3:00 执行 (node-cron)
- 清理条件: `created_at < NOW() - INTERVAL 3 DAY`
- 清理顺序: 先删除本地文件，再删除数据库记录
- 清理日志: 记录到 `/data/logs/cleanup.log`

### 5.4 目录创建命令

```bash
# 在服务器上执行
mkdir -p /data/{recordings,events,thumbnails,uploads,logs}
chown -R node:node /data
chmod -R 755 /data
```

---

## 6. 安全设计

### 6.1 认证与授权

```
JWT Token 结构（用户Token）:
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": 1,
    "type": "user",
    "iat": 1743400000,
    "exp": 1743486400  // 24小时后过期
  }
}

JWT Token 结构（设备Token）:
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "deviceId": "device_abc123",
    "type": "device",
    "iat": 1743400000,
    "exp": 1743486400  // 24小时后过期
  }
}
```

### 6.2 权限控制

| 角色 | 权限 |
|------|------|
| 设备端 | 推送视频流、推送事件、上传录像、更新设备状态 |
| Web 用户/游客 | 查看实时视频、查看录像、查看事件、语音对讲 |

### 6.3 API 权限矩阵

| 接口 | 设备端 | Web 用户/游客 |
|------|--------|--------------|
| GET /api/devices | ✗ | ✓ (user_id=1) |
| POST /api/devices | ✗ | ✓ (无需认证，user_id=1) |
| POST /api/devices/:id/status | ✓ | ✗ |
| GET /api/recordings | ✗ | ✓ |
| GET /api/events | ✗ | ✓ |
| WebSocket /signaling | ✓ (device-auth) | ✓ |

### 6.4 传输安全

- HTTPS: 已配置阿里云 SSL 证书
- WSS: WebSocket over HTTPS
- WebRTC: DTLS-SRTP 加密（WebRTC 本身加密）

---

## 7. 部署架构

### 7.1 正式环境服务器配置

| 项目 | 配置 |
|------|------|
| 服务器 | 阿里云 ECS |
| 公网 IP | 101.200.132.120 |
| 域名 | www.xn--3kqq33bc0a96w.top |
| 操作系统 | CentOS 8 |
| Node.js | 20.x LTS |
| PM2 | 已安装 |
| 数据库 | MariaDB (本地) |
| 数据库端口 | 3306 |
| Web 服务端口 | 3000 |
| HTTPS | 已配置阿里云 SSL 证书 |

### 7.1.1 SSH 连接信息

| 项目 | 配置 |
|------|------|
| SSH 命令 | `ssh -i ~/.ssh/id_rsa root@101.200.132.120` |
| 项目路径 | `/root/pet_camera_project` |
| 服务名称 | `petcam-server-new` |
| 重启命令 | `pm2 restart petcam-server-new` |
| 查看日志 | `pm2 logs petcam-server-new` |

### 7.2 服务器部署结构

```
                              ┌─────────────────┐
                              │   阿里云 ECS     │
                              │  CentOS 8       │
                              │  (公网:101.200.132.120)│
┌─────────────┐               │                 │
│   域名解析   │──────────────►│  Nginx (443)    │◄── HTTPS
│ xn--3kq...  │               │    │            │
└─────────────┘               │    ▼            │
                              │  Node.js        │
                              │  (PM2 进程管理)  │
                              │    │            │
                              │    ├── Express  │
                              │    ├── Socket.IO│
                              │    └── Cron     │
                              │                 │
                              │  ┌───────────┐  │
                              │  │ MariaDB   │  │
                              │  │  (本地)    │  │
                              │  └───────────┘  │
                              │                 │
                              │  ┌───────────┐  │
                              │  │ 本地存储   │  │
                              │  │ /data/     │  │
                              │  └───────────┘  │
                              └─────────────────┘
```

### 7.3 Nginx 配置要点

```nginx
# HTTPS 配置
server {
    listen 443 ssl;
    server_name www.xn--3kqq33bc0a96w.top;

    # SSL 证书配置
    ssl_certificate /etc/nginx/ssl/www.xn--3kqq33bc0a96w.top.pem;
    ssl_certificate_key /etc/nginx/ssl/www.xn--3kqq33bc0a96w.top.key;

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 代理
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # 静态文件
    location / {
        root /var/www/petcam-web/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # 录像文件访问（本地存储）
    location /recordings/ {
        alias /data/recordings/;
        internal;
    }

    # APK 下载
    location /apk/ {
        alias /var/www/petcam-apk/;
        autoindex off;
    }

    # HTTP 重定向到 HTTPS
    server {
        listen 80;
        server_name www.xn--3kqq33bc0a96w.top;
        return 301 https://$server_name$request_uri;
    }

    # 上传临时目录
    location /uploads/ {
        alias /data/uploads/;
        internal;
    }

    # 访问日志
    access_log /var/log/nginx/petcam_access.log;
    error_log /var/log/nginx/petcam_error.log;
}
```

### 7.3 环境变量配置

```bash
# .env 文件（生产环境）
NODE_ENV=production
PORT=3000

# 数据库 - MariaDB 自建
DB_HOST=localhost
DB_PORT=3306
DB_NAME=petcam
DB_USER=root
DB_PASSWORD=<数据库密码>

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# 存储 - 本地文件系统
STORAGE_PATH=/data/recordings
UPLOAD_PATH=/data/uploads
THUMBNAIL_PATH=/data/thumbnails

# WebRTC
STUN_SERVER=stun:stun.l.google.com:19302
# TURN 服务器（可选，如有需求）

# 服务器
SERVER_URL=https://www.xn--3kqq33bc0a96w.top
```

> **注意：** `.env` 文件中的敏感信息（密码、JWT_SECRET）不要提交到代码仓库，建议单独保管。

---

## 8. 技术选型详细说明

### 8.1 安卓端技术栈

| 组件 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 语言 | Kotlin | 1.9+ | Android 官方推荐语言 |
| 最小 SDK | API 26 | Android 8.0 | 覆盖 95% 设备 |
| 目标 SDK | API 34 | Android 14 | 最新特性 |
| 相机 | Camera2 API | - | 高性能相机控制 |
| WebRTC | Google WebRTC | 1.0.x | 官方移动端 SDK |
| 动作检测 | TensorFlow Lite | 2.14+ | 本地 ML 推理 |
| 本地存储 | Room | 2.6+ | SQLite 封装 |
| 网络 | Retrofit + OkHttp | - | REST API 调用 |
| WebSocket | OkHttp WebSocket | - | 信令通道 |
| DI | Hilt | 2.50+ | 依赖注入 |
| 异步 | Kotlin Coroutines + Flow | - | 响应式编程 |

### 8.2 后端技术栈

| 组件 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 运行时 | Node.js | 20 LTS | 稳定高性能 |
| 框架 | Express | 4.x | 轻量 Web 框架 |
| WebSocket | Socket.IO | 4.x | 信令服务 |
| ORM | Sequelize | 6.x | MariaDB 操作 |
| 认证 | jsonwebtoken | 9.x | JWT 令牌 |
| 密码 | bcrypt | 5.x | 密码加密 |
| 文件上传 | Multer | 1.x | multipart 处理 |
| 本地存储 | fs (Node.js 内置) | - | 本地文件系统存储 |
| 定时任务 | node-cron | 3.x | 清理任务 |
| 进程管理 | PM2 | 5.x | 生产环境运行 |
| 验证 | express-validator | 7.x | 请求验证 |

### 8.3 Web 前端技术栈

| 组件 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 框架 | Vue.js | 3.4+ | 组合式 API |
| 构建 | Vite | 5.x | 快速开发构建 |
| 路由 | Vue Router | 4.x | SPA 路由 |
| 状态 | Pinia | 2.x | 状态管理 |
| HTTP | Axios | 1.x | API 调用 |
| UI 组件 | 待定 | - | 可选 Element+/NaiveUI |
| WebRTC | adapter.js | 8.x | 浏览器兼容 |
| 视频播放 | video.js | 8.x | 录像播放 |
| 图标 | Lucide Vue | 0.3.x | 现代图标 |

---

## 9. 目录结构汇总

```
pet_camera_project/
├── docs/
│   ├── requirements.md        # 需求文档
│   ├── technical-design.md     # 本文档 - 技术设计
│   └── development-plan.md     # 开发计划
│
├── android/                     # 安卓端代码
│   ├── app/
│   │   └── src/main/
│   │       ├── java/com/petcam/app/
│   │       └── res/
│   ├── build.gradle
│   ├── settings.gradle
│   └── gradle.properties
│
├── server/                      # 后端服务代码
│   ├── src/
│   │   ├── index.js
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── services/
│   │   ├── socket/
│   │   └── utils/
│   ├── package.json
│   └── .env.example
│
└── web/                         # Web 前端代码
    ├── src/
    │   ├── main.js
    │   ├── App.vue
    │   ├── router/
    │   ├── stores/
    │   ├── api/
    │   ├── components/
    │   ├── views/
    │   ├── composables/
    │   └── utils/
    ├── public/
    ├── package.json
    └── vite.config.js
```
