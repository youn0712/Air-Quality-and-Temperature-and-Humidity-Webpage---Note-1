#include <Wire.h>              // 用於 I2C 通信
#include <LiquidCrystal_I2C.h> // LCD 顯示器的 I2C 庫
#include <SoftwareSerial.h>    // 用於藍牙通信
#include "XLAN_PMS5003T.h"     // PM2.5 感測器庫

// 宣告 LCD 顯示器物件，I2C 地址為 0x27，16 列，2 行顯示器
LiquidCrystal_I2C lcd(0x27, 16, 2);

// 定義 PM2.5 感測器的 RX 和 TX 引腳
#define PM25_RX_PIN 3
#define PM25_TX_PIN 2

// 定義藍牙模組的 RX 和 TX 引腳
#define BT_RX_PIN 10
#define BT_TX_PIN 11

// 定義 LED 引腳
#define BLUE_LED_PIN 5   // 藍色 LED
#define GREEN_LED_PIN 7  // 綠色 LED
#define RED_LED_PIN 6    // 紅色 LED

// 定義繼電器引腳
#define RELAY_PIN 8      // 繼電器控制風扇

// 宣告藍牙 Serial 物件
SoftwareSerial BTSerial(BT_RX_PIN, BT_TX_PIN);

// 宣告 PM2.5 感測器物件
SoftwareSerial PM25Serial(PM25_TX_PIN, PM25_RX_PIN);
XLAN_PMS5003T pms(PM25Serial);
XLAN_PMS5003T::DATA data;

//數值MAX與MIN
const float MAX_PM10_0 = 1000.0;    // PM10 最大合理值 (μg/m³)
const float MIN_PM10_0 = 0.0;      // PM10 最小合理值
const float MAX_PM1_0 = 1000.0;    // PM1.0 最大合理值 (μg/m³)
const float MIN_PM1_0 = 0.0;      // PM1.0 最小合理值
const float MAX_PM25 = 1000.0;    // PM2.5 最大合理值 (μg/m³)
const float MIN_PM25 = 0.0;      // PM2.5 最小合理值
const float MAX_TEMP = 40.0;     // 最高溫度 (°C)
const float MIN_TEMP = 5.0;    // 最低溫度
const float MAX_HUMIDITY = 100.0; // 最大濕度 (%)
const float MIN_HUMIDITY = 0.0;   // 最小濕度

// 記錄讀取次數的變數
int readCount = 0;

bool isDataValid(XLAN_PMS5003T::DATA &data) {
    // 檢查 PM2.5
    if (data.PM_ATM_UG_2_5 < MIN_PM25 || data.PM_ATM_UG_2_5 > MAX_PM25) {
        Serial.println("Error: Invalid PM2.5 reading!" + String(data.PM_ATM_UG_2_5));
        return false;
    }

    // 檢查 PM1.0
    if (data.PM_ATM_UG_1_0 < MIN_PM1_0 || data.PM_ATM_UG_1_0 > MAX_PM1_0) {
        Serial.println("Error: Invalid PM1_0 reading!" + String(data.PM_ATM_UG_1_0));
        return false;
    }
    
    // 檢查 PM10
    if (data.PM_ATM_UG_10_0 < MIN_PM10_0 || data.PM_ATM_UG_10_0 > MAX_PM10_0) {
        Serial.println("Error: Invalid PM10_0 reading!" + String(data.PM_ATM_UG_10_0));
        return false;
    }
    
    // 檢查溫度
    if (data.Temperature < MIN_TEMP || data.Temperature > MAX_TEMP) {
        Serial.println("Error: Invalid temperature reading!" + String(data.Temperature));
        return false;
    }
    
    // 檢查濕度
    if (data.Humidity < MIN_HUMIDITY || data.Humidity > MAX_HUMIDITY) {
        Serial.println("Error: Invalid humidity reading!" + String(data.Humidity));
        return false;
    }
    
    return true;
}

void resetSensor() {
    // 先關閉現有的連接
    PM25Serial.end();
    delay(100);  // 給一些時間完全關閉
    
    // 重新初始化 Serial
    PM25Serial.begin(9600);
    
    // 重新初始化感測器物件
    pms = XLAN_PMS5003T(PM25Serial);
    
    delay(2000);  // 給感測器一些初始化時間
}

void setup() {
    // 初始化串口與藍牙
    Serial.begin(9600);
    BTSerial.begin(9600);

    // 初始化 LCD 顯示器
    lcd.init();
    lcd.backlight();

    // 初始化 PM2.5 感測器
    PM25Serial.begin(9600);

    // 初始化 LED 引腳為輸出
    pinMode(BLUE_LED_PIN, OUTPUT);
    pinMode(GREEN_LED_PIN, OUTPUT);
    pinMode(RED_LED_PIN, OUTPUT);
    pinMode(RELAY_PIN, OUTPUT);

    // 初始校準 PM2.5 感測器
    calibrateSensor(10000);
}

void loop() {
    // 讀取 PM2.5 感測器數據
    if (pms.read(data) && isDataValid(data)) {
        // 根據 PM2.5 數據控制 LED 和顯示藍牙訊息
        String statusMessage;
        if (data.PM_ATM_UG_2_5 < 15) {
            digitalWrite(BLUE_LED_PIN, HIGH);
            digitalWrite(GREEN_LED_PIN, LOW);
            digitalWrite(RED_LED_PIN, LOW);
            digitalWrite(RELAY_PIN, LOW); // 關閉風扇
            statusMessage = "Safe";
        } else if (data.PM_ATM_UG_2_5 <= 50) {
            digitalWrite(BLUE_LED_PIN, LOW);
            digitalWrite(GREEN_LED_PIN, HIGH);
            digitalWrite(RED_LED_PIN, LOW);
            digitalWrite(RELAY_PIN, LOW); // 關閉風扇
            statusMessage = "Warning";
        } else {
            digitalWrite(BLUE_LED_PIN, LOW);
            digitalWrite(GREEN_LED_PIN, LOW);
            digitalWrite(RED_LED_PIN, HIGH);
            digitalWrite(RELAY_PIN, HIGH); // 啟動風扇
            statusMessage = "Danger";
        }

        // 顯示數據於 LCD 顯示器
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("PM10 : " + String(data.PM_ATM_UG_10_0) + " ug/m3");
        lcd.setCursor(0, 1);
        lcd.print("PM1.0: " + String(data.PM_ATM_UG_1_0) + " ug/m3");
        delay(1000);
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("PM2.5: " + String(data.PM_ATM_UG_2_5) + " ug/m3");
        lcd.setCursor(0, 1);
        lcd.print("T:" + String(data.Temperature) + "C, H:" + String(data.Humidity) + "%");
        delay(2000);

        // 構建並發送JSON數據
        String jsonData = "{";
        jsonData += "\"pm1_0\":" + String(int(data.PM_ATM_UG_1_0)) + ",";
        jsonData += "\"pm2_5\":" + String(int(data.PM_ATM_UG_2_5)) + ",";
        jsonData += "\"pm10_0\":" + String(int(data.PM_ATM_UG_10_0)) + ",";
        jsonData += "\"temperature\":" + String(int(data.Temperature)) + ",";
        jsonData += "\"humidity\":" + String(int(data.Humidity)) + ",";
        jsonData += "\"status\":\"" + statusMessage + "\"";
        jsonData += "}";

        // 調試輸出
        Serial.println("Sending JSON: " + jsonData);
        
        // 一次性發送完整的JSON字串
        BTSerial.print(jsonData + "\n");
        
        // 等待數據發送完成
        BTSerial.flush();

        // 增加讀取次數，進行週期性校準
        readCount++;
        if (readCount >= 10) {
            calibrateSensor(5000);
            readCount = 0;
        }

        delay(1500);
    } else {
        resetSensor();
    }
}

// 校準 PM2.5 感測器函數
void calibrateSensor(int duration) {
    Serial.println("Calibrating...");
    BTSerial.println("Calibrating...");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Calibrating...");
    delay(duration);
    Serial.println("Calibration Done.");
    BTSerial.println("Calibration Done");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Calibration Done");
} 