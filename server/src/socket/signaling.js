const { verifyToken } = require('../utils/jwt');
const { Device } = require('../models');

/**
 * WebRTC 信令服务
 * 处理设备端和 Web 端的连接、信令交换
 */

// 在线设备和房间管理
const devices = new Map(); // deviceId -> { socket, info }
const rooms = new Map();   // roomId -> { device, viewers: Set }

function signaling(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] 客户端连接: ${socket.id}`);

    let currentUser = null;
    let currentDevice = null;
    let currentRoom = null;

    /**
     * 设备端认证
     */
    socket.on('device-auth', async (data) => {
      try {
        const { device_id, token } = data;

        // 验证设备 Token
        const decoded = verifyToken(token);
        if (!decoded || decoded.deviceId !== device_id) {
          socket.emit('auth-error', { message: '设备认证失败' });
          return;
        }

        // 查找设备
        const device = await Device.findOne({ where: { device_id } });
        if (!device) {
          socket.emit('auth-error', { message: '设备不存在' });
          return;
        }

        // 更新设备状态
        device.status = 'online';
        device.last_seen = new Date();
        await device.save();

        // 保存设备信息
        currentDevice = { id: device.id, device_id: device.device_id, user_id: device.user_id };
        devices.set(device_id, { socket, info: currentDevice });

        // 加入设备房间
        const roomId = `device_${device_id}`;
        currentRoom = roomId;
        socket.join(roomId);

        // 广播设备上线
        io.to(`user_${device.user_id}`).emit('device-status', {
          device_id: device.device_id,
          status: 'online',
          last_seen: device.last_seen
        });

        socket.emit('auth-success', { device_id, status: 'online' });
        console.log(`[Socket] 设备认证成功: ${device_id}`);
      } catch (error) {
        console.error('[Socket] 设备认证错误:', error);
        socket.emit('auth-error', { message: '认证过程出错' });
      }
    });

    /**
     * Web 端用户认证
     */
    socket.on('user-auth', async (data) => {
      try {
        const { user_id, token } = data;

        const decoded = verifyToken(token);
        if (!decoded || decoded.userId !== user_id) {
          socket.emit('auth-error', { message: '用户认证失败' });
          return;
        }

        currentUser = { id: user_id, user_id: decoded.userId, username: decoded.username };

        // 加入用户房间（用于接收设备状态更新）
        socket.join(`user_${user_id}`);

        socket.emit('auth-success', { user_id, username: decoded.username });
        console.log(`[Socket] 用户认证成功: ${decoded.username}`);
      } catch (error) {
        console.error('[Socket] 用户认证错误:', error);
        socket.emit('auth-error', { message: '认证过程出错' });
      }
    });

    /**
     * Web 端请求观看设备视频
     */
    socket.on('watch-device', async (data) => {
      try {
        const { device_id } = data;

        if (!currentUser) {
          socket.emit('error', { message: '请先认证' });
          return;
        }

        const deviceInfo = devices.get(device_id);
        if (!deviceInfo) {
          socket.emit('error', { message: '设备不在线' });
          return;
        }

        // 检查设备是否属于该用户
        if (deviceInfo.info.user_id !== currentUser.user_id) {
          socket.emit('error', { message: '无权观看此设备' });
          return;
        }

        const roomId = `device_${device_id}`;
        socket.join(roomId);

        // 通知设备端有观众加入
        io.to(roomId).emit('viewer-joined', {
          viewer_id: socket.id,  // 使用 socket ID 而不是 user_id，因为 offer 需要用 socket.id 路由
          viewer_count: getRoomViewerCount(roomId)
        });

        socket.emit('watch-started', { device_id, room_id: roomId });
        console.log(`[Socket] 用户 ${currentUser.username} 开始观看设备 ${device_id}`);
      } catch (error) {
        console.error('[Socket] 观看设备错误:', error);
        socket.emit('error', { message: '请求失败' });
      }
    });

    /**
     * 离开观看
     */
    socket.on('stop-watching', (data) => {
      if (!data) return;
      const device_id = data.device_id;
      if (!device_id) return;
      const roomId = `device_${device_id}`;
      socket.leave(roomId);

      // 通知设备端观众离开
      io.to(roomId).emit('viewer-left', {
        viewer_id: socket.id,  // 使用 socket ID
        viewer_count: getRoomViewerCount(roomId)
      });

      console.log(`[Socket] 用户 ${currentUser?.username} 停止观看设备 ${device_id}`);
    });

    /**
     * WebRTC Offer (设备端 -> Web 端 或 Web 端 -> 设备端)
     */
    socket.on('offer', (data) => {
      const { target_id, type, sdp } = data;
      io.to(target_id).emit('offer-received', {
        from_id: socket.id,
        type,
        sdp
      });
    });

    /**
     * WebRTC Answer
     */
    socket.on('answer', (data) => {
      const { target_id, sdp } = data;
      io.to(target_id).emit('answer-received', {
        from_id: socket.id,
        type: 'answer',
        sdp
      });
    });

    /**
     * ICE Candidate
     */
    socket.on('ice-candidate', (data) => {
      const { target_id, candidate } = data;
      console.log('[Socket] ICE candidate received:', JSON.stringify(data));
      io.to(target_id).emit('ice-candidate-received', {
        from_id: socket.id,
        sdpMid: candidate?.sdpMid || '',
        sdpMLineIndex: candidate?.sdpMLineIndex || 0,
        candidate: candidate?.candidate || ''
      });
    });

    /**
     * 对讲音频 (Web 端 -> 设备端)
     */
    socket.on('intercom-audio', (data) => {
      if (!currentUser || !currentDevice) return;

      const { device_id, audio_data } = data;
      const roomId = `device_${device_id}`;

      // 转发音频数据到设备端
      io.to(roomId).emit('intercom-audio', {
        from_id: currentUser.user_id,
        audio_data
      });
    });

    /**
     * 心跳检测
     */
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    /**
     * 断开连接
     */
    socket.on('disconnect', async () => {
      console.log(`[Socket] 客户端断开: ${socket.id}`);

      if (currentDevice) {
        // 设备断开
        const device = await Device.findByPk(currentDevice.id);
        if (device) {
          device.status = 'offline';
          await device.save();

          // 广播设备下线
          io.to(`user_${device.user_id}`).emit('device-status', {
            device_id: device.device_id,
            status: 'offline'
          });
        }

        devices.delete(currentDevice.device_id);
      }
    });
  });
}

/**
 * 获取房间内观众数量
 */
function getRoomViewerCount(roomId) {
  const room = rooms.get(roomId);
  return room ? room.viewers.size : 0;
}

module.exports = signaling;
