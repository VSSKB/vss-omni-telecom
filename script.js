const express = require('express');
const path = require('path');
const { exec, execFile } = require('child_process');
const fs = require('fs').promises;
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg'); // Для работы с PostgreSQL
const bcrypt = require('bcrypt'); // Для хеширования паролей

const app = express();
const PORT = 3000;
const PROJECTS_DIR = path.join(__dirname, 'projects');
const VSS_APP_DIR = __dirname; // Корневая директория вашего приложения VSS

// Middleware для обработки JSON-запросов
app.use(express.json());
// Статический сервер для фронтенд-файлов
app.use(express.static(path.join(__dirname, 'public')));

// Убедимся, что директория для проектов существует
fs.mkdir(PROJECTS_DIR, { recursive: true }).catch(console.error);

// --- Вспомогательные функции ---

/**
 * Проверяет доступность порта.
 * @param {number} port - Номер порта.
 * @returns {Promise<boolean>} - True, если порт свободен, иначе False.
 */
async function isPortAvailable(port) {
    return new Promise((resolve) => {
        const net = require('net');
        const tester = net.createServer()
            .once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(false);
                } else {
                    resolve(false); // Другие ошибки тоже означают, что порт недоступен
                }
            })
            .once('listening', () => {
                tester.once('close', () => {
                    resolve(true);
                }).close();
            })
            .listen(port);
    });
}

/**
 * Генерирует свободный порт в заданном диапазоне.
 * @param {number} startPort - Начальный порт диапазона.
 * @param {number} endPort - Конечный порт диапазона.
 * @returns {Promise<number|null>} - Свободный порт или null, если не найдено.
 */
async function generateFreePort(startPort, endPort) {
    for (let port = startPort; port <= endPort; port++) {
        if (await isPortAvailable(port)) {
            return port;
        }
    }
    return null;
}

/**
 * Получает IP-адреса хоста.
 * @returns {object} - Объект с publicIp и internalIp.
 */
async function getHostIps() {
    let publicIp = '127.0.0.1'; // По умолчанию localhost
    let internalIp = '127.0.0.1';

    try {
        const networkInterfaces = os.networkInterfaces();
        for (const interfaceName in networkInterfaces) {
            for (const iface of networkInterfaces[interfaceName]) {
                // Игнорируем внутренние и не IPv4 адреса
                if ('IPv4' !== iface.family || iface.internal !== false) {
                    continue;
                }
                // Для упрощения, первый найденный не-internal IPv4 берем как публичный/основной
                // В реальных сценариях может потребоваться более сложная логика
                if (iface.address && iface.address !== '127.0.0.1' && !iface.address.startsWith('169.254.')) {
                    if (!publicIp || iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || iface.address.startsWith('172.16.')) {
                        internalIp = iface.address; // Приватный IP
                    } else {
                        publicIp = iface.address; // Предположительно публичный IP
                    }
                }
            }
        }

        // Если публичный IP не найден, но есть внутренний, используем внутренний как публичный
        if (publicIp === '127.0.0.1' && internalIp !== '127.0.0.1') {
            publicIp = internalIp;
        }

    } catch (error) {
        console.error('Ошибка при получении IP-адресов:', error);
    }
    return { publicIp, internalIp };
}

/**
 * Загружает конфигурацию проекта по его ID.
 * @param {string} projectId - ID проекта.
 * @returns {Promise<object|null>} - Объект проекта с конфигом и путем, или null если не найден.
 */
async function getProjectConfigById(projectId) {
    const projectDirs = await fs.readdir(PROJECTS_DIR);

    for (const dir of projectDirs) {
        const configPath = path.join(PROJECTS_DIR, dir, 'config.json');
        try {
            const configContent = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configContent);
            if (config.id === projectId) {
                return { id: projectId, path: path.join(PROJECTS_DIR, dir), config: config };
            }
        } catch (error) {
            // Игнорируем ошибки чтения/парсинга, если файл не является валидным config.json
            console.warn(`Не удалось прочитать или распарсить config.json в ${dir}: ${error.message}`);
        }
    }
    return null; // Проект не найден
}


// --- API Маршруты ---

/**
 * Проверка зависимостей (Docker, Docker Compose, Node.js, npm).
 */
app.post('/api/check-deps', (req, res) => {
    const checks = {
        docker: false,
        dockerCompose: false,
        node: false,
        npm: false
    };

    exec('docker --version', (error) => {
        if (!error) checks.docker = true;
        exec('docker compose version', (errorCompose) => { // 'docker compose' вместо 'docker-compose'
            if (!errorCompose) checks.dockerCompose = true;
            exec('node -v', (errorNode) => {
                if (!errorNode) checks.node = true;
                exec('npm -v', (errorNpm) => {
                    if (!errorNpm) checks.npm = true;
                    res.json(checks);
                });
            });
        });
    });
});

/**
 * Генерация свободных портов для веб-приложения, API, Nginx и MikoPBX.
 */
app.post('/api/generate-ports', async (req, res) => {
    try {
        const webAppPort = await generateFreePort(8080, 8100);
        const apiPort = await generateFreePort(3000, 3020);
        const nginxHostPort = await generateFreePort(80, 100); // Порты 80, 443 обычно
        const mikopbxHostPort = await generateFreePort(8080, 8100);

        if (!webAppPort || !apiPort || !nginxHostPort || !mikopbxHostPort) {
            return res.status(500).json({ success: false, message: 'Не удалось найти все свободные порты.' });
        }

        res.json({
            success: true,
            ports: { webAppPort, apiPort, nginxHostPort, mikopbxHostPort }
        });
    } catch (error) {
        console.error('Ошибка при генерации портов:', error);
        res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера.', error: error.message });
    }
});

/**
 * Получение IP-адресов хоста.
 */
app.get('/api/get-host-ips', async (req, res) => {
    try {
        const ips = await getHostIps();
        res.json({ success: true, ...ips });
    } catch (error) {
        console.error('Ошибка при получении IP-адресов хоста:', error);
        res.status(500).json({ success: false, message: 'Не удалось получить IP-адреса хоста.', error: error.message });
    }
});

/**
 * Генерация конфигурации Docker Compose и файлов проекта.
 */
app.post('/api/generate-config', async (req, res) => {
    const config = req.body;
    const projectId = uuidv4();
    const projectNameSlug = config.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const projectDirName = `${projectNameSlug}-${projectId.substring(0, 8)}`;
    const projectPath = path.join(PROJECTS_DIR, projectDirName);

    try {
        await fs.mkdir(projectPath, { recursive: true });

        // Сохраняем полную конфигурацию
        await fs.writeFile(path.join(projectPath, 'config.json'), JSON.stringify({ id: projectId, ...config }, null, 2));

        // Копируем Dockerfiles и nginx.conf из vss-app/docker-templates
        const dockerTemplatesPath = path.join(VSS_APP_DIR, 'docker-templates');
        await fs.copyFile(path.join(dockerTemplatesPath, 'Dockerfile.backend'), path.join(projectPath, 'Dockerfile.backend'));
        await fs.copyFile(path.join(dockerTemplatesPath, 'Dockerfile.frontend'), path.join(projectPath, 'Dockerfile.frontend'));
        await fs.copyFile(path.join(dockerTemplatesPath, 'nginx.conf'), path.join(projectPath, 'nginx.conf'));

        // Создание docker-compose.yml
        const composeContent = `
version: '3.8'

services:
  db:
    image: ${config.dbImage}
    environment:
      POSTGRES_DB: ${config.dbName}
      POSTGRES_USER: ${config.dbUser}
      POSTGRES_PASSWORD: ${config.dbPassword}
    volumes:
      - db_data:/var/lib/postgresql/data
    restart: unless-stopped

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "${config.apiPort}:3000" # Порт хоста:Порт контейнера
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://${config.dbUser}:${config.dbPassword}@db:${config.databasePort}/${config.dbName}
      AMI_HOST: ${config.amiHost}
      AMI_PORT: ${config.amiPort}
      AMI_USER: ${config.amiUser}
      AMI_PASSWORD: ${config.amiPassword}
      PUBLIC_IP: ${config.publicIp}
      INTERNAL_IP: ${config.internalIp}
      NGINX_HOST_PORT: ${config.nginxHostPort}
      MIKOPBX_HOST_PORT: ${config.mikopbxHostPort}
    depends_on:
      - db
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "${config.webAppPort}:80" # Порт хоста:Порт контейнера
    environment:
      # Если ваш фронтенд обращается к API по доменному имени или IP:
      REACT_APP_API_URL: http://${config.publicIp}:${config.apiPort} # Пример
    depends_on:
      - backend
    restart: unless-stopped

  nginx:
    image: ${config.nginxImage}
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "${config.nginxHostPort}:80" # Порт хоста:Порт контейнера
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

  mikopbx:
    image: ${config.mikopbxImage}
    ports:
      - "${config.mikopbxHostPort}:80" # Порт хоста:Порт контейнера
    environment:
      # Пример переменных окружения для MikoPBX, если они нужны
      MIKOPBX_DB_HOST: db # Если MikoPBX должен использовать общую БД
      MIKOPBX_DB_NAME: ${config.dbName}
      MIKOPBX_DB_USER: ${config.dbUser}
      MIKOPBX_DB_PASSWORD: ${config.dbPassword}
    depends_on:
      - db
    restart: unless-stopped

volumes:
  db_data:
`;
        await fs.writeFile(path.join(projectPath, 'docker-compose.yml'), composeContent);

        res.json({ success: true, message: 'Проект успешно сгенерирован!', projectId: projectId });

    } catch (error) {
        console.error('Ошибка при генерации проекта:', error);
        res.status(500).json({ success: false, message: 'Ошибка при генерации проекта.', error: error.message });
    }
});

/**
 * Получение списка всех сгенерированных проектов.
 */
app.get('/api/projects', async (req, res) => {
    try {
        const projects = [];
        const projectDirs = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });

        for (const dirent of projectDirs) {
            if (dirent.isDirectory()) {
                const configPath = path.join(PROJECTS_DIR, dirent.name, 'config.json');
                try {
                    const configContent = await fs.readFile(configPath, 'utf8');
                    const config = JSON.parse(configContent);
                    projects.push({
                        id: config.id,
                        name: config.projectName,
                        path: path.join(PROJECTS_DIR, dirent.name),
                        config: config // Включаем всю конфигурацию
                    });
                } catch (readError) {
                    console.warn(`Не удалось прочитать или распарсить config.json в ${dirent.name}:`, readError.message);
                }
            }
        }
        res.json({ success: true, projects });
    } catch (error) {
        console.error('Ошибка при получении списка проектов:', error);
        res.status(500).json({ success: false, message: 'Не удалось получить список проектов.', error: error.message });
    }
});

/**
 * Запуск Docker Compose для проекта.
 */
app.post('/api/run-docker-compose', (req, res) => {
    const { projectPath } = req.body;
    if (!projectPath) {
        return res.status(400).json({ success: false, message: 'Путь к проекту не указан.' });
    }

    exec(`docker compose -f ${path.join(projectPath, 'docker-compose.yml')} up -d --build`, { cwd: projectPath }, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).json({ success: false, message: `Ошибка запуска Docker Compose: ${error.message}`, error: stderr });
        }
        res.json({ success: true, message: `Docker Compose успешно запущен для ${projectPath}`, stdout });
    });
});

/**
 * Остановка Docker Compose для проекта.
 */
app.post('/api/stop-docker-compose', (req, res) => {
    const { projectPath } = req.body;
    if (!projectPath) {
        return res.status(400).json({ success: false, message: 'Путь к проекту не указан.' });
    }

    exec(`docker compose -f ${path.join(projectPath, 'docker-compose.yml')} down -v`, { cwd: projectPath }, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).json({ success: false, message: `Ошибка остановки Docker Compose: ${error.message}`, error: stderr });
        }
        res.json({ success: true, message: `Docker Compose успешно остановлен для ${projectPath}`, stdout });
    });
});

/**
 * Получение статуса контейнеров Docker Compose для проекта.
 */
app.get('/api/get-project-status', (req, res) => {
    const { projectPath } = req.query;
    if (!projectPath) {
        return res.status(400).json({ success: false, message: 'Путь к проекту не указан.' });
    }

    exec(`docker compose -f ${path.join(projectPath, 'docker-compose.yml')} ps --format "{{.Service}}\t{{.Status}}"`, { cwd: projectPath }, (error, stdout, stderr) => {
        if (error) {
            // Если docker-compose.yml не найден или другие ошибки, вернуть пустой статус
            if (stderr.includes('no such file or directory') || stderr.includes('No such file or directory')) {
                return res.json({ success: true, status: [], message: 'Docker Compose файл не найден или проект не запущен.' });
            }
            console.error(`exec error: ${error}`);
            return res.status(500).json({ success: false, message: `Ошибка получения статуса: ${error.message}`, error: stderr });
        }
        const lines = stdout.trim().split('\n').filter(line => line.length > 0);
        const status = lines.map(line => {
            const parts = line.split('\t');
            return { service: parts[0], status: parts[1] };
        });
        res.json({ success: true, status });
    });
});

/**
 * Удаление проекта (директории и томов Docker Compose).
 */
app.post('/api/delete-project', async (req, res) => {
    const { projectPath } = req.body;
    if (!projectPath) {
        return res.status(400).json({ success: false, message: 'Путь к проекту не указан.' });
    }

    try {
        // Сначала останавливаем и удаляем контейнеры/тома Docker Compose
        await new Promise((resolve, reject) => {
            exec(`docker compose -f ${path.join(projectPath, 'docker-compose.yml')} down -v`, { cwd: projectPath }, (error, stdout, stderr) => {
                if (error && !stderr.includes('no such file or directory')) { // Игнорируем ошибку, если файла уже нет
                    console.warn(`Warning: Could not stop or remove docker compose services for ${projectPath}: ${error.message}`);
                    // return reject(new Error(`Failed to stop and remove Docker services: ${error.message}`));
                    // Продолжаем попытку удаления директории даже если Docker Compose не удалил сервисы
                }
                resolve();
            });
        });

        // Затем удаляем саму директорию проекта
        await fs.rm(projectPath, { recursive: true, force: true });
        res.json({ success: true, message: `Проект ${projectPath} успешно удален.` });
    } catch (error) {
        console.error('Ошибка при удалении проекта:', error);
        res.status(500).json({ success: false, message: `Ошибка при удалении проекта: ${error.message}`, error: error.message });
    }
});

// --- API для управления пользователями (ПРИМЕРЫ - ТРЕБУЕТСЯ АДАПТАЦИЯ К ВАШЕЙ БД VSS) ---

/**
 * API для создания пользователя VSS-приложения (администратор, оператор, супервизор).
 * ЭТО ПРИМЕР, ТРЕБУЕТСЯ АДАПТАЦИЯ К ВАШЕЙ СХЕМЕ БД VSS!
 * Также, подключение к БД должно использовать параметры конкретного проекта.
 */
app.post('/api/create-vss-user', async (req, res) => {
    const { projectId, role, login, password } = req.body;

    if (!projectId || !role || !login || !password) {
        return res.status(400).json({ success: false, message: 'Все поля (projectId, role, login, password) обязательны.' });
    }

    try {
        // 1. Загрузить конфигурацию проекта по projectId
        const project = await getProjectConfigById(projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Проект не найден.' });
        }

        // 2. Сформировать параметры подключения к БД для этого проекта
        const dbConfig = {
            user: project.config.dbUser,
            host: '127.0.0.1', // Ваш Node.js сервер подключается к БД на хосте
            // Важно: если PostgreSQL запущен в Docker, то вам нужно будет
            // обеспечить доступ к нему с хоста (проброс порта)
            // ИЛИ запускать этот server.js внутри того же docker network
            // Что усложнит инсталлятор. Проще: пробрасывать порт Postgres
            // из Docker на хост и подключаться к нему как к '127.0.0.1:ПОРТ_ХОСТА_ДБ'
            database: project.config.dbName,
            password: project.config.dbPassword,
            port: project.config.databasePort, // Порт на хосте, если проброшен
        };

        const pool = new Pool(dbConfig);
        const client = await pool.connect();

        // 3. Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. SQL-запрос для вставки пользователя
        // !!! ЭТО ПРИМЕР, ВАША СХЕМА БД МОЖЕТ ОТЛИЧАТЬСЯ !!!
        let query = '';
        if (role === 'admin') {
            query = `INSERT INTO users (login, password_hash, role) VALUES ($1, $2, 'admin')`;
        } else if (role === 'operator') {
            query = `INSERT INTO users (login, password_hash, role) VALUES ($1, $2, 'operator')`;
        } else if (role === 'supervisor') {
            query = `INSERT INTO users (login, password_hash, role) VALUES ($1, $2, 'supervisor')`;
        } else {
            return res.status(400).json({ success: false, message: 'Неизвестная роль пользователя.' });
        }

        await client.query(query, [login, hashedPassword]);
        client.release();
        await pool.end(); // Важно: закрыть пул, если это временное соединение

        res.json({ success: true, message: `Пользователь ${login} (${role}) успешно создан в БД VSS.` });

    } catch (error) {
        console.error(`Ошибка создания пользователя VSS:`, error);
        res.status(500).json({
            success: false,
            message: `Ошибка создания пользователя VSS: ${error.message}. Убедитесь, что база данных запущена и доступна, а таблицы пользователей существуют.`,
            error: error.message
        });
    }
});

/**
 * API для получения информации о доступе к MikoPBX.
 * Требуется projectId для получения порта MikoPBX, который был сгенерирован для этого проекта.
 */
app.get('/api/get-mikopbx-info', async (req, res) => {
    const { projectId } = req.query;

    if (!projectId) {
        return res.status(400).json({ success: false, message: 'Требуется ID проекта.' });
    }

    try {
        const project = await getProjectConfigById(projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Проект не найден.' });
        }

        const mikopbxHostPort = project.config.mikopbxHostPort;
        const publicIp = project.config.publicIp;
        const mikopbxUrl = `http://${publicIp}:${mikopbxHostPort}`;

        res.json({ success: true, url: mikopbxUrl, port: mikopbxHostPort });
    } catch (error) {
        console.error(`Ошибка получения информации MikoPBX:`, error);
        res.status(500).json({ success: false, message: `Ошибка получения информации MikoPBX: ${error.message}`, error: error.message });
    }
});


// Запуск сервера
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Open your browser at http://localhost:${PORT}`);
});
