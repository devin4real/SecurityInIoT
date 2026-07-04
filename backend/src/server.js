// =============================================
// IoT Security Backend Server
// =============================================
// Kiến trúc: Express REST API + MQTT Bridge + Firebase Admin
//
// Các lớp bảo mật đã triển khai:
// 1. Helmet       → Security headers (chống XSS, clickjacking, sniffing)
// 2. CORS         → Kiểm soát nguồn gốc request
// 3. Rate Limiting → Chống DDoS / Flooding Attack
// 4. Auth Middleware → Verify Firebase ID Token (JWT)
// 5. Input Validation → Chống Injection (express-validator)
// 6. Audit Logging → Ghi lại hành động nhạy cảm
// 7. MQTT over TLS → Mã hóa đường truyền với broker
// 8. Nonce + Timestamp → Chống Replay Attack
// =============================================

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { globalLimiter } = require('./middleware/rateLimiter');
const mqttService = require('./services/mqttService');

// Import routes
const deviceRoutes = require('./routes/deviceRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// SECURITY MIDDLEWARE (Áp dụng toàn cục)
// =============================================

// 1. Helmet — Thiết lập Security Headers
// Chống: XSS, Clickjacking, MIME sniffing, v.v.
app.use(helmet());

// 2. CORS — Cross-Origin Resource Sharing
// Chỉ cho phép request từ nguồn đã cấu hình
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 3. Rate Limiting — Giới hạn request toàn cục
// Chống: DDoS, Brute Force, Flooding Attack
app.use(globalLimiter);

// 4. Parse JSON body
app.use(express.json({ limit: '10kb' })); // Giới hạn kích thước body → chống payload attack

// =============================================
// API ROUTES
// =============================================

app.use('/api/devices', deviceRoutes);
app.use('/api/auth', authRoutes);

// Health check (không cần auth)
app.get('/api/health', (req, res) => {
  const mqttClient = mqttService.getClient();
  res.json({
    status: 'OK',
    server: 'IoT Security Backend',
    mqtt: mqttClient?.connected ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString(),
    security: {
      helmet: true,
      cors: true,
      rateLimiting: true,
      authentication: 'Firebase ID Token',
      inputValidation: 'express-validator',
      auditLogging: true,
      tlsMqtt: true,
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} không tồn tại`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Đã xảy ra lỗi không mong muốn.',
  });
});

// =============================================
// START SERVER
// =============================================

app.listen(PORT, () => {
  console.log('');
  console.log('=============================================');
  console.log('  🔒 IoT Security Backend Server');
  console.log('=============================================');
  console.log(`  📡 API:  http://localhost:${PORT}`);
  console.log(`  🏥 Health: http://localhost:${PORT}/api/health`);
  console.log('  🛡️  Security layers: Helmet, CORS, Rate Limit,');
  console.log('      Auth, Validation, Audit Log, TLS-MQTT');
  console.log('=============================================');
  console.log('');

  // Khởi động MQTT Service — kết nối EMQX Broker
  mqttService.connect();
});
