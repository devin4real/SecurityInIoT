const mqtt = require('mqtt');
require('dotenv').config();

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtts://broker.emqx.io:8883';
const username = process.env.MQTT_USERNAME || 'my_secure_user';
const password = process.env.MQTT_PASSWORD || 'my_secure_password';

console.log('🔄 Connecting to MQTT Broker...');

const client = mqtt.connect(brokerUrl, {
  username,
  password,
  clientId: `simulate_alarm_${Math.random().toString(16).substring(2, 8)}`,
});

client.on('connect', () => {
  console.log('✅ Connected! Sending fake alarm...');

  const topic = 'user123/esp32_01/alarm';
  const payload = {
    alert: 'OVERLOAD',
    power: 1250.5 + Math.random() * 500 // random power từ 1250 đến 1750W
  };

  client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Failed to send alarm:', err);
    } else {
      console.log(`📤 Message sent to [${topic}]`);
      console.log('Payload:', payload);
      console.log('✅ Kiểm tra điện thoại, bạn sẽ thấy Push Notification nhảy ra!');
    }
    
    // Đóng kết nối sau khi gửi xong
    client.end();
  });
});

client.on('error', (err) => {
  console.error('❌ Connection error:', err);
  client.end();
});
