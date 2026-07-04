// MQTT Service — Kết nối EMQX Broker qua TLS
// Vai trò: Cầu nối giữa ESP32 (MQTT) và Backend (REST API + Firebase)

const mqtt = require('mqtt');
const firebaseService = require('./firebaseService');

let mqttClient = null;

/**
 * Khởi tạo kết nối MQTT với EMQX Broker
 * Bảo mật:
 * - Kết nối qua MQTTS (TLS) port 8883
 * - Xác thực bằng Username/Password
 * - Không dùng anonymous connection
 */
function connect() {
  const brokerUrl = process.env.MQTT_BROKER_URL;

  const options = {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    // TLS: Bỏ qua kiểm tra certificate cho public broker (demo)
    // Production: cung cấp CA certificate
    rejectUnauthorized: false,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    // Sử dụng clientId cố định để khi start instance mới, instance cũ bị đá ra
    // Tránh tình trạng 2 backend cùng chạy và nhận cùng 1 tin nhắn
    clientId: 'backend-server-primary',
  };

  mqttClient = mqtt.connect(brokerUrl, options);

  mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT Broker (TLS)');

    // Subscribe topic CỤ THỂ của user (không dùng wildcard toàn cục)
    // Vì broker.emqx.io là public broker, dùng +/+/energy sẽ nhận rác từ người khác
    // Cấu trúc: user123/{deviceId}/{action}
    mqttClient.subscribe('user123/+/energy', { qos: 1 }, (err) => {
      if (!err) console.log('📊 Subscribed to user123/+/energy (QoS 1)');
    });

    mqttClient.subscribe('user123/+/alarm', { qos: 1 }, (err) => {
      if (!err) console.log('🚨 Subscribed to user123/+/alarm (QoS 1)');
    });
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      const parts = topic.split('/');
      if (parts.length !== 3) {
        console.warn('⚠️ Invalid topic format:', topic);
        return;
      }

      const [userId, deviceId, action] = parts;
      const payload = JSON.parse(message.toString());

      // ===== TOPIC VALIDATION (chống Injection vào topic) =====
      // Chỉ cho phép ký tự alphanumeric và underscore
      const validPattern = /^[a-zA-Z0-9_]+$/;
      if (!validPattern.test(userId) || !validPattern.test(deviceId)) {
        console.warn('⚠️ Suspicious topic rejected:', topic);
        return;
      }

      if (action === 'energy') {
        // Validate data trước khi lưu (Input Validation)
        if (typeof payload.energy !== 'number' || payload.energy < 0) {
          console.warn('⚠️ Invalid energy data rejected:', payload);
          return;
        }

        await firebaseService.saveEnergyData(userId, deviceId, payload);
        console.log(`📊 Energy saved: ${userId}/${deviceId} → ${payload.energy} kWh`);

      } else if (action === 'alarm') {
        // Validate alarm data
        if (!payload.alert || typeof payload.power !== 'number') {
          console.warn('⚠️ Invalid alarm data rejected:', payload);
          return;
        }

        const { isDuplicate } = await firebaseService.saveAlarmData(userId, deviceId, payload);

        if (!isDuplicate) {
          console.log(`🚨 ALARM saved: ${userId}/${deviceId} → ${payload.alert} (${payload.power}W)`);
          
          // Cập nhật trạng thái thiết bị thành Bị hỏng
          await firebaseService.updateDeviceStatus(userId, deviceId, { state: 'broken', isOn: false });

          // Lấy Push Token và gửi thông báo đẩy
          const pushToken = await firebaseService.getPushToken(userId);
          if (pushToken) {
            try {
              await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                  Accept: 'application/json',
                  'Accept-encoding': 'gzip, deflate',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  to: pushToken,
                  sound: 'default',
                  title: '🚨 CẢNH BÁO NGUY HIỂM!',
                  body: `Thiết bị đang quá tải (${payload.power} W). Vui lòng kiểm tra ngay!`,
                  data: { deviceId, power: payload.power },
                }),
              });
              console.log(`📲 Push notification sent to ${pushToken}`);
            } catch (pushErr) {
              console.error('❌ Failed to send push notification:', pushErr);
            }
          }
        }

        // TỰ ĐỘNG ACK: Ngay khi nhận được cảnh báo đầu tiên, 
        // publish ACK ngay lập tức để ESP32 ngừng kêu (theo yêu cầu mới của người dùng)
        publishAlarmAck(userId, deviceId);
      }
    } catch (err) {
      console.error('❌ Error processing MQTT message:', err.message);
    }
  });

  mqttClient.on('error', (err) => {
    console.error('❌ MQTT Error:', err.message);
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 Reconnecting to MQTT Broker...');
  });

  return mqttClient;
}

/**
 * Publish lệnh điều khiển xuống ESP32
 * Bảo mật:
 * - Payload bao gồm timestamp + nonce để chống Replay Attack
 * - Chỉ được gọi từ authenticated API endpoint
 */
function publishCommand(userId, deviceId, command, nonce) {
  if (!mqttClient || !mqttClient.connected) {
    throw new Error('MQTT client not connected');
  }

  const topic = `${userId}/${deviceId}/command`;
  const payload = JSON.stringify({
    cmd: command,
    timestamp: Math.floor(Date.now() / 1000), // Unix timestamp (giây)
    nonce: nonce, // Mã duy nhất chống Replay Attack
  });

  // Publish với QoS 1 (At least once)
  mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Failed to publish command:', err);
    } else {
      console.log(`📤 Command published: ${topic} → ${payload}`);
    }
  });
}

/**
 * Publish ACK xác nhận alarm đã nhận được
 */
function publishAlarmAck(userId, deviceId) {
  if (!mqttClient || !mqttClient.connected) {
    throw new Error('MQTT client not connected');
  }

  const topic = `${userId}/${deviceId}/alarm_ack`;
  const payload = JSON.stringify({
    ack: true,
    timestamp: Math.floor(Date.now() / 1000),
  });

  mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Failed to publish alarm ACK:', err);
    } else {
      console.log(`✅ Alarm ACK published: ${topic}`);
    }
  });
}

function getClient() {
  return mqttClient;
}

module.exports = {
  connect,
  publishCommand,
  publishAlarmAck,
  getClient,
};
