const { sequelize } = require('../config/database');
const User = require('./User');
const Device = require('./Device');
const Recording = require('./Recording');
const Event = require('./Event');

/**
 * 模型关联设置
 */
function setupAssociations() {
  User.hasMany(Device, {
    foreignKey: 'user_id',
    as: 'devices'
  });

  Device.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  Device.hasMany(Recording, {
    foreignKey: 'device_id',
    as: 'recordings'
  });

  Recording.belongsTo(Device, {
    foreignKey: 'device_id',
    as: 'device'
  });

  Device.hasMany(Event, {
    foreignKey: 'device_id',
    as: 'events'
  });

  Event.belongsTo(Device, {
    foreignKey: 'device_id',
    as: 'device'
  });

  Recording.hasOne(Event, {
    foreignKey: 'video_id',
    as: 'event'
  });

  Event.belongsTo(Recording, {
    foreignKey: 'video_id',
    as: 'video'
  });

  console.log('✓ 模型关联设置完成');
}

// 初始化所有模型
async function initModels() {
  setupAssociations();
  // 验证模型
  await sequelize.authenticate();
  console.log('✓ 模型初始化完成');
}

module.exports = {
  sequelize,
  User,
  Device,
  Recording,
  Event,
  initModels
};
