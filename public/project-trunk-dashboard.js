// Mock данные транков (audio-host)
let trunks = [
    {
        id: 1,
        name: "garage-01",
        tailscaleIp: "100.64.1.10",
        description: "Основной гараж, стойка 1",
        status: "online",
        p_type: "sip",
        slots: 10,
        activeSlots: 8,
        activeCalls: 1,
        maxCalls: 10,
        slotsStatus: [1,1,0,1,1,1,0,1,1,1],
        calls: [
            {
                id: 1,
                from: "+79161234567",
                to: "74951234567",
                duration: "00:02:34",
                status: "active",
                slot: 3
            }
        ]
    },
    {
        id: 2,
        name: "showroom-01", 
        tailscaleIp: "100.64.1.11",
        description: "Выставочный зал",
        status: "busy",
        p_type: "gsm",
        slots: 10,
        activeSlots: 10,
        activeCalls: 1,
        maxCalls: 5,
        slotsStatus: [1,1,1,1,1,1,1,1,1,1],
        calls: [
            {
                id: 2,
                from: "74957654321", 
                to: "+79168765432",
                duration: "00:01:15",
                status: "active",
                slot: 7
            }
        ]
    },
    {
        id: 3,
        name: "warehouse-01",
        tailscaleIp: "100.64.1.12", 
        description: "Складской терминал",
        status: "warning",
        p_type: "sip",
        slots: 10,
        activeSlots: 6,
        activeCalls: 0,
        maxCalls: 10,
        slotsStatus: [1,1,1,0,0,1,2,1,0,1],
        calls: []
    }
];

let currentSelectedSlot = null;
let terminalHistory = [];

// Получение ID проекта из URL
function getProjectIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('projectId') || params.get('id');
}

// Управление мобильным меню
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('mobile-visible');
}

// Закрытие мобильного меню при клике вне его
document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    
    if (!sidebar.contains(event.target) && mobileMenuBtn && !mobileMenuBtn.contains(event.target) && sidebar.classList.contains('mobile-visible')) {
        sidebar.classList.remove('mobile-visible');
    }
});

// Инициализация интерфейса
function initInterface() {
    // Загрузка данных проекта из API
    const projectId = getProjectIdFromUrl();
    if (projectId) {
        loadProjectData(projectId);
    }
    
    renderTrunks();
    updateQuickCallSelector();
    renderActiveCalls();
    updateStats();
    startLiveMonitoring();
}

// Загрузка данных проекта
async function loadProjectData(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/info`);
        if (response.ok) {
            const project = await response.json();
            // Обновляем заголовок с именем проекта
            const header = document.querySelector('.header h1');
            if (header) {
                header.textContent = `Центр управления транками - ${project.name}`;
            }
            // Загружаем транки проекта, если есть API
            // loadTrunksFromAPI(projectId);
        }
    } catch (error) {
        console.error('Ошибка загрузки данных проекта:', error);
    }
}

// Рендер списка транков
function renderTrunks() {
    const grid = document.getElementById('trunkGrid');
    grid.innerHTML = '';
    
    trunks.forEach(trunk => {
        const card = document.createElement('div');
        card.className = `trunk-card ${trunk.status}`;
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <h4>${trunk.name}</h4>
                    <div style="font-size: 14px; color: #bdc3c7;">
                        ${trunk.description} • ${trunk.p_type.toUpperCase()}
                    </div>
                </div>
                <span class="status-indicator ${trunk.status}"></span>
            </div>
            
            <div class="trunk-info">
                <div class="trunk-info-item">
                    <div>Tailscale</div>
                    <div>${trunk.tailscaleIp}</div>
                </div>
                <div class="trunk-info-item">
                    <div>Звонки</div>
                    <div>${trunk.activeCalls}/${trunk.maxCalls}</div>
                </div>
                <div class="trunk-info-item">
                    <div>Слотов</div>
                    <div>${trunk.activeSlots}/${trunk.slots}</div>
                </div>
                <div class="trunk-info-item">
                    <div>Статус</div>
                    <div>${getStatusText(trunk.status)}</div>
                </div>
            </div>
            
            <div class="slot-grid">
                ${trunk.slotsStatus.map((status, index) => {
                    const isInCall = trunk.calls.some(call => call.slot === index + 1);
                    const slotClass = isInCall ? 'busy' : 
                                    status === 1 ? 'active' : 
                                    status === 0 ? 'inactive' : 'warning';
                    const hasADB = status === 1 || status === 2;
                    
                    return `
                        <div class="slot ${slotClass}" 
                             onclick="showSlotAccess(${trunk.id}, ${index})"
                             title="Слот ${index + 1} - ${getSlotStatusText(status, isInCall)}">
                            ${index + 1}
                            ${isInCall ? '📞' : ''}
                            ${hasADB ? '<div class="slot-badge">⚡</div>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div class="call-controls">
                <button class="btn btn-sm btn-success" onclick="testTrunk(${trunk.id})">Тест транка</button>
                <button class="btn btn-sm btn-call" onclick="makeCallFromTrunk(${trunk.id})">Создать звонок</button>
                <button class="btn btn-sm btn-warning" onclick="restartTrunk(${trunk.id})">Перезапуск</button>
                <button class="btn btn-sm btn-danger" onclick="removeTrunk(${trunk.id})">Удалить</button>
            </div>
            
            ${trunk.calls.length > 0 ? `
                <div style="margin-top: 10px; font-size: 14px;">
                    <strong>Активные звонки:</strong>
                    ${trunk.calls.map(call => `
                        <div style="background: rgba(155,89,182,0.2); padding: 8px; margin: 5px 0; border-radius: 6px;">
                            ${call.from} → ${call.to} (${call.duration})
                            <button class="btn btn-sm btn-danger" onclick="endCall(${call.id}, ${trunk.id})" style="padding: 5px 10px; font-size: 12px; margin-top: 5px;">Завершить</button>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
        grid.appendChild(card);
    });
    
    updateStats();
}

// Показать меню доступа к слоту
function showSlotAccess(trunkId, slotIndex) {
    const trunk = trunks.find(t => t.id === trunkId);
    const slotStatus = trunk.slotsStatus[slotIndex];
    const isInCall = trunk.calls.some(call => call.slot === slotIndex + 1);
    
    currentSelectedSlot = { trunkId, slotIndex, trunk, slotStatus, isInCall };
    
    document.getElementById('accessSlotNumber').textContent = slotIndex + 1;
    document.getElementById('accessTrunkName').textContent = trunk.name;
    document.getElementById('accessTrunkIp').textContent = trunk.tailscaleIp;
    document.getElementById('accessSlotStatus').textContent = getSlotStatusText(slotStatus, isInCall);
    
    document.getElementById('slotAccessModal').style.display = 'block';
}

// Открыть War Room для слота
function openWarRoom() {
    if (!currentSelectedSlot) return;
    
    const { trunk, slotIndex } = currentSelectedSlot;
    
    document.getElementById('warRoomTrunkName').textContent = trunk.name;
    document.getElementById('warRoomSlotNumber').textContent = slotIndex + 1;
    
    const warRoomContainer = document.getElementById('warRoomContainer');
    warRoomContainer.innerHTML = `
        <div class="war-room-slot green">
            <div class="war-room-header">Slot ${slotIndex + 1} (AUTO) - ACTIVE</div>
            <div>Call: +380991234567 | Duration: 00:02:34</div>
            <div class="war-room-metrics">
                <div>MOS: 4.2</div>
                <div>Jitter: 12ms</div>
                <div>Loss: 0.1%</div>
                <div>Latency: 45ms</div>
            </div>
            <div class="war-room-guac">GUACAMOLE: Android Head Unit 2DIN Active</div>
            <pre class="war-room-pre">
12:31:20 INVITE
12:31:20 100 Trying
12:31:20 180 Ringing
12:31:22 200 OK
12:31:22 ACK
12:31:22 RTP Stream Start
12:33:54 BYE
12:33:54 200 OK
            </pre>
        </div>
    `;
    
    closeModal('slotAccessModal');
    document.getElementById('warRoomModal').style.display = 'block';
}

// Открыть CLI терминал
function openCLI() {
    if (!currentSelectedSlot) return;
    
    const { trunk, slotIndex } = currentSelectedSlot;
    
    document.getElementById('cliTrunkName').textContent = trunk.name;
    document.getElementById('cliSlotNumber').textContent = slotIndex + 1;
    document.getElementById('cliTargetIp').textContent = trunk.tailscaleIp;
    
    setTimeout(() => {
        addTerminalOutput(`SSH connection established to ${trunk.tailscaleIp}`);
        addTerminalOutput(`Android device detected in slot ${slotIndex + 1}`);
        addTerminalOutput(`ADB shell access granted`);
        addTerminalOutput(`root@android-headunit:~# `, true);
    }, 1000);
    
    closeModal('slotAccessModal');
    document.getElementById('cliModal').style.display = 'block';
}

// Открыть Guacamole
function openGuacamole() {
    if (!currentSelectedSlot) return;
    
    const { trunk, slotIndex } = currentSelectedSlot;
    
    document.getElementById('guacTrunkName').textContent = trunk.name;
    document.getElementById('guacSlotNumber').textContent = slotIndex + 1;
    document.getElementById('guacTargetIp').textContent = trunk.tailscaleIp;
    
    closeModal('slotAccessModal');
    document.getElementById('guacamoleModal').style.display = 'block';
}

// Подключить Guacamole
function connectGuacamole() {
    document.getElementById('guacStatus').textContent = 'Установка RDP соединения...';
    document.getElementById('guacamoleFrame').innerHTML = `
        <div style="text-align: center; padding: 50px;">
            <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 0 auto 20px;"></div>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
            <h4>Подключение к удаленному рабочему столу</h4>
            <p>Инициализация RDP сессии...</p>
        </div>
    `;
    
    setTimeout(() => {
        document.getElementById('guacStatus').textContent = 'Соединение установлено';
        document.getElementById('guacamoleFrame').innerHTML = `
            <div style="width: 100%; height: 100%; background: #1a1a1a; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                <div style="font-size: 48px; margin-bottom: 20px;">🖥️</div>
                <h4>Android 2DIN Headunit Desktop</h4>
                <p>Эмуляция графического интерфейса магнитолы</p>
                <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <button class="btn btn-sm" onclick="launchApp('radio')">Радио</button>
                    <button class="btn btn-sm" onclick="launchApp('settings')">Настройки</button>
                    <button class="btn btn-sm" onclick="launchApp('navigation')">Навигация</button>
                    <button class="btn btn-sm" onclick="launchApp('phone')">Телефон</button>
                </div>
            </div>
        `;
    }, 3000);
}

function reconnectGuacamole() {
    document.getElementById('guacStatus').textContent = 'Переподключение...';
    connectGuacamole();
}

function launchApp(app) {
    alert(`Запуск приложения: ${app}`);
    addLog(`Запущено приложение ${app} на ${currentSelectedSlot.trunk.name} слот ${currentSelectedSlot.slotIndex + 1}`);
}

// CLI функции
function executeCLICommand() {
    const input = document.getElementById('cliInput');
    const command = input.value.trim();
    
    if (!command) return;
    
    addTerminalOutput(`root@android-headunit:~# ${command}`);
    
    setTimeout(() => {
        let output = '';
        
        if (command.startsWith('adb devices')) {
            output = `List of devices attached\n${currentSelectedSlot.trunk.tailscaleIp}:5555\tdevice`;
        } else if (command.startsWith('adb shell')) {
            const subCommand = command.replace('adb shell', '').trim();
            if (subCommand === 'ls') {
                output = `system\nvendor\nproc\nsys\nsdcard\nandroid_apps`;
            } else if (subCommand === 'pwd') {
                output = `/`;
            } else if (subCommand === 'whoami') {
                output = `root`;
            } else {
                output = `Command '${subCommand}' executed`;
            }
        } else if (command.startsWith('logcat')) {
            output = `--------- beginning of system\n--------- beginning of main\nI/System.out: Android headunit running\nD/AudioService: Audio focus granted`;
        } else if (command.startsWith('dumpsys')) {
            output = `DUMP OF SERVICE activity:\n  Current activities:\n  * Task{12345 #123 A=com.android.settings}\n  Running services:\n  * com.android.phone`;
        } else if (command.startsWith('pm list packages')) {
            output = `package:com.android.settings\npackage:com.android.phone\npackage:com.google.android.maps\npackage:com.android.camera2`;
        } else {
            output = `Command not found: ${command}`;
        }
        
        addTerminalOutput(output);
        addTerminalOutput(`root@android-headunit:~# `, true);
    }, 500);
    
    input.value = '';
    terminalHistory.push(command);
}

function addTerminalOutput(text, isPrompt = false) {
    const terminal = document.getElementById('terminalOutput');
    const line = document.createElement('div');
    line.className = 'terminal-line';
    
    if (isPrompt) {
        line.innerHTML = `<span class="terminal-prompt">${text}</span>`;
        document.getElementById('currentCommand').textContent = '';
    } else {
        line.textContent = text;
    }
    
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

function clearTerminal() {
    document.getElementById('terminalOutput').innerHTML = '';
    addTerminalOutput(`Terminal cleared`);
    addTerminalOutput(`root@android-headunit:~# `, true);
}

function getStatusText(status) {
    const statusMap = {
        'online': 'Активен',
        'offline': 'Неактивен',
        'warning': 'Предупреждение',
        'busy': 'Занят'
    };
    return statusMap[status] || 'Неизвестно';
}

function getSlotStatusText(status, isInCall) {
    if (isInCall) return 'В разговоре';
    switch(status) {
        case 1: return 'Активен';
        case 0: return 'Неактивен';
        case 2: return 'Предупреждение';
        default: return 'Неизвестно';
    }
}

function updateStats() {
    const activeTrunks = trunks.filter(t => t.status === 'online' || t.status === 'busy').length;
    const totalSlots = trunks.reduce((sum, trunk) => sum + trunk.slots, 0);
    const activeSlots = trunks.reduce((sum, trunk) => sum + trunk.activeSlots, 0);
    const activeCallsCount = trunks.reduce((sum, trunk) => sum + trunk.activeCalls, 0);
    
    document.getElementById('activeTrunksCount').textContent = `${activeTrunks}/${trunks.length}`;
    document.getElementById('totalSlots').textContent = `${activeSlots}/${totalSlots}`;
    document.getElementById('activeCallsCount').textContent = activeCallsCount;
}

function updateQuickCallSelector() {
    const selector = document.getElementById('quickCallTrunk');
    selector.innerHTML = '';
    
    trunks.forEach(trunk => {
        const option = document.createElement('option');
        option.value = trunk.id;
        option.textContent = `${trunk.name} (${trunk.activeCalls}/${trunk.maxCalls} звонков)`;
        selector.appendChild(option);
    });
}

function renderActiveCalls() {
    const container = document.getElementById('activeCallsList');
    container.innerHTML = '';
    
    const allCalls = trunks.flatMap(trunk => 
        trunk.calls.map(call => ({...call, trunkName: trunk.name}))
    );
    
    if (allCalls.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">Нет активных звонков</div>';
        return;
    }
    
    allCalls.forEach(call => {
        const callItem = document.createElement('div');
        callItem.className = 'call-item';
        callItem.innerHTML = `
            <div style="display: flex; justify-content: space-between;">
                <strong>${call.from} → ${call.to}</strong>
                <span class="status-indicator active-call"></span>
            </div>
            <div style="font-size: 14px; margin-top: 5px;">
                <div>Транк: ${call.trunkName}</div>
                <div>Слот: ${call.slot}</div>
                <div>Длительность: ${call.duration}</div>
            </div>
            <div style="margin-top: 8px;">
                <button class="btn btn-sm btn-danger" onclick="endCall(${call.id})">Завершить</button>
                <button class="btn btn-sm" onclick="transferCall(${call.id})">Перевести</button>
            </div>
        `;
        container.appendChild(callItem);
    });
}

function showAddTrunkModal() {
    document.getElementById('addTrunkModal').style.display = 'block';
}

function addTrunk() {
    const address = document.getElementById('trunkAddress').value;
    const name = document.getElementById('trunkName').value;
    const description = document.getElementById('trunkDescription').value;
    const slots = parseInt(document.getElementById('trunkSlots').value);
    const type = document.getElementById('trunkType').value;
    
    if (!address || !name) {
        alert('Заполните обязательные поля');
        return;
    }
    
    const newTrunk = {
        id: trunks.length + 1,
        name: name,
        tailscaleIp: address,
        description: description,
        status: 'online',
        p_type: type,
        slots: slots,
        activeSlots: slots,
        activeCalls: 0,
        maxCalls: type === 'gsm' ? 4 : 10,
        slotsStatus: Array(slots).fill(1),
        calls: []
    };
    
    trunks.push(newTrunk);
    renderTrunks();
    updateQuickCallSelector();
    closeModal('addTrunkModal');
    addLog(`Добавлен новый транк: ${name}`);
    
    document.getElementById('trunkAddress').value = '';
    document.getElementById('trunkName').value = '';
    document.getElementById('trunkDescription').value = '';
}

function testTrunk(trunkId) {
    const trunk = trunks.find(t => t.id === trunkId);
    addLog(`Тестирование транка: ${trunk.name}`);
    
    setTimeout(() => {
        addLog(`Транк ${trunk.name}: тест пройден успешно`);
        alert(`Транк ${trunk.name} работает корректно`);
    }, 2000);
}

function restartTrunk(trunkId) {
    const trunk = trunks.find(t => t.id === trunkId);
    if (confirm(`Перезапустить транк ${trunk.name}?`)) {
        addLog(`Перезапуск транка: ${trunk.name}`);
        trunk.status = 'warning';
        renderTrunks();
        
        setTimeout(() => {
            trunk.status = 'online';
            trunk.activeCalls = 0;
            trunk.calls = [];
            trunk.slotsStatus = trunk.slotsStatus.map(() => 1);
            trunk.activeSlots = trunk.slots;
            renderTrunks();
            renderActiveCalls();
            addLog(`Транк ${trunk.name} перезапущен`);
        }, 3000);
    }
}

function removeTrunk(trunkId) {
    const trunk = trunks.find(t => t.id === trunkId);
    if (confirm(`Удалить транк ${trunk.name}?`)) {
        const index = trunks.findIndex(t => t.id === trunkId);
        trunks.splice(index, 1);
        renderTrunks();
        updateQuickCallSelector();
        addLog(`Транк ${trunk.name} удален`);
    }
}

function makeCallFromTrunk(trunkId) {
    const number = prompt('Введите номер для звонка:');
    if (!number) return;
    
    const trunk = trunks.find(t => t.id === trunkId);
    if (trunk.activeCalls >= trunk.maxCalls) {
        alert(`Транк ${trunk.name} достиг максимального количества звонков (${trunk.maxCalls})`);
        return;
    }
    
    addLog(`Инициирован звонок с транка ${trunk.name} на номер ${number}`);
    
    setTimeout(() => {
        const newCall = {
            id: Date.now(),
            from: trunk.tailscaleIp,
            to: number,
            duration: "00:00:01",
            status: "active",
            slot: 1
        };
        
        trunk.calls.push(newCall);
        trunk.activeCalls++;
        trunk.status = trunk.activeCalls > 0 ? 'busy' : 'online';
        renderTrunks();
        renderActiveCalls();
        updateQuickCallSelector();
        addLog(`Звонок с ${trunk.name} на ${number} установлен`);
    }, 2000);
}

function makeQuickCall() {
    const number = document.getElementById('quickCallNumber').value;
    const trunkId = document.getElementById('quickCallTrunk').value;
    
    if (!number) {
        alert('Введите номер для звонка');
        return;
    }
    
    makeCallFromTrunk(parseInt(trunkId));
    document.getElementById('quickCallNumber').value = '';
}

function endCall(callId, trunkId = null) {
    let trunk;
    if (trunkId) {
        trunk = trunks.find(t => t.id === trunkId);
    } else {
        for (let t of trunks) {
            const callIndex = t.calls.findIndex(c => c.id === callId);
            if (callIndex !== -1) {
                trunk = t;
                break;
            }
        }
    }
    
    if (trunk) {
        const callIndex = trunk.calls.findIndex(c => c.id === callId);
        if (callIndex !== -1) {
            const call = trunk.calls[callIndex];
            trunk.calls.splice(callIndex, 1);
            trunk.activeCalls--;
            trunk.status = trunk.activeCalls > 0 ? 'busy' : 'online';
            renderTrunks();
            renderActiveCalls();
            updateQuickCallSelector();
            addLog(`Звонок ${call.from} → ${call.to} завершен`);
        }
    }
}

function endAllCalls() {
    if (confirm('Завершить все активные звонки?')) {
        trunks.forEach(trunk => {
            trunk.calls = [];
            trunk.activeCalls = 0;
            trunk.status = 'online';
        });
        renderTrunks();
        renderActiveCalls();
        updateQuickCallSelector();
        addLog('Все активные звонки завершены');
    }
}

function transferCall(callId) {
    addLog(`Перевод звонка ${callId}`);
    alert(`Перевод звонка\nЗдесь будет интерфейс перевода на другой слот или транк`);
}

function refreshCalls() {
    addLog('Обновление статуса звонков...');
    renderActiveCalls();
}

function scanNetwork() {
    addLog('Сканирование сети... Поиск доступных транков через Tailscale');
    setTimeout(() => {
        addLog('Обнаружен новый транк: discovered-01 (100.64.1.20)');
        alert('Обнаружен 1 новый транк!\nПроверьте логи для подробностей.');
    }, 2000);
}

function restartAll() {
    if (confirm('Перезапустить все транки?')) {
        trunks.forEach(trunk => {
            addLog(`Перезапуск ${trunk.name}...`);
            trunk.status = 'warning';
        });
        renderTrunks();
        
        setTimeout(() => {
            trunks.forEach(trunk => {
                trunk.status = 'online';
                trunk.activeCalls = 0;
                trunk.calls = [];
                trunk.slotsStatus = trunk.slotsStatus.map(() => 1);
                trunk.activeSlots = trunk.slots;
            });
            renderTrunks();
            renderActiveCalls();
            updateQuickCallSelector();
            addLog('Все транки перезапущены');
        }, 5000);
    }
}

function clearLogs() {
    document.getElementById('systemLogs').innerHTML = '';
    addLog('Логи очищены');
}

function addLog(message) {
    const logContent = document.getElementById('systemLogs');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.textContent = `[${timestamp}] ${message}`;
    logContent.prepend(logEntry);
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showNetworkConfig() {
    document.getElementById('networkConfigModal').style.display = 'block';
}

function saveNetworkConfig() {
    const hostname = document.getElementById('tailscaleHostname').value;
    const ip = document.getElementById('tailscaleIp').value;
    const enabled = document.getElementById('tailscaleEnabled').checked;
    const autoConnect = document.getElementById('tailscaleAutoConnect').checked;
    
    addLog(`Сетевые настройки сохранены: Tailscale ${enabled ? 'включен' : 'выключен'}, Hostname: ${hostname}, IP: ${ip}`);
    closeModal('networkConfigModal');
    alert('Сетевые настройки сохранены');
}

function testNetworkConnection() {
    addLog('Тестирование сетевого соединения...');
    setTimeout(() => {
        addLog('Сетевое соединение: OK');
        alert('Сетевое соединение работает корректно');
    }, 2000);
}

function restartSlot() {
    if (currentSelectedSlot) {
        addLog(`Перезапуск слота ${currentSelectedSlot.slotIndex + 1} на транке ${currentSelectedSlot.trunk.name}`);
        alert('Слот перезапущен');
    }
}

function startLiveMonitoring() {
    setInterval(() => {
        document.getElementById('cpuUsage').textContent = Math.floor(Math.random() * 10 + 20) + '%';
        document.getElementById('ramUsage').textContent = (Math.random() * 0.5 + 1.5).toFixed(1) + '/4GB';
        document.getElementById('networkUsage').textContent = Math.floor(Math.random() * 30 + 100) + ' Mbps';
        
        if (Math.random() > 0.8) {
            const events = [
                'Проверка соединения с транками... OK',
                'Синхронизация времени... Выполнена',
                'Мониторинг транков... Активны',
                'Проверка VoIP сервера... Стабильно'
            ];
            addLog(events[Math.floor(Math.random() * events.length)]);
        }
        
        trunks.forEach(trunk => {
            trunk.calls.forEach(call => {
                const parts = call.duration.split(':').map(Number);
                let seconds = parts[2] + 1;
                let minutes = parts[1];
                let hours = parts[0];
                
                if (seconds >= 60) {
                    seconds = 0;
                    minutes++;
                }
                if (minutes >= 60) {
                    minutes = 0;
                    hours++;
                }
                
                call.duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            });
        });
        
        renderActiveCalls();
    }, 1000);
}

// Закрытие модальных окон по клику вне
window.onclick = function(event) {
    const modals = document.getElementsByClassName('modal');
    for (let modal of modals) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
}

// Обработка Enter в CLI и инициализация
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация интерфейса
    initInterface();
    
    // Обработка Enter в CLI
    const cliInput = document.getElementById('cliInput');
    if (cliInput) {
        cliInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                executeCLICommand();
            }
        });
    }
    
    // Убеждаемся, что все кнопки кликабельны
    setTimeout(() => {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            button.style.cursor = 'pointer';
            // Убеждаемся, что кнопка не блокирует клики
            if (!button.disabled) {
                // Добавляем обработчик только если его нет
                if (!button.onclick && !button.getAttribute('onclick')) {
                    button.addEventListener('click', function(e) {
                        console.log('Кнопка без обработчика:', this.textContent || this.className);
                    }, { passive: true });
                }
            }
        });
        
        // Убеждаемся, что все элементы с cursor: pointer кликабельны
        const clickableElements = document.querySelectorAll('.slot, .access-option, .trunk-card');
        clickableElements.forEach(element => {
            element.style.cursor = 'pointer';
            element.style.userSelect = 'none';
        });
        
        console.log('✅ Все элементы интерфейса готовы к использованию');
    }, 100);
});

