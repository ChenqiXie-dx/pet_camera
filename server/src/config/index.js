require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,

  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    name: process.env.DB_NAME || 'petcam',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    dialect: 'mysql',
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },

  // 存储路径
  storage: {
    recordings: process.env.STORAGE_PATH || './data/recordings',
    uploads: process.env.UPLOAD_PATH || './uploads',
    thumbnails: process.env.THUMBNAIL_PATH || './data/thumbnails'
  },

  // WebRTC 配置
  webrtc: {
    stunServer: process.env.STUN_SERVER || 'stun:stun.l.google.com:19302'
  },

  // 服务器URL
  serverUrl: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`
};
