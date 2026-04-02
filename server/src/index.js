const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const { testConnection, syncDatabase } = require('./config/database');
const { initModels } = require('./models');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// 路由引入
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const deviceRoutes = require('./routes/devices');
const recordingRoutes = require('./routes/recordings');
const eventRoutes = require('./routes/events');

// Socket.IO 信令处理
const signaling = require('./socket/signaling');

// 创建 Express 应用
const app = express();
const server = http.createServer(app);

// Socket.IO 配置
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 15000
});

// 存储 io 实例供路由使用
app.set('io', io);

// 中间件配置
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 确保上传目录存在
const uploadDirs = [
  config.storage.uploads,
  config.storage.recordings,
  config.storage.thumbnails
];
uploadDirs.forEach(dir => {
  const absolutePath = path.isAbsolute(dir) ? dir : path.join(__dirname, '..', dir);
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
    console.log(`✓ 创建目录: ${absolutePath}`);
  }
});

// 静态文件服务
app.use('/uploads', express.static(config.storage.uploads));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/recordings', recordingRoutes);
app.use('/api/events', eventRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  });
});

// 404 处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

// Socket.IO 信令服务
signaling(io);

// 启动服务器
async function startServer() {
  try {
    // 测试数据库连接
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('数据库连接失败，请检查配置');
      process.exit(1);
    }

    // 初始化模型（不强制同步，仅验证连接）
    await initModels();

    // 开发环境自动同步数据库
    if (config.env === 'development') {
      await syncDatabase({ alter: true });
    }

    // 启动 HTTP 服务器
    server.listen(config.port, () => {
      console.log(`
╔════════════════════════════════════════════════╗
║         心系宠物 - 后端服务启动成功            ║
╠════════════════════════════════════════════════╣
║  环境: ${config.env.padEnd(40)}║
║  端口: ${String(config.port).padEnd(40)}║
║  数据库: ${config.database.host}:${config.database.port}/${config.database.name}     ║
╚════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('收到 SIGTERM 信号，正在关闭...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

// 启动服务
startServer();

module.exports = { app, server, io };
