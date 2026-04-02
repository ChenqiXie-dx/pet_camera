/**
 * 统一响应格式工具
 */

/**
 * 成功响应
 * @param {Object} res - Express response 对象
 * @param {Object} data - 响应数据
 * @param {string} message - 成功消息
 * @param {number} statusCode - HTTP 状态码
 */
function success(res, data = null, message = '操作成功', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

/**
 * 错误响应
 * @param {Object} res - Express response 对象
 * @param {string} message - 错误消息
 * @param {number} statusCode - HTTP 状态码
 * @param {Object} errors - 详细错误信息
 */
function error(res, message = '操作失败', statusCode = 500, errors = null) {
  const response = {
    success: false,
    message
  };
  if (errors) {
    response.errors = errors;
  }
  return res.status(statusCode).json(response);
}

/**
 * 分页响应
 * @param {Object} res - Express response 对象
 * @param {Array} data - 数据列表
 * @param {Object} pagination - 分页信息
 */
function paginated(res, data, pagination) {
  return res.status(200).json({
    success: true,
    data: {
      list: data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        total_pages: Math.ceil(pagination.total / pagination.limit)
      }
    }
  });
}

/**
 * UNAUTHORIZED 响应
 */
function unauthorized(res, message = '未授权，请登录') {
  return error(res, message, 401);
}

/**
 * FORBIDDEN 响应
 */
function forbidden(res, message = '权限不足') {
  return error(res, message, 403);
}

/**
 * NOT_FOUND 响应
 */
function notFound(res, message = '资源不存在') {
  return error(res, message, 404);
}

/**
 * VALIDATION_ERROR 响应
 */
function validationError(res, errors) {
  return error(res, '数据验证失败', 400, errors);
}

/**
 * SERVER_ERROR 响应
 */
function serverError(res, message = '服务器内部错误') {
  return error(res, message, 500);
}

module.exports = {
  success,
  error,
  paginated,
  unauthorized,
  forbidden,
  notFound,
  validationError,
  serverError
};
