let bluetoothDevice = null; // 儲存藍牙裝置物件
let pmChartInstance = null; // PM 圖表實例
let tempHumChartInstance = null; // 溫濕度圖表實例
let dataBuffer = ''; // 暫存接收到的資料字串

// 初始化圖表
function initCharts() {
    // 初始化 PM 圖表
    const pmCtx = document.getElementById('pmChart').getContext('2d'); // 取得 PM 圖表畫布
    pmChartInstance = new Chart(pmCtx, {
        type: 'line', // 折線圖
        data: {
            labels: [], // 時間軸標籤
            datasets: [
                {
                    label: 'PM2.5',
                    data: [], // 資料陣列
                    borderColor: 'rgb(75, 192, 192)', // 線條顏色
                    tension: 0.1 // 線條平滑程度
                },
                {
                    label: 'PM10',
                    data: [],
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                },
                {
                    label: 'PM1.0',
                    data: [],
                    borderColor: 'rgb(54, 162, 235)',
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true, // 自適應畫面大小
            scales: {
                y: {
                    beginAtZero: true, // y軸從0開始
                    title: {
                        display: true,
                        text: 'μg/m³' // y軸單位
                    }
                }
            }
        }
    });

    // 初始化溫濕度圖表
    const tempHumCtx = document.getElementById('tempHumChart').getContext('2d');
    tempHumChartInstance = new Chart(tempHumCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: [],
                    borderColor: 'rgb(255, 159, 64)',
                    tension: 0.1,
                    yAxisID: 'y-temp' // 對應溫度的 y 軸
                },
                {
                    label: 'Humidity (%)',
                    data: [],
                    borderColor: 'rgb(153, 102, 255)',
                    tension: 0.1,
                    yAxisID: 'y-humidity' // 對應濕度的 y 軸
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                'y-temp': {
                    type: 'linear',
                    position: 'left', // 溫度軸在左側
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                },
                'y-humidity': {
                    type: 'linear',
                    position: 'right', // 濕度軸在右側
                    title: {
                        display: true,
                        text: 'Humidity (%)'
                    }
                }
            }
        }
    });
}

// 更新圖表數據
function updateCharts(data) {
    const timestamp = new Date().toLocaleTimeString(); // 取得當前時間
    const maxDataPoints = 10; // 圖表最多保留10筆資料

    // 更新 PM 圖表
    pmChartInstance.data.labels.push(timestamp); // 加入時間標籤
    pmChartInstance.data.datasets[0].data.push(data.pm2_5); // 加入 PM2.5 資料
    pmChartInstance.data.datasets[1].data.push(data.pm10_0); // 加入 PM10 資料
    pmChartInstance.data.datasets[2].data.push(data.pm1_0); // 加入 PM1.0 資料

    if (pmChartInstance.data.labels.length > maxDataPoints) {
        pmChartInstance.data.labels.shift(); // 移除最舊時間
        pmChartInstance.data.datasets.forEach(dataset => dataset.data.shift()); // 移除最舊資料
    }

    // 更新溫濕度圖表
    tempHumChartInstance.data.labels.push(timestamp);
    tempHumChartInstance.data.datasets[0].data.push(data.temperature);
    tempHumChartInstance.data.datasets[1].data.push(data.humidity);

    if (tempHumChartInstance.data.labels.length > maxDataPoints) {
        tempHumChartInstance.data.labels.shift();
        tempHumChartInstance.data.datasets.forEach(dataset => dataset.data.shift());
    }

    pmChartInstance.update(); // 重新繪製 PM 圖表
    tempHumChartInstance.update(); // 重新繪製溫濕度圖表
}

// 連接藍牙設備
async function connectBluetooth() {
    try {
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] }] // 根據特定服務過濾裝置
        });

        const server = await bluetoothDevice.gatt.connect(); // 建立 GATT 連線
        const service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb'); // 取得服務
        const characteristic = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb'); // 取得特徵值

        await characteristic.startNotifications(); // 啟用通知
        characteristic.addEventListener('characteristicvaluechanged', handleData); // 設定資料處理事件
        
        // 更新畫面顯示為已連線
        document.getElementById('connection-status').textContent = 'Bluetooth Status: Connected';
        document.getElementById('connect-button').textContent = 'Disconnect';
    } catch (error) {
        console.error('Bluetooth connection error:', error);
        document.getElementById('connection-status').textContent = 'Bluetooth Status: Connection Failed';
    }
}

// 處理接收到的資料
function handleData(event) {
    const decoder = new TextDecoder(); // 建立文字解碼器
    const data = decoder.decode(event.target.value); // 將資料解碼為字串
    
    try {
        dataBuffer += data; // 累加資料到緩衝區
        
        if (dataBuffer.includes('\n')) { // 如果包含換行符表示有完整資料
            const messages = dataBuffer.split('\n'); // 以換行符分割資料
            dataBuffer = messages.pop(); // 最後一筆可能不完整，保留
            
            messages.forEach(message => {
                processMessage(message.trim()); // 處理每個完整資料
            });
        }
    } catch (error) {
        console.error('Data processing error:', error);
        console.log('Raw data:', data);
        dataBuffer = ''; // 若錯誤則清空緩衝區
    }
}

// 處理單筆完整資料
function processMessage(message) {
    if (!message) return; // 空訊息略過
    
    console.log('Processing message:', message);
    
    try {
        if (!message.startsWith('{') || !message.endsWith('}')) {
            console.error('Invalid JSON format:', message); // 格式錯誤則略過
            return;
        }
        
        const jsonData = JSON.parse(message); // 解析 JSON
        
        if (!jsonData || typeof jsonData !== 'object') {
            console.error('Invalid data object');
            return;
        }
        
        // 對應更新畫面的各個元素
        const updates = {
            'pm1_0': ['pm1_0', ' μg/m³'],
            'pm2_5': ['pm2_5', ' μg/m³'],
            'pm10_0': ['pm10_0', ' μg/m³'],
            'temperature': ['temperature', ' °C'],
            'humidity': ['humidity', ' %'],
            'status': ['status', '']
        };
        
        Object.entries(updates).forEach(([key, [elementId, unit]]) => {
            const value = jsonData[key];
            if (value !== undefined && value !== null) {
                const element = document.getElementById(elementId);
                if (element) {
                    element.textContent = value + (unit || ''); // 顯示數值與單位
                }
            }
        });
        
        // 若有數值就更新圖表
        if (typeof jsonData.pm2_5 === 'number' && 
            typeof jsonData.temperature === 'number' && 
            typeof jsonData.humidity === 'number') {
            updateCharts(jsonData);
        }
        
    } catch (error) {
        console.error('Message processing error:', error);
        console.log('Problem message:', message);
    }
}

// 當頁面載入完成時執行
document.addEventListener('DOMContentLoaded', () => {
    initCharts(); // 初始化圖表
    
    // 綁定藍牙連接按鈕事件
    document.getElementById('connect-button').addEventListener('click', async () => {
        if (!bluetoothDevice || !bluetoothDevice.gatt.connected) {
            await connectBluetooth(); // 尚未連線則嘗試連線
        } else {
            if (bluetoothDevice.gatt.connected) {
                await bluetoothDevice.gatt.disconnect(); // 若已連線則斷開
            }
            // 更新畫面為未連線狀態
            document.getElementById('connection-status').textContent = 'Bluetooth Status: Not Connected';
            document.getElementById('connect-button').textContent = 'Connect Bluetooth';
        }
    });
});
