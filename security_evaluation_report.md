# Chương: Đánh giá Bảo mật Hệ thống

Chương này phân tích và đánh giá mức độ áp dụng các kiến thức lý thuyết về kiến trúc bảo mật trong ứng dụng IoT — được tổng hợp từ bài giảng — vào hệ thống thực tế của đề tài. Mỗi khái niệm lý thuyết sẽ được đối chiếu trực tiếp với các đoạn mã nguồn (code) đã triển khai trên cả ba phân hệ: Firmware ESP32, Backend Server và Mobile App.

---

## 1. Mô hình Phòng thủ chiều sâu (Defense-in-Depth)

**Khái niệm từ bài giảng:**
Một hệ thống IoT an toàn không bao giờ được phụ thuộc vào một rào cản bảo mật duy nhất. Thay vào đó, cần triển khai nhiều lớp bảo vệ độc lập và chồng chéo, sao cho khi một lớp bị phá vỡ, các lớp phía sau vẫn có khả năng ngăn chặn cuộc tấn công. Mô hình này được gọi là Defense-in-Depth (Phòng thủ chiều sâu).

**Đánh giá qua mã nguồn:**
Dự án đã thể hiện rõ tư duy phân lớp bảo mật này qua việc mỗi phân hệ tự triển khai cơ chế phòng thủ riêng, hoạt động độc lập với nhau:

- **Lớp 1 — Tại Backend (`server.js`):** Là tuyến phòng thủ đầu tiên cho mọi request đến từ bên ngoài. Hàng loạt middleware bảo mật được xếp chồng theo thứ tự:
  ```javascript
  // server.js
  app.use(helmet());        // Lớp 1a: Thiết lập Security Headers
  app.use(cors({...}));      // Lớp 1b: Kiểm soát nguồn gốc request
  app.use(globalLimiter);    // Lớp 1c: Giới hạn tần suất gọi API
  app.use(express.json({ limit: '10kb' })); // Lớp 1d: Giới hạn kích thước payload
  ```

- **Lớp 2 — Tại đường truyền MQTT (`mqttService.js`):** Khi dữ liệu đã vượt qua Backend và được publish xuống MQTT, mọi giao tiếp đều đi qua kênh mã hóa TLS:
  ```javascript
  // mqttService.js
  const brokerUrl = process.env.MQTT_BROKER_URL; // mqtts://broker.emqx.io:8883
  ```

- **Lớp 3 — Tại thiết bị biên ESP32 (`sketch_jun18a.ino`):** Ngay cả khi hacker vượt qua tất cả các lớp trên và bơm được lệnh vào MQTT topic, ESP32 vẫn tự bảo vệ bằng cách kiểm tra Timestamp:
  ```cpp
  // sketch_jun18a.ino — Hàm callback()
  if (abs((long)(currentUnix - msgTimestamp)) <= 60) {
    // Chỉ thực thi lệnh nếu bản tin còn "tươi"
  } else {
    Serial.println("!!! Replay Attack Detected!");
  }
  ```

**Nhận xét:** Thiết kế này đảm bảo rằng không có "điểm chết duy nhất" (Single Point of Failure) về bảo mật trong toàn bộ hệ thống.

---

## 2. Nguyên tắc AAA (Authentication, Authorization, Accounting)

**Khái niệm từ bài giảng:**
Mọi thực thể (người dùng, thiết bị) tham gia hệ thống IoT đều phải trải qua ba bước kiểm soát: **Authentication** (Bạn là ai?), **Authorization** (Bạn được phép làm gì?), và **Accounting** (Ghi nhận lại bạn đã làm gì?).

### 2.1. Authentication (Xác thực)
Dự án triển khai xác thực ở hai tầng khác nhau cho hai loại thực thể:

**a) Xác thực Thiết bị (Device Authentication) — ESP32 ↔ MQTT Broker:**
```cpp
// sketch_jun18a.ino
const char* mqttUser = "my_secure_user";
const char* mqttPass = "my_secure_password";
// ...
client.connect(clientId.c_str(), mqttUser, mqttPass); // Trình Username/Password khi kết nối
```
Mỗi thiết bị ESP32 phải cung cấp một cặp `username/password` hợp lệ trong gói CONNECT. MQTT Broker sẽ từ chối các kết nối ẩn danh (Anonymous) hoặc sai mật khẩu.

**b) Xác thực Người dùng (User Authentication) — Mobile App ↔ Backend:**
```typescript
// AuthContext.tsx — Đăng nhập bằng Firebase Auth
const login = async (email: string, password: string) => {
  await signInWithEmailAndPassword(auth, email, password);
};
```
```typescript
// apiService.ts — Tự động gắn JWT Token vào mọi request
const token = await currentUser.getIdToken(true); // Lấy JWT, force refresh
headers: { 'Authorization': `Bearer ${token}` }
```
```javascript
// authMiddleware.js — Backend xác minh chữ ký số của Token
const decodedToken = await firebaseService.verifyIdToken(idToken);
req.user = { uid: decodedToken.uid, email: decodedToken.email };
```
Luồng xác thực hoàn chỉnh: Người dùng đăng nhập trên App → Firebase cấp JWT Token → App gửi Token trong header mỗi request → Backend dùng Firebase Admin SDK xác minh chữ ký số của token phía server (không thể giả mạo từ phía client).

### 2.2. Authorization (Phân quyền)
```javascript
// deviceRoutes.js — Whitelist lệnh điều khiển, chỉ chấp nhận "on" hoặc "off"
body('cmd')
  .isIn(['on', 'off'])
  .withMessage('Command chỉ được là "on" hoặc "off" (chống Injection)'),
```
```javascript
// mqttService.js — Validate Topic, chặn ký tự đặc biệt
const validPattern = /^[a-zA-Z0-9_]+$/;
if (!validPattern.test(userId) || !validPattern.test(deviceId)) {
  console.warn('⚠️ Suspicious topic rejected:', topic);
  return; // Từ chối xử lý
}
```
Hệ thống phân quyền theo cấu trúc Topic phân cấp (`user123/esp32_01/command`), kết hợp Input Validation ở mọi API endpoint để ngăn chặn Command Injection và Topic Injection.

### 2.3. Accounting (Lưu vết kiểm toán)
```javascript
// auditLogger.js — Ghi lại hành động nhạy cảm
const logEntry = {
  action: action,
  userId: req.user?.uid || 'anonymous',
  email: req.user?.email || 'unknown',
  ip: req.ip || req.connection?.remoteAddress,
  userAgent: req.headers['user-agent'],
  body: sanitizeBody(req.body), // Lọc bỏ các trường nhạy cảm trước khi ghi
};
await firebaseService.writeOverloadHistory(logEntry);
```
Mọi thao tác quan trọng (gửi lệnh điều khiển, sự kiện quá tải) đều được ghi nhận với đầy đủ thông tin: ai thực hiện (`userId`, `email`), từ đâu (`IP`, `User-Agent`), lúc nào (`timestamp`). Đặc biệt, hàm `sanitizeBody()` tự động loại bỏ các trường nhạy cảm (`password`, `token`, `secret`, `key`) trước khi ghi vào log, tuân thủ nguyên tắc bảo mật dữ liệu nhạy cảm ngay cả trong hệ thống nội bộ.

---

## 3. Bảo mật lớp Vận chuyển (Transport Layer Security)

**Khái niệm từ bài giảng:**
Dữ liệu IoT truyền qua mạng không dây (WiFi) và Internet đặc biệt dễ bị tấn công nghe lén (Eavesdropping / Packet Sniffing). Cần mã hóa toàn bộ đường truyền bằng giao thức TLS/SSL.

**Đánh giá qua mã nguồn:**
Cả hai phía của kênh truyền MQTT đều sử dụng TLS:

```cpp
// ESP32 — Sử dụng socket bảo mật thay vì socket thường
WiFiClientSecure espClient;          // TLS Socket
const int mqttPort = 8883;           // Cổng MQTTS (có mã hóa)
PubSubClient client(espClient);      // MQTT Client chạy trên TLS Socket
```
```javascript
// Backend — Kết nối MQTT qua giao thức mqtts://
MQTT_BROKER_URL=mqtts://broker.emqx.io:8883  // Cấu hình trong .env
```

**Phân tích kịch bản tấn công bị chặn:**
Giả sử tin tặc sử dụng Wireshark tại cùng mạng WiFi với ESP32 để bắt gói tin. Với kết nối TCP thường (port 1883), hacker sẽ thấy rõ ràng payload JSON như `{"cmd":"on","timestamp":1718765432}`. Nhưng với MQTTS (port 8883), toàn bộ payload được mã hóa thành chuỗi byte vô nghĩa, khiến việc đọc trộm dữ liệu trở nên vô hiệu.

---

## 4. Chống tấn công phát lại (Anti-Replay Attack)

**Khái niệm từ bài giảng:**
Replay Attack (Tấn công phát lại) là kỹ thuật mà hacker bắt một gói tin hợp lệ đã được truyền đi và phát lại nó nhiều lần để thực thi lại hành động trái phép, bất kể gói tin đó có bị mã hóa hay không. Biện pháp phòng chống cốt lõi là kiểm tra tính "tươi" (Freshness) của bản tin thông qua Timestamp và/hoặc Nonce.

**Đánh giá qua mã nguồn:**
Dự án triển khai cơ chế chống Replay Attack theo hai lớp:

**Lớp 1 — Timestamp + Nonce tại Backend (nơi tạo lệnh):**
```javascript
// mqttService.js — publishCommand()
const payload = JSON.stringify({
  cmd: command,
  timestamp: Math.floor(Date.now() / 1000), // Unix Epoch (giây)
  nonce: nonce, // UUID v4 — mã duy nhất không lặp lại
});
mqttClient.publish(topic, payload, { qos: 1 });
```
```javascript
// deviceRoutes.js — Tạo Nonce bằng UUID v4
const nonce = uuidv4(); // VD: "3b241101-e2bb-4d7a-8b65-9e10d27a8f0c"
mqttService.publishCommand(userId, deviceId, cmd, nonce);
```

**Lớp 2 — Kiểm tra Timestamp tại ESP32 (nơi nhận lệnh):**
```cpp
// sketch_jun18a.ino — callback()
unsigned long msgTimestamp = doc["timestamp"];
unsigned long currentUnix = getUnixTime(); // Đồng bộ NTP

// Chấp nhận lệnh nếu và chỉ nếu: chênh lệch thời gian <= 60 giây
if (currentUnix > 0 && abs((long)(currentUnix - msgTimestamp)) <= 60) {
  // Thực thi lệnh
} else {
  Serial.println("!!! Replay Attack Detected or Time Expired! Command dropped.");
}
```

**Phân tích kịch bản tấn công bị chặn:**
Hacker bắt được gói tin `{"cmd":"off","timestamp":1718765432,"nonce":"abc-123"}` lúc 10:00:00. Nếu hacker phát lại gói tin này lúc 10:05:00, ESP32 tính `abs(currentUnix - 1718765432)` = 300 giây > 60 giây → Lệnh bị từ chối. Cửa sổ tấn công chỉ còn tối đa 60 giây, và trong thực tế rất khó khai thác do cần vượt qua cả lớp TLS phía trước.

---

## 5. Phòng chống tấn công từ chối dịch vụ (DDoS / Flooding Mitigation)

**Khái niệm từ bài giảng:**
Mạng IoT có đặc thù là số lượng thiết bị kết nối (Node) rất lớn. Đây là mục tiêu hấp dẫn cho các cuộc tấn công DDoS (Distributed Denial of Service) hoặc Flooding, nhằm làm quá tải tài nguyên máy chủ trung tâm. Biện pháp phòng chống bao gồm Rate Limiting, giới hạn payload, và kiểm soát tần suất gửi dữ liệu từ thiết bị.

**Đánh giá qua mã nguồn:**
Dự án đã áp dụng chiến lược phòng chống DDoS trên cả hai phía Client và Server:

**a) Rate Limiting tại Backend:**
```javascript
// rateLimiter.js — Giới hạn toàn cục
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Cửa sổ 15 phút
  max: 100, // Tối đa 100 request/IP/15 phút
});

// Giới hạn riêng cho lệnh điều khiển (nghiêm ngặt hơn)
const commandLimiter = rateLimit({
  windowMs: 60 * 1000,  // Cửa sổ 1 phút
  max: 10, // Tối đa 10 lệnh/phút — chống spam bật/tắt liên tục
});
```
```javascript
// server.js — Giới hạn kích thước body (chống Payload Bomb)
app.use(express.json({ limit: '10kb' }));
```

**b) Kiểm soát tần suất gửi tại Firmware ESP32:**
```cpp
// sketch_jun18a.ino
const unsigned long mqttInterval = 60000; // Telemetry: 60 giây/lần
const unsigned long protectionInterval = 500; // Giám sát quá tải: 500ms/lần (nội bộ, không gửi mạng)
```

**Phân tích kịch bản tấn công bị chặn:**
- **Kịch bản 1 — Tấn công từ bên ngoài qua API:** Nếu hacker gửi 200 request liên tục vào endpoint `/api/devices/.../command`, sau 10 request đầu tiên (trong vòng 1 phút), `commandLimiter` sẽ trả về lỗi `429 Too Many Requests` cho 190 request còn lại.
- **Kịch bản 2 — Thiết bị bị chiếm quyền (Botnet):** Nếu một ESP32 bị hack và gửi dữ liệu liên tục mỗi giây, hành vi này sẽ bất thường so với tần suất thiết kế (60s/lần) và có thể bị nhận diện ngay bởi hệ thống giám sát tại Broker.

---

## 6. Nguyên tắc Đặc quyền tối thiểu (Principle of Least Privilege)

**Khái niệm từ bài giảng:**
Mỗi thành phần trong hệ thống chỉ nên được cấp đúng mức quyền hạn tối thiểu cần thiết để hoàn thành nhiệm vụ, không hơn. Nếu thành phần đó bị xâm nhập, thiệt hại sẽ được giới hạn ở phạm vi nhỏ nhất.

**Đánh giá qua mã nguồn:**

**a) Mobile App — Không truy cập trực tiếp Database:**
```typescript
// apiService.ts — App KHÔNG gọi thẳng Firebase Database
// Thay vào đó, mọi thao tác đều đi qua Backend API
export async function getEnergyData(deviceId: string) {
  return apiRequest(`/devices/${deviceId}/energy`); // Gọi Backend, không gọi Firebase
}
export async function sendCommand(deviceId: string, cmd: 'on' | 'off') {
  return apiRequest(`/devices/${deviceId}/command`, { method: 'POST', body: JSON.stringify({ cmd }) });
}
```
Nếu App bị dịch ngược (reverse engineering), hacker chỉ thấy URL của Backend API, không thể biết cấu trúc cơ sở dữ liệu Firebase hay khóa bí mật của Service Account.

**b) Backend — Dùng Firebase Admin SDK (Server-side) thay vì Client SDK:**
```javascript
// firebaseService.js
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount), // Private Key chỉ nằm trên Server
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});
```
Private Key của Firebase Service Account chỉ tồn tại trên Server, không bao giờ được gửi đến Client (App hoặc ESP32). Đây là sự phân tách rõ ràng giữa quyền đọc/ghi dữ liệu (chỉ Server có) và quyền yêu cầu dữ liệu (App có, thông qua API).

---

## 7. Đảm bảo tính Toàn vẹn dữ liệu (Data Integrity & Input Validation)

**Khái niệm từ bài giảng:**
Dữ liệu đầu vào từ mọi nguồn (người dùng, thiết bị, mạng) đều phải được coi là không đáng tin cậy (Untrusted Input) và phải được kiểm tra, làm sạch (Sanitization) trước khi xử lý. Đây là biện pháp phòng chống các cuộc tấn công tiêm mã (Injection Attack).

**Đánh giá qua mã nguồn:**
Dự án triển khai Input Validation ở nhiều điểm:

**a) Validation tại API endpoint (Backend):**
```javascript
// deviceRoutes.js
param('deviceId')
  .matches(/^[a-zA-Z0-9_]+$/)                        // Chỉ cho phép ký tự an toàn
  .withMessage('Device ID chỉ được chứa chữ, số và underscore'),
body('cmd')
  .isIn(['on', 'off'])                                 // Whitelist lệnh (không phải Blacklist)
  .withMessage('Command chỉ được là "on" hoặc "off"'),
```

**b) Validation tại lớp MQTT (Backend):**
```javascript
// mqttService.js — Kiểm tra dữ liệu năng lượng trước khi lưu
if (typeof payload.energy !== 'number' || payload.energy < 0) {
  console.warn('⚠️ Invalid energy data rejected:', payload);
  return; // Từ chối lưu dữ liệu sai kiểu hoặc giá trị âm
}
// Kiểm tra dữ liệu alarm
if (!payload.alert || typeof payload.power !== 'number') {
  console.warn('⚠️ Invalid alarm data rejected:', payload);
  return;
}
```

**c) Chống Race Condition khi nhận cảnh báo (Backend):**
```javascript
// firebaseService.js — In-memory lock chống trùng lặp
const processingAlarms = new Set();

async function saveAlarmData(userId, deviceId, data) {
  const lockKey = `${userId}_${deviceId}_${data.alert}`;
  if (processingAlarms.has(lockKey)) {
    return { key: null, isDuplicate: true }; // Bỏ qua bản tin trùng lặp
  }
  processingAlarms.add(lockKey); // Đặt khóa
  try { /* ... lưu dữ liệu ... */ }
  finally { processingAlarms.delete(lockKey); } // Giải phóng khóa
}
```

---

## 8. Quản lý phiên đăng nhập an toàn (Secure Session Management)

**Khái niệm từ bài giảng:**
Phiên đăng nhập (Session) cần được quản lý chặt chẽ: Token phải có thời hạn, được làm mới tự động, và hệ thống phải xử lý đúng trạng thái khi token hết hạn hoặc bị thu hồi.

**Đánh giá qua mã nguồn:**

**a) Tự động làm mới Token (Mobile App):**
```typescript
// apiService.ts
return await currentUser.getIdToken(true); // true = force refresh
```
Tham số `true` buộc Firebase SDK kiểm tra và làm mới token nếu token cũ sắp hết hạn, đảm bảo người dùng không bị gián đoạn phiên sử dụng.

**b) Xử lý Token hết hạn / bị thu hồi (Backend):**
```javascript
// authMiddleware.js
if (error.code === 'auth/id-token-expired') {
  return res.status(401).json({ error: 'Token Expired', message: 'Vui lòng đăng nhập lại.' });
}
return res.status(403).json({ error: 'Forbidden', message: 'Token không hợp lệ hoặc đã bị thu hồi.' });
```

**c) Yêu cầu xác thực lại trước khi đổi mật khẩu (Mobile App):**
```typescript
// AuthContext.tsx — Đổi mật khẩu yêu cầu nhập lại mật khẩu cũ
const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
await reauthenticateWithCredential(auth.currentUser, credential); // Xác thực lại
await updatePassword(auth.currentUser, newPassword); // Chỉ đổi nếu xác thực thành công
```
Điều này ngăn chặn kịch bản hacker chiếm được phiên đăng nhập (Session Hijacking) rồi âm thầm đổi mật khẩu để chiếm tài khoản vĩnh viễn.

---

## Tổng kết đánh giá

Bảng dưới đây tổng hợp mức độ áp dụng các kiến thức bảo mật IoT từ bài giảng vào dự án:

| STT | Kiến thức lý thuyết | Mức độ áp dụng | Minh chứng trong code |
| :---: | :--- | :---: | :--- |
| 1 | Phòng thủ chiều sâu (Defense-in-Depth) | ✅ Đầy đủ | Helmet + CORS + Rate Limit (Backend) → TLS (Network) → Timestamp Check (ESP32) |
| 2 | Xác thực (Authentication) | ✅ Đầy đủ | User/Pass MQTT (ESP32) + JWT Firebase (App ↔ Backend) |
| 3 | Phân quyền (Authorization) | ✅ Đầy đủ | Topic ACL + Input Validation + Whitelist Command |
| 4 | Lưu vết kiểm toán (Accounting) | ✅ Đầy đủ | `auditLogger.js` với sanitizeBody() + lịch sử quá tải |
| 5 | Mã hóa đường truyền (TLS) | ⚠️ Cơ bản | MQTTS port 8883 hoạt động, nhưng chưa xác thực chứng chỉ CA (setInsecure) |
| 6 | Chống Replay Attack | ⚠️ Cơ bản | Timestamp ≤ 60s hoạt động tốt; Nonce đã tạo nhưng ESP32 chưa lưu đối chiếu |
| 7 | Chống DDoS / Flooding | ✅ Đầy đủ | Rate Limit 2 tầng (100 req/15' + 10 cmd/1') + Telemetry 60s/lần |
| 8 | Đặc quyền tối thiểu (Least Privilege) | ✅ Đầy đủ | App chỉ gọi API, không truy cập DB; Private Key chỉ trên Server |
| 9 | Toàn vẹn dữ liệu (Input Validation) | ✅ Đầy đủ | `express-validator` + Regex Topic + Race Condition Lock |
| 10 | Quản lý phiên (Session Management) | ✅ Đầy đủ | Auto-refresh Token + Xử lý Expired/Revoked + Re-auth khi đổi mật khẩu |

> **Kết luận:** Hệ thống đã áp dụng thành công **8/10 tiêu chí** ở mức đầy đủ và **2/10 tiêu chí** ở mức cơ bản (cần hoàn thiện thêm ở giai đoạn triển khai thực tế). Toàn bộ các khái niệm lý thuyết được giảng dạy đều có minh chứng cụ thể trong mã nguồn, cho thấy sự hiểu biết sâu sắc và khả năng chuyển hóa kiến thức học thuật thành giải pháp kỹ thuật thực tiễn.
