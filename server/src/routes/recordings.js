const express = require('express');
const { query, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { Device, Recording } = require('../models');
const { success, paginated, notFound, error } = require('../utils/response');
const config = require('../config');

const router = express.Router();

/**
 * GET /api/recordings
 * 获取录像列表
 */
router.get('/',
  authenticate,
  [
    query('device_id').optional().isInt(),
    query('date').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '参数错误',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // 构建查询条件
    const where = {};
    if (req.query.device_id) {
      // 验证设备归属
      const device = await Device.findOne({
        where: {
          id: parseInt(req.query.device_id),
          user_id: req.userId
        }
      });
      if (!device) {
        return notFound(res, '设备不存在');
      }
      where.device_id = device.id;
    } else {
      // 只查询用户自己的设备
      const userDevices = await Device.findAll({
        where: { user_id: req.userId },
        attributes: ['id']
      });
      where.device_id = userDevices.map(d => d.id);
    }

    // 按日期筛选
    if (req.query.date) {
      const date = new Date(req.query.date);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));
      where.created_at = {
        [require('sequelize').Op.between]: [startOfDay, endOfDay]
      };
    }

    const { count, rows } = await Recording.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
      include: [{
        model: Device,
        as: 'device',
        attributes: ['id', 'device_id', 'name']
      }]
    });

    return paginated(res, rows.map(r => ({
      id: r.id,
      device_id: r.device_id,
      device_name: r.device?.name,
      filename: r.filename,
      duration: r.duration,
      size: r.file_size,
      recording_type: r.recording_type,
      created_at: r.created_at
    })), { page, limit, total: count });
  })
);

/**
 * GET /api/recordings/:id
 * 获取录像详情
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const recording = await Recording.findByPk(req.params.id, {
    include: [{
      model: Device,
      as: 'device',
      where: { user_id: req.userId },
      required: true
    }]
  });

  if (!recording) {
    return notFound(res, '录像不存在');
  }

  success(res, {
    recording: {
      id: recording.id,
      device_id: recording.device_id,
      device_name: recording.device?.name,
      filename: recording.filename,
      filepath: recording.filepath,
      duration: recording.duration,
      size: recording.file_size,
      recording_type: recording.recording_type,
      created_at: recording.created_at
    }
  }, '获取成功');
}));

/**
 * GET /api/recordings/:id/stream
 * 流式播放录像
 */
router.get('/:id/stream', authenticate, asyncHandler(async (req, res) => {
  const recording = await Recording.findByPk(req.params.id, {
    include: [{
      model: Device,
      as: 'device',
      where: { user_id: req.userId },
      required: true
    }]
  });

  if (!recording) {
    return notFound(res, '录像不存在');
  }

  const filePath = path.isAbsolute(recording.filepath)
    ? recording.filepath
    : path.join(config.storage.recordings, recording.filepath);

  if (!fs.existsSync(filePath)) {
    return notFound(res, '录像文件不存在');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    // 支持 Range 请求（断点续传）
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4'
    });

    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
  } else {
    // 全文件下载
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4'
    });
    fs.createReadStream(filePath).pipe(res);
  }
}));

/**
 * GET /api/recordings/:id/download
 * 下载录像
 */
router.get('/:id/download', authenticate, asyncHandler(async (req, res) => {
  const recording = await Recording.findByPk(req.params.id, {
    include: [{
      model: Device,
      as: 'device',
      where: { user_id: req.userId },
      required: true
    }]
  });

  if (!recording) {
    return notFound(res, '录像不存在');
  }

  const filePath = path.isAbsolute(recording.filepath)
    ? recording.filepath
    : path.join(config.storage.recordings, recording.filepath);

  if (!fs.existsSync(filePath)) {
    return notFound(res, '录像文件不存在');
  }

  res.download(filePath, recording.filename);
}));

/**
 * DELETE /api/recordings/:id
 * 删除录像
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const recording = await Recording.findByPk(req.params.id, {
    include: [{
      model: Device,
      as: 'device',
      where: { user_id: req.userId },
      required: true
    }]
  });

  if (!recording) {
    return notFound(res, '录像不存在');
  }

  // 删除文件
  const filePath = path.isAbsolute(recording.filepath)
    ? recording.filepath
    : path.join(config.storage.recordings, recording.filepath);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await recording.destroy();

  success(res, null, '删除成功');
}));

module.exports = router;
