const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { User } = require('../models');
const { success, validationError, notFound } = require('../utils/response');

const router = express.Router();

/**
 * GET /api/user/profile
 * 获取用户信息
 */
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  success(res, {
    user: req.user.toJSON()
  }, '获取成功');
}));

/**
 * PUT /api/user/profile
 * 更新用户信息
 */
router.put('/profile',
  authenticate,
  [
    body('email')
      .optional()
      .isEmail()
      .withMessage('邮箱格式不正确'),
    body('avatar_url')
      .optional()
      .isURL()
      .withMessage('头像URL格式不正确')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors.array());
    }

    const { email, avatar_url } = req.body;
    const user = req.user;

    // 更新字段
    if (email !== undefined) {
      // 检查邮箱是否被其他用户使用
      const existing = await User.findByEmail(email);
      if (existing && existing.id !== user.id) {
        return res.status(409).json({
          success: false,
          message: '邮箱已被其他用户使用'
        });
      }
      user.email = email;
    }

    if (avatar_url !== undefined) {
      user.avatar_url = avatar_url;
    }

    await user.save();

    success(res, {
      user: user.toJSON()
    }, '更新成功');
  })
);

/**
 * PUT /api/user/password
 * 修改密码
 */
router.put('/password',
  authenticate,
  [
    body('oldPassword').notEmpty().withMessage('旧密码不能为空'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('新密码长度不能少于6个字符')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors.array());
    }

    const { oldPassword, newPassword } = req.body;
    const user = req.user;

    // 验证旧密码
    const isValid = await user.validatePassword(oldPassword);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: '旧密码不正确'
      });
    }

    // 更新密码
    await user.setPassword(newPassword);
    await user.save();

    success(res, null, '密码修改成功');
  })
);

module.exports = router;
