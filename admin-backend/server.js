// admin-backend/server.js
const http = require('http');
const WebSocket = require('ws');
const { Manager } = require('asterisk-manager');
const { Adb } = require('@devicefarmer/adbkit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const logger = require('./logger'); // Путь к логгеру внутри контейнера

// --- Конфигурация сервера ---
const WEB_PORT = 8181; // Порт для HTTP-сервера и WebSocket внутри контейнера
const AMI_HOST = process.env.AMI_HOST || '213.165.48.17'; // IP-адрес Asterisk, можно задать через переменную окружения Docker
const AMI_PORT = process.env.AMI_PORT || 6038;        // Порт AMI Asterisk
const AMI_USERNAME = process.env.AMI_USERNAME || 'vss_1'; // Имя пользователя AMI
const AMI_PASSWORD = process.env.AMI_PASSWORD || 'QmlVdWNndTdRYlk9'; // Пароль AMI
const SALT_ROUNDS = 10;

// --- Конфигурация CORS ---
// ВНИМАНИЕ: ALLOWED_ORIGIN должен указывать на URL, с которого будет доступен ваш фронтенд админки.
// Если фронтенд админки в Docker Compose доступен как http://localhost:8080, то так и оставляем.
// Если фронтенд будет доступен по имени сервиса внутри Docker, то это будет `http://admin-frontend:80`.
// Для доступа из браузера, который будет на хосте, скорее всего, понадобится `http://localhost:8080`.
const ALLOWED_ORIGIN = process.env.ADMIN_FRONTEND_URL || 'http://localhost:8080';


// --- Хранилище пользователей ---
// Путь к файлу users.json внутри контейнера.
// Этот файл будет монтироваться из хоста, чтобы данные сохранялись.
const USERS_FILE = path.join('/app', 'users.json');
let users = {};

async function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
            if (data.trim().length > 0) {
                users = JSON.parse(data);
                logger.info('[AUTH] Пользователи загружены из users.json.');
            } else {
                users = {};
                logger.info('[AUTH] Файл users.json пуст. Будут созданы тестовые пользователи.');
            }
        } else {
            logger.info('[AUTH] Файл users.json не найден. Создаем новый и добавляем тестовых пользователей.');
        }

        if (!users['user']) {
            const testUserToken = crypto.randomUUID();
            const testUserHashedPassword = await bcrypt.hash('pass', SALT_ROUNDS);
            users['user'] = { password: testUserHashedPassword, token: testUserToken, roles: ['default', 'ami_monitor'] };
        }
        if (!users['admin']) {
            const adminToken = crypto.randomUUID();
            const adminHashedPassword = await bcrypt.hash('adminpass', SALT_ROUNDS);
            users['admin'] = { password: adminHashedPassword, token: adminToken, roles: ['admin', 'ami_full_access', 'adb_full_access'] };
        }
        saveUsers();
        logger.info(`[AUTH] Тестовые пользователи 'user' (pass) и 'admin' (adminpass) инициализированы/проверены.`);

    } catch (err) {
        logger.error('[AUTH] Ошибка при загрузке/инициализации пользователей из users.json:', err);
        users = {};
    }
}

function saveUsers() {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
        logger.info('[AUTH] Пользователи сохранены в users.json.');
    } catch (err) {
        logger.error('[AUTH] Ошибка при сохранении пользователей в users.json:', err);
    }
}

const clients = new Map();
let nextWsId = 1;

let globalAmiManager = null;
let amiStatus = 'disconnected';

const adbClient = Adb.createClient(); // ADB клиент
let adbDevices = [];

const PERMISSIONS = {
    'admin': {
        ami_actions: ['Originate', 'Hangup', 'Status', 'CoreShowChannels', 'ConfbridgeList', 'ConfbridgeListRooms', 'ConfbridgeKick', 'ConfbridgeMute', 'ConfbridgeUnmute', 'DAHDIShowChannels', 'PJSIPShowEndpoints', 'QueueSummary', 'Reload', 'ModuleLoad', 'System', 'Command'],
        ami_events_filter: []
    },
    'ami_full_access': {
        ami_actions: ['Originate', 'Hangup', 'Status', 'CoreShowChannels', 'ConfbridgeList', 'ConfbridgeListRooms', 'ConfbridgeKick', 'ConfbridgeMute', 'ConfbridgeUnmute', 'DAHDIShowChannels', 'PJSIPShowEndpoints', 'QueueSummary'],
        ami_events_filter: []
    },
    'ami_monitor': {
        ami_actions: ['Status', 'CoreShowChannels', 'ConfbridgeList', 'ConfbridgeListRooms'],
        ami_events_filter: ['Newchannel', 'Newstate', 'Hangup', 'ConfbridgeJoin', 'ConfbridgeLeave', 'ConfbridgeStart', 'ConfbridgeEnd', 'DialBegin', 'DialEnd', 'DTMFBegin', 'DTMFEnd']
    },
    'adb_full_access': {
        adb_actions: ['dial', 'answer', 'hangup']
    },
    'default': {
        ami_actions: [],
        ami_events_filter: []
    }
};

function getUserRoles(username) {
    return users[username] ? users[username].roles || ['default'] : ['default'];
}

function isAuthorizedForAmiAction(username, actionName) {
    const roles = getUserRoles(username);
    for (const role of roles) {
        if (PERMISSIONS[role] && PERMISSIONS[role].ami_actions && PERMISSIONS[role].ami_actions.includes(actionName)) {
            return true;
        }
    }
    return false;
}

function isAuthorizedForAdbAction(username, actionType) {
    const roles = getUserRoles(username);
    for (const role of roles) {
        if (PERMISSIONS[role] && PERMISSIONS[role].adb_actions && PERMISSIONS[role].adb_actions.includes(actionType)) {
            return true;
        }
    }
    return false;
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url === '/') {
        // В Docker-контейнере фронтенд будет обслуживаться Nginx,
        // поэтому этот путь для client.html здесь не нужен, но оставлен для полноты.
        // Если вы запускаете бэкенд отдельно от Docker Compose, и он должен отдавать HTML:
        fs.readFile(path.join(__dirname, 'client.html'), (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
                logger.error('Ошибка при чтении client.html:', err);
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const { username, password } = JSON.parse(body);
                const user = users[username];

                if (user) {
                    const isMatch = await bcrypt.compare(password, user.password);
                    if (isMatch) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Авторизация успешна', token: user.token }));
                        logger.info(`[AUTH] Пользователь ${username} вошел в систему.`);
                    } else {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Неверное имя пользователя или пароль' }));
                        logger.warn(`[AUTH] Неудачная попытка входа для ${username} (неверный пароль).`);
                    }
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Неверное имя пользователя или пароль' }));
                    logger.warn(`[AUTH] Неудачная попытка входа для ${username} (пользователь не найден).`);
                }
            } catch (e) {
                logger.error('[AUTH] Ошибка при обработке /login:', e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Неверный формат запроса или внутренняя ошибка' }));
            }
        });
    } else if (req.url === '/register' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const { username, password } = JSON.parse(body);
                if (users[username]) {
                    res.writeHead(409, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Пользователь с таким именем уже существует' }));
                    logger.warn(`[AUTH] Попытка регистрации существующего пользователя: ${username}.`);
                } else {
                    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
                    const token = crypto.randomUUID();
                    users[username] = { password: hashedPassword, token: token, roles: ['default'] };
                    saveUsers();
                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Регистрация успешна', token: token }));
                    logger.info(`[AUTH] Пользователь ${username} зарегистрирован.`);
                }
            } catch (e) {
                logger.error('[AUTH] Ошибка при обработке /register:', e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Неверный формат запроса или ошибка хеширования' }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

const wss = new WebSocket.Server({ server });

function broadcastAmiEvent(event) {
    clients.forEach(ws => {
        if (ws.isAuthenticated && ws.userId) {
            const roles = getUserRoles(ws.userId);
            let shouldSendEvent = false;
            let filteredEvent = { ...event };

            for (const role of roles) {
                if (PERMISSIONS[role] && PERMISSIONS[role].ami_events_filter) {
                    if (PERMISSIONS[role].ami_events_filter.length === 0 || PERMISSIONS[role].ami_events_filter.includes(event.event)) {
                        shouldSendEvent = true;

                        delete filteredEvent.calleridnum;
                        delete filteredEvent.calleridname;
                        delete filteredEvent.uniqueid;
                        delete filteredEvent.linkedid;
                        delete filteredEvent.accountcode;
                        delete filteredEvent.peer;
                        delete filteredEvent.destchannel;
                        delete filteredEvent.destcalleridnum;
                        delete filteredEvent.destcalleridname;

                        if (filteredEvent.event === 'DTMFBegin' || filteredEvent.event === 'DTMFEnd') {
                             delete filteredEvent.digit;
                        }

                        break;
                    }
                }
            }

            if (shouldSendEvent) {
                sendMessageToClient(ws, { type: 'ami_event', data: filteredEvent });
            }
        }
    });
}

function connectGlobalAmi() {
    logger.info(`[AMI_GLOBAL] Попытка подключения к AMI на ${AMI_HOST}:${AMI_PORT}...`);
    if (globalAmiManager) {
        globalAmiManager.disconnect();
        globalAmiManager = null;
    }

    globalAmiManager = new Manager(AMI_PORT, AMI_HOST, AMI_USERNAME, AMI_PASSWORD, true);
    amiStatus = 'connecting';
    broadcastToAllClients({ type: 'ami_status', status: 'reconnecting', message: 'Подключение к AMI...' });

    globalAmiManager.on('connect', () => {
        logger.info(`[AMI_GLOBAL] Подключен к Asterisk AMI.`);
        amiStatus = 'connected';
        broadcastToAllClients({ type: 'ami_status', status: 'connected', message: 'Подключен к AMI.' });
        globalAmiManager.on('managerevent', broadcastAmiEvent);
    });

    globalAmiManager.on('disconnect', () => {
        logger.warn(`[AMI_GLOBAL] Отключен от Asterisk AMI. Попытка переподключения через 5 секунд...`);
        amiStatus = 'disconnected';
        broadcastToAllClients({ type: 'ami_status', status: 'disconnected', message: 'Отключен от AMI. Переподключение...' });
        if (globalAmiManager) {
            globalAmiManager.removeAllListeners('managerevent');
            globalAmiManager.removeAllListeners('response');
        }
        setTimeout(connectGlobalAmi, 5000);
    });

    globalAmiManager.on('error', err => {
        logger.error(`[AMI_GLOBAL] Ошибка AMI:`, err);
        amiStatus = 'disconnected';
        broadcastToAllClients({ type: 'ami_status', status: 'disconnected', message: `Ошибка AMI: ${err.message}. Переподключение...` });
    });
}

function broadcastToAllClients(message) {
    clients.forEach(ws => {
        sendMessageToClient(ws, message);
    });
}

wss.on('connection', ws => {
    const wsId = nextWsId++;
    clients.set(wsId, ws);
    logger.info(`[WS] Клиент подключен. ID: ${wsId}. Всего клиентов: ${clients.size}`);
    sendMessageToClient(ws, { type: 'server_status', message: `Подключен к серверу Node.js. Ваш ID: ${wsId}` });

    ws.isAuthenticated = false;
    ws.userId = null;

    sendMessageToClient(ws, { type: 'ami_status', status: amiStatus, message: `Статус AMI: ${amiStatus}` });
    sendAdbDevicesToClient(ws);

    ws.on('message', async message => {
        try {
            const parsedMessage = JSON.parse(message);
            logger.debug(`[WS:${wsId}] Получено сообщение:`, parsedMessage);

            if (parsedMessage.type === 'auth') {
                const userEntry = Object.values(users).find(u => u.token === parsedMessage.token);
                if (userEntry) {
                    ws.isAuthenticated = true;
                    ws.userId = Object.keys(users).find(key => users[key] === userEntry);
                    sendMessageToClient(ws, { type: 'auth_status', success: true, message: 'Авторизация WebSocket успешна.' });
                    logger.info(`[WS:${wsId}] Авторизация успешна для пользователя ${ws.userId}.`);
                } else {
                    sendMessageToClient(ws, { type: 'auth_status', success: false, message: 'Неверный токен авторизации.' });
                    logger.warn(`[WS:${wsId}] Неудачная авторизация: неверный токен.`);
                    ws.close(1008, 'Unauthorized');
                    return;
                }
            }

            if (!ws.isAuthenticated) {
                sendMessageToClient(ws, { type: 'error', message: 'Неавторизованный доступ. Пожалуйста, авторизуйтесь.' });
                logger.warn(`[WS:${wsId}] Попытка неавторизованного действия без авторизации.`);
                return;
            }

            switch (parsedMessage.type) {
                case 'ami_action':
                    if (globalAmiManager && amiStatus === 'connected') {
                        if (!isAuthorizedForAmiAction(ws.userId, parsedMessage.action.Action)) {
                            sendMessageToClient(ws, { type: 'error', message: `Пользователь ${ws.userId} не имеет прав на выполнение действия "${parsedMessage.action.Action}".` });
                            logger.warn(`[WS:${wsId}] Пользователь ${ws.userId} попытался выполнить запрещенное AMI действие: ${parsedMessage.action.Action}`);
                            return;
                        }
                        try {
                            const response = await globalAmiManager.action(parsedMessage.action);
                            sendMessageToClient(ws, { type: 'ami_action_response', action: parsedMessage.action.Action, data: response });
                            logger.info(`[WS:${wsId}] Отправлено AMI действие "${parsedMessage.action.Action}".`);
                        } catch (amiError) {
                            sendMessageToClient(ws, { type: 'ami_error', message: `Ошибка AMI действия "${parsedMessage.action.Action}": ${amiError.message}` });
                            logger.error(`[WS:${wsId}] Ошибка AMI действия "${parsedMessage.action.Action}":`, amiError);
                        }
                    } else {
                        sendMessageToClient(ws, { type: 'error', message: 'AMI не подключен.' });
                    }
                    break;
                case 'join_conference':
                    sendMessageToClient(ws, { type: 'conf_originate_response', success: true, message: `Попытка присоединиться к конференции ${parsedMessage.conferenceName}.` });
                    logger.info(`[WS:${wsId}] Клиент запросил присоединение к конференции: ${parsedMessage.conferenceName}`);
                    break;
                case 'adb_action':
                    if (!isAuthorizedForAdbAction(ws.userId, parsedMessage.actionType)) {
                        sendMessageToClient(ws, { type: 'error', message: `Пользователь ${ws.userId} не имеет прав на выполнение действия ADB "${parsedMessage.actionType}".` });
                        logger.warn(`[WS:${wsId}] Пользователь ${ws.userId} попытался выполнить запрещенное ADB действие: ${parsedMessage.actionType}`);
                        return;
                    }
                    await handleAdbAction(ws, parsedMessage.deviceId, parsedMessage.actionType, parsedMessage.value);
                    break;
                default:
                    sendMessageToClient(ws, { type: 'error', message: 'Неизвестный тип сообщения.' });
            }
        } catch (e) {
            logger.error(`[WS:${wsId}] Ошибка обработки сообщения:`, e);
            sendMessageToClient(ws, { type: 'error', message: `Ошибка обработки сообщения: ${e.message}` });
        }
    });

    ws.on('close', () => {
        clients.delete(wsId);
        logger.info(`[WS] Клиент отключен. ID: ${wsId}. Всего клиентов: ${clients.size}`);
    });

    ws.on('error', error => {
        logger.error(`[WS:${wsId}] Ошибка WebSocket:`, error);
    });
});

async function discoverAdbDevices() {
    try {
        const devices = await adbClient.listDevices();
        adbDevices = devices;
        logger.info('[ADB] Обнаружены устройства:', adbDevices.map(d => d.id).join(', '));
        clients.forEach(ws => {
            if (ws.isAuthenticated) {
                sendAdbDevicesToClient(ws);
            }
        });
    } catch (err) {
        logger.error('[ADB] Ошибка обнаружения устройств:', err);
        clients.forEach(ws => {
            sendMessageToClient(ws, { type: 'error', message: `Ошибка ADB: ${err.message}` });
        });
    }
}

function sendAdbDevicesToClient(ws) {
    sendMessageToClient(ws, { type: 'adb_device_update', devices: adbDevices });
}

async function handleAdbAction(ws, deviceId, actionType, value) {
    const device = adbDevices.find(d => d.id === deviceId);
    if (!device) {
        sendMessageToClient(ws, { type: 'adb_action_response', success: false, deviceId, actionType, error: 'Устройство не найдено.' });
        logger.warn(`[ADB] Действие "${actionType}" на несуществующем устройстве ${deviceId}.`);
        return;
    }

    try {
        let output = '';
        switch (actionType) {
            case 'dial':
                if (!value) throw new Error('Номер телефона не указан для набора.');
                output = await adbClient.startActivity(deviceId, {
                    action: 'android.intent.action.CALL',
                    data: `tel:${value}`
                });
                break;
            case 'answer':
                output = await adbClient.pressKey(deviceId, 'KEYCODE_CALL');
                break;
            case 'hangup':
                output = await adbClient.pressKey(deviceId, 'KEYCODE_ENDCALL');
                break;
            default:
                throw new Error(`Неизвестное ADB действие: ${actionType}`);
        }
        sendMessageToClient(ws, { type: 'adb_action_response', success: true, deviceId, actionType, output: output.toString() });
        logger.info(`[ADB] Действие "${actionType}" на устройстве ${deviceId} успешно.`);
    } catch (err) {
        sendMessageToClient(ws, { type: 'adb_action_response', success: false, deviceId, actionType, error: err.message });
        logger.error(`[ADB] Ошибка действия "${actionType}" на устройстве ${deviceId}:`, err);
    }
}

function sendMessageToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        logger.warn(`[WS] Попытка отправить сообщение клиенту ID:${ws.wsId} с закрытым соединением.`);
    }
}

server.listen(WEB_PORT, async () => {
    logger.info(`Сервер запущен на http://localhost:${WEB_PORT}`);
    logger.info(`WebSocket сервер запущен на ws://localhost:${WEB_PORT}`);

    await loadUsers();
    connectGlobalAmi();

    discoverAdbDevices();
    setInterval(discoverAdbDevices, 30000);
});

server.on('error', (err) => {
    logger.error('Критическая ошибка HTTP-сервера:', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    logger.error('Необработанное исключение:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Необработанное отклонение промиса:', reason, promise);
});
