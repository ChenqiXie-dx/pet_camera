const express = require('express');
const { query, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { Device, Event, Recording } = require('../models');
const { success, notFound } = require('../utils/response');
const { Op } = require('sequelize');

const router = express.Router();

/**
 * GET /api/events
 * 获取事件列表
 */
router.get('/',
  authenticate,
  [
    query('device_id').optional().isInt(),
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601(),
    query('event_type').optional().isString(),
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
      const userDevices = await Device.findAll({
        where: { user_id: req.userId },
        attributes: ['id']
      });
      where.device_id = userDevices.map(d => d.id);
    }

    if (req.query.start_date) {
      where.created_at = where.created_at || {};
      where.created_at[Op.gte] = new Date(req.query.start_date);
    }

    if (req.query.end_date) {
      where.created_at = where.created_at || {};
      where.created_at[Op.lte] = new Date(req.query.end_date);
    }

    if (req.query.event_type) {
      where.event_type = req.query.event_type;
    }

    const { count, rows } = await Event.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
      include: [
        {
          model: Device,
          as: 'device',
          attributes: ['id', 'device_id', 'name']
        },
        {
          model: Recording,
          as: 'video',
          attributes: ['id', 'filename', 'duration']
        }
      ]
    });

    success(res, {
      events: rows.map(e => ({
        id: e.id,
        device_id: e.device_id,
        device_name: e.device?.name,
        event_type: e.event_type,
        confidence: e.confidence,
        thumbnail_url: e.thumbnail_path ? `/uploads/thumbnails/${path.basename(e.thumbnail_path)}` : null,
        video: e.video ? {
          id: e.video.id,
          filename: e.video.filename,
          duration: e.video.duration
        } : null,
        description: e.description,
        created_at: e.created_at
      })),
      pagination: {
        page,
        limit,
        total: count,
        total_pages: Math.ceil(count / limit)
      }
    }, '获取成功');
  })
);

/**
 * GET /api/events/:id
 * 获取事件详情
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const event = await Event.findByPk(req.params.id, {
    include: [
      {
        model: Device,
        as: 'device',
        where: { user_id: req.userId },
        required: true
      },
      {
        model: Recording,
        as: 'video'
      }
    ]
  });

  if (!event) {
    return notFound(res, '事件不存在');
  }

  success(res, {
    event: {
      id: event.id,
      device_id: event.device_id,
      device_name: event.device?.name,
      event_type: event.event_type,
      confidence: event.confidence,
      thumbnail_url: event.thumbnail_path ? `/uploads/thumbnails/${path.basename(event.thumbnail_path)}` : null,
      video: event.video ? {
        id: event.video.id,
        filename: event.video.filename,
        duration: event.video.duration,
        stream_url: `/api/events/${event.id}/video`
      } : null,
      description: event.description,
      created_at: event.created_at
    }
  }, '获取成功');
}));

/**
 * GET /api/events/:id/video
 * 获取事件关联视频流
 */
router.get('/:id/video', authenticate, asyncHandler(async (req, res) => {
  const event = await Event.findByPk(req.params.id, {
    include: [
      {
        model: Device,
        as: 'device',
        where: { user_id: req.userId },
        required: true
      },
      {
        model: Recording,
        as: 'video'
      }
    ]
  });

  if (!event || !event.video) {
    return notFound(res, '视频不存在');
  }

  const recording = event.video;
  const filePath = path.isAbsolute(recording.filepath)
    ? recording.filepath
    : path.join(require('../config').storage.recordings, recording.filepath);

  if (!fs.existsSync(filePath)) {
    return notFound(res, '视频文件不存在');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
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
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4'
    });
    fs.createReadStream(filePath).pipe(res);
  }
}));

module.exports = router;
