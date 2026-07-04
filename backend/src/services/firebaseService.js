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

/**
 * Lưu alarm data (Có cơ chế chống duplicate/flooding)
 */
async function saveAlarmData(userId, deviceId, data) {
  const ref = db.ref(`users/${userId}/devices/${deviceId}/alarms`);
  
  // Lấy cảnh báo gần nhất
  const snapshot = await ref.orderByKey().limitToLast(1).once('value');
  if (snapshot.exists()) {
    const latestKey = Object.keys(snapshot.val())[0];
    const latestAlarm = snapshot.val()[latestKey];
    
    // Nếu cảnh báo gần nhất CHƯA được acknowledge (xác nhận) 
    // và có cùng loại (alert) -> Không tạo thêm bản ghi mới để tránh rác DB
    if (latestAlarm.acknowledged === false && latestAlarm.alert === data.alert) {
      return { key: latestKey, isDuplicate: true };
    }
  }

  // Nếu không có trùng lặp, tạo cảnh báo mới
  const newEntry = ref.push();
  await newEntry.set({
    alert: data.alert,
    power: data.power,
    time: data.time || new Date().toISOString(),
    acknowledged: false,
    receivedAt: admin.database.ServerValue.TIMESTAMP,
  });
  return { key: newEntry.key, isDuplicate: false };
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

// =============================================
// AUTH - Verify Firebase ID Token
// Mobile App gửi ID Token → Backend verify bằng Admin SDK
// =============================================

async function verifyIdToken(idToken) {
  return await auth.verifyIdToken(idToken);
}

module.exports = {
  db,
  saveEnergyData,
  getEnergyData,
  saveAlarmData,
  getAlarms,
  acknowledgeAlarm,
  writeOverloadHistory,
  verifyIdToken,
};
