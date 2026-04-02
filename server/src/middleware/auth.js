const { verifyToken } = require('../utils/jwt');
const { unauthorized } = require('../utils/response');
const { User } = require('../models');

/**
 * JWT 认证中间件
 * 验证请求头中的 Token
 */
async function authenticate(req, res, next) {
  try {
    // 获取 Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, '未提供认证 Token');
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return unauthorized(res, '无效或过期的 Token');
    }

    // 查找用户
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return unauthorized(res, '用户不存在');
    }

    // 将用户信息挂载到 req
    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    console.error('认证中间件错误:', error);
    return unauthorized(res, '认证失败');
  }
}

/**
 * 可选认证中间件
 * 如果有 Token 则验证，没有则继续
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (decoded) {
      const user = await User.findByPk(decoded.userId);
      if (user) {
        req.user = user;
        req.userId = user.id;
      }
    }
    next();
  } catch (error) {
    // 忽略错误，继续处理
    next();
  }
}

/**
 * 设备认证中间件
 * 用于设备端连接认证
 */
async function authenticateDevice(req, res, next) {
  try {
    const deviceToken = req.headers['x-device-token'];
    if (!deviceToken) {
      return unauthorized(res, '未提供设备认证 Token');
    }

    // 设备 Token 验证逻辑
    // 这里需要根据实际设备绑定流程实现
    const decoded = verifyToken(deviceToken);
    if (!decoded) {
      return unauthorized(res, '无效的设备 Token');
    }

    req.deviceId = decoded.deviceId;
    req.device = decoded;
    next();
  } catch (error) {
    console.error('设备认证中间件错误:', error);
    return unauthorized(res, '设备认证失败');
  }
}

module.exports = {
  authenticate,
  optionalAuth,
  authenticateDevice
};
