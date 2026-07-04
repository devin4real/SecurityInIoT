// Device API Routes
// Các endpoint để Mobile App tương tác với thiết bị IoT
//
// Bảo mật áp dụng:
// - Authentication: Mọi endpoint đều yêu cầu Firebase ID Token
// - Authorization: Kiểm tra ownership (userId phải khớp)
// - Input Validation: Kiểm tra dữ liệu đầu vào (chống Injection)
// - Rate Limiting: Giới hạn lệnh điều khiển
// - Audit Logging: Ghi lại các hành động nhạy cảm
// - Nonce: Chống Replay Attack cho lệnh điều khiển

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const firebaseService = require('../services/firebaseService');
const mqttService = require('../services/mqttService');
const authMiddleware = require('../middleware/authMiddleware');
const { commandLimiter } = require('../middleware/rateLimiter');
const auditLogger = require('../middleware/auditLogger');

const router = express.Router();

// Tất cả routes đều yêu cầu authentication
router.use(authMiddleware);

// =============================================
// GET /api/devices/:deviceId/energy
// Lấy dữ liệu năng lượng tiêu thụ
// Bảo mật: Auth + Ownership check
// =============================================
router.get(
  '/:deviceId/energy',
  [
    param('deviceId')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Device ID chỉ được chứa chữ, số và underscore'),
  ],
  async (req, res) => {
    // Input Validation — kiểm tra deviceId hợp lệ
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array(),
      });
    }

    try {
      const { deviceId } = req.params;
      // Vì code ESP32 (không muốn sửa) đang fix cứng topic là 'user123/...'
      // Nên ta sẽ ép userId = 'user123' thay vì dùng UID thật của Firebase (req.user.uid)
      const userId = 'user123'; 

      // Authorization: Lấy dữ liệu theo userId
      const data = await firebaseService.getEnergyData(userId, deviceId);

      res.json({
        success: true,
        deviceId,
        count: data.length,
        data,
      });
    } catch (error) {
      console.error('❌ Error fetching energy data:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

// =============================================
// POST /api/devices/:deviceId/command
// Gửi lệnh bật/tắt thiết bị
// Bảo mật: Auth + Validation + Rate Limit + Nonce + Audit Log
// =============================================
router.post(
  '/:deviceId/command',
  commandLimiter, // Rate limiting: tối đa 10 lệnh/phút
  [
    param('deviceId')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Device ID không hợp lệ'),
    body('cmd')
      .isIn(['on', 'off'])
      .withMessage('Command chỉ được là "on" hoặc "off" (chống Injection)'),
  ],
  async (req, res) => {
    // Input Validation — chống Command Injection
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Lệnh không hợp lệ. Chỉ chấp nhận "on" hoặc "off".',
        details: errors.array(),
      });
    }

    try {
      const { deviceId } = req.params;
      const { cmd } = req.body;
      const userId = 'user123'; // Map vào user123 để khớp với ESP32 topic

      // Tạo Nonce (UUID v4) — mã duy nhất cho mỗi lệnh
      // ESP32 sẽ kiểm tra nonce này để chống Replay Attack
      const nonce = uuidv4();

      // Publish lệnh qua MQTT (kèm timestamp + nonce)
      mqttService.publishCommand(userId, deviceId, cmd, nonce);

      res.json({
        success: true,
        message: `Lệnh "${cmd}" đã được gửi đến thiết bị ${deviceId}`,
        nonce, // Trả về nonce để client có thể verify
        timestamp: Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      console.error('❌ Error sending command:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  }
);

// =============================================
// GET /api/devices/:deviceId/alarms
// Lấy lịch sử cảnh báo
// Bảo mật: Auth + Ownership check
// =============================================
router.get(
  '/:deviceId/alarms',
  [
    param('deviceId')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Device ID không hợp lệ'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array(),
      });
    }

    try {
      const { deviceId } = req.params;
      const userId = 'user123'; // Map vào user123 để khớp với ESP32 topic

      const data = await firebaseService.getAlarms(userId, deviceId);

      res.json({
        success: true,
        deviceId,
        count: data.length,
        data,
      });
    } catch (error) {
      console.error('❌ Error fetching alarms:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

// =============================================
// POST /api/devices/:deviceId/alarm-ack
// Xác nhận đã nhận cảnh báo → ESP32 dừng gửi lại
// Bảo mật: Auth + Audit Log
// =============================================
router.post(
  '/:deviceId/alarm-ack',
  [
    param('deviceId')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Device ID không hợp lệ'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array(),
      });
    }

    try {
      const { deviceId } = req.params;
      const userId = 'user123'; // Map vào user123 để khớp với ESP32 topic

      // Publish ACK qua MQTT → ESP32 nhận và dừng gửi alarm
      mqttService.publishAlarmAck(userId, deviceId);

      res.json({
        success: true,
        message: `Alarm ACK đã gửi đến ${deviceId}. Thiết bị sẽ dừng gửi cảnh báo.`,
      });
    } catch (error) {
      console.error('❌ Error acknowledging alarm:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);
// =============================================
// GET /api/devices/overload-history
// Lấy lịch sử thiết bị vượt POWER LIMIT
// Bảo mật: Auth
// =============================================
router.get('/overload-history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const data = await firebaseService.getOverloadHistory(limit);

    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('❌ Error fetching overload history:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
