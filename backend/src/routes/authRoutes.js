// Auth API Routes
// Endpoint xác thực — cho Mobile App kiểm tra token hợp lệ

const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const firebaseService = require('../services/firebaseService');

const router = express.Router();

// GET /api/auth/me
// Trả về thông tin user đã xác thực từ Firebase ID Token
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: {
      uid: req.user.uid,
      email: req.user.email,
    },
  });
});

// POST /api/auth/push-token
// Lưu push token của thiết bị để bắn thông báo
router.post('/push-token', authMiddleware, async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) {
      return res.status(400).json({ error: 'Missing pushToken' });
    }
    
    // Ghi đè cứng userId = 'user123' cho khớp logic IoT hiện tại
    const userId = 'user123';
    
    await firebaseService.savePushToken(userId, pushToken);
    
    res.json({ success: true, message: 'Push token saved successfully' });
  } catch (error) {
    console.error('❌ Error saving push token:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
