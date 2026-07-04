// Firebase Admin SDK Service
// Khởi tạo Firebase Admin để truy cập database từ server-side
// Sử dụng Service Account (không dùng client SDK) → bảo mật hơn

const admin = require('firebase-admin');
const path = require('path');

// Load Service Account từ biến môi trường (không hardcode đường dẫn)
const serviceAccountPath = path.resolve(__dirname, '../../', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.database();
const auth = admin.auth();

// =============================================
// DATABASE OPERATIONS
// =============================================

/**
 * Lưu dữ liệu energy vào Firebase
 * Cấu trúc: /users/{userId}/devices/{deviceId}/energy/{timestamp}
 * → Phân quyền theo userId (Authorization)
 */
async function saveEnergyData(userId, deviceId, data) {
  const ref = db.ref(`users/${userId}/devices/${deviceId}/energy`);
  const newEntry = ref.push();
  await newEntry.set({
    energy: data.energy,
    time: data.time || new Date().toISOString(),
    receivedAt: admin.database.ServerValue.TIMESTAMP,
  });
  return newEntry.key;
}

/**
 * Lấy dữ liệu energy theo userId + deviceId
 * → Kiểm tra ownership: chỉ trả về dữ liệu của user sở hữu thiết bị
 */
async function getEnergyData(userId, deviceId, limit = 50) {
  const ref = db.ref(`users/${userId}/devices/${deviceId}/energy`);
  const snapshot = await ref.orderByKey().limitToLast(limit).once('value');
  
  if (!snapshot.exists()) return [];
  
  const data = [];
  snapshot.forEach((child) => {
    data.push({ id: child.key, ...child.val() });
  });
  return data;
}

// In-memory lock để chống Race Condition khi nhận nhiều request cùng lúc
const processingAlarms = new Set();

/**
 * Lưu alarm data (Có cơ chế chống duplicate/flooding và Race Condition)
 */
async function saveAlarmData(userId, deviceId, data) {
  const lockKey = `${userId}_${deviceId}_${data.alert}`;
  
  // Nếu đang xử lý cảnh báo này rồi thì bỏ qua luôn (chống concurrent requests)
  if (processingAlarms.has(lockKey)) {
    return { key: null, isDuplicate: true };
  }
  
  // Đặt lock
  processingAlarms.add(lockKey);

  try {
    const ref = db.ref(`users/${userId}/devices/${deviceId}/alarms`);

    // Tạo cảnh báo mới
    const newEntry = ref.push();
    await newEntry.set({
      alert: data.alert,
      power: data.power,
      time: data.time || new Date().toISOString(),
      acknowledged: true, // Tự động ACK vì đã bỏ tính năng popup
      receivedAt: admin.database.ServerValue.TIMESTAMP,
    });
    return { key: newEntry.key, isDuplicate: false };
  } finally {
    // Luôn giải phóng lock dù thành công hay thất bại
    processingAlarms.delete(lockKey);
  }
}

/**
 * Lấy danh sách alarm
 */
async function getAlarms(userId, deviceId, limit = 20) {
  const ref = db.ref(`users/${userId}/devices/${deviceId}/alarms`);
  const snapshot = await ref.orderByKey().limitToLast(limit).once('value');
  
  if (!snapshot.exists()) return [];
  
  const data = [];
  snapshot.forEach((child) => {
    data.push({ id: child.key, ...child.val() });
  });
  return data;
}

/**
 * Đánh dấu alarm đã được acknowledge
 */
async function acknowledgeAlarm(userId, deviceId, alarmId) {
  const ref = db.ref(`users/${userId}/devices/${deviceId}/alarms/${alarmId}`);
  await ref.update({
    acknowledged: true,
    acknowledgedAt: admin.database.ServerValue.TIMESTAMP,
  });
}

// =============================================
// OVERLOAD HISTORY
// Lưu lại lịch sử thiết bị hoạt động vượt POWER LIMIT
// =============================================

async function writeOverloadHistory(logEntry) {
  const ref = db.ref('overloadHistory');
  const newLog = ref.push();
  await newLog.set({
    ...logEntry,
    timestamp: admin.database.ServerValue.TIMESTAMP,
  });
}

/**
 * Lấy lịch sử thiết bị vượt POWER LIMIT
 * Sắp xếp theo timestamp giảm dần (mới nhất lên đầu)
 */
async function getOverloadHistory(limit = 50) {
  const ref = db.ref('overloadHistory');
  const snapshot = await ref.orderByChild('timestamp').limitToLast(limit).once('value');
  
  const data = [];
  snapshot.forEach((childSnapshot) => {
    data.push({
      id: childSnapshot.key,
      ...childSnapshot.val(),
    });
  });
  
  // Firebase trả về tăng dần, nên reverse để mới nhất lên đầu
  return data.reverse();
}

// =============================================
// PUSH NOTIFICATIONS
// =============================================

async function savePushToken(userId, pushToken) {
  const ref = db.ref(`users/${userId}/pushToken`);
  await ref.set(pushToken);
}

async function getPushToken(userId) {
  const snapshot = await db.ref(`users/${userId}/pushToken`).once('value');
  return snapshot.val();
}

// =============================================
// AUTH - Verify Firebase ID Token
// Mobile App gửi ID Token → Backend verify bằng Admin SDK
// =============================================

async function verifyIdToken(idToken) {
  return await auth.verifyIdToken(idToken);
}

// =============================================
// DEVICE STATUS
// =============================================

async function updateDeviceStatus(userId, deviceId, statusObj) {
  const ref = db.ref(`users/${userId}/devices/${deviceId}/status`);
  await ref.update({
    ...statusObj,
    updatedAt: admin.database.ServerValue.TIMESTAMP,
  });
}

async function getDeviceStatus(userId, deviceId) {
  const snapshot = await db.ref(`users/${userId}/devices/${deviceId}/status`).once('value');
  if (snapshot.exists()) {
    return snapshot.val();
  }
  return { state: 'normal', isOn: true };
}

module.exports = {
  db,
  saveEnergyData,
  getEnergyData,
  saveAlarmData,
  getAlarms,
  acknowledgeAlarm,
  writeOverloadHistory,
  getOverloadHistory,
  savePushToken,
  getPushToken,
  verifyIdToken,
  updateDeviceStatus,
  getDeviceStatus,
};
