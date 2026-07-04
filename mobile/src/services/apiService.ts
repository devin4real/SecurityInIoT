// API Service — Tầng trung gian giữa Mobile App và Backend Server
// 
// Thay vì gọi Firebase trực tiếp (không an toàn), Mobile App giờ gọi
// Backend API và đính kèm Firebase ID Token trong mỗi request.
// Backend sẽ verify token trước khi xử lý.

import { auth } from '../config/firebaseConfig';

// Backend URL — thay đổi khi deploy lên cloud
// const API_BASE_URL = 'http://10.0.2.2:3000/api'; // Android emulator
// const API_BASE_URL = 'http://localhost:3000/api'; // iOS simulator
const API_BASE_URL = 'http://10.136.13.200:3000/api'; // Physical device trên LAN

/**
 * Lấy Firebase ID Token hiện tại của user đã đăng nhập
 * Token này sẽ được gửi kèm mọi API request để Backend verify
 */
async function getAuthToken(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User chưa đăng nhập');
  }
  // getIdToken(true) force refresh nếu token sắp hết hạn
  return await currentUser.getIdToken(true);
}

/**
 * Helper function cho API calls — tự động gắn Auth header
 */
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`, // JWT-style authentication
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `API Error: ${response.status}`);
  }

  return data;
}

// =============================================
// API FUNCTIONS
// =============================================

/**
 * Lấy dữ liệu energy từ Backend (qua API, không trực tiếp Firebase)
 * Backend kiểm tra ownership trước khi trả dữ liệu
 */
export async function getEnergyData(deviceId: string) {
  return apiRequest(`/devices/${deviceId}/energy`);
}

/**
 * Gửi lệnh bật/tắt thiết bị
 * Backend sẽ: validate input → tạo nonce → publish MQTT → log audit
 */
export async function sendCommand(deviceId: string, cmd: 'on' | 'off') {
  return apiRequest(`/devices/${deviceId}/command`, {
    method: 'POST',
    body: JSON.stringify({ cmd }),
  });
}

/**
 * Lấy danh sách cảnh báo
 */
export async function getAlarms(deviceId: string) {
  return apiRequest(`/devices/${deviceId}/alarms`);
}

/**
 * Gửi ACK xác nhận cảnh báo → ESP32 sẽ dừng gửi lại
 */
export async function acknowledgeAlarm(deviceId: string) {
  return apiRequest(`/devices/${deviceId}/alarm-ack`, {
    method: 'POST',
  });
}

/**
 * Kiểm tra trạng thái Backend + MQTT
 */
export async function healthCheck() {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
}

/**
 * Lấy lịch sử sự cố / quá tải
 */
export async function getOverloadHistory(limit: number = 50) {
  return apiRequest(`/devices/overload-history?limit=${limit}`);
}

export default {
  getEnergyData,
  sendCommand,
  getAlarms,
  acknowledgeAlarm,
  healthCheck,
  getOverloadHistory,
};
