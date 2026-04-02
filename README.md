# 心系宠物 - 智能宠物监控系统

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)
![Vue.js](https://img.shields.io/badge/vue.js-3.x-brightgreen.svg)
![Android](https://img.shields.io/badge/android-24+-green.svg)

**宠物在家不放心，远程守护宠物**

</div>

---

## 项目简介

心系宠物是一款基于 WebRTC 的实时视频监控系统，支持 Android 设备推流和 Web 浏览器观看。设备端采用 Android APP 实现摄像头采集和 WebRTC 推流，用户端通过浏览器即可实时查看宠物动态，无需安装额外软件。

---

## 功能特性

### 已完成

- **用户认证** - 注册、登录、JWT Token 认证
- **设备管理** - 设备绑定、解绑、设备状态监控
- **实时视频** - Android 设备推流，Web 端实时观看
- **WebRTC 信令** - 基于 Socket.IO 的 offer/answer/ICE 交换
- **本地预览** - Android 端本地摄像头预览
- **Demo 模式** - 设备不在线时使用本地摄像头演示

### 开发中

- 双向语音对讲
- 视频录像回放
- 事件检测与通知
- Android 端视频录制

---

## 技术架构

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Android   │     │   Nginx Proxy    │     │    Web      │
│    APP      │────>│   (Socket.IO)    │<────│   Browser   │
│ (推流端)     │     │   (HTTP/WS)     │     │  (观看端)    │
└─────────────┘     └──────────────────┘     └─────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   Node.js    │
                    │   Backend    │
                    │  (信令服务)   │
                    └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   MariaDB    │
                    │   数据库     │
                    └──────────────┘
```

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **后端** | Node.js + Express | REST API + Socket.IO 信令 |
| **数据库** | MariaDB + Sequelize | ORM 关系数据库 |
| **Web 前端** | Vue.js 3 + Vite | SPA 单页应用 |
| **状态管理** | Pinia | Vue 3 官方推荐状态管理 |
| **WebRTC** | 原生 WebRTC API | 浏览器端视频接收 |
| **Android** | Kotlin + CameraX | 设备端视频采集 |
| **WebRTC** | Google WebRTC | Android 端推流 |
| **信令** | Socket.IO | WebRTC 信令交换 |
| **部署** | PM2 + Nginx | 生产环境服务管理 |

---

## 项目结构

```
pet_camera/
├── server/                 # 后端服务
│   ├── src/
│   │   ├── config/         # 数据库配置
│   │   ├── middleware/     # 中间件 (认证、错误处理)
│   │   ├── models/         # Sequelize 模型
│   │   ├── routes/         # API 路由
│   │   ├── socket/         # Socket.IO 信令服务
│   │   ├── utils/          # 工具函数 (JWT、密码加密)
│   │   └── index.js        # 入口文件
│   └── package.json
│
├── web/                    # Web 前端
│   ├── src/
│   │   ├── api/            # API 请求封装
│   │   ├── composables/    # Vue Composables (useWebRTC)
│   │   ├── router/         # Vue Router 配置
│   │   ├── stores/         # Pinia 状态管理
│   │   ├── views/          # 页面组件
│   │   ├── App.vue         # 根组件
│   │   └── main.js        # 入口文件
│   ├── dist/               # 构建输出
│   └── package.json
│
├── android/               # Android 应用
│   └── app/
│       └── src/main/java/com/petcam/app/
│           ├── capture/    # CameraX 视频采集
│           ├── data/       # API 和本地存储
│           ├── di/         # Hilt 依赖注入
│           ├── domain/     # 数据模型
│           ├── service/    # 前台服务
│           ├── ui/         # Activity
│           └── webrtc/     # WebRTC 客户端
│
└── docs/                  # 文档
    ├── development-plan.md # 开发计划
    ├── bug-review.md      # Bug 复盘记录
    ├── requirements.md    # 需求文档
    └── technical-design.md # 技术设计
```

---

## 快速开始

### 前置要求

- Node.js >= 18
- MariaDB >= 10
- JDK >= 17 (Android)
- Android Studio (Android 构建)
- Nginx (生产部署)

### 1. 克隆项目

```bash
git clone https://github.com/ChenqiXie-dx/pet_camera.git
cd pet_camera
```

### 2. 后端服务

```bash
cd server

# 安装依赖
npm install

# 复制配置
cp .env.example .env
# 编辑 .env 填写数据库配置

# 启动服务
npm start
```

### 3. Web 前端

```bash
cd web

# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build
```

### 4. Android 应用

```bash
cd android

# 使用 Android Studio 打开项目
# 等待 Gradle 同步完成
# 连接设备或启动模拟器
# 点击 Run (Shift + F10)
```

---

## WebRTC 信令流程

```
┌─────────┐                      ┌─────────┐                      ┌─────────┐
│ Android │                      │ Server  │                      │   Web   │
│ Device  │                      │(Socket) │                      │ Browser │
└────┬────┘                      └────┬────┘                      └────┬────┘
     │  1. device-auth               │                                │
     │──────────────────────────────>│                                │
     │  auth-success                 │                                │
     │<──────────────────────────────│                                │
     │                                │                                │
     │                                │  2. watch-device              │
     │                                │<───────────────────────────────│
     │  3. viewer-joined             │                                │
     │<──────────────────────────────│                                │
     │                                │                                │
     │  4. create offer (SDP)        │                                │
     │  5. offer                     │                                │
     │──────────────────────────────>│───────────────────────────────>│
     │                                │                                │
     │                                │  6. answer                    │
     │  7. answer-received           │<──────────────────────────────│
     │<──────────────────────────────│                                │
     │                                │                                │
     │  8. ICE candidate             │                                │
     │──────────────────────────────>│───────────────────────────────>│
     │                                │                                │
     │  9. ICE candidate-received    │<──────────────────────────────│
     │<──────────────────────────────│                                │
     │                                │                                │
     │  ===== P2P 连接建立 =====      │                                │
```

---

## API 文档

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| POST | /api/auth/logout | 用户登出 |

### 设备

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/devices | 绑定设备 |
| GET | /api/devices | 获取设备列表 |
| GET | /api/devices/:id | 获取设备详情 |
| DELETE | /api/devices/:id | 解绑设备 |

### 事件

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/events | 获取事件列表 |
| GET | /api/events/:id | 获取事件详情 |

### 录像

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/recordings | 获取录像列表 |
| GET | /api/recordings/:id/stream | 播放录像 |

---

## 部署

### 生产环境

1. **后端服务**
```bash
cd server
npm install --production
pm2 start src/index.js --name petcam-server
```

2. **Web 静态文件**
```bash
cd web
npm run build
# 将 dist/ 内容复制到 Nginx web root
```

3. **Nginx 配置**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/petcam-web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3000;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 开发团队

- **后端**: Node.js + Express + MariaDB
- **前端**: Vue.js 3 + Pinia
- **移动端**: Android (Kotlin) + CameraX + WebRTC

---

## License

MIT License

---

## 联系方式

- 项目地址: https://github.com/ChenqiXie-dx/pet_camera