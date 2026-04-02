const { Sequelize } = require('sequelize');
const config = require('./index');

const sequelize = new Sequelize(
  config.database.name,
  config.database.username,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: config.database.dialect,
    pool: config.database.pool,
    logging: config.env === 'development' ? console.log : false,
    timezone: '+08:00' // 北京时间
  }
);

// 测试数据库连接
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✓ 数据库连接成功');
    return true;
  } catch (error) {
    console.error('✗ 数据库连接失败:', error.message);
    return false;
  }
}

// 同步数据库（开发环境使用）
async function syncDatabase(options = {}) {
  const { force = false, alter = false } = options;
  try {
    await sequelize.sync({ force, alter });
    console.log('✓ 数据库同步完成');
    return true;
  } catch (error) {
    console.error('✗ 数据库同步失败:', error.message);
    return false;
  }
}

module.exports = {
  sequelize,
  testConnection,
  syncDatabase
};
