/*
 * SafeStep ESP32 Firmware
 * Hardware: ESP32 Wrover-E + MPU-6050 + SW-420 + GY-GPS6MV2 (NEO-6M)
 *
 * Câblage:
 *   MPU-6050  SDA -> GPIO 21 | SCL -> GPIO 22 | VCC -> 3.3V | GND -> GND
 *   SW-420    DO  -> GPIO 34 | VCC -> 3.3V     | GND -> GND
 *   GPS NEO-6M TX -> GPIO 16 | RX  -> GPIO 17  | VCC -> 3.3V | GND -> GND
 *
 * Librairies nécessaires (Arduino Library Manager):
 *   - TinyGPS++ by Mikal Hart
 *
 * BLE UUIDs (copier dans le frontend):
 *   Service  : 4fafc201-1fb5-459e-8fcc-c5c9c331914b
 *   IMU      : beb5483e-36e1-4688-b7f5-ea07361b26a8
 *   Vibration: beb5483e-36e1-4688-b7f5-ea07361b26a9
 *   GPS      : beb5483e-36e1-4688-b7f5-ea07361b26aa
 *   Chute    : beb5483e-36e1-4688-b7f5-ea07361b26ab
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Wire.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>

// ==================== PINS ====================
#define SW420_PIN    34    // Capteur vibration (entrée digitale)
#define GPS_RX_PIN   16    // GPS TX -> ESP32 RX2
#define GPS_TX_PIN   17    // GPS RX -> ESP32 TX2
#define GPS_BAUD     9600

// ==================== MPU-6050 (I2C direct, sans librairie) ====================
#define MPU6050_ADDR  0x68
#define PWR_MGMT_1    0x6B
#define ACCEL_XOUT_H  0x3B

struct IMUData {
  float ax, ay, az;  // accélération en g
  float gx, gy, gz;  // vitesse angulaire en deg/s
};

void mpu6050_init() {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(PWR_MGMT_1);
  Wire.write(0x00);  // Sortie du mode sleep
  Wire.endTransmission(true);
  delay(100);

  // Vérification
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x75);  // WHO_AM_I register
  Wire.endTransmission(false);
  Wire.requestFrom(MPU6050_ADDR, 1, true);
  uint8_t whoAmI = Wire.read();
  if (whoAmI == 0x68) {
    Serial.println("✅ MPU-6050 détecté (0x68)");
  } else {
    Serial.printf("❌ MPU-6050 non détecté (WHO_AM_I = 0x%02X)\n", whoAmI);
  }
}

IMUData mpu6050_read() {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(ACCEL_XOUT_H);
  Wire.endTransmission(false);
  
  uint8_t bytesRead = Wire.requestFrom(MPU6050_ADDR, 14, true);  // 6 accel + 2 temp + 6 gyro
  
  IMUData d = {0, 0, 0, 0, 0, 0};
  
  // Si le bus I2C a planté, on renvoie 0 et on tente de réinitialiser
  if (bytesRead < 14) {
    Serial.printf("⚠️ Erreur lecture I2C (reçu %d octets). Re-init MPU...\n", bytesRead);
    Wire.end();
    delay(50);
    Wire.begin(21, 22);
    mpu6050_init();
    return d;
  }

  int16_t raw_ax = Wire.read() << 8 | Wire.read();
  int16_t raw_ay = Wire.read() << 8 | Wire.read();
  int16_t raw_az = Wire.read() << 8 | Wire.read();
  Wire.read(); Wire.read();  // Température (ignorée)
  int16_t raw_gx = Wire.read() << 8 | Wire.read();
  int16_t raw_gy = Wire.read() << 8 | Wire.read();
  int16_t raw_gz = Wire.read() << 8 | Wire.read();

  // ±2g  -> LSB = 16384 | ±250°/s -> LSB = 131
  d.ax = raw_ax / 16384.0f;
  d.ay = raw_ay / 16384.0f;
  d.az = raw_az / 16384.0f;
  d.gx = raw_gx / 131.0f;
  d.gy = raw_gy / 131.0f;
  d.gz = raw_gz / 131.0f;
  return d;
}

// ==================== BLE ====================
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_IMU_UUID       "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CHAR_VIBRATION_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define CHAR_GPS_UUID       "beb5483e-36e1-4688-b7f5-ea07361b26aa"
#define CHAR_FALL_UUID      "beb5483e-36e1-4688-b7f5-ea07361b26ab"

BLEServer*         pServer        = nullptr;
BLECharacteristic* pIMUChar       = nullptr;
BLECharacteristic* pVibrationChar = nullptr;
BLECharacteristic* pGPSChar       = nullptr;
BLECharacteristic* pFallChar      = nullptr;
bool               bleConnected   = false;

class BLECallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override {
    bleConnected = true;
    Serial.println("✅ Client BLE connecté");
  }
  void onDisconnect(BLEServer*) override {
    bleConnected = false;
    Serial.println("🔌 Client BLE déconnecté - relance advertising...");
    BLEDevice::startAdvertising();
  }
};

void ble_init() {
  BLEDevice::init("SafeStep_Shoe");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new BLECallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);

  // IMU: 6 floats (ax, ay, az, gx, gy, gz) = 24 bytes
  pIMUChar = pService->createCharacteristic(
    CHAR_IMU_UUID,
    BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_READ
  );
  pIMUChar->addDescriptor(new BLE2902());

  // Vibration: 1 byte (0 = calme, 1 = vibration détectée)
  pVibrationChar = pService->createCharacteristic(
    CHAR_VIBRATION_UUID,
    BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_READ
  );
  pVibrationChar->addDescriptor(new BLE2902());

  // GPS: 3 floats (latitude, longitude, vitesse km/h) = 12 bytes
  pGPSChar = pService->createCharacteristic(
    CHAR_GPS_UUID,
    BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_READ
  );
  pGPSChar->addDescriptor(new BLE2902());

  // Chute: 1 byte (0 = normal, 1 = chute détectée)
  pFallChar = pService->createCharacteristic(
    CHAR_FALL_UUID,
    BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_READ
  );
  pFallChar->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising* pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID(SERVICE_UUID);
  pAdv->setScanResponse(true);
  pAdv->setMinPreferred(0x06);
  BLEDevice::startAdvertising();

  Serial.println("📡 BLE Advertising actif - Nom: SafeStep_Shoe");
}

// ==================== DÉTECTION DE CHUTE ====================
/*
 * Algorithme basé sur 3 phases :
 *   1. CHUTE LIBRE  : magnitude accél < 0.5g pendant >100ms
 *   2. IMPACT       : magnitude accél > 2.5g après la chute libre
 *   3. CONFIRMATION : SW-420 se déclenche dans les 500ms après l'impact
 */
enum FallState { NORMAL, FREE_FALL, IMPACT, CONFIRMED };

FallState  fallState        = NORMAL;
uint32_t   freefallStart    = 0;
uint32_t   impactTime       = 0;

#define FREEFALL_THRESHOLD   0.8f   // g (Augmenté de 0.5 à 0.8 pour être plus tolérant)
#define IMPACT_THRESHOLD     1.8f   // g (Baissé de 2.5 à 1.8 pour détecter un impact plus léger)
#define FREEFALL_MIN_MS      50     // ms (Baissé de 100 à 50 pour nécessiter une chute plus courte)
#define CONFIRM_WINDOW_MS    2000   // ms (Augmenté de 500 à 2000 pour laisser le temps au capteur de vibration de s'activer)

bool detectFall(const IMUData& imu, bool vibration) {
  float mag = sqrt(imu.ax * imu.ax + imu.ay * imu.ay + imu.az * imu.az);
  uint32_t now = millis();

  switch (fallState) {
    case NORMAL:
      if (mag < FREEFALL_THRESHOLD) {
        fallState     = FREE_FALL;
        freefallStart = now;
      }
      break;

    case FREE_FALL:
      if (mag >= FREEFALL_THRESHOLD && (now - freefallStart) < FREEFALL_MIN_MS) {
        fallState = NORMAL;  // Trop court -> faux positif
      } else if (mag > IMPACT_THRESHOLD && (now - freefallStart) >= FREEFALL_MIN_MS) {
        fallState  = IMPACT;
        impactTime = now;
        Serial.printf("💥 Impact! mag=%.2fg\n", mag);
      }
      break;

    case IMPACT:
      if (vibration || (now - impactTime > CONFIRM_WINDOW_MS)) {
        if (vibration) {
          fallState = CONFIRMED;
          Serial.println("🚨 CHUTE CONFIRMÉE par SW-420 !");
          return true;
        }
        fallState = NORMAL;  // Pas de vibration dans la fenêtre -> faux positif
      }
      break;

    case CONFIRMED:
      // Reset après 3s
      if (now - impactTime > 3000) {
        fallState = NORMAL;
        Serial.println("✅ Alarme chute réinitialisée");
      }
      break;
  }
  return false;
}

// ==================== ENVOI BLE ====================
void ble_sendIMU(const IMUData& d) {
  float buf[6] = { d.ax, d.ay, d.az, d.gx, d.gy, d.gz };
  pIMUChar->setValue((uint8_t*)buf, sizeof(buf));
  pIMUChar->notify();
}

void ble_sendVibration(bool v) {
  uint8_t val = v ? 1 : 0;
  pVibrationChar->setValue(&val, 1);
  pVibrationChar->notify();
}

void ble_sendGPS(float lat, float lon, float speed) {
  float buf[3] = { lat, lon, speed };
  pGPSChar->setValue((uint8_t*)buf, sizeof(buf));
  pGPSChar->notify();
}

void ble_sendFall(bool fall) {
  uint8_t val = fall ? 1 : 0;
  pFallChar->setValue(&val, 1);
  pFallChar->notify();
}

// ==================== GPS ====================
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  Serial.println("\n🦿 SafeStep ESP32 - Démarrage...");

  pinMode(SW420_PIN, INPUT);

  Wire.begin(21, 22);
  mpu6050_init();

  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("✅ GPS UART2 initialisé (Serial2)");

  ble_init();
  Serial.println("✅ Initialisation terminée\n");
}

// ==================== LOOP ====================
uint32_t lastSensorMs = 0;
uint32_t lastGPSMs    = 0;
const uint16_t SENSOR_INTERVAL_MS = 100;   // 10 Hz
const uint16_t GPS_INTERVAL_MS    = 1000;  // 1 Hz

void loop() {
  // Alimentation continue du parser GPS
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  uint32_t now = millis();

  // --- Capteurs IMU + Vibration @ 10 Hz ---
  if (now - lastSensorMs >= SENSOR_INTERVAL_MS) {
    lastSensorMs = now;

    IMUData imu      = mpu6050_read();
    bool    vibration = digitalRead(SW420_PIN) == HIGH;
    bool    fall      = detectFall(imu, vibration);

    Serial.printf("[IMU] ax:%.2f ay:%.2f az:%.2f | gx:%.1f gy:%.1f gz:%.1f | Vib:%d | Chute:%d\n",
                  imu.ax, imu.ay, imu.az,
                  imu.gx, imu.gy, imu.gz,
                  vibration, fall);

    if (bleConnected) {
      ble_sendIMU(imu);
      ble_sendVibration(vibration);
      if (fall) ble_sendFall(true);
    }
  }

  // --- GPS @ 1 Hz ---
  if (now - lastGPSMs >= GPS_INTERVAL_MS) {
    lastGPSMs = now;

    if (gps.location.isValid()) {
      float lat   = (float)gps.location.lat();
      float lon   = (float)gps.location.lng();
      float speed = (float)gps.speed.kmph();
      Serial.printf("[GPS] lat:%.6f lon:%.6f vitesse:%.1f km/h\n", lat, lon, speed);
      if (bleConnected) ble_sendGPS(lat, lon, speed);
    } else {
      Serial.println("[GPS] En attente de signal...");
    }
  }
}
