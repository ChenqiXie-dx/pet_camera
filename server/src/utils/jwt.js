const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * 生成 JWT Token
 * @param {Object} payload - Token 载荷数据
 * @returns {string} JWT Token
 */
function generateToken(payload) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
}

/**
 * 验证 JWT Token
 * @param {string} token - JWT Token
 * @returns {Object|null} 解码后的数据或 null
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    return null;
  }
}

/**
 * 解码 JWT Token（不验证）
 * @param {string} token - JWT Token
 * @returns {Object|null} 解码后的数据或 null
 */
function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
}

/**
 * 获取 Token 过期时间
 * @returns {number} 过期时间戳
 */
function getTokenExpireTime() {
  const decoded = jwt.decode(generateToken({ test: true }));
  return decoded.exp;
}

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
  getTokenExpireTime
};
