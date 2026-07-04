// Rate Limiter Middleware
// Giới hạn số lượng request để chống DDoS / Flooding Attack
//
// Mapping bài giảng: "Rate Limiting & Anti-DDoS: áp dụng giới hạn tần suất
// gửi/nhận request ở phía Server để chống tấn công ngập lụt mạng"

const rateLimit = require('express-rate-limit');

// Rate limiter chung cho tất cả API
// 100 requests mỗi 15 phút từ cùng 1 IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100,
  message: {
    error: 'Too Many Requests',
    message: 'Quá nhiều request. Vui lòng thử lại sau 15 phút.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter nghiêm ngặt cho endpoint gửi lệnh điều khiển
// Chỉ cho phép 10 lệnh mỗi phút (chống spam lệnh bật/tắt)
const commandLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 10,
  message: {
    error: 'Command Rate Limit Exceeded',
    message: 'Quá nhiều lệnh điều khiển. Tối đa 10 lệnh/phút.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  globalLimiter,
  commandLimiter,
};
