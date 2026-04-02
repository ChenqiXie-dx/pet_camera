const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { Device, Recording, Event } = require('../models');
const { success, validationError, notFound, unauthorized } = require('../utils/response');
const { generateToken } = require('../utils/jwt');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

/**
 * GET /api/devices
 * 获取用户的设备列表
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const devices = await Device.findAll({
    where: { user_id: req.userId },
    order: [['created_at', 'DESC']]
  });

  success(res, {
    devices: devices.map(d => ({
      id: d.id,
      device_id: d.device_id,
      name: d.name,
      status: d.status,
      resolution: d.resolution,
      last_seen: d.last_seen,
      created_at: d.created_at
    }))
  }, '获取成功');
}));

/**
 * POST /api/devices
 * 创建设备（用于扫码绑定）
 * 无需用户认证，设备直接绑定
 */
router.post('/',
  [
    body('device_id').trim().notEmpty().withMessage('设备ID不能为空'),
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('设备名称长度必须在1-100个字符之间')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors.array());
    }

    const { device_id, name } = req.body;
    const userId = req.userId || 1; // 未登录时使用默认用户ID 1

    // 检查设备是否已存在
    const existing = await Device.findOne({ where: { device_id } });
    if (existing) {
      // 如果已绑定到其他用户
      if (existing.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: '该设备已绑定到其他账户'
        });
      }
      // 已绑定到当前用户，返回现有设备
      return success(res, {
        device: {
          id: existing.id,
          device_id: existing.device_id,
          name: existing.name,
          status: existing.status
        }
      }, '设备已存在');
    }

    // 创建设备
    const device = await Device.create({
      device_id,
      user_id: userId,
      name
    });

    // 生成设备 Token
    const deviceToken = generateToken({
      deviceId: device.device_id,
      type: 'device'
    });

    success(res, {
      device: {
        id: device.id,
        device_id: device.device_id,
        name: device.name,
        status: device.status
      },
      token: deviceToken
    }, '设备绑定成功', 201);
  })
);

/**
 * GET /api/devices/:id
 * 获取设备详情
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const device = await Device.findOne({
    where: {
      id: req.params.id,
      user_id: req.userId
    }
  });

  if (!device) {
    return notFound(res, '设备不存在');
  }

  success(res, {
    device: {
      id: device.id,
      device_id: device.device_id,
      name: device.name,
      status: device.status,
      resolution: device.resolution,
      bitrate: device.bitrate,
      motion_sensitivity: device.motion_sensitivity,
      last_seen: device.last_seen,
      created_at: device.created_at
    }
  }, '获取成功');
}));

/**
 * PUT /api/devices/:id
 * 更新设备配置
 */
router.put('/:id',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('resolution').optional().isIn(['480p', '720p', '1080p']),
    body('bitrate').optional().isInt({ min: 500, max: 8000 }),
    body('motion_sensitivity').optional().isFloat({ min: 0, max: 1 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors.array());
    }

    const device = await Device.findOne({
      where: {
        id: req.params.id,
        user_id: req.userId
      }
    });

    if (!device) {
      return notFound(res, '设备不存在');
    }

    const { name, resolution, bitrate, motion_sensitivity } = req.body;

    // 更新字段
    if (name !== undefined) device.name = name;
    if (resolution !== undefined) device.resolution = resolution;
    if (bitrate !== undefined) device.bitrate = bitrate;
    if (motion_sensitivity !== undefined) device.motion_sensitivity = motion_sensitivity;

    await device.save();

    success(res, {
      device: {
        id: device.id,
        device_id: device.device_id,
        name: device.name,
        status: device.status,
        resolution: device.resolution,
        bitrate: device.bitrate,
        motion_sensitivity: device.motion_sensitivity
      }
    }, '更新成功');
  })
);

/**
 * DELETE /api/devices/:id
 * 解绑设备
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const device = await Device.findOne({
    where: {
      id: req.params.id,
      user_id: req.userId
    }
  });

  if (!device) {
    return notFound(res, '设备不存在');
  }

  await device.destroy();

  success(res, null, '设备已解绑');
}));

/**
 * POST /api/devices/:id/status
 * 更新设备状态（由设备端调用）
 */
router.post('/:id/status',
  [
    body('status').isIn(['online', 'offline', 'busy'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors.array());
    }

    const device = await Device.findByPk(req.params.id);
    if (!device) {
      return notFound(res, '设备不存在');
    }

    device.status = req.body.status;
    if (req.body.status === 'online') {
      device.last_seen = new Date();
    }
    await device.save();

    // 通过 Socket.IO 广播设备状态更新
    const io = req.app.get('io');
    io.to(`user_${device.user_id}`).emit('device-status', {
      device_id: device.device_id,
      status: device.status,
      last_seen: device.last_seen
    });

    success(res, { status: device.status }, '状态更新成功');
  })
);

/**
 * GET /api/devices/:id/events
 * 获取设备的事件列表
 */
router.get('/:id/events', authenticate, asyncHandler(async (req, res) => {
  const device = await Device.findOne({
    where: {
      id: req.params.id,
      user_id: req.userId
    }
  });

  if (!device) {
    return notFound(res, '设备不存在');
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const { count, rows } = await Event.findAndCountAll({
    where: { device_id: device.id },
    order: [['created_at', 'DESC']],
    limit,
    offset
  });

  success(res, {
    events: rows,
    pagination: {
      page,
      limit,
      total: count,
      total_pages: Math.ceil(count / limit)
    }
  }, '获取成功');
}));

module.exports = router;
