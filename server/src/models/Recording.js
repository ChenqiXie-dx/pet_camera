const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Recording = sequelize.define('Recording', {
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
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '文件名'
  },
  filepath: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: '文件路径'
  },
  file_size: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    comment: '文件大小(字节)'
  },
  duration: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    comment: '时长(秒)'
  },
  recording_type: {
    type: DataTypes.ENUM('continuous', 'motion'),
    defaultValue: 'continuous',
    comment: '录制类型'
  }
}, {
  tableName: 'recordings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['device_id', 'created_at'] },
    { fields: ['created_at'] }
  ]
});

// 关联关系
Recording.associate = function(models) {
  Recording.belongsTo(models.Device, {
    foreignKey: 'device_id',
    as: 'device'
  });
  Recording.hasOne(models.Event, {
    foreignKey: 'video_id',
    as: 'event'
  });
};

module.exports = Recording;
