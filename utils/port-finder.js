/**
 * Утилита для проверки и поиска свободных портов
 * Используется для автоматического назначения портов в Node.js сервисах и Docker контейнерах
 */

const net = require('net');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Проверяет, доступен ли порт для прослушивания
 * @param {number} port - Порт для проверки
 * @returns {Promise<boolean>} - true если порт свободен, false если занят
 */
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false);
            } else {
                resolve(false);
            }
        });
        
        server.once('listening', () => {
            server.once('close', () => {
                resolve(true);
            });
            server.close();
        });
        
        server.listen(port);
    });
}

/**
 * Проверяет, используется ли порт Docker контейнером
 * @param {number} port - Порт для проверки
 * @returns {Promise<boolean>} - true если порт используется Docker, false если нет
 */
async function isPortUsedByDocker(port) {
    try {
        const { stdout } = await execAsync(`docker ps --format "{{.Ports}}" | grep ":${port}->" || echo ""`);
        return stdout.trim().length > 0;
    } catch (error) {
        // Если Docker недоступен, считаем что порт не используется Docker
        return false;
    }
}

/**
 * Проверяет, используется ли порт Node.js процессом
 * @param {number} port - Порт для проверки
 * @returns {Promise<boolean>} - true если порт используется Node.js, false если нет
 */
async function isPortUsedByNode(port) {
    try {
        if (process.platform === 'win32') {
            // На Windows проверяем только LISTENING порты
            const { stdout } = await execAsync(`netstat -ano | findstr "LISTENING" | findstr ":${port} " || echo ""`);
            return stdout.trim().length > 0;
        } else {
            const { stdout } = await execAsync(`lsof -i :${port} 2>/dev/null | grep LISTEN || echo ""`);
            return stdout.trim().length > 0;
        }
    } catch (error) {
        // Если команда не выполнилась, считаем что порт не используется Node.js
        return false;
    }
}

/**
 * Комплексная проверка доступности порта (Node.js + Docker)
 * @param {number} port - Порт для проверки
 * @returns {Promise<boolean>} - true если порт полностью свободен, false если занят
 */
async function isPortFullyAvailable(port) {
    // Проверяем через net.createServer (самый надежный способ)
    const netAvailable = await isPortAvailable(port);
    if (!netAvailable) {
        return false;
    }
    
    // Дополнительно проверяем Docker и Node.js процессы
    const dockerUsed = await isPortUsedByDocker(port);
    const nodeUsed = await isPortUsedByNode(port);
    
    return !dockerUsed && !nodeUsed;
}

/**
 * Находит следующий свободный порт начиная с указанного
 * @param {number} startPort - Начальный порт для поиска
 * @param {number} maxAttempts - Максимальное количество попыток (по умолчанию 100)
 * @param {boolean} checkDocker - Проверять ли использование порта Docker (по умолчанию true)
 * @returns {Promise<number>} - Свободный порт
 * @throws {Error} - Если не удалось найти свободный порт
 */
async function findAvailablePort(startPort = 3000, maxAttempts = 100, checkDocker = true) {
    // Ограничиваем максимальный порт значением 65535
    const maxPort = Math.min(startPort + maxAttempts - 1, 65535);
    const actualMaxAttempts = maxPort - startPort + 1;
    
    for (let i = 0; i < actualMaxAttempts; i++) {
        const port = startPort + i;
        
        // Пропускаем системные порты (0-1023) и известные зарезервированные
        if (port < 1024 && startPort >= 1024) {
            continue;
        }
        
        if (checkDocker) {
            const available = await isPortFullyAvailable(port);
            if (available) {
                return port;
            }
        } else {
            const available = await isPortAvailable(port);
            if (available) {
                return port;
            }
        }
    }
    
    throw new Error(`Не удалось найти свободный порт в диапазоне ${startPort}-${maxPort}`);
}

/**
 * Находит несколько свободных портов подряд
 * @param {number} startPort - Начальный порт для поиска
 * @param {number} count - Количество портов для поиска
 * @param {number} maxAttempts - Максимальное количество попыток
 * @returns {Promise<number[]>} - Массив свободных портов
 */
async function findAvailablePorts(startPort = 3000, count = 1, maxAttempts = 100) {
    const ports = [];
    let currentPort = startPort;
    
    for (let i = 0; i < count && ports.length < count; i++) {
        try {
            const port = await findAvailablePort(currentPort, maxAttempts, true);
            ports.push(port);
            currentPort = port + 1; // Следующий порт начинаем с найденного + 1
        } catch (error) {
            throw new Error(`Не удалось найти ${count} свободных портов, найдено только ${ports.length}`);
        }
    }
    
    return ports;
}

/**
 * Резервирует порт (создает временный сервер для блокировки порта)
 * @param {number} port - Порт для резервирования
 * @returns {Promise<net.Server>} - Сервер, который резервирует порт
 */
async function reservePort(port) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        
        server.once('error', (err) => {
            reject(new Error(`Не удалось зарезервировать порт ${port}: ${err.message}`));
        });
        
        server.listen(port, () => {
            resolve(server);
        });
    });
}

module.exports = {
    isPortAvailable,
    isPortUsedByDocker,
    isPortUsedByNode,
    isPortFullyAvailable,
    findAvailablePort,
    findAvailablePorts,
    reservePort
};

