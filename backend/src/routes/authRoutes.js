// Auth API Routes
// Endpoint xác thực — cho Mobile App kiểm tra token hợp lệ

const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');

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

module.exports = router;
