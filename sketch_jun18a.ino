#include <WiFi.h>
#include <WiFiClientSecure.h> // Sử dụng bảo mật TLS/SSL
#include <PubSubClient.h>
#include <PZEM004Tv30.h>
#include <time.h>
#include <ArduinoJson.h>      // Thư viện xử lý JSON chống Replay Attack

// --- HARDWARE CONFIGURATION ---
#define RELAY_PIN 25
PZEM004Tv30 pzem(&Serial1, 26, 27);

// --- WIFI CONFIGURATION ---
const char* ssid = "26 Kim Ma";
const char* password = "12341234";

// --- MQTT SECURE CONFIGURATION ---
const char* mqttServer = "broker.emqx.io"; 
const int mqttPort = 8883; // Port MQTTS (Có mã hóa)

// Xác thực định danh (Authentication)
const char* mqttUser = "my_secure_user";
const char* mqttPass = "my_secure_password";

// Topic phân quyền rõ ràng (Authorization)
const char* commandTopic = "user123/esp32_01/command"; 
const char* energyTopic  = "user123/esp32_01/energy";  
const char* alarmTopic   = "user123/esp32_01/alarm";   
const char* alarmAckTopic = "user123/esp32_01/alarm_ack"; // Topic để nhận xác nhận (ACK)

WiFiClientSecure espClient; 
PubSubClient client(espClient);

// --- TIME CONFIGURATION (NTP - GMT+7) ---
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 25200;     
const int   daylightOffset_sec = 0;    

// --- TIMERS & LIMITS ---
unsigned long previousProtectionMillis = 0;
const unsigned long protectionInterval = 500; 

unsigned long previousMqttMillis = 0;
const unsigned long mqttInterval = 60000;       

unsigned long previousDateCheckMillis = 0;
const unsigned long dateCheckInterval = 60000; 

const float POWER_LIMIT = 1000.0; 

// Global variables
float currentPower = 0.0;
float currentEnergy = 0.0;
bool isSensorError = false;
int lastResetMonth = -1; 

// Variables for Application-level ACK (Đảm bảo QoS)
bool isAlarmActive = false;
unsigned long lastAlarmSentMillis = 0;
String currentAlarmPayload = "";

// Lấy thời gian dạng Unix Timestamp (để so sánh)
unsigned long getUnixTime() {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return 0;
  time(&now);
  return now;
}

String getCurrentTimeStr() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "Time Sync Error";
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(timeStringBuff);
}

void setupWifi() {
  delay(10);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
  
  // Bỏ qua kiểm tra chứng chỉ (Chỉ dùng cho testing. Thực tế cần cung cấp Root CA của EMQX)
  espClient.setInsecure(); 
}

// --- MQTT MESSAGE CALLBACK ---
void callback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (int i = 0; i < length; i++) {
    msg += (char)payload[i];
  }
  
  if (String(topic) == commandTopic) {
    // 3. CHỐNG TẤN CÔNG PHÁT LẠI (Anti-Replay Attack)
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, msg);
    
    if (!error) {
      String cmd = doc["cmd"];
      unsigned long msgTimestamp = doc["timestamp"];
      unsigned long currentUnix = getUnixTime();
      
      // Chỉ chấp nhận lệnh nếu timestamp không chênh lệch quá 60 giây
      if (currentUnix > 0 && abs((long)(currentUnix - msgTimestamp)) <= 60) {
        if (cmd == "on") {
          digitalWrite(RELAY_PIN, HIGH);
        } else if (cmd == "off") {
          digitalWrite(RELAY_PIN, LOW);
        }
      }
    }
  } 
  else if (String(topic) == alarmAckTopic) {
    // Nhận được phản hồi ACK từ ứng dụng -> Ngừng gửi cảnh báo lại
    isAlarmActive = false;
  }
}

void reconnect() {
  while (!client.connected()) {
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    
    // 2. XÁC THỰC BẰNG USERNAME VÀ PASSWORD
    if (client.connect(clientId.c_str(), mqttUser, mqttPass)) {
      client.subscribe(commandTopic);
      client.subscribe(alarmAckTopic); // Lắng nghe phản hồi ACK
    } else {
      delay(5000);
    }
  }
}

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); 
  
  setupWifi();
  
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  
  client.setServer(mqttServer, mqttPort);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop(); 

  unsigned long currentMillis = millis();

  // --- TASK 1: OVERLOAD PROTECTION & ALARM ---
  if (currentMillis - previousProtectionMillis >= protectionInterval) {
    previousProtectionMillis = currentMillis;
    
    currentPower = pzem.power();
    currentEnergy = pzem.energy();
    
    if (!isnan(currentPower) && !isnan(currentEnergy)) {
      if (currentPower > POWER_LIMIT && digitalRead(RELAY_PIN) == HIGH) { 
        digitalWrite(RELAY_PIN, LOW); 
        
        String timeStampStr = getCurrentTimeStr();
        currentAlarmPayload = "{\"alert\":\"OVERLOAD\", \"power\":" + String(currentPower) + ", \"time\":\"" + timeStampStr + "\"}";
        
        // Gửi ngay lập tức
        client.publish(alarmTopic, currentAlarmPayload.c_str());
        
        // Kích hoạt cờ Application-level ACK
        isAlarmActive = true;
        lastAlarmSentMillis = currentMillis;
      }
    }
  }

  // --- TASK 1.5: ĐẢM BẢO TÍNH SẴN SÀNG (QoS Tầng Ứng dụng) ---
  // Nếu đang có báo động mà chưa nhận được ACK, cứ mỗi 2 giây gửi lại 1 lần
  if (isAlarmActive && (currentMillis - lastAlarmSentMillis >= 2000)) {
    client.publish(alarmTopic, currentAlarmPayload.c_str());
    lastAlarmSentMillis = currentMillis;
  }

  // --- TASK 2: PUBLISH DATA ---
  if (currentMillis - previousMqttMillis >= mqttInterval) {
    previousMqttMillis = currentMillis;
    if (!isnan(currentEnergy)) {
      String timeStampStr = getCurrentTimeStr();
      String payload = "{\"energy\":" + String(currentEnergy, 3) + ", \"time\":\"" + timeStampStr + "\"}";
      client.publish(energyTopic, payload.c_str());
    }
  }

  // --- TASK 3: RESET ENERGY ON THE 1ST DAY OF THE MONTH (Check every 60s) ---
  if (currentMillis - previousDateCheckMillis >= dateCheckInterval) {
    previousDateCheckMillis = currentMillis;
    
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
      if (lastResetMonth == -1) {
        lastResetMonth = timeinfo.tm_mon;
      }
      
      if (timeinfo.tm_mday == 1 && timeinfo.tm_mon != lastResetMonth) {
        pzem.resetEnergy();
        lastResetMonth = timeinfo.tm_mon; 
      } 
      else if (timeinfo.tm_mday > 1 && timeinfo.tm_mon != lastResetMonth) {
        lastResetMonth = timeinfo.tm_mon;
      }
    }
  }
}
