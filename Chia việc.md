# Phân chia Công việc Dự án — 4 Thành viên (Dương, Tú, Vũ, Thành)

> **Nguyên tắc:** Mỗi người đều lập trình trực tiếp, tự kiểm thử phần mình, và viết báo cáo cho phần mình phụ trách. Không ai chỉ viết tài liệu hay slide.

---

## Tổng quan phân chia

| Thành viên | Vai trò chính | Phân hệ phụ trách |
| :---: | :--- | :--- |
| **Tú** | Lập trình viên Nhúng (Embedded Developer) | ESP32 Firmware + Phần cứng |
| **Dương** | Lập trình viên Backend — Dịch vụ (Backend Services Developer) | Backend: Server Core + MQTT Bridge + Firebase |
| **Vũ** | Lập trình viên Backend — API & Bảo mật (Backend Security Developer) | Backend: API Routes + Security Middleware |
| **Thành** | Lập trình viên Mobile (Mobile Developer) | Mobile App (React Native / Expo) |

---

## Chi tiết công việc từng người

### 👤 Thành viên Tú — Lập trình nhúng ESP32 + Phần cứng

| Hạng mục | Chi tiết |
| :--- | :--- |
| **Lập trình** | `sketch_jun18a.ino` — Toàn bộ firmware, bao gồm: |
| | • Kết nối WiFi và MQTT Broker qua TLS (WiFiClientSecure, port 8883) |
| | • Đọc dữ liệu cảm biến PZEM-004T qua UART (GPIO 26, 27) |
| | • Điều khiển Relay đóng/cắt tải (GPIO 25) |
| | • Bảo vệ quá tải (Overload Protection — ngưỡng 1000W) |
| | • Chống tấn công phát lại: Đồng bộ NTP + Kiểm tra Timestamp ≤ 60s |
| | • Application-level ACK: Gửi lại cảnh báo mỗi 2s cho đến khi nhận ACK |
| | • Tự động Reset Energy đầu tháng |
| **Phần cứng** | Thiết kế sơ đồ mạch, đi dây thực tế ESP32 + PZEM-004T + Relay + Nguồn 5V |
| **Kiểm thử** | • Đo thông số V, A, W, kWh bằng tải thực tế |
| | • Kiểm tra ngắt Relay khi quá tải |
| | • Kiểm tra gửi/nhận bản tin MQTT qua MQTTX hoặc Serial Monitor |
| | • Gửi lệnh có timestamp cũ (> 60s) để xác nhận Anti-Replay hoạt động |
| **Báo cáo** | Viết chương **Thiết kế phần cứng** (sơ đồ đi dây, bảng kết nối, nguyên lý hoạt động) |

---

### 👤 Thành viên Dương — Backend: Server Core + Dịch vụ MQTT + Firebase

| Hạng mục | Chi tiết |
| :--- | :--- |
| **Lập trình** | **`server.js`** — Khởi tạo Express Server, tích hợp middleware bảo mật: |
| | • Cấu hình Helmet (Security Headers) |
| | • Cấu hình CORS (Cross-Origin) |
| | • Tích hợp Rate Limiter toàn cục |
| | • Giới hạn JSON body 10kb |
| | • Khai báo Routes, Error Handler, Health Check |
| | **`mqttService.js`** — Cầu nối MQTT giữa ESP32 và Backend: |
| | • Kết nối EMQX Broker qua MQTTS (TLS) |
| | • Subscribe topic `energy` và `alarm` (QoS 1) |
| | • Xử lý message: Topic Validation (Regex), Input Validation dữ liệu |
| | • `publishCommand()`: Tạo payload kèm Timestamp + Nonce, publish QoS 1 |
| | • `publishAlarmAck()`: Gửi ACK khi nhận cảnh báo |
| | • Gửi Push Notification qua Expo Push API khi có sự cố quá tải |
| | **`firebaseService.js`** — Tầng truy cập dữ liệu Firebase: |
| | • Khởi tạo Firebase Admin SDK (Service Account) |
| | • CRUD: `saveEnergyData`, `getEnergyData`, `saveAlarmData`, `getAlarms` |
| | • In-memory Lock chống Race Condition (`processingAlarms Set`) |
| | • `updateDeviceStatus`, `getDeviceStatus` |
| | • `savePushToken`, `getPushToken`, `verifyIdToken` |
| | • `writeOverloadHistory`, `getOverloadHistory` |
| | **`.env`** — Cấu hình biến môi trường (PORT, Firebase, MQTT, CORS) |
| **Kiểm thử** | • Kiểm tra luồng end-to-end: ESP32 gửi energy → MQTT → Backend nhận → Firebase lưu |
| | • Kiểm tra luồng alarm: ESP32 gửi alarm → Backend lưu + gửi Push + auto ACK |
| | • Kiểm tra chống duplicate alarm (gửi liên tục cùng 1 cảnh báo) |
| | • Kiểm tra Health Check API (`/api/health`) |
| **Báo cáo** | Viết chương **Thiết kế luồng dữ liệu (Data Flow)** |

---

### 👤 Thành viên Vũ — Backend: API Routes + Security Middleware

| Hạng mục | Chi tiết |
| :--- | :--- |
| **Lập trình** | **`deviceRoutes.js`** — API điều khiển và truy vấn thiết bị: |
| | • `GET /:deviceId/energy` — Lấy dữ liệu điện năng (Auth + Validation) |
| | • `GET /:deviceId/status` — Lấy trạng thái thiết bị |
| | • `POST /:deviceId/command` — Gửi lệnh bật/tắt (Auth + Validation + Rate Limit + Nonce + Audit) |
| | • `GET /:deviceId/alarms` — Lấy lịch sử cảnh báo |
| | • `POST /:deviceId/alarm-ack` — Xác nhận cảnh báo |
| | • `GET /overload-history` — Lấy lịch sử quá tải |
| | **`authRoutes.js`** — API xác thực: |
| | • `GET /me` — Trả về thông tin user từ JWT Token |
| | • `POST /push-token` — Lưu Push Token của thiết bị di động |
| | **`authMiddleware.js`** — Middleware xác thực JWT: |
| | • Trích xuất Bearer Token từ header Authorization |
| | • Verify Token bằng Firebase Admin SDK (server-side) |
| | • Xử lý Token hết hạn (`auth/id-token-expired`) vs Token bị giả mạo (`403 Forbidden`) |
| | **`rateLimiter.js`** — Middleware chống DDoS: |
| | • `globalLimiter`: 100 request / 15 phút / IP |
| | • `commandLimiter`: 10 lệnh / 1 phút (chống spam bật/tắt) |
| | **`auditLogger.js`** — Middleware ghi log kiểm toán: |
| | • Ghi lại: userId, email, IP, User-Agent, action, body |
| | • `sanitizeBody()`: Lọc bỏ các trường nhạy cảm (password, token, key) trước khi log |
| | **`test-alarm.js`** — Script kiểm thử cảnh báo |
| **Kiểm thử** | • Dùng Postman kiểm tra từng API endpoint |
| | • Gửi request không có Token → xác nhận trả 401 |
| | • Gửi Token hết hạn / giả mạo → xác nhận trả 401/403 |
| | • Gửi command `"rm -rf"` thay vì `"on"/"off"` → xác nhận bị reject (Input Validation) |
| | • Spam 20 lệnh liên tục → xác nhận Rate Limiter trả 429 sau lệnh thứ 10 |
| | • Kiểm tra Audit Log ghi đúng thông tin vào Firebase |
| **Báo cáo** | Viết chương **Kiến trúc bảo mật** + **Đánh giá bảo mật** |

---

### 👤 Thành viên Thành — Mobile App (React Native / Expo)

| Hạng mục | Chi tiết |
| :--- | :--- |
| **Lập trình** | **Quản lý trạng thái xác thực — `AuthContext.tsx`:** |
| | • Context Provider quản lý phiên đăng nhập toàn cục |
| | • `login`, `register`, `logout`, `resetPassword` |
| | • `changeUserPassword` — Yêu cầu xác thực lại (Re-authenticate) trước khi đổi |
| | • `onAuthStateChanged` — Lắng nghe trạng thái đăng nhập tự động |
| | **Tầng giao tiếp API — `apiService.ts`:** |
| | • `getAuthToken()` — Lấy JWT Token, auto-refresh nếu sắp hết hạn |
| | • `apiRequest()` — Hàm wrapper tự động gắn `Authorization: Bearer` header |
| | • Các hàm API: `getEnergyData`, `sendCommand`, `getAlarms`, `acknowledgeAlarm`, `healthCheck`, `getOverloadHistory`, `savePushToken`, `getDeviceStatus` |
| | **Push Notification — `notificationService.ts`:** |
| | • Xin quyền thông báo (Android/iOS) |
| | • Lấy Expo Push Token |
| | • Cấu hình hiển thị thông báo khi App ở Foreground |
| | **6 Màn hình giao diện:** |
| | • `LoginScreen.tsx` — Đăng nhập (Email/Password) |
| | • `RegisterScreen.tsx` — Đăng ký tài khoản mới |
| | • `ForgotPasswordScreen.tsx` — Quên mật khẩu (gửi email reset) |
| | • `HomeScreen.tsx` — Dashboard chính: hiển thị điện năng, điều khiển bật/tắt, trạng thái thiết bị |
| | • `AlertsScreen.tsx` — Danh sách cảnh báo quá tải |
| | • `ProfileScreen.tsx` — Hồ sơ cá nhân, đổi mật khẩu, đăng xuất |
| | **Hạ tầng App:** |
| | • `App.tsx`, `index.ts`, `app.json` — Entry point |
| | • Navigation (điều hướng giữa các màn hình) |
| | • Theme / Styling (giao diện thống nhất) |
| | • Components (các thành phần tái sử dụng) |
| | • `firebaseConfig.ts` — Cấu hình Firebase Client SDK |
| **Kiểm thử** | • Luồng Đăng ký → Đăng nhập → Xem Dashboard → Bật/Tắt thiết bị → Đăng xuất |
| | • Nhập sai mật khẩu → xác nhận thông báo lỗi |
| | • Quên mật khẩu → kiểm tra email reset |
| | • Đổi mật khẩu → nhập sai mật khẩu cũ → xác nhận bị reject |
| | • Nhận Push Notification khi có cảnh báo quá tải |
| | • Kiểm tra giao diện trên cả Android và iOS |
| **Báo cáo** | Viết chương **Thiết kế ứng dụng di động** |

---

## Bảng tổng hợp phân chia

| | **Tú** (Embedded) | **Dương** (Backend Services) | **Vũ** (Backend Security) | **Thành** (Mobile App) |
| :--- | :--- | :--- | :--- | :--- |
| **File chính** | `sketch_jun18a.ino` | `server.js`, `mqttService.js`, `firebaseService.js` | `deviceRoutes.js`, `authRoutes.js`, `authMiddleware.js`, `rateLimiter.js`, `auditLogger.js` | `AuthContext.tsx`, `apiService.ts`, `notificationService.ts`, 6 Screens, Navigation, Theme |
| **Ngôn ngữ** | C++ (Arduino) | JavaScript (Node.js) | JavaScript (Node.js) | TypeScript (React Native) |
| **Số file** | 1 file code + phần cứng | 4 files | 6 files | ~15+ files |
| **Độ phức tạp** | Phần cứng + Firmware nhúng (thời gian thực, debug khó) | Logic nghiệp vụ + Tích hợp 3 dịch vụ (MQTT, Firebase, Push) | Thiết kế bảo mật nhiều lớp + Validation phức tạp | Khối lượng code lớn nhất + UI/UX đa nền tảng |
| **Kiểm thử** | Phần cứng thực tế + Serial Monitor | Luồng dữ liệu end-to-end | Bảo mật API (Postman) | UI/UX + Luồng người dùng |
| **Viết báo cáo** | Thiết kế phần cứng | Thiết kế luồng dữ liệu | Kiến trúc + Đánh giá bảo mật | Thiết kế ứng dụng di động |
| **Slide** | Phần cứng + Demo thiết bị | Backend Architecture | Security Demo | Mobile App Demo |

---

## Công việc chung (cả 4 người cùng tham gia)

| Công việc chung | Mô tả |
| :--- | :--- |
| **Tích hợp hệ thống** | Cả 4 phối hợp ghép nối: ESP32 ↔ MQTT ↔ Backend ↔ Firebase ↔ Mobile App |
| **Kiểm thử tổng thể (E2E)** | Chạy thử toàn bộ luồng: Cắm tải → ESP32 đo → Backend nhận → App hiển thị → Bật/Tắt từ App → ESP32 phản hồi |
| **Chương Kết luận** | Cùng viết chương Kết luận & Hướng phát triển |
| **Thuyết trình** | Mỗi người trình bày phần mình phụ trách |
