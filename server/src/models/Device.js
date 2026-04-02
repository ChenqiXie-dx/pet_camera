const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  device_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    comment: '设备生成的唯一ID'
  },
  user_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '设备名称'
  },
  status: {
    type: DataTypes.ENUM('online', 'offline', 'busy'),
    defaultValue: 'offline',
    comment: '设备状态'
  },
  resolution: {
    type: DataTypes.ENUM('480p', '720p', '1080p'),
    defaultValue: '720p',
    comment: '视频分辨率'
  },
  bitrate: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 2000,
    comment: '码率(kbps)'
  },
  motion_sensitivity: {
    type: DataTypes.FLOAT,
    defaultValue: 0.5,
    comment: '动作检测灵敏度(0.0-1.0)'
  },
  last_seen: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后在线时间'
  }
}, {
  tableName: 'devices',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['device_id'] },
    { fields: ['user_id'] }
  ]
});

// 关联关系
Device.associate = function(models) {
  Device.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  Device.hasMany(models.Recording, {
    foreignKey: 'device_id',
    as: 'recordings'
  });
  Device.hasMany(models.Event, {
    foreignKey: 'device_id',
    as: 'events'
  });
};

// 更新在线状态
Device.prototype.updateStatus = function(status) {
  this.status = status;
  if (status === 'online') {
    this.last_seen = new Date();
  }
  return this.save();
};

module.exports = Device;
