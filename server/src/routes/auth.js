const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { User } = require('../models');
const { generateToken } = require('../utils/jwt');
const { success, validationError, unauthorized } = require('../utils/response');

const router = express.Router();

/**
 * POST /api/auth/register
 * 用户注册
 */
router.post('/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('用户名长度必须在3-50个字符之间'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('密码长度不能少于6个字符'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('邮箱格式不正确')
  ],
  asyncHandler(async (req, res) => {
    // 验证请求
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors.array());
    }

    const { username, password, email } = req.body;

    // 检查用户名是否已存在
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: '用户名已存在'
      });
    }

    // 检查邮箱是否已存在（如果提供）
    if (email) {
      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: '邮箱已被使用'
        });
      }
    }

    // 创建用户
    const user = User.build({
      username,
      email: email || null
    });
    await user.setPassword(password);
    await user.save();

    // 生成 Token
    const token = generateToken({
      userId: user.id,
      username: user.username
    });

    success(res, {
      user: user.toJSON(),
      token
    }, '注册成功', 201);
  })
);

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login',
  [
    body('username').trim().notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors.array());
    }

    const { username, password } = req.body;

    // 查找用户
    const user = await User.findByUsername(username);
    if (!user) {
      return unauthorized(res, '用户名或密码错误');
    }

    // 验证密码
    const isValid = await user.validatePassword(password);
    if (!isValid) {
      return unauthorized(res, '用户名或密码错误');
    }

    // 生成 Token
    const token = generateToken({
      userId: user.id,
      username: user.username
    });

    success(res, {
      user: user.toJSON(),
      token
    }, '登录成功');
  })
);

/**
 * POST /api/auth/logout
 * 用户登出
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  // JWT 无状态，客户端删除 Token 即可
  // 这里可以做些日志记录
  success(res, null, '登出成功');
}));

/**
 * GET /api/auth/me
 * 获取当前用户信息
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  success(res, {
    user: req.user.toJSON()
  }, '获取成功');
}));

module.exports = router;
