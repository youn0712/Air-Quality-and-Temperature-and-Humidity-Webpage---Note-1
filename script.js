let bluetoothDevice = null;
let pmChartInstance = null;
let tempHumChartInstance = null;
let dataBuffer = '';

// 初始化圖表
function initCharts() {
    // 初始化 PM 圖表
    const pmCtx = document.getElementById('pmChart').getContext('2d');
    pmChartInstance = new Chart(pmCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'PM2.5',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
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
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'μg/m³'
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
                    yAxisID: 'y-temp'
                },
                {
                    label: 'Humidity (%)',
                    data: [],
                    borderColor: 'rgb(153, 102, 255)',
                    tension: 0.1,
                    yAxisID: 'y-humidity'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                'y-temp': {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                },
                'y-humidity': {
                    type: 'linear',
                    position: 'right',
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
    const timestamp = new Date().toLocaleTimeString();
    const maxDataPoints = 10;

    // 更新 PM 圖表
    pmChartInstance.data.labels.push(timestamp);
    pmChartInstance.data.datasets[0].data.push(data.pm2_5);
    pmChartInstance.data.datasets[1].data.push(data.pm10_0);
    pmChartInstance.data.datasets[2].data.push(data.pm1_0);

    if (pmChartInstance.data.labels.length > maxDataPoints) {
        pmChartInstance.data.labels.shift();
        pmChartInstance.data.datasets.forEach(dataset => dataset.data.shift());
    }

    // 更新溫濕度圖表
    tempHumChartInstance.data.labels.push(timestamp);
    tempHumChartInstance.data.datasets[0].data.push(data.temperature);
    tempHumChartInstance.data.datasets[1].data.push(data.humidity);

    if (tempHumChartInstance.data.labels.length > maxDataPoints) {
        tempHumChartInstance.data.labels.shift();
        tempHumChartInstance.data.datasets.forEach(dataset => dataset.data.shift());
    }

    pmChartInstance.update();
    tempHumChartInstance.update();
}

// 連接藍芽設備
async function connectBluetooth() {
    try {
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] }]
        });

        const server = await bluetoothDevice.gatt.connect();
        const service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
        const characteristic = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');

        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', handleData);
        
        document.getElementById('connection-status').textContent = 'Bluetooth Status: Connected';
        document.getElementById('connect-button').textContent = 'Disconnect';
    } catch (error) {
        console.error('Bluetooth connection error:', error);
        document.getElementById('connection-status').textContent = 'Bluetooth Status: Connection Failed';
    }
}

// 處理接收到的數據
function handleData(event) {
    const decoder = new TextDecoder();
    const data = decoder.decode(event.target.value);
    
    try {
        // 將新數據添加到緩衝區
        dataBuffer += data;
        
        // 檢查是否有完整的JSON
        if (dataBuffer.includes('\n')) {
            // 分割並處理每個完整的JSON
            const messages = dataBuffer.split('\n');
            // 保留最後一個可能不完整的部分
            dataBuffer = messages.pop();
            
            // 處理每個完整的消息
            messages.forEach(message => {
                processMessage(message.trim());
            });
        }
    } catch (error) {
        console.error('Data processing error:', error);
        console.log('Raw data:', data);
        // 清空緩衝區
        dataBuffer = '';
    }
}

// 處理單個完整的消息
function processMessage(message) {
    if (!message) return;
    
    console.log('Processing message:', message);
    
    try {
        // 檢查是否是有效的JSON格式
        if (!message.startsWith('{') || !message.endsWith('}')) {
            console.error('Invalid JSON format:', message);
            return;
        }
        
        // 解析JSON
        const jsonData = JSON.parse(message);
        
        // 驗證數據
        if (!jsonData || typeof jsonData !== 'object') {
            console.error('Invalid data object');
            return;
        }
        
        // 更新UI
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
                    element.textContent = value + (unit || '');
                }
            }
        });
        
        // 更新圖表
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

// 初始化頁面
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    
    document.getElementById('connect-button').addEventListener('click', async () => {
        if (!bluetoothDevice || !bluetoothDevice.gatt.connected) {
            await connectBluetooth();
        } else {
            if (bluetoothDevice.gatt.connected) {
                await bluetoothDevice.gatt.disconnect();
            }
            document.getElementById('connection-status').textContent = 'Bluetooth Status: Not Connected';
            document.getElementById('connect-button').textContent = 'Connect Bluetooth';
        }
    });
}); 