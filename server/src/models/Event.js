const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  device_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'devices',
      key: 'id'
    }
  },
  event_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '事件类型'
  },
  confidence: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: '检测置信度'
  },
  video_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: 'recordings',
      key: 'id'
    },
    comment: '关联的短视频'
  },
  thumbnail_path: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '缩略图路径'
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '事件描述'
  }
}, {
  tableName: 'events',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['device_id', 'created_at'] }
  ]
});

// 关联关系
Event.associate = function(models) {
  Event.belongsTo(models.Device, {
    foreignKey: 'device_id',
    as: 'device'
  });
  Event.belongsTo(models.Recording, {
    foreignKey: 'video_id',
    as: 'video'
  });
};

module.exports = Event;
