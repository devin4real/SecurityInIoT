// Audit Logger Middleware
// Ghi lại mọi hành động quan trọng vào Firebase để truy vết bảo mật
//
// Mục đích: Khi có sự cố bảo mật (ví dụ: ai đó gửi lệnh tắt thiết bị lúc 3h sáng),
// admin có thể xem lại audit log để biết: ai làm, lúc nào, từ IP nào

const firebaseService = require('../services/firebaseService');

function auditLogger(action) {
  return async (req, res, next) => {
    // Ghi log TRƯỚC khi xử lý request
    const logEntry = {
      action: action,
      userId: req.user?.uid || 'anonymous',
      email: req.user?.email || 'unknown',
      method: req.method,
      path: req.originalUrl,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      body: sanitizeBody(req.body), // Không log password hoặc token
    };

    try {
      await firebaseService.writeOverloadHistory(logEntry);
    } catch (err) {
      // Không block request nếu audit log lỗi
      console.error('⚠️ Audit log failed:', err.message);
    }

    next();
  };
}

// Xóa các trường nhạy cảm trước khi log
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'private_key'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

module.exports = auditLogger;
