const { serverError } = require('../utils/response');

/**
 * 全局错误处理中间件
 */
function errorHandler(err, req, res, next) {
  console.error('错误:', err);

  // Sequelize 错误处理
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => ({
      field: e.path,
      message: e.message
    }));
    return res.status(400).json({
      success: false,
      message: '数据验证失败',
      errors
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors[0]?.path || 'field';
    return res.status(409).json({
      success: false,
      message: `${field}已存在`
    });
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: '无效的 Token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token 已过期'
    });
  }

  // 自定义业务错误
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  // 默认服务器错误
  serverError(res, process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误');
}

/**
 * 404 处理中间件
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `路由 ${req.method} ${req.path} 不存在`
  });
}

/**
 * 异步处理器包装
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
