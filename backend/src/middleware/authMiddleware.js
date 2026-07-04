// Authentication Middleware
// Verify Firebase ID Token từ Mobile App
// 
// Bảo mật: Mọi API request đều phải đính kèm token hợp lệ
// Mobile App gửi: Authorization: Bearer <Firebase ID Token>
// Backend verify bằng Firebase Admin SDK (server-side, không thể giả mạo)

const firebaseService = require('../services/firebaseService');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Format: Bearer <token>',
    });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    // Verify token bằng Firebase Admin SDK
    // Kiểm tra: token chưa hết hạn, chữ ký hợp lệ, được cấp bởi Firebase Auth
    const decodedToken = await firebaseService.verifyIdToken(idToken);
    
    // Gắn thông tin user vào request để các handler sau dùng
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
    
    next();
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    
    // Phân biệt các loại lỗi token
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Token Expired',
        message: 'Firebase ID Token đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }
    
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Token không hợp lệ hoặc đã bị thu hồi.',
    });
  }
}

module.exports = authMiddleware;
