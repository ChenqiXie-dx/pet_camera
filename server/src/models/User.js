const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { hashPassword } = require('../utils/password');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '用户名'
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '密码哈希'
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    validate: {
      isEmail: true
    },
    comment: '邮箱'
  },
  avatar_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '头像URL'
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['username'] },
    { fields: ['email'] }
  ]
});

// 实例方法：设置密码
User.prototype.setPassword = async function(password) {
  this.password_hash = await hashPassword(password);
  return this;
};

// 实例方法：验证密码
User.prototype.validatePassword = async function(password) {
  const { comparePassword } = require('../utils/password');
  return comparePassword(password, this.password_hash);
};

// 类方法：根据用户名查找
User.findByUsername = function(username) {
  return this.findOne({ where: { username } });
};

// 类方法：根据邮箱查找
User.findByEmail = function(email) {
  return this.findOne({ where: { email } });
};

// 序列化（去除敏感信息）
User.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.password_hash;
  return values;
};

module.exports = User;
