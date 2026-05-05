/*
 * MediAlert — Production-Quality Firmware
 * ESP32 + Supabase + DS3231 RTC + SSD1306 OLED
 *
 * Architecture:
 *   - State machine: IDLE → ALERT_ACTIVE → CONFIRMED_FLASH → MISSED
 *   - Primary sync: Supabase Realtime (WebSocket)
 *   - Fallback sync: 2–3 second polling when WebSocket unavailable
 *   - RTC-based timing (no millis() drift for critical paths)
 *   - Full debouncing for reed switch + button
 *   - Multi-reminder queue, sorted by time
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>   // Links2004/arduinoWebSockets
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <RTClib.h>
#include <time.h>
#include "secrets.h"  // gitignored — copy secrets.h.template → secrets.h and fill in values

// ─── WiFi ───────────────────────────────────────────────────────────────────
const char* WIFI_SSID     = WIFI_SSID_SECRET;
const char* WIFI_PASSWORD = WIFI_PASSWORD_SECRET;

// ─── Supabase ───────────────────────────────────────────────────────────────
const char* SUPABASE_HOST   = SUPABASE_HOST_SECRET;
const char* SUPABASE_URL    = SUPABASE_URL_SECRET;
const char* SUPABASE_KEY    = SUPABASE_KEY_SECRET;
const char* WS_PATH         = WS_PATH_SECRET;

// ─── Pins ───────────────────────────────────────────────────────────────────
#define PIN_BUZZER      25
#define PIN_BUTTON      26
#define PIN_LED_GREEN   27
#define PIN_LED_RED     14
#define PIN_REED        32

// ─── OLED ───────────────────────────────────────────────────────────────────
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT  64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ─── RTC ────────────────────────────────────────────────────────────────────
RTC_DS3231 rtc;

// ─── Timing constants ───────────────────────────────────────────────────────
const unsigned long POLL_INTERVAL_MS    = 3000UL;
const unsigned long TIMEOUT_MS          = 600000UL;   // 10 minutes
const uint32_t TIMEOUT_SEC              = 600;        // 10 minutes in seconds
const unsigned long CONFIRM_FLASH_MS    = 2500UL;     // 2.5 seconds
const unsigned long DEBOUNCE_MS         = 80UL;
const unsigned long WIFI_RETRY_MS       = 10000UL;

// ─── State machine ──────────────────────────────────────────────────────────
enum SystemState {
  STATE_IDLE,
  STATE_ALERT_ACTIVE,
  STATE_CONFIRMED_FLASH,
  STATE_MISSED
};
SystemState systemState = STATE_IDLE;

// ─── Reminder struct ────────────────────────────────────────────────────────
struct Reminder {
  int    id       = -1;
  String medicine = "";
  int    hour     = -1;
  int    minute   = -1;
  bool   triggered = false;
};

// Up to 16 reminders queued
#define MAX_REMINDERS 16
Reminder reminders[MAX_REMINDERS];
int reminderCount = 0;

// Currently active/alerting reminder
Reminder activeReminder;

// ─── Flags / timestamps ─────────────────────────────────────────────────────
unsigned long lastPollMs          = 0;
unsigned long alertStartMs        = 0;
uint32_t alertStartUnix           = 0;                
unsigned long confirmedFlashStart = 0;
unsigned long lastWifiRetryMs     = 0;
int initialReedState              = -1;

bool wsConnected = false;

// ─── WebSocket client ───────────────────────────────────────────────────────
WebSocketsClient ws;

// ─── Function prototypes ────────────────────────────────────────────────────

// wifi_manager
void connectWiFi();
void checkWiFi();

// realtime_sync / polling
void setupWebSocket();
void wsEventHandler(WStype_t type, uint8_t* payload, size_t length);
void pollReminders();
void parseRemindersJson(const String& json);

// rtc_handler
String formatHHMM(int h, int m);
String getDateString(DateTime now);
String getCurrentTimeStr();

// alert_controller
void checkForAlerts(DateTime now);
void enterAlertState();
void confirmDose(const String& triggerSource);
void enterMissedState();
void updateAlertLoop();
void updateConfirmedFlash();
void updateMissedDisplay();

// input_handler
bool readReed();
bool readButton();

// display_controller
void showIdle(DateTime now);
void showAlert(const String& medicine);
void showConfirmed(const String& medicine);
void showMissed(const String& medicine);
void showConnecting();

// supabase_client
String httpGet(const String& path);
String httpPatch(const String& path, const String& body);
String httpPost(const String& path, const String& body);
void patchReminder(bool taken, const String& takenTime);
void postHistory(const String& status, const String& takenTime, const String& triggerSource);


// ═══════════════════════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println(F("[MediAlert] Booting..."));

  // Pin modes
  pinMode(PIN_BUZZER,    OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED,   OUTPUT);
  pinMode(PIN_BUTTON,    INPUT_PULLUP);
  pinMode(PIN_REED,      INPUT_PULLUP);

  noTone(PIN_BUZZER);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED,   LOW);

  // OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("[OLED] Init failed"));
  }
  display.clearDisplay();
  display.setTextColor(WHITE);
  showConnecting();

  // RTC
  if (!rtc.begin()) {
    Serial.println(F("[RTC] Init failed"));
  }
  if (rtc.lostPower()) {
    Serial.println(F("[RTC] Lost power — set time to compile time"));
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }

  // WiFi
  connectWiFi();

  // NTP Time Sync (Fixes phone vs firmware desync)
  if (WiFi.status() == WL_CONNECTED) {
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    setenv("TZ", "IST-5:30", 1); // User timezone: IST (+5:30)
    tzset();

    Serial.print(F("[NTP] Syncing internet time"));
    struct tm timeinfo;
    int retries = 0;
    while (!getLocalTime(&timeinfo) && retries < 10) {
      Serial.print(".");
      delay(500);
      retries++;
    }
    
    if (retries < 10) {
      Serial.println(F(" OK!"));
      rtc.adjust(DateTime(timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday, timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec));
    } else {
      Serial.println(F(" FAILED. Using RTC fallback."));
    }
  }

  // Real-time WebSocket
  if (WiFi.status() == WL_CONNECTED) {
    setupWebSocket();
  }

  // Initial reminder fetch
  pollReminders();

  Serial.println(F("[MediAlert] Ready."));
}


// ═══════════════════════════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════════════════════════
void loop() {
  static DateTime now;
  static unsigned long lastRtcSync = 0;
  
  if (millis() - lastRtcSync >= 1000 || lastRtcSync == 0) {
    now = rtc.now();
    lastRtcSync = millis();
  }

  checkWiFi();

  // CRITICAL FIX: Only run WebSocket and Polling if the system is IDLE.
  // This prevents the ESP32 from freezing during an active alarm.
  if (systemState == STATE_IDLE) {
    if (wsConnected) {
      ws.loop();
    }
    if (millis() - lastPollMs >= POLL_INTERVAL_MS) {
      lastPollMs = millis();
      pollReminders();
    }
  }

  // ── State machine ────────────────────────────────────────────────────────
  static unsigned long lastDisplayMs = 0;
  bool shouldUpdateDisplay = (millis() - lastDisplayMs >= 1000); // 1Hz refresh rate

  switch (systemState) {
    case STATE_IDLE:
      checkForAlerts(now);
      if (systemState == STATE_IDLE && shouldUpdateDisplay) {
        showIdle(now);
        lastDisplayMs = millis();
      }
      break;

    case STATE_ALERT_ACTIVE:
      updateAlertLoop();
      break;

    case STATE_CONFIRMED_FLASH:
      if (shouldUpdateDisplay) {
        showConfirmed(activeReminder.medicine);
        lastDisplayMs = millis();
      }
      updateConfirmedFlash();
      break;

    case STATE_MISSED:
      if (shouldUpdateDisplay) {
        updateMissedDisplay();
        lastDisplayMs = millis();
      }
      break;
  }

  delay(10); // Reduced from 50 for hyper-fast button response
}
// ═══════════════════════════════════════════════════════════════════════════
//  WIFI MANAGER
// ═══════════════════════════════════════════════════════════════════════════
void connectWiFi() {
  Serial.print(F("[WiFi] Connecting"));
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print('.');
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F(" connected."));
    digitalWrite(PIN_LED_GREEN, HIGH);
  } else {
    Serial.println(F(" failed."));
    digitalWrite(PIN_LED_GREEN, LOW);
  }
}

void checkWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wsConnected) {
      // Try to reconnect WebSocket
      setupWebSocket();
    }
    return;
  }
  // Disconnected
  digitalWrite(PIN_LED_GREEN, LOW);
  wsConnected = false;

  if (millis() - lastWifiRetryMs >= WIFI_RETRY_MS) {
    lastWifiRetryMs = millis();
    Serial.println(F("[WiFi] Retrying..."));
    WiFi.reconnect();
  }
}


// ═══════════════════════════════════════════════════════════════════════════
//  REALTIME SYNC (WebSocket)
// ═══════════════════════════════════════════════════════════════════════════
void setupWebSocket() {
  ws.beginSSL(SUPABASE_HOST, 443, WS_PATH);
  ws.onEvent(wsEventHandler);
  ws.setReconnectInterval(5000);
  wsConnected = false;
  Serial.println(F("[WS] Connecting to Supabase Realtime..."));
}

void wsEventHandler(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      wsConnected = false;
      Serial.println(F("[WS] Disconnected"));
      break;

    case WStype_CONNECTED: {
      wsConnected = true;
      Serial.println(F("[WS] Connected"));
      // Subscribe to reminders table changes
      const char* sub = R"({"topic":"realtime:public:reminders","event":"phx_join","payload":{},"ref":"1"})";
      ws.sendTXT(sub);
      break;
    }

    case WStype_TEXT: {
      // Any change to reminders table — re-fetch
      String msg = String((char*)payload);
      if (msg.indexOf("\"event\":\"INSERT\"") >= 0 ||
          msg.indexOf("\"event\":\"UPDATE\"") >= 0 ||
          msg.indexOf("\"event\":\"DELETE\"") >= 0) {
        Serial.println(F("[WS] Reminder change detected — fetching..."));
        pollReminders();
      }
      break;
    }

    default:
      break;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
//  POLLING / DATA SYNC
// ═══════════════════════════════════════════════════════════════════════════
void pollReminders() {
  if (WiFi.status() != WL_CONNECTED) return;

  String path = "/rest/v1/reminders?active=eq.true&status=eq.pending&order=time.asc&limit=16";
  String response = httpGet(path);

  if (response.length() == 0) return;

  parseRemindersJson(response);
}

void parseRemindersJson(const String& json) {
  DynamicJsonDocument doc(4096);
  if (deserializeJson(doc, json) != DeserializationError::Ok) {
    Serial.println(F("[JSON] Parse error"));
    return;
  }
  if (!doc.is<JsonArray>()) return;

  JsonArray arr = doc.as<JsonArray>();
  reminderCount = 0;

  for (JsonObject obj : arr) {
    if (reminderCount >= MAX_REMINDERS) break;

    Reminder& r = reminders[reminderCount];
    r.id       = obj["id"].as<int>();
    r.medicine = obj["medicine"].as<String>();
    r.triggered = false;

    String t = obj["time"].as<String>();
    if (t.length() >= 5) {
      r.hour   = t.substring(0, 2).toInt();
      r.minute = t.substring(3, 5).toInt();
    }

    // Preserve triggered flag if same ID already was processing
    if (activeReminder.id == r.id && activeReminder.triggered) {
      r.triggered = true;
    }

    reminderCount++;
    Serial.printf("[Reminder] id=%d  %s  @%02d:%02d\n", r.id, r.medicine.c_str(), r.hour, r.minute);
  }
}


// ═══════════════════════════════════════════════════════════════════════════
//  RTC HANDLER
// ═══════════════════════════════════════════════════════════════════════════
String formatHHMM(int h, int m) {
  char buf[6];
  snprintf(buf, sizeof(buf), "%02d:%02d", h, m);
  return String(buf);
}

String getDateString(DateTime now) {
  char buf[11];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02d", now.year(), now.month(), now.day());
  return String(buf);
}

String getCurrentTimeStr() {
  DateTime now = rtc.now();
  return formatHHMM(now.hour(), now.minute());
}


// ═══════════════════════════════════════════════════════════════════════════
//  ALERT CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════
void checkForAlerts(DateTime now) {
  for (int i = 0; i < reminderCount; i++) {
    Reminder& r = reminders[i];
    if (r.id == -1 || r.triggered) continue;

    if (now.hour() == r.hour && now.minute() == r.minute) {
      activeReminder = r;
      activeReminder.triggered = true;
      reminders[i].triggered = true;
      enterAlertState();
      return;
    }
  }
}

void enterAlertState() {
  systemState = STATE_ALERT_ACTIVE;
  alertStartUnix = rtc.now().unixtime(); 
  alertStartMs = millis(); 

  // Capture the physical resting state BEFORE the buzzer turns on
  // This prevents vibration from causing false edge-detection
  initialReedState = digitalRead(PIN_REED);
  
  // Turn on buzzer and LED continuously
  tone(PIN_BUZZER, 1000); 
  digitalWrite(PIN_LED_RED, HIGH);

  // Draw the OLED exactly ONCE
  showAlert(activeReminder.medicine);
  Serial.printf("[ALERT] %s\n", activeReminder.medicine.c_str());
}

void updateAlertLoop() {
  static unsigned long lastDebounceTime = 0;
  static int lastButtonState = HIGH;
  static int lastReedState = -1;
  
  // 1. HARDWARE GRACE PERIOD: Ignore inputs for the first 1000ms.
  if (millis() - alertStartMs < 1000) {
    lastDebounceTime = millis();
    lastButtonState = digitalRead(PIN_BUTTON);
    lastReedState = digitalRead(PIN_REED);
    return;
  }

  int currentButton = digitalRead(PIN_BUTTON);
  int currentReed = digitalRead(PIN_REED);

  // 2. STABLE DEBOUNCED DETECTION (100ms)
  if (currentButton != lastButtonState || currentReed != lastReedState) {
    if (millis() - lastDebounceTime > 100) {
      bool buttonPressed = (currentButton == LOW && lastButtonState == HIGH);
      bool reedChanged = (currentReed != initialReedState); // Any shift from original resting state

      lastButtonState = currentButton;
      lastReedState = currentReed;

      if (buttonPressed) {
        confirmDose("button");
        return;
      }
      if (reedChanged) {
        confirmDose("box_opened");
        return;
      }
    }
  } else {
    lastDebounceTime = millis();
  }

  // 3. Exact 10-Minute Timeout
  if (millis() - alertStartMs >= TIMEOUT_MS) {
    enterMissedState();
  }
}

void confirmDose(const String& triggerSource) {
  noTone(PIN_BUZZER);
  digitalWrite(PIN_LED_RED, LOW);

  // Show visual feedback IMMEDIATELY before the internet blocks the processor
  showConfirmed(activeReminder.medicine);

  String takenTime = getCurrentTimeStr();

  // Now that the buzzer is off and screen is updated, safely talk to the database
  patchReminder(true, takenTime);
  postHistory("taken", takenTime, triggerSource);

  systemState = STATE_CONFIRMED_FLASH;
  confirmedFlashStart = millis();

  Serial.printf("[CONFIRMED] %s via %s\n", activeReminder.medicine.c_str(), triggerSource.c_str());
}

void updateConfirmedFlash() {
  if (millis() - confirmedFlashStart >= CONFIRM_FLASH_MS) {
    // Clear active reminder BEFORE polling so parseRemindersJson
    // doesn't re-apply the triggered flag to the freshly reset reminder.
    activeReminder = Reminder();
    systemState = STATE_IDLE;
    pollReminders();
    Serial.println(F("[STATE] → IDLE"));
  }
}

void enterMissedState() {
  noTone(PIN_BUZZER);
  digitalWrite(PIN_LED_RED, LOW);

  String missedTime = getCurrentTimeStr();
  // Cache medicine name for the display before clearing activeReminder
  String missedMedicine = activeReminder.medicine;
  patchReminder(false, missedTime);
  postHistory("missed", missedTime, "no_response");

  systemState = STATE_MISSED;
  showMissed(missedMedicine);
  Serial.printf("[MISSED] %s\n", missedMedicine.c_str());

  // Brief display then back to idle
  delay(4000);
  // Clear active reminder BEFORE polling so parseRemindersJson
  // doesn't re-apply the triggered flag to the freshly reset reminder.
  activeReminder = Reminder();
  systemState = STATE_IDLE;
  pollReminders();
}

void updateMissedDisplay() {
  showMissed(activeReminder.medicine);
}


// ═══════════════════════════════════════════════════════════════════════════
//  INPUT HANDLER (debounced)
// ═══════════════════════════════════════════════════════════════════════════
bool readReed() {
  // Matches reference: simply returns true if pulled LOW
  return digitalRead(PIN_REED) == LOW;
}

bool readButton() {
  // Matches reference: simply returns true if pulled LOW
  return digitalRead(PIN_BUTTON) == LOW;
}

// ═══════════════════════════════════════════════════════════════════════════
//  DISPLAY CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════
void showConnecting() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 24);
  display.println(F("Connecting..."));
  display.display();
}

void showIdle(DateTime now) {
  display.clearDisplay();

  // Current time — large
  display.setTextSize(2);
  display.setCursor(16, 4);
  display.print(formatHHMM(now.hour(), now.minute()));

  // Next medicine
  display.setTextSize(1);
  display.setCursor(0, 36);
  if (reminderCount > 0) {
    // Find nearest upcoming
    int nearest = -1;
    int nearestMinutes = 9999;
    int nowTotal = now.hour() * 60 + now.minute();
    for (int i = 0; i < reminderCount; i++) {
      if (reminders[i].triggered) continue;
      int t = reminders[i].hour * 60 + reminders[i].minute;
      int diff = (t >= nowTotal) ? (t - nowTotal) : (1440 - nowTotal + t);
      if (diff < nearestMinutes) {
        nearestMinutes = diff;
        nearest = i;
      }
    }
    if (nearest >= 0) {
      display.print(F("Next: "));
      display.print(reminders[nearest].medicine.substring(0, 14));
      display.setCursor(0, 50);
      display.print(F("Time: "));
      display.print(formatHHMM(reminders[nearest].hour, reminders[nearest].minute));
    } else {
      display.print(F("All doses done!"));
    }
  } else {
    display.print(F("No Reminder Set"));
  }

  display.display();
}

void showAlert(const String& medicine) {
  display.clearDisplay();

  // Inverted header
  display.fillRect(0, 0, 128, 18, WHITE);
  display.setTextColor(BLACK);
  display.setTextSize(1);
  display.setCursor(4, 5);
  display.print(F("!! TAKE MEDICINE !!"));
  display.setTextColor(WHITE);

  display.setTextSize(1);
  display.setCursor(0, 24);
  // Truncate long names
  String name = medicine.substring(0, 20);
  display.println(name);

  display.setTextSize(1);
  display.setCursor(0, 42);
  display.print(F("Open box or press"));
  display.setCursor(0, 54);
  display.print(F("button to confirm"));

  display.display();
}

void showConfirmed(const String& medicine) {
  display.clearDisplay();

  display.fillRect(0, 0, 128, 18, WHITE);
  display.setTextColor(BLACK);
  display.setTextSize(1);
  display.setCursor(16, 5);
  display.print(F("MEDICINE TAKEN"));
  display.setTextColor(WHITE);

  display.setTextSize(1);
  display.setCursor(0, 28);
  display.print(medicine.substring(0, 20));

  display.setCursor(0, 44);
  display.print(getCurrentTimeStr());

  display.display();
}

void showMissed(const String& medicine) {
  display.clearDisplay();

  display.fillRect(0, 0, 128, 18, WHITE);
  display.setTextColor(BLACK);
  display.setTextSize(1);
  display.setCursor(20, 5);
  display.print(F("DOSE MISSED"));
  display.setTextColor(WHITE);

  display.setTextSize(1);
  display.setCursor(0, 28);
  display.print(medicine.substring(0, 20));

  display.setCursor(0, 48);
  display.print(F("Please take it now"));

  display.display();
}


// ═══════════════════════════════════════════════════════════════════════════
//  SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════════════════
void patchReminder(bool taken, const String& takenTime) {
  if (activeReminder.id == -1) return;

  String path = "/rest/v1/reminders?id=eq." + String(activeReminder.id);

  // Only mark the dose result — the app is responsible for resetting
  // the reminder back to active/pending after the current minute passes.
  // Doing it immediately here caused the buzzer to re-ring within the same minute.
  DynamicJsonDocument doc(256);
  doc["active"]     = false;
  doc["status"]     = taken ? "taken" : "missed";
  doc["taken_time"] = takenTime;

  String body;
  serializeJson(doc, body);
  httpPatch(path, body);
}

void postHistory(const String& status, const String& takenTime, const String& triggerSource) {
  DateTime now = rtc.now();

  DynamicJsonDocument doc(512);
  doc["medicine"]       = activeReminder.medicine;
  doc["scheduled_time"] = formatHHMM(activeReminder.hour, activeReminder.minute);
  doc["taken_time"]     = takenTime;
  doc["status"]         = status;
  doc["date"]           = getDateString(now);
  doc["trigger"]        = triggerSource;

  String body;
  serializeJson(doc, body);
  httpPost("/rest/v1/history", body);
}

String httpGet(const String& path) {
  if (WiFi.status() != WL_CONNECTED) return "";
  HTTPClient http;
  http.begin(String(SUPABASE_URL) + path);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Accept", "application/json");
  int code = http.GET();
  String payload = (code == 200) ? http.getString() : "";
  http.end();
  return payload;
}

String httpPatch(const String& path, const String& body) {
  if (WiFi.status() != WL_CONNECTED) return "";
  HTTPClient http;
  http.begin(String(SUPABASE_URL) + path);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Prefer", "return=minimal");
  int code = http.PATCH(body);
  Serial.printf("[PATCH] %s -> Code: %d\n", path.c_str(), code);
  http.end();
  return "";
}

String httpPost(const String& path, const String& body) {
  if (WiFi.status() != WL_CONNECTED) return "";
  HTTPClient http;
  http.begin(String(SUPABASE_URL) + path);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Prefer", "return=minimal");
  int code = http.POST(body);
  Serial.printf("[POST] %s -> Code: %d\n", path.c_str(), code);
  http.end();
  return "";
}