// admin-backend/server.js
const http = require('http');
const WebSocket = require('ws');
const net = require('net');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const logger = require('./logger'); // Путь к логгеру внутри контейнера
const { findAvailablePort: findPort, isPortFullyAvailable } = require('../utils/port-finder');

// Импорт asterisk-manager (экспортирует Manager напрямую)
let Manager;
try {
    Manager = require('asterisk-manager');
    if (typeof Manager !== 'function') {
        logger.error('[AMI] Manager не является конструктором. Проверьте установку пакета asterisk-manager.');
        Manager = null;
    }
} catch (error) {
    logger.error('[AMI] Ошибка импорта asterisk-manager:', error);
    Manager = null;
}
const { Adb } = require('@devicefarmer/adbkit');

// --- Конфигурация сервера ---
const DEFAULT_WEB_PORT = parseInt(process.env.WEB_PORT) || 8181; // Порт для HTTP-сервера и WebSocket внутри контейнера
let WEB_PORT = DEFAULT_WEB_PORT;
let serverRestartAttempts = 0;
const MAX_SERVER_RESTART_ATTEMPTS = 10;
const SALT_ROUNDS = 10;

// --- Файл конфигурации AMI ---
const CONFIG_FILE = path.join('/app', 'config.json');

// --- Настройки AMI (загружаются из config.json или переменных окружения) ---
let amiConfig = {
    host: process.env.AMI_HOST || '213.165.48.17',
    port: parseInt(process.env.AMI_PORT || '6038'),
    username: process.env.AMI_USERNAME || 'vss_1',
    password: process.env.AMI_PASSWORD || 'QmlVdWNndTdRYlk9'
};

// Загрузка настроек из файла
function loadAmiConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            if (data.trim().length > 0) {
                const config = JSON.parse(data);
                if (config.ami) {
                    amiConfig = {
                        host: config.ami.host || amiConfig.host,
                        port: parseInt(config.ami.port || amiConfig.port),
                        username: config.ami.username || amiConfig.username,
                        password: config.ami.password || amiConfig.password
                    };
                    logger.info('[CONFIG] Настройки AMI загружены из config.json');
                }
            }
        } else {
            logger.info('[CONFIG] Файл config.json не найден. Используются настройки по умолчанию.');
        }
    } catch (error) {
        logger.error('[CONFIG] Ошибка загрузки config.json:', error);
    }
}

// Сохранение настроек в файл
function saveAmiConfig() {
    try {
        const config = {
            ami: amiConfig
        };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        logger.info('[CONFIG] Настройки AMI сохранены в config.json');
        return true;
    } catch (error) {
        logger.error('[CONFIG] Ошибка сохранения config.json:', error);
        return false;
    }
}

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
let amiReconnectAttempts = 0;
const MAX_AMI_RECONNECT_ATTEMPTS = parseInt(process.env.AMI_MAX_RECONNECT_ATTEMPTS) || 10;
const INITIAL_AMI_RECONNECT_DELAY = parseInt(process.env.AMI_RECONNECT_DELAY) || 5000; // 5 секунд начальная задержка
const AMI_ENABLED = process.env.AMI_ENABLED !== 'false'; // Можно отключить через переменную окружения
const AMI_AUTO_RECONNECT = process.env.AMI_AUTO_RECONNECT !== 'false'; // Можно отключить автопереподключение
let lastAmiErrorLogTime = 0;
const AMI_ERROR_LOG_INTERVAL = 60000; // Логировать ошибки не чаще раза в минуту

// ADB Configuration
let adbConfig = {
    enabled: process.env.ADB_ENABLED === 'true' || false,
    path: process.env.ADB_PATH || (process.platform === 'win32' ? 'adb.exe' : 'adb'),
    port: parseInt(process.env.ADB_PORT || '5037'),
    autoStart: process.env.ADB_AUTO_START === 'true' || false
};

// Load ADB config from file
function loadAdbConfig() {
    try {
        const configFile = path.join('/app', 'adb-config.json');
        if (fs.existsSync(configFile)) {
            const data = fs.readFileSync(configFile, 'utf8');
            if (data.trim().length > 0) {
                const config = JSON.parse(data);
                adbConfig = {
                    enabled: config.enabled !== undefined ? config.enabled : adbConfig.enabled,
                    path: config.path || adbConfig.path,
                    port: config.port || adbConfig.port,
                    autoStart: config.autoStart !== undefined ? config.autoStart : adbConfig.autoStart
                };
                logger.info('[ADB] Настройки ADB загружены из adb-config.json');
            }
        }
    } catch (error) {
        logger.error('[ADB] Ошибка загрузки adb-config.json:', error);
    }
}

// Save ADB config to file
function saveAdbConfig() {
    try {
        const configFile = path.join('/app', 'adb-config.json');
        fs.writeFileSync(configFile, JSON.stringify(adbConfig, null, 2), 'utf8');
        logger.info('[ADB] Настройки ADB сохранены в adb-config.json');
        return true;
    } catch (error) {
        logger.error('[ADB] Ошибка сохранения adb-config.json:', error);
        return false;
    }
}

// Create ADB client with custom path
let adbClient = null;
function createAdbClient() {
    if (!adbConfig.enabled) {
        logger.info('[ADB] ADB отключен в настройках');
        return null;
    }
    
    try {
        // Set ADB path in environment if custom path is provided
        if (adbConfig.path && adbConfig.path !== 'adb' && adbConfig.path !== 'adb.exe') {
            process.env.PATH = `${path.dirname(adbConfig.path)}${path.delimiter}${process.env.PATH}`;
        }
        
        const client = Adb.createClient({
            port: adbConfig.port,
            bin: adbConfig.path
        });
        logger.info(`[ADB] ADB клиент создан (path: ${adbConfig.path}, port: ${adbConfig.port})`);
        return client;
    } catch (error) {
        logger.error('[ADB] Ошибка создания ADB клиента:', error);
        return null;
    }
}

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
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
    } else if (req.url === '/api/config/ami' && req.method === 'GET') {
        // Получение настроек AMI
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            config: {
                host: amiConfig.host,
                port: amiConfig.port,
                username: amiConfig.username,
                // Пароль не возвращаем для безопасности, только маску
                password: amiConfig.password ? '***' : ''
            }
        }));
    } else if (req.url === '/api/config/adb' && req.method === 'GET') {
        // Получение настроек ADB
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            config: {
                enabled: adbConfig.enabled,
                path: adbConfig.path,
                port: adbConfig.port,
                autoStart: adbConfig.autoStart
            }
        }));
    } else if (req.url === '/api/config/adb' && req.method === 'PUT') {
        // Сохранение настроек ADB
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const { enabled, path: adbPath, port, autoStart } = JSON.parse(body);
                
                // Валидация
                if (port && (isNaN(port) || port < 1024 || port > 65535)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Порт должен быть числом от 1024 до 65535' }));
                    return;
                }
                
                // Обновляем настройки
                adbConfig = {
                    enabled: enabled !== undefined ? enabled : adbConfig.enabled,
                    path: adbPath || adbConfig.path,
                    port: port || adbConfig.port,
                    autoStart: autoStart !== undefined ? autoStart : adbConfig.autoStart
                };
                
                // Сохраняем в файл
                if (saveAdbConfig()) {
                    // Пересоздаем ADB клиент с новыми настройками
                    adbClient = createAdbClient();
                    
                    // Перезапускаем обнаружение устройств и ждем завершения
                    try {
                        await discoverAdbDevices();
                    } catch (discoverError) {
                        logger.warn('[ADB] Ошибка при обнаружении устройств после обновления настроек:', discoverError);
                        // Продолжаем выполнение, так как настройки уже сохранены
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        message: 'Настройки ADB сохранены и применены',
                        config: adbConfig
                    }));
                    logger.info('[ADB] Настройки ADB обновлены через API');
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Ошибка сохранения настроек' }));
                }
            } catch (e) {
                logger.error('[ADB] Ошибка при обработке /api/config/adb:', e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Неверный формат запроса' }));
            }
        });
    } else if (req.url === '/api/config/ami' && req.method === 'PUT') {
        // Сохранение настроек AMI
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { host, port, username, password } = JSON.parse(body);
                
                // Валидация
                if (!host || !port || !username || !password) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Все поля обязательны' }));
                    return;
                }
                
                if (isNaN(port) || port < 1 || port > 65535) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Порт должен быть числом от 1 до 65535' }));
                    return;
                }
                
                // Обновляем настройки
                amiConfig = {
                    host: host.trim(),
                    port: parseInt(port),
                    username: username.trim(),
                    password: password.trim()
                };
                
                // Сохраняем в файл
                if (saveAmiConfig()) {
                    // Переподключаемся к AMI с новыми настройками
                    connectGlobalAmi();
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        message: 'Настройки AMI сохранены и применены',
                        config: {
                            host: amiConfig.host,
                            port: amiConfig.port,
                            username: amiConfig.username,
                            password: '***'
                        }
                    }));
                    logger.info('[CONFIG] Настройки AMI обновлены через API');
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Ошибка сохранения настроек' }));
                }
            } catch (e) {
                logger.error('[CONFIG] Ошибка при обработке /api/config/ami:', e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Неверный формат запроса' }));
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
    // Проверяем, включен ли AMI
    if (!AMI_ENABLED) {
        logger.info('[AMI_GLOBAL] ℹ️  AMI отключен через переменную окружения AMI_ENABLED=false');
        amiStatus = 'disabled';
        broadcastToAllClients({ type: 'ami_status', status: 'disabled', message: 'AMI отключен в настройках' });
        return;
    }

    if (!Manager) {
        logger.error('[AMI_GLOBAL] Manager не доступен. Проверьте установку пакета asterisk-manager.');
        amiStatus = 'disconnected';
        broadcastToAllClients({ type: 'ami_status', status: 'disconnected', message: 'AMI Manager не доступен. Проверьте установку пакета.' });
        return;
    }

    // Логируем только при первой попытке или если прошло достаточно времени
    const now = Date.now();
    if (amiReconnectAttempts === 0 || (now - lastAmiErrorLogTime) > AMI_ERROR_LOG_INTERVAL) {
        logger.info(`[AMI_GLOBAL] Попытка подключения к AMI на ${amiConfig.host}:${amiConfig.port}...`);
        lastAmiErrorLogTime = now;
    }

    if (globalAmiManager) {
        try {
            globalAmiManager.removeAllListeners();
            globalAmiManager.disconnect();
        } catch (e) {
            // Игнорируем ошибки при отключении
        }
        globalAmiManager = null;
    }

    try {
        // Проверяем, является ли Manager функцией/конструктором
        if (typeof Manager !== 'function') {
            throw new Error('Manager is not a constructor. Проверьте импорт пакета asterisk-manager.');
        }
        globalAmiManager = new Manager(amiConfig.port, amiConfig.host, amiConfig.username, amiConfig.password, true);
    } catch (error) {
        const now = Date.now();
        const shouldLog = amiReconnectAttempts === 0 || (now - lastAmiErrorLogTime) > AMI_ERROR_LOG_INTERVAL;
        
        if (shouldLog) {
            logger.error(`[AMI_GLOBAL] Ошибка создания Manager:`, error);
            lastAmiErrorLogTime = now;
        }
        
        amiStatus = 'disconnected';
        broadcastToAllClients({ type: 'ami_status', status: 'disconnected', message: `Ошибка создания AMI Manager: ${error.message}` });
        
        if (AMI_AUTO_RECONNECT) {
            scheduleAmiReconnect();
        }
        return;
    }
    
    amiStatus = 'connecting';
    if (amiReconnectAttempts === 0) {
        broadcastToAllClients({ type: 'ami_status', status: 'connecting', message: 'Подключение к AMI...' });
    } else {
        broadcastToAllClients({ type: 'ami_status', status: 'reconnecting', message: `Переподключение к AMI (попытка ${amiReconnectAttempts})...` });
    }

    globalAmiManager.on('connect', () => {
        logger.info(`[AMI_GLOBAL] ✅ Подключен к Asterisk AMI.`);
        amiStatus = 'connected';
        amiReconnectAttempts = 0; // Сбрасываем счетчик при успешном подключении
        lastAmiErrorLogTime = 0; // Сбрасываем таймер ошибок
        broadcastToAllClients({ type: 'ami_status', status: 'connected', message: 'Подключен к AMI.' });
        globalAmiManager.on('managerevent', broadcastAmiEvent);
    });

    globalAmiManager.on('disconnect', () => {
        const now = Date.now();
        const shouldLog = (now - lastAmiErrorLogTime) > AMI_ERROR_LOG_INTERVAL;
        
        if (shouldLog) {
            logger.warn(`[AMI_GLOBAL] Отключен от Asterisk AMI.`);
            lastAmiErrorLogTime = now;
        }
        
        amiStatus = 'disconnected';
        broadcastToAllClients({ type: 'ami_status', status: 'disconnected', message: 'Отключен от AMI. Переподключение...' });
        
        if (globalAmiManager) {
            globalAmiManager.removeAllListeners('managerevent');
            globalAmiManager.removeAllListeners('response');
        }
        
        if (AMI_AUTO_RECONNECT) {
            scheduleAmiReconnect();
        }
    });

    globalAmiManager.on('error', err => {
        const now = Date.now();
        const shouldLog = (now - lastAmiErrorLogTime) > AMI_ERROR_LOG_INTERVAL;
        
        if (shouldLog) {
            logger.error(`[AMI_GLOBAL] ❌ Ошибка AMI:`, err.message);
            lastAmiErrorLogTime = now;
        }
        
        amiStatus = 'disconnected';
        broadcastToAllClients({ type: 'ami_status', status: 'disconnected', message: `Ошибка AMI: ${err.message}. Переподключение...` });
        
        if (AMI_AUTO_RECONNECT) {
            scheduleAmiReconnect();
        }
    });
}

// Функция для планирования переподключения AMI
function scheduleAmiReconnect() {
    if (!AMI_AUTO_RECONNECT) {
        return; // Автопереподключение отключено
    }

    if (amiReconnectAttempts >= MAX_AMI_RECONNECT_ATTEMPTS) {
        const now = Date.now();
        if ((now - lastAmiErrorLogTime) > AMI_ERROR_LOG_INTERVAL) {
            logger.error(`[AMI_GLOBAL] ❌ Превышено максимальное количество попыток переподключения (${MAX_AMI_RECONNECT_ATTEMPTS}). Остановка попыток переподключения.`);
            logger.log('[AMI_GLOBAL] ℹ️  Для повторной попытки перезапустите сервис или установите AMI_AUTO_RECONNECT=true');
            lastAmiErrorLogTime = now;
        }
        return;
    }
    
    amiReconnectAttempts++;
    // Используем экспоненциальную задержку с начальной задержкой
    const delay = INITIAL_AMI_RECONNECT_DELAY * Math.pow(1.5, amiReconnectAttempts - 1);
    const delaySeconds = Math.round(delay / 1000);
    
    // Логируем только каждую 3-ю попытку или если прошло достаточно времени
    const now = Date.now();
    if (amiReconnectAttempts % 3 === 0 || amiReconnectAttempts === 1 || (now - lastAmiErrorLogTime) > AMI_ERROR_LOG_INTERVAL) {
        logger.log(`[AMI_GLOBAL] 🔄 Попытка переподключения к AMI через ${delaySeconds} секунд (попытка ${amiReconnectAttempts}/${MAX_AMI_RECONNECT_ATTEMPTS})...`);
        lastAmiErrorLogTime = now;
    }
    
    setTimeout(() => {
        if (!globalAmiManager || amiStatus !== 'connected') {
            connectGlobalAmi();
        }
    }, delay);
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

let lastAdbErrorLogTime = 0;
const ADB_ERROR_LOG_INTERVAL = 60000; // Логировать ошибки не чаще раза в минуту

async function discoverAdbDevices() {
    if (!adbConfig.enabled) {
        logger.debug('[ADB] ADB отключен, пропускаем обнаружение устройств');
        adbDevices = [];
        clients.forEach(ws => {
            if (ws.isAuthenticated) {
                sendAdbDevicesToClient(ws);
            }
        });
        return;
    }

    if (!adbClient) {
        adbClient = createAdbClient();
        if (!adbClient) {
            const now = Date.now();
            if ((now - lastAdbErrorLogTime) > ADB_ERROR_LOG_INTERVAL) {
                logger.warn('[ADB] Не удалось создать ADB клиент. Проверьте настройки ADB.');
                lastAdbErrorLogTime = now;
            }
            adbDevices = [];
            clients.forEach(ws => {
                if (ws.isAuthenticated) {
                    sendAdbDevicesToClient(ws);
                }
            });
            return;
        }
    }

    try {
        // Auto-start ADB server if enabled
        if (adbConfig.autoStart) {
            try {
                // execAsync уже определен на уровне модуля
                await execAsync(`${adbConfig.path} -P ${adbConfig.port} start-server`);
                logger.info('[ADB] ADB сервер запущен автоматически');
            } catch (startError) {
                const now = Date.now();
                if ((now - lastAdbErrorLogTime) > ADB_ERROR_LOG_INTERVAL) {
                    logger.warn(`[ADB] Не удалось автоматически запустить ADB сервер: ${startError.message}`);
                    lastAdbErrorLogTime = now;
                }
            }
        }

        const devices = await adbClient.listDevices();
        adbDevices = devices;
        logger.info('[ADB] Обнаружены устройства:', adbDevices.map(d => d.id).join(', ') || 'нет устройств');
        lastAdbErrorLogTime = 0; // Сбрасываем таймер ошибок при успехе
        clients.forEach(ws => {
            if (ws.isAuthenticated) {
                sendAdbDevicesToClient(ws);
            }
        });
    } catch (err) {
        const now = Date.now();
        const shouldLog = (now - lastAdbErrorLogTime) > ADB_ERROR_LOG_INTERVAL;
        
        if (shouldLog) {
            logger.error('[ADB] Ошибка обнаружения устройств:', err.message);
            if (err.code === 'ENOENT' || err.message.includes('spawn')) {
                logger.error(`[ADB] ADB не найден по пути: ${adbConfig.path}. Проверьте настройки ADB в личном кабинете проекта.`);
            }
            lastAdbErrorLogTime = now;
        }
        
        adbDevices = [];
        clients.forEach(ws => {
            if (ws.isAuthenticated) {
                sendMessageToClient(ws, { 
                    type: 'error', 
                    message: `Ошибка ADB: ${err.message}. Проверьте настройки ADB в личном кабинете проекта.` 
                });
                sendAdbDevicesToClient(ws);
            }
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

// Используем утилиту для проверки и поиска свободных портов

// Функция для очистки Docker контейнеров
async function cleanupDockerContainers() {
    try {
        logger.info('[DOCKER] Очистка остановленных Docker контейнеров...');
        
        // Удаляем остановленные контейнеры
        try {
            const { stdout: containers } = await execAsync('docker ps -a -q -f status=exited');
            if (containers.trim()) {
                await execAsync(`docker rm ${containers.trim().split('\n').join(' ')}`);
                logger.info('[DOCKER] Остановленные контейнеры удалены');
            } else {
                logger.info('[DOCKER] Нет остановленных контейнеров для удаления');
            }
        } catch (error) {
            // Игнорируем ошибки, если Docker недоступен или нет контейнеров
            if (!error.message.includes('Cannot connect') && !error.message.includes('No such')) {
                logger.warn('[DOCKER] Предупреждение при очистке контейнеров:', error.message);
            }
        }

        // Очищаем неиспользуемые образы (опционально, можно закомментировать если не нужно)
        try {
            await execAsync('docker image prune -f');
            logger.info('[DOCKER] Неиспользуемые образы очищены');
        } catch (error) {
            // Игнорируем ошибки
            logger.debug('[DOCKER] Очистка образов пропущена:', error.message);
        }

        // Очищаем неиспользуемые сети
        try {
            await execAsync('docker network prune -f');
            logger.info('[DOCKER] Неиспользуемые сети очищены');
        } catch (error) {
            // Игнорируем ошибки
            logger.debug('[DOCKER] Очистка сетей пропущена:', error.message);
        }

        logger.info('[DOCKER] Очистка Docker завершена');
    } catch (error) {
        // Если Docker недоступен, просто логируем и продолжаем
        if (error.message.includes('Cannot connect') || error.message.includes('docker')) {
            logger.warn('[DOCKER] Docker недоступен, пропускаем очистку. Это нормально, если Docker не установлен или не запущен.');
        } else {
            logger.warn('[DOCKER] Ошибка при очистке Docker:', error.message);
        }
    }
}

// Запуск сервера с автоматическим поиском свободного порта
async function startServer(portOffset = 0) {
    try {
        // Очищаем Docker контейнеры при запуске
        await cleanupDockerContainers();

        // Пытаемся найти свободный порт, начиная с DEFAULT_WEB_PORT + offset (используем утилиту)
        const startPort = DEFAULT_WEB_PORT + portOffset;
        WEB_PORT = await findPort(startPort, 100, true);
        
        // Сбрасываем счетчик попыток при успешном поиске порта
        serverRestartAttempts = 0;
        
        if (WEB_PORT !== DEFAULT_WEB_PORT) {
            logger.warn(`⚠️  Порт ${DEFAULT_WEB_PORT} занят. Используется порт ${WEB_PORT}`);
        }
        
        // Проверяем порт еще раз непосредственно перед привязкой для избежания race condition
        const stillAvailable = await isPortFullyAvailable(WEB_PORT).catch(() => false);
        if (!stillAvailable) {
            // Порт стал недоступен, ищем новый
            logger.warn(`⚠️  Порт ${WEB_PORT} стал недоступен. Поиск нового порта...`);
            WEB_PORT = await findPort(WEB_PORT + 1, 100, true);
        }
        
        server.listen(WEB_PORT, '0.0.0.0', async () => {
            logger.info(`✅ Сервер запущен на http://localhost:${WEB_PORT}`);
            logger.info(`✅ WebSocket сервер запущен на ws://localhost:${WEB_PORT}`);

            await loadUsers();
            loadAmiConfig(); // Загружаем настройки AMI из файла
            connectGlobalAmi();

            loadAdbConfig(); // Загружаем настройки ADB из файла
            adbClient = createAdbClient(); // Создаем ADB клиент с настройками
            discoverAdbDevices();
            setInterval(discoverAdbDevices, 30000);
        });
    } catch (error) {
        logger.error('❌ Ошибка запуска сервера:', error.message);
        process.exit(1);
    }
}

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        serverRestartAttempts++;
        if (serverRestartAttempts > MAX_SERVER_RESTART_ATTEMPTS) {
            logger.error(`❌ Превышено максимальное количество попыток перезапуска сервера (${MAX_SERVER_RESTART_ATTEMPTS}). Завершение работы.`);
            process.exit(1);
        }
        
        logger.error(`❌ Порт ${WEB_PORT} уже занят. Попытка найти свободный порт... (попытка ${serverRestartAttempts}/${MAX_SERVER_RESTART_ATTEMPTS})`);
        // Закрываем существующий сервер перед повторной попыткой
        if (server.listening) {
            server.close((closeErr) => {
                if (closeErr) {
                    logger.error('❌ Ошибка при закрытии сервера:', closeErr);
                }
                // Пытаемся перезапустить с другим портом, начиная с текущего + 1
                const portOffset = WEB_PORT - DEFAULT_WEB_PORT + 1;
                startServer(portOffset).catch(error => {
                    logger.error('❌ Критическая ошибка HTTP-сервера:', error);
                    // Если findAvailablePort выбросил ошибку (все порты заняты), завершаем работу
                    if (error.message.includes('Не удалось найти свободный порт')) {
                        logger.error('❌ Все доступные порты заняты. Невозможно запустить сервер.');
                        process.exit(1);
                    }
                    // Для других ошибок также завершаем, чтобы избежать бесконечной рекурсии
                    process.exit(1);
                });
            });
        } else {
            // Сервер не слушает, можно сразу перезапустить с offset
            const portOffset = WEB_PORT - DEFAULT_WEB_PORT + 1;
            startServer(portOffset).catch(error => {
                logger.error('❌ Критическая ошибка HTTP-сервера:', error);
                // Если findAvailablePort выбросил ошибку (все порты заняты), завершаем работу
                if (error.message.includes('Не удалось найти свободный порт')) {
                    logger.error('❌ Все доступные порты заняты. Невозможно запустить сервер.');
                    process.exit(1);
                }
                // Для других ошибок также завершаем, чтобы избежать бесконечной рекурсии
                process.exit(1);
            });
        }
    } else {
        logger.error('❌ Критическая ошибка HTTP-сервера:', err);
        process.exit(1);
    }
});

// Запускаем сервер
startServer();

process.on('uncaughtException', (err) => {
    logger.error('Необработанное исключение:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Необработанное отклонение промиса:', reason, promise);
});
