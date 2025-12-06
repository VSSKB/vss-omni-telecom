const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const net = require('net');
const authDB = require('./database/auth-db');
const { findAvailablePort: findPort, isPortFullyAvailable } = require('./utils/port-finder');

const app = express();
const DEFAULT_PORT = 3000;
let PORT = DEFAULT_PORT;
// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Определения путей к директориям
const BASE_DIR = __dirname;
const PROJECTS_DIR = path.join(BASE_DIR, 'projects');
const DB_DATA_DIR = path.join(BASE_DIR, 'db_data');
const DOCKER_TEMPLATES_DIR = path.join(BASE_DIR, 'docker-templates');

// Путь к файлу с данными проектов
const PROJECTS_JSON_PATH = path.join(BASE_DIR, 'projects.json');

// --- Вспомогательные функции для работы с файлами и Docker ---

// Проверка и создание необходимых директорий
function ensureDirectoriesExist() {
    // Создаем основные директории
    [PROJECTS_DIR, DB_DATA_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Директория ${dir} создана.`);
        } else {
            console.log(`Директория ${dir} уже существует.`);
        }
    });

    // Проверка наличия и создание заглушек для шаблонов Docker
    const backendTemplatePath = path.join(DOCKER_TEMPLATES_DIR, 'backend');
    const frontendBuildSourcePath = path.join(DOCKER_TEMPLATES_DIR, 'frontend-app-template', 'build');

    // Если папки backend нет, создаем ее и пустые файлы-заглушки
    if (!fs.existsSync(backendTemplatePath)) {
        fs.mkdirSync(backendTemplatePath, { recursive: true });
        console.log(`Директория ${backendTemplatePath} создана.`);
        fs.writeFileSync(path.join(backendTemplatePath, 'app.js'), 'console.log("Backend placeholder is running!");');
        fs.writeFileSync(path.join(backendTemplatePath, 'package.json'), '{}');
        console.log(`Созданы файлы-заглушки в ${backendTemplatePath}.`);
    }

    // Если папки build для фронтенда нет, создаем ее и пустой index.html
    if (!fs.existsSync(frontendBuildSourcePath)) {
        fs.mkdirSync(frontendBuildSourcePath, { recursive: true });
        console.log(`Директория ${frontendBuildSourcePath} создана.`);
        fs.writeFileSync(path.join(frontendBuildSourcePath, 'index.html'), '<h1>Frontend application placeholder.</h1>');
        console.log(`Создан файл-заглушка в ${frontendBuildSourcePath}.`);
    }
}


// Проверка существования шаблонов Docker
function checkDockerTemplates() {
    const templates = [
        'backend.Dockerfile',
        'frontend.Dockerfile',
        'docker-compose.yml.template',
        'nginx.conf'
    ];
    let allTemplatesExist = true;
    templates.forEach(template => {
        const templatePath = path.join(DOCKER_TEMPLATES_DIR, template);
        if (!fs.existsSync(templatePath)) {
            console.error(`Ошибка: Шаблон Docker не найден: ${templatePath}`);
            allTemplatesExist = false;
        }
    });
    if (allTemplatesExist) {
        console.log('Основные шаблоны Docker проверены и готовы к использованию.');
    } else {
        console.error('Некоторые основные шаблоны Docker отсутствуют. Убедитесь, что они находятся в директории docker-templates.');
    }
}

// Вспомогательная функция для определения команды docker-compose
function getDockerComposeCommand() {
    try {
        execSync('docker-compose --version', { stdio: 'ignore' });
        return 'docker-compose';
    } catch (e) {
        try {
            execSync('docker compose version', { stdio: 'ignore' });
            return 'docker compose';
        } catch (e2) {
            return null; // Docker Compose не найден
        }
    }
}

// Кроссплатформенная функция копирования директорий
function copyDirectorySync(source, destination) {
    if (!fs.existsSync(source)) {
        throw new Error(`Исходная директория не существует: ${source}`);
    }

    // Создаем целевую директорию, если её нет
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }

    // Получаем список элементов в исходной директории
    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);

        if (entry.isDirectory()) {
            // Рекурсивно копируем поддиректории
            copyDirectorySync(sourcePath, destPath);
        } else {
            // Копируем файлы
            fs.copyFileSync(sourcePath, destPath);
        }
    }
}


// Функция запуска VSS DEMIURGE инфраструктуры
async function startVSSInfrastructure() {
    const composeCommand = getDockerComposeCommand();
    if (!composeCommand) {
        console.warn('[VSS] Docker Compose не найден. Пропускаем запуск VSS DEMIURGE инфраструктуры.');
        return false;
    }

    // Пробуем сначала полную версию, затем упрощенную
    let composeFile = path.join(BASE_DIR, 'docker-compose.vss-demiurge.yml');
    const simpleComposeFile = path.join(BASE_DIR, 'docker-compose.vss-demiurge-simple.yml');
    let useSimpleVersion = false;
    
    // Проверяем, есть ли флаг для использования упрощенной версии
    if (process.env.VSS_USE_SIMPLE === 'true' || !fs.existsSync(composeFile)) {
        useSimpleVersion = true;
    }
    
    if (useSimpleVersion) {
        if (fs.existsSync(simpleComposeFile)) {
            console.log('[VSS] Используется упрощенная версия (без Kamailio/Asterisk).');
            composeFile = simpleComposeFile;
        } else {
            console.warn('[VSS] docker-compose файлы не найдены. Пропускаем запуск VSS DEMIURGE.');
            return false;
        }
    }

    console.log(`[VSS] Используется файл: ${path.basename(composeFile)}`);
    console.log('[VSS] Проверка статуса VSS DEMIURGE инфраструктуры...');
    
    try {
        // Проверяем, запущены ли уже контейнеры
        const checkCmd = `${composeCommand} -f "${composeFile}" ps --format json`;
        const checkOutput = execSync(checkCmd, { encoding: 'utf8', cwd: BASE_DIR, stdio: 'pipe' });
        const containers = checkOutput.trim().split('\n').filter(line => line.trim()).map(line => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        }).filter(c => c);

        const runningContainers = containers.filter(c => c.State === 'running');
        
        if (runningContainers.length > 0) {
            console.log(`[VSS] Найдено ${runningContainers.length} запущенных контейнеров VSS DEMIURGE.`);
            console.log('[VSS] Инфраструктура уже запущена.');
            return true;
        }

        console.log(`[VSS] Запуск VSS DEMIURGE инфраструктуры (${path.basename(composeFile)})...`);
        
        // Запускаем все сервисы
        exec(`${composeCommand} -f "${composeFile}" up -d`, { 
            cwd: BASE_DIR,
            maxBuffer: 10 * 1024 * 1024 
        }, (error, stdout, stderr) => {
            if (error) {
                console.error('[VSS] Ошибка запуска инфраструктуры:', error.message);
                if (stderr) console.error('[VSS] stderr:', stderr);
                
                // Если ошибка связана с Kamailio/Asterisk и есть упрощенная версия - переключаемся
                const errorText = (stderr || error.message || '').toLowerCase();
                if (errorText && (errorText.includes('kamailio') || errorText.includes('asterisk') || errorText.includes('failed to solve')) && composeFile.includes('docker-compose.vss-demiurge.yml') && !composeFile.includes('simple')) {
                    const simpleComposeFile = path.join(BASE_DIR, 'docker-compose.vss-demiurge-simple.yml');
                    if (fs.existsSync(simpleComposeFile)) {
                        console.log('[VSS] Обнаружена ошибка сборки Kamailio/Asterisk. Переключаемся на упрощенную версию...');
                        // Устанавливаем флаг для использования упрощенной версии
                        process.env.VSS_USE_SIMPLE = 'true';
                        // Рекурсивно вызываем с упрощенной версией
                        setTimeout(() => {
                            startVSSInfrastructure();
                        }, 2000);
                        return;
                    }
                }
                return;
            }
            
            console.log('[VSS] VSS DEMIURGE инфраструктура запущена.');
            console.log('[VSS] Ожидание готовности сервисов...');
            
            // Ждем немного и проверяем статус
            setTimeout(() => {
                checkVSSInfrastructureStatus();
            }, 10000); // 10 секунд на запуск
        });
        
        return true;
    } catch (error) {
        console.error('[VSS] Ошибка при проверке статуса инфраструктуры:', error.message);
        return false;
    }
}

// Функция проверки статуса VSS инфраструктуры
function checkVSSInfrastructureStatus() {
    const composeCommand = getDockerComposeCommand();
    if (!composeCommand) return;

    // Пробуем сначала полную версию, затем упрощенную
    let composeFile = path.join(BASE_DIR, 'docker-compose.vss-demiurge.yml');
    const simpleComposeFile = path.join(BASE_DIR, 'docker-compose.vss-demiurge-simple.yml');
    if (!fs.existsSync(composeFile)) {
        if (fs.existsSync(simpleComposeFile)) {
            composeFile = simpleComposeFile;
        } else {
            return;
        }
    }

    try {
        const statusCmd = `${composeCommand} -f "${composeFile}" ps --format json`;
        const statusOutput = execSync(statusCmd, { encoding: 'utf8', cwd: BASE_DIR, stdio: 'pipe' });
        const containers = statusOutput.trim().split('\n').filter(line => line.trim()).map(line => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        }).filter(c => c);

        const running = containers.filter(c => c.State === 'running');
        const stopped = containers.filter(c => c.State !== 'running');

        console.log('\n[VSS] ==========================================');
        console.log('[VSS] Статус VSS DEMIURGE инфраструктуры:');
        console.log(`[VSS] Запущено: ${running.length} контейнеров`);
        if (stopped.length > 0) {
            console.log(`[VSS] Остановлено: ${stopped.length} контейнеров`);
        }
        console.log('[VSS] ==========================================');
        console.log('[VSS] Доступные сервисы:');
        console.log('  - WORKSPACE: http://localhost:3000');
        console.log('  - OTTB API: http://localhost:8083');
        console.log('  - DCI API: http://localhost:8082');
        console.log('  - POINT API: http://localhost:8081');
        console.log('  - Guacamole: http://localhost:8080/guacamole');
        console.log('  - RabbitMQ Management: http://localhost:15672');
        console.log('  - Grafana: http://localhost:3001');
        console.log('  - Prometheus: http://localhost:9090');
        console.log('[VSS] ==========================================\n');
    } catch (error) {
        console.error('[VSS] Ошибка при проверке статуса:', error.message);
    }
}

// Запуск начальных проверок при старте сервера
ensureDirectoriesExist();
checkDockerTemplates(); // Проверяет только файлы-шаблоны Dockerfile и docker-compose

// Инициализация файла projects.json, если его нет
if (!fs.existsSync(PROJECTS_JSON_PATH)) {
    fs.writeFileSync(PROJECTS_JSON_PATH, '[]', 'utf8');
    console.log(`Файл ${PROJECTS_JSON_PATH} создан.`);
}


// --- API Эндпоинты ---

// API для проверки зависимостей (Docker, Docker Compose, Node.js)
app.get('/api/check-dependencies', async (req, res) => {
    const results = {
        docker: { installed: false, version: '' },
        dockerCompose: { installed: false, version: '' },
        nodejs: { installed: false, version: '' },
        allDependenciesMet: false
    };

    const checkCommand = (cmd) => {
        try {
            const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
            return output;
        } catch (error) {
            console.error(`Ошибка выполнения команды "${cmd}": ${error.message}`);
            return null;
        }
    };

    // Проверка Docker
    const dockerVersion = checkCommand('docker --version');
    if (dockerVersion) {
        results.docker.installed = true;
        results.docker.version = dockerVersion.replace('Docker version ', '');
    }

    // Проверка Docker Compose (v1 и v2)
    let composeVersion = checkCommand('docker-compose --version'); // v1
    if (composeVersion) {
        results.dockerCompose.installed = true;
        results.dockerCompose.version = composeVersion.replace('docker-compose version ', '');
    } else {
        composeVersion = checkCommand('docker compose version --short'); // v2, если v1 не найден
        if (composeVersion) {
            results.dockerCompose.installed = true;
            results.dockerCompose.version = `v2.${composeVersion.trim()}`;
        }
    }

    // Проверка Node.js
    const nodeVersion = checkCommand('node -v');
    if (nodeVersion) {
        results.nodejs.installed = true;
        results.nodejs.version = nodeVersion;
    }

    results.allDependenciesMet = results.docker.installed && results.dockerCompose.installed && results.nodejs.installed;

    res.json(results);
});

// Функция проверки доступности порта (использует утилиту)
async function isPortAvailable(port) {
    return await isPortFullyAvailable(port);
}

// Функция проверки, используется ли порт в Docker контейнерах
async function isPortUsedByDocker(port) {
    try {
        // Проверяем все запущенные контейнеры
        const { execSync } = require('child_process');
        const output = execSync(`docker ps --format "{{.Ports}}"`, { encoding: 'utf8', stdio: 'pipe' });
        // Ищем порт в выводе (формат: "0.0.0.0:PORT->...")
        const portPattern = new RegExp(`:${port}[->]|:${port}\\s|0\\.0\\.0\\.0:${port}|\\[::\\]:${port}`);
        return portPattern.test(output);
    } catch (error) {
        // Если Docker недоступен, считаем что порт не используется Docker
        return false;
    }
}

// Функция проверки, используется ли порт в существующих проектах
function isPortUsedByProjects(port, excludeProjectId = null) {
    try {
        const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON_PATH, 'utf8') || '[]');
        for (const project of projects) {
            if (excludeProjectId && project.id === excludeProjectId) continue;
            if (project.ports) {
                const projectPorts = Object.values(project.ports);
                if (projectPorts.includes(port)) {
                    return true;
                }
            }
        }
        return false;
    } catch (error) {
        return false;
    }
}

// Функция поиска свободного порта (использует утилиту + проверка проектов)
async function findAvailablePort(startPort, maxAttempts = 1000, excludeProjectId = null) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const port = startPort + attempt;
        if (port > 65535) break;
        
        // Используем утилиту для проверки доступности порта (Node.js + Docker)
        const isAvailable = await isPortFullyAvailable(port);
        if (!isAvailable) continue;
        
        // Дополнительно проверяем, не используется ли порт в других проектах
        const isUsedByProjects = isPortUsedByProjects(port, excludeProjectId);
        if (isUsedByProjects) continue;
        
        return port;
    }
    throw new Error(`Не удалось найти свободный порт, начиная с ${startPort} после ${maxAttempts} попыток`);
}

// API для генерации свободных портов
app.get('/api/generate-ports', async (req, res) => {
    try {
        const getRandomStartPort = () => Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
        
        // Функция для поиска свободного порта с случайной начальной точки
        const findRandomAvailablePort = async (excludePorts = []) => {
            let attempts = 0;
            while (attempts < 100) {
                const startPort = getRandomStartPort();
                try {
                    const port = await findAvailablePort(startPort, 100);
                    if (!excludePorts.includes(port)) {
                        return port;
                    }
                } catch (e) {
                    // Продолжаем поиск
                }
                attempts++;
            }
            // Если не нашли случайный, ищем последовательно
            return await findAvailablePort(10000, 50000);
        };

        const ports = {};
        const usedPorts = [];

        // Nginx порт - проверяем начиная с 8080
        try {
            ports.nginx = await findAvailablePort(8080, 100);
            usedPorts.push(ports.nginx);
        } catch (e) {
            ports.nginx = await findRandomAvailablePort(usedPorts);
            usedPorts.push(ports.nginx);
        }

        // Остальные порты - ищем случайные свободные
        ports.backend = await findRandomAvailablePort(usedPorts);
        usedPorts.push(ports.backend);
        
        ports.frontend = await findRandomAvailablePort(usedPorts);
        usedPorts.push(ports.frontend);
        
        ports.mikopbx = await findRandomAvailablePort(usedPorts);
        usedPorts.push(ports.mikopbx);
        
        ports.db = await findRandomAvailablePort(usedPorts);
        usedPorts.push(ports.db);
        
        ports.rabbitmq = await findRandomAvailablePort(usedPorts);
        usedPorts.push(ports.rabbitmq);
        
        ports.rabbitmqMgmt = await findRandomAvailablePort(usedPorts);
        usedPorts.push(ports.rabbitmqMgmt);

        console.log(`[API] Сгенерированы свободные порты:`, ports);
        res.json(ports);
    } catch (error) {
        console.error('[API] Ошибка генерации портов:', error);
        res.status(500).json({ error: 'Не удалось найти свободные порты', message: error.message });
    }
});

// API для генерации проекта
app.post('/api/generate-project', async (req, res) => {
    const { projectName, ports, includeMikopbx, includePostgres, db } = req.body;

    if (!projectName || !ports) {
        return res.status(400).json({ message: 'Недостаточно данных для создания проекта.' });
    }

    // Проверяем и исправляем порты перед созданием проекта
    const validatedPorts = {};
    const usedPorts = [];
    
    try {
        // Вспомогательная функция для поиска случайного свободного порта
        const getRandomStartPort = () => Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
        const findRandomAvailablePort = async (excludePorts = []) => {
            let attempts = 0;
            while (attempts < 100) {
                const startPort = getRandomStartPort();
                try {
                    const port = await findAvailablePort(startPort, 100, null);
                    if (!excludePorts.includes(port)) {
                        return port;
                    }
                } catch (e) {
                    // Продолжаем поиск
                }
                attempts++;
            }
            // Если не нашли случайный, ищем последовательно
            return await findAvailablePort(10000, 50000, null);
        };

        // Валидация и поиск свободных портов
        const validateAndFindPort = async (portKey, defaultStartPort) => {
            const requestedPort = ports[portKey];
            if (requestedPort) {
                // Проверяем доступность запрошенного порта
                const isAvailable = await isPortAvailable(requestedPort);
                const isUsedByDocker = await isPortUsedByDocker(requestedPort);
                const isUsedByProjects = isPortUsedByProjects(requestedPort);
                
                if (isAvailable && !isUsedByDocker && !isUsedByProjects && !usedPorts.includes(requestedPort)) {
                    usedPorts.push(requestedPort);
                    return requestedPort;
                } else {
                    // Порт занят, ищем свободный
                    console.log(`[PROJECT] Порт ${requestedPort} для ${portKey} занят, ищем свободный...`);
                    const freePort = await findRandomAvailablePort(usedPorts);
                    usedPorts.push(freePort);
                    console.log(`[PROJECT] Найден свободный порт ${freePort} для ${portKey}`);
                    return freePort;
                }
            } else {
                // Порт не указан, ищем свободный
                const freePort = await findRandomAvailablePort(usedPorts);
                usedPorts.push(freePort);
                return freePort;
            }
        };

        validatedPorts.nginx = await validateAndFindPort('nginx', 8080);
        validatedPorts.backend = await validateAndFindPort('backend', 3000);
        validatedPorts.frontend = await validateAndFindPort('frontend', 3001);
        validatedPorts.mikopbx = await validateAndFindPort('mikopbx', 8081);
        validatedPorts.db = await validateAndFindPort('db', 5432);
        validatedPorts.rabbitmq = await validateAndFindPort('rabbitmq', 5672);
        validatedPorts.rabbitmqMgmt = await validateAndFindPort('rabbitmqMgmt', 15672);

        // Если порты изменились, логируем
        const portsChanged = Object.keys(ports).some(key => ports[key] !== validatedPorts[key]);
        if (portsChanged) {
            console.log(`[PROJECT] Некоторые порты были изменены из-за занятости:`);
            Object.keys(validatedPorts).forEach(key => {
                if (ports[key] && ports[key] !== validatedPorts[key]) {
                    console.log(`  ${key}: ${ports[key]} -> ${validatedPorts[key]}`);
                }
            });
        }
    } catch (error) {
        console.error('[PROJECT] Ошибка валидации портов:', error);
        return res.status(500).json({ 
            error: 'Не удалось найти свободные порты для проекта', 
            message: error.message 
        });
    }

    const projectId = uuidv4();
    const projectPath = path.join(PROJECTS_DIR, projectId);
    const backendTemplatePath = path.join(DOCKER_TEMPLATES_DIR, 'backend');
    const frontendTemplatePath = path.join(DOCKER_TEMPLATES_DIR, 'frontend-app-template');
    const dockerComposeTemplatePath = path.join(DOCKER_TEMPLATES_DIR, 'docker-compose.yml.template');
    const backendDockerfileTemplatePath = path.join(DOCKER_TEMPLATES_DIR, 'backend.Dockerfile');
    const frontendDockerfileTemplatePath = path.join(DOCKER_TEMPLATES_DIR, 'frontend.Dockerfile');
    const nginxConfTemplatePath = path.join(DOCKER_TEMPLATES_DIR, 'nginx.conf');

    try {
        // 1. Создание директории проекта
        fs.mkdirSync(projectPath, { recursive: true });

        // 2. Копирование шаблонов приложений
        // Копирование собранного фронтенда
        const frontendBuildSourcePath = path.join(frontendTemplatePath, 'build');
        const frontendDestPath = path.join(projectPath, 'frontend');
        if (fs.existsSync(frontendBuildSourcePath)) {
            copyDirectorySync(frontendBuildSourcePath, frontendDestPath);
        } else {
            console.warn(`Внимание: директория сборки фронтенда не найдена: ${frontendBuildSourcePath}. Создаем пустую директорию.`);
            fs.mkdirSync(frontendDestPath, { recursive: true });
            fs.writeFileSync(path.join(frontendDestPath, 'index.html'), '<h1>Frontend application not built.</h1>');
        }

        // Копирование backend (исходники)
        const backendDestPath = path.join(projectPath, 'backend');
        if (fs.existsSync(backendTemplatePath)) {
            copyDirectorySync(backendTemplatePath, backendDestPath);
        } else {
            console.warn(`Внимание: директория шаблона бэкенда не найдена: ${backendTemplatePath}. Создаем пустую директорию.`);
            fs.mkdirSync(backendDestPath, { recursive: true });
            fs.writeFileSync(path.join(backendDestPath, 'app.js'), 'console.log("Backend placeholder is running!");');
            fs.writeFileSync(path.join(backendDestPath, 'package.json'), '{}');
        }


        // 3. Копирование и модификация Dockerfile и docker-compose.yml.template
        let dockerComposeContent = fs.readFileSync(dockerComposeTemplatePath, 'utf8');
        let backendDockerfileContent = fs.readFileSync(backendDockerfileTemplatePath, 'utf8');
        let frontendDockerfileContent = fs.readFileSync(frontendDockerfileTemplatePath, 'utf8');
        let nginxConfContent = fs.readFileSync(nginxConfTemplatePath, 'utf8');

        // Замена плейсхолдеров
        // Важно: в шаблоне docker-compose.yml.template не должно быть {{PROJECT_ID}}
        // Используем валидированные порты
        dockerComposeContent = dockerComposeContent
            .replace(/{{NGINX_PORT}}/g, validatedPorts.nginx)
            .replace(/{{BACKEND_PORT}}/g, validatedPorts.backend)
            .replace(/{{FRONTEND_PORT}}/g, validatedPorts.frontend)
            .replace(/{{RABBITMQ_PORT}}/g, validatedPorts.rabbitmq || 5672)
            .replace(/{{RABBITMQ_MGMT_PORT}}/g, validatedPorts.rabbitmqMgmt || 15672);

        // Динамическое добавление сервисов MIKOPBX и POSTGRES
        let mikopbxService = '';
        if (includeMikopbx) {
            // Используем образ hello-world для теста, если mikopbx/miko-pbx недоступен
            // В реальном приложении: убедитесь, что образ mikopbx/miko-pbx доступен или используйте другой
            mikopbxService = `
  mikopbx:
    image: nginx:alpine
    ports:
      - "${validatedPorts.mikopbx}:80"
    restart: always
    # volumes:
    #   - ./mikopbx_data:/var/lib/mikopbx # Раскомментировать, если MikoPBX требует данных
`;
        }
        dockerComposeContent = dockerComposeContent.replace(/{{MIKOPBX_SERVICE}}/g, mikopbxService || ''); // Заменяем на пустую строку, если не включен

        let postgresService = '';
        if (includePostgres && db) {
            // Валидация и экранирование имени пользователя для безопасности
            const sanitizeDbUser = (username) => {
                // Разрешаем только буквы, цифры и подчеркивания
                if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                    throw new Error('Имя пользователя БД может содержать только буквы, цифры и подчеркивания');
                }
                return username;
            };
            
            // Экранирование пароля для YAML
            const escapeYamlString = (str) => {
                if (typeof str !== 'string') {
                    str = String(str);
                }
                // Экранируем специальные символы YAML
                // Если содержит специальные символы, оборачиваем в одинарные кавычки и экранируем их
                if (/[:#@`|>*&!%{}[\]\\"',\n\r]/.test(str)) {
                    // Экранируем одинарные кавычки удвоением
                    return "'" + str.replace(/'/g, "''") + "'";
                }
                // Если не содержит специальных символов, можно без кавычек, но для безопасности используем кавычки
                return "'" + str.replace(/'/g, "''") + "'";
            };
            
            // Валидация имени базы данных
            const sanitizeDbName = (dbName) => {
                if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
                    throw new Error('Имя базы данных может содержать только буквы, цифры и подчеркивания');
                }
                return dbName;
            };
            
            const safeDbUser = sanitizeDbUser(db.dbUser);
            const safeDbName = sanitizeDbName(db.dbName);
            const safeDbPassword = escapeYamlString(db.dbPassword);
            
            postgresService = `
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${safeDbName}
      POSTGRES_USER: ${safeDbUser}
      POSTGRES_PASSWORD: ${safeDbPassword}
    ports:
      - "${validatedPorts.db}:5432"
    restart: always
    volumes:
      - ./db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U '${safeDbUser.replace(/'/g, "''")}'"]
      interval: 10s
      timeout: 5s
      retries: 5
`;
        }
        dockerComposeContent = dockerComposeContent.replace(/{{POSTGRES_SERVICE}}/g, postgresService || ''); // Заменяем на пустую строку, если не включен


        // Удаляем устаревший атрибут version из docker-compose.yml (если есть)
        dockerComposeContent = dockerComposeContent.replace(/^version:\s*['"]3\.\d+['"]\s*\n\n?/m, '');

        // Сохранение модифицированных файлов
        fs.writeFileSync(path.join(projectPath, 'docker-compose.yml'), dockerComposeContent);
        fs.writeFileSync(path.join(projectPath, 'backend.Dockerfile'), backendDockerfileContent);
        fs.writeFileSync(path.join(projectPath, 'frontend.Dockerfile'), frontendDockerfileContent);
        fs.writeFileSync(path.join(projectPath, 'nginx.conf'), nginxConfContent);


        // 4. Сохранение метаданных проекта
        const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON_PATH, 'utf8') || '[]');
        projects.push({
            id: projectId,
            name: projectName,
            path: projectPath,
            status: 'stopped', // Изначально проект остановлен
            ports: validatedPorts,
            includeMikopbx,
            includePostgres,
            db: includePostgres && db ? { dbName: db.dbName, dbUser: db.dbUser, dbPort: validatedPorts.db } : undefined
        });
        fs.writeFileSync(PROJECTS_JSON_PATH, JSON.stringify(projects, null, 2));

        res.json({ message: 'Проект успешно сгенерирован!', projectId: projectId, projectName: projectName });

    } catch (error) {
        console.error('Ошибка при генерации проекта:', error);
        // Попробуйте очистить созданную директорию при ошибке
        if (fs.existsSync(projectPath)) {
            fs.rmSync(projectPath, { recursive: true, force: true });
        }
        res.status(500).json({ message: 'Ошибка сервера при генерации проекта.', error: error.message, stack: error.stack });
    }
});

// API для получения списка проектов
app.get('/api/projects', (req, res) => {
    try {
        if (!fs.existsSync(PROJECTS_JSON_PATH)) {
            return res.json([]);
        }
        const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON_PATH, 'utf8'));
        res.json(projects);
    } catch (error) {
        console.error('Ошибка чтения projects.json:', error);
        res.status(500).json({ message: 'Ошибка чтения списка проектов.' });
    }
});

// API для запуска проекта
app.post('/api/projects/:id/start', async (req, res) => {
    const projectId = req.params.id;
    const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON_PATH, 'utf8'));
    const project = projects.find(p => p.id === projectId);

    if (!project) {
        return res.status(404).json({ message: 'Проект не найден.' });
    }

    const projectPath = project.path;
    const dockerComposeFilePath = path.join(projectPath, 'docker-compose.yml');
    
    if (!fs.existsSync(dockerComposeFilePath)) {
        return res.status(404).json({ message: 'docker-compose.yml не найден для проекта.' });
    }

    const composeCommand = getDockerComposeCommand();
    if (!composeCommand) {
        return res.status(500).json({ message: 'Docker Compose не найден. Убедитесь, что Docker Compose установлен.' });
    }

    try {
        // Проверяем и исправляем порты в docker-compose.yml перед запуском
        let dockerComposeContent = fs.readFileSync(dockerComposeFilePath, 'utf8');
        let portsChanged = false;
        
        // Удаляем устаревший атрибут version
        if (dockerComposeContent.match(/^version:\s*['"]3\.\d+['"]\s*\n\n?/m)) {
            dockerComposeContent = dockerComposeContent.replace(/^version:\s*['"]3\.\d+['"]\s*\n\n?/m, '');
            portsChanged = true;
        }
        
        // Извлекаем порты из docker-compose.yml и проверяем их доступность
        // Ищем все строки с портами в формате: "PORT:PORT" или 'PORT:PORT' или PORT:PORT
        const portLinePattern = /-\s*["']?(\d+):(\d+)["']?/g;
        const portMappings = new Map(); // Map<oldPort, newPort>
        const allMatches = [];
        
        // Находим все порты в файле
        let match;
        while ((match = portLinePattern.exec(dockerComposeContent)) !== null) {
            const hostPort = parseInt(match[1]);
            const containerPort = match[2];
            if (hostPort && !allMatches.find(m => m.hostPort === hostPort)) {
                allMatches.push({ hostPort, containerPort, fullMatch: match[0] });
            }
        }
        
        // Проверяем каждый порт и создаем маппинг
        for (const portInfo of allMatches) {
            const hostPort = portInfo.hostPort;
            
            if (!portMappings.has(hostPort)) {
                // Проверяем доступность порта
                const isAvailable = await isPortAvailable(hostPort);
                const isUsedByDocker = await isPortUsedByDocker(hostPort);
                const isUsedByProjects = isPortUsedByProjects(hostPort, projectId);
                
                if (!isAvailable || isUsedByDocker || isUsedByProjects) {
                    // Порт занят, ищем свободный
                    console.log(`[PROJECT START] Порт ${hostPort} занят (available: ${isAvailable}, docker: ${isUsedByDocker}, projects: ${isUsedByProjects}), ищем свободный...`);
                    const freePort = await findAvailablePort(hostPort, 1000, projectId);
                    portMappings.set(hostPort, freePort);
                    console.log(`[PROJECT START] Порт ${hostPort} будет заменен на ${freePort}`);
                    portsChanged = true;
                } else {
                    // Порт свободен, оставляем как есть
                    portMappings.set(hostPort, hostPort);
                }
            }
        }
        
        // Заменяем все порты в docker-compose.yml
        for (const [oldPort, newPort] of portMappings.entries()) {
            if (oldPort !== newPort) {
                // Заменяем порт в разных форматах
                dockerComposeContent = dockerComposeContent.replace(
                    new RegExp(`"${oldPort}:`, 'g'),
                    `"${newPort}:`
                );
                dockerComposeContent = dockerComposeContent.replace(
                    new RegExp(`'${oldPort}:`, 'g'),
                    `'${newPort}:`
                );
                // Также заменяем без кавычек
                dockerComposeContent = dockerComposeContent.replace(
                    new RegExp(`(\\s|:)${oldPort}:`, 'g'),
                    `$1${newPort}:`
                );
                // Заменяем в переменных окружения, если есть
                dockerComposeContent = dockerComposeContent.replace(
                    new RegExp(`localhost:${oldPort}`, 'g'),
                    `localhost:${newPort}`
                );
                dockerComposeContent = dockerComposeContent.replace(
                    new RegExp(`http://localhost:${oldPort}`, 'g'),
                    `http://localhost:${newPort}`
                );
            }
        }
        
        // Сохраняем исправленный docker-compose.yml
        if (portsChanged) {
            fs.writeFileSync(dockerComposeFilePath, dockerComposeContent);
            console.log(`[PROJECT START] docker-compose.yml обновлен с исправленными портами`);
        }
    } catch (error) {
        console.error(`[PROJECT START] Ошибка при проверке портов:`, error);
        console.error(`[PROJECT START] Stack trace:`, error.stack);
        // Продолжаем запуск даже если проверка портов не удалась
    }

    try {
        // Шаг 1: Предварительная загрузка образов для избежания ошибок
        console.log(`[${projectId}] Загрузка Docker образов...`);
        try {
            execSync(`${composeCommand} -f "${dockerComposeFilePath}" pull`, { 
                cwd: projectPath,
                stdio: 'pipe',
                timeout: 300000 // 5 минут на загрузку образов
            });
        } catch (pullError) {
            // Игнорируем ошибки загрузки, так как образы могут быть уже загружены или собираться из Dockerfile
            console.warn(`[${projectId}] Предупреждение при загрузке образов: ${pullError.message}`);
        }

        // Шаг 2: Запуск проекта
        console.log(`[${projectId}] Запуск проекта...`);
        exec(`${composeCommand} -f "${dockerComposeFilePath}" up -d --build`, { 
            cwd: projectPath,
            maxBuffer: 10 * 1024 * 1024 // 10MB буфер
        }, (error, stdout, stderr) => {
            if (error) {
                console.error(`[${projectId}] Ошибка запуска проекта:`, error.message);
                
                // Парсим stderr для более понятного сообщения об ошибке
                let errorMessage = error.message;
                let errorDetails = stderr || '';
                
                // Обработка специфичных ошибок
                if (errorDetails.includes('unable to get image')) {
                    errorMessage = 'Ошибка загрузки Docker образа. Проверьте подключение к интернету и доступность Docker Hub.';
                    if (errorDetails.includes('postgres')) {
                        errorMessage += ' Проблема с образом PostgreSQL. Попробуйте запустить проект позже или проверьте сеть.';
                    }
                } else if (errorDetails.includes('port is already allocated')) {
                    errorMessage = 'Порт уже занят другим приложением. Остановите конфликтующее приложение или измените порты проекта.';
                } else if (errorDetails.includes('network') || errorDetails.includes('Network')) {
                    errorMessage = 'Ошибка создания Docker сети. Проверьте, что Docker запущен и работает корректно.';
                } else if (errorDetails.includes('build')) {
                    errorMessage = 'Ошибка сборки Docker образа. Проверьте Dockerfile и зависимости проекта.';
                }
                
                return res.status(500).json({ 
                    message: errorMessage,
                    details: errorDetails,
                    stdout: stdout
                });
            }
            
            project.status = 'running';
            fs.writeFileSync(PROJECTS_JSON_PATH, JSON.stringify(projects, null, 2));
            console.log(`[${projectId}] Проект успешно запущен.`);
            res.json({ 
                message: `Проект ${project.name || projectId} успешно запущен.`, 
                stdout, 
                stderr 
            });
        });
    } catch (syncError) {
        console.error(`[${projectId}] Синхронная ошибка при запуске проекта:`, syncError);
        return res.status(500).json({ 
            message: `Ошибка при подготовке к запуску проекта: ${syncError.message}` 
        });
    }
});

// API для остановки проекта
app.post('/api/projects/:id/stop', (req, res) => {
    const projectId = req.params.id;
    const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON_PATH, 'utf8'));
    const project = projects.find(p => p.id === projectId);

    if (!project) {
        return res.status(404).json({ message: 'Проект не найден.' });
    }

    const projectPath = project.path;
    const composeCommand = getDockerComposeCommand();
    if (!composeCommand) {
        return res.status(500).json({ message: 'Docker Compose не найден. Убедитесь, что Docker Compose установлен.' });
    }
    exec(`${composeCommand} -f "${path.join(projectPath, 'docker-compose.yml')}" down`, { cwd: projectPath }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Ошибка остановки проекта ${projectId}: ${error.message}`);
            return res.status(500).json({ message: `Ошибка остановки проекта: ${error.message}`, details: stderr });
        }
        project.status = 'stopped';
        fs.writeFileSync(PROJECTS_JSON_PATH, JSON.stringify(projects, null, 2));
        res.json({ message: `Проект ${projectId} успешно остановлен.`, stdout, stderr });
    });
});

// API для удаления проекта
app.delete('/api/projects/:id', (req, res) => {
    const projectId = req.params.id;
    let projects = JSON.parse(fs.readFileSync(PROJECTS_JSON_PATH, 'utf8'));
    const projectIndex = projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) {
        return res.status(404).json({ message: 'Проект не найден.' });
    }

    const projectToRemove = projects[projectIndex];
    const projectPath = projectToRemove.path;
    const dockerComposeFilePath = path.join(projectPath, 'docker-compose.yml');

    try {
        // Сначала останавливаем проект, если он запущен и docker-compose.yml существует
        if (fs.existsSync(dockerComposeFilePath)) {
            const composeCommand = getDockerComposeCommand();
            if (composeCommand) {
                execSync(`${composeCommand} -f "${dockerComposeFilePath}" down`, { stdio: 'ignore', encoding: 'utf8', cwd: projectPath });
            }
        } else {
            console.warn(`docker-compose.yml не найден для проекта ${projectId} по пути ${dockerComposeFilePath}. Пропускаем остановку Docker.`);
        }
        

        // Удаляем директорию проекта
        fs.rmSync(projectPath, { recursive: true, force: true });

        // Удаляем проект из списка
        projects.splice(projectIndex, 1);
        fs.writeFileSync(PROJECTS_JSON_PATH, JSON.stringify(projects, null, 2));

        res.json({ message: `Проект ${projectId} успешно удален.` });
    } catch (error) {
        console.error(`Ошибка при удалении проекта ${projectId}:`, error);
        res.status(500).json({ message: `Ошибка сервера при удалении проекта: ${error.message}`, error: error.message });
    }
});


// API для Docker Hub login
app.post('/api/docker-login', (req, res) => {
    const { username, password, registry } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: 'Имя пользователя и пароль обязательны.' });
    }
    
    const registryUrl = registry || 'https://index.docker.io/v1/';
    const loginCommand = `echo "${password}" | docker login ${registryUrl} -u "${username}" --password-stdin`;
    
    exec(loginCommand, { shell: true }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Ошибка входа в Docker Hub: ${error.message}`);
            return res.status(500).json({ 
                message: `Ошибка входа в Docker Hub: ${error.message}`, 
                details: stderr 
            });
        }
        
        // Сохраняем credentials в безопасном месте (опционально)
        const dockerConfigPath = path.join(BASE_DIR, '.docker-config.json');
        try {
            const config = {
                username: username,
                registry: registryUrl,
                loggedIn: true,
                lastLogin: new Date().toISOString()
            };
            fs.writeFileSync(dockerConfigPath, JSON.stringify(config, null, 2));
        } catch (configError) {
            console.warn('Не удалось сохранить конфигурацию Docker:', configError);
        }
        
        res.json({ 
            message: 'Успешный вход в Docker Hub', 
            stdout, 
            stderr,
            registry: registryUrl
        });
    });
});

// API для проверки статуса Docker login
app.get('/api/docker-login-status', (req, res) => {
    exec('docker info | grep -i "username" || echo ""', (error, stdout, stderr) => {
        const dockerConfigPath = path.join(BASE_DIR, '.docker-config.json');
        let config = null;
        
        try {
            if (fs.existsSync(dockerConfigPath)) {
                const configData = fs.readFileSync(dockerConfigPath, 'utf8');
                config = JSON.parse(configData);
            }
        } catch (configError) {
            console.warn('Ошибка чтения конфигурации Docker:', configError);
        }
        
        // Проверяем, есть ли активная сессия
        exec('docker system info 2>&1 | grep -i "username" || echo ""', (error, infoStdout) => {
            const isLoggedIn = !error && (stdout.trim() || infoStdout.trim() || (config && config.loggedIn));
            
            res.json({
                loggedIn: isLoggedIn,
                config: config ? {
                    username: config.username,
                    registry: config.registry,
                    lastLogin: config.lastLogin
                } : null
            });
        });
    });
});

// API для выхода из Docker Hub
app.post('/api/docker-logout', (req, res) => {
    const { registry } = req.body;
    const registryUrl = registry || 'https://index.docker.io/v1/';
    
    exec(`docker logout ${registryUrl}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Ошибка выхода из Docker Hub: ${error.message}`);
            return res.status(500).json({ 
                message: `Ошибка выхода из Docker Hub: ${error.message}`, 
                details: stderr 
            });
        }
        
        // Удаляем сохраненную конфигурацию
        const dockerConfigPath = path.join(BASE_DIR, '.docker-config.json');
        try {
            if (fs.existsSync(dockerConfigPath)) {
                fs.unlinkSync(dockerConfigPath);
            }
        } catch (configError) {
            console.warn('Не удалось удалить конфигурацию Docker:', configError);
        }
        
        res.json({ 
            message: 'Успешный выход из Docker Hub', 
            stdout, 
            stderr 
        });
    });
});

// API для загрузки Docker образа (глобально) с поддержкой авторизации
app.post('/api/pull-docker-image', (req, res) => {
    const { imageName } = req.body;
    if (!imageName) {
        return res.status(400).json({ message: 'Имя образа не указано.' });
    }

    // Проверяем, требуется ли авторизация для приватных образов
    const isPrivateImage = imageName.includes('/') && !imageName.startsWith('library/');
    
    // Выполняем pull
    exec(`docker pull ${imageName}`, (error, stdout, stderr) => {
        if (error) {
            // Если ошибка связана с авторизацией, предлагаем войти
            if (stderr && (stderr.includes('unauthorized') || stderr.includes('authentication required') || stderr.includes('pull access denied'))) {
                return res.status(401).json({ 
                    message: 'Требуется авторизация в Docker Hub. Пожалуйста, войдите в систему.',
                    requiresAuth: true,
                    details: stderr 
                });
            }
            
            console.error(`Ошибка загрузки образа ${imageName}: ${error.message}`);
            return res.status(500).json({ 
                message: `Ошибка загрузки образа: ${error.message}`, 
                details: stderr 
            });
        }
        res.json({ message: `Образ ${imageName} успешно загружен.`, stdout, stderr });
    });
});

// API для получения логов проекта
app.get('/api/projects/:id/logs', (req, res) => {
    const projectId = req.params.id;
    const { service, tail = '100' } = req.query; // tail - количество последних строк логов
    
    try {
        const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON_PATH, 'utf8'));
        const project = projects.find(p => p.id === projectId);

        if (!project) {
            return res.status(404).json({ message: 'Проект не найден.' });
        }

        const projectPath = project.path;
        const dockerComposeFilePath = path.join(projectPath, 'docker-compose.yml');

        if (!fs.existsSync(dockerComposeFilePath)) {
            return res.status(404).json({ message: 'docker-compose.yml не найден для проекта.' });
        }

        // Получаем имя проекта для docker-compose (используем имя директории или ID проекта)
        const projectDirName = path.basename(projectPath).replace(/[^a-zA-Z0-9_-]/g, '_');
        
        // Определяем, какая версия docker-compose доступна
        const composeCommand = getDockerComposeCommand();
        if (!composeCommand) {
            return res.status(500).json({ message: 'Docker Compose не найден. Убедитесь, что Docker Compose установлен.' });
        }
        
        // Валидация и санитизация параметра service для предотвращения command injection
        const sanitizeServiceName = (serviceName) => {
            if (!serviceName) {
                return null;
            }
            // Разрешаем только буквы, цифры, дефисы и подчеркивания
            if (!/^[a-zA-Z0-9_-]+$/.test(serviceName)) {
                throw new Error('Недопустимое имя сервиса. Разрешены только буквы, цифры, дефисы и подчеркивания.');
            }
            return serviceName;
        };
        
        // Валидация параметра tail
        const sanitizeTail = (tailValue) => {
            const tailNum = parseInt(tailValue, 10);
            if (isNaN(tailNum) || tailNum < 1 || tailNum > 10000) {
                return '100'; // Значение по умолчанию
            }
            return String(tailNum);
        };
        
        const safeTail = sanitizeTail(tail);
        let safeService = null;
        
        if (service) {
            try {
                safeService = sanitizeServiceName(service);
            } catch (error) {
                return res.status(400).json({ message: error.message });
            }
        }
        
        // Формируем команду для получения логов
        let logCommand;
        if (safeService) {
            // Логи конкретного сервиса - используем безопасное имя
            logCommand = `${composeCommand} -f "${dockerComposeFilePath}" -p "${projectDirName}" logs --tail=${safeTail} ${safeService}`;
        } else {
            // Логи всех сервисов
            logCommand = `${composeCommand} -f "${dockerComposeFilePath}" -p "${projectDirName}" logs --tail=${safeTail}`;
        }

        try {
            const logs = execSync(logCommand, { 
                encoding: 'utf8', 
                cwd: projectPath,
                maxBuffer: 10 * 1024 * 1024, // 10MB буфер для больших логов
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            res.json({ 
                projectId: projectId,
                service: service || 'all',
                logs: logs,
                timestamp: new Date().toISOString()
            });
        } catch (execError) {
            // Если контейнеры не запущены, возвращаем пустые логи
            if (execError.message.includes('No such service') || execError.message.includes('not found')) {
                return res.json({ 
                    projectId: projectId,
                    service: service || 'all',
                    logs: 'Контейнеры не запущены или сервис не найден.',
                    timestamp: new Date().toISOString()
                });
            }
            throw execError;
        }
    } catch (error) {
        console.error(`Ошибка получения логов проекта ${projectId}:`, error);
        res.status(500).json({ message: `Ошибка получения логов: ${error.message}` });
    }
});

// API для обработки входа в админку проекта
app.post('/api/admin-login', async (req, res) => {
    const { username, password, role, projectId, adminUrl } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Имя пользователя и пароль обязательны.' 
        });
    }
    
    try {
        // Убеждаемся, что база данных инициализирована
        try {
            if (authDB.ensureInitialized) {
                await authDB.ensureInitialized();
            } else if (!authDB.db) {
                console.log('[AUTH] База данных не инициализирована, инициализируем...');
                await authDB.init();
            }
        } catch (initError) {
            console.error('[AUTH] Ошибка инициализации базы данных:', initError);
            console.error('[AUTH] Stack:', initError.stack);
            return res.status(500).json({
                success: false,
                message: 'Ошибка инициализации базы данных. Попробуйте позже.'
            });
        }
        
        // Получаем IP адрес и User-Agent для логирования
        const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        
        // Аутентифицируем пользователя
        const user = await authDB.authenticateUser(username, password, ipAddress, userAgent);
        
        // Проверяем роль, если указана
        if (role && user.role !== role) {
            // Проверяем, имеет ли пользователь права на указанную роль
            const roleHierarchy = {
                'admin': ['admin', 'supervisor', 'operator', 'seller'],
                'supervisor': ['supervisor', 'operator', 'seller'],
                'operator': ['operator', 'seller'],
                'seller': ['seller']
            };
            
            if (!roleHierarchy[user.role] || !roleHierarchy[user.role].includes(role)) {
                return res.status(403).json({
                    success: false,
                    message: `У вас нет прав для доступа с ролью "${role}". Ваша роль: "${user.role}"`
                });
            }
        }
        
        // Создаем сессию
        const session = await authDB.createSession(user.id, projectId, ipAddress, userAgent, 24);
        const dashboardUrl = `/dashboard${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`;
        
        res.json({
            success: true,
            message: 'Успешный вход',
            redirectUrl: dashboardUrl,
            sessionId: session.sessionId,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                fullName: user.full_name
            },
            adminUrl: adminUrl || null,
            projectId: projectId || null
        });
    } catch (error) {
        console.error('[AUTH] Ошибка аутентификации:', error);
        console.error('[AUTH] Stack trace:', error.stack);
        
        // Более детальное сообщение об ошибке
        let errorMessage = error.message || 'Ошибка аутентификации';
        
        // Если это ошибка базы данных, даем более понятное сообщение
        if (error.message && (error.message.includes('SQLITE') || error.message.includes('database'))) {
            errorMessage = 'Ошибка базы данных. Проверьте логи сервера.';
        }
        
        const statusCode = error.message && error.message.includes('база данных') ? 500 : 401;
        
        res.status(statusCode).json({
            success: false,
            message: errorMessage
        });
    }
});

// API для регистрации нового пользователя
app.post('/api/admin-register', async (req, res) => {
    const { username, password, role = 'operator', email, fullName } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Имя пользователя и пароль обязательны.'
        });
    }
    
    try {
        const user = await authDB.registerUser(username, password, role, email, fullName);
        res.json({
            success: true,
            message: 'Пользователь успешно зарегистрирован',
            user: user
        });
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Ошибка регистрации'
        });
    }
});

// API для проверки сессии
app.get('/api/admin-session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
        const session = await authDB.validateSession(sessionId);
        if (session) {
            res.json({
                success: true,
                session: session
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Сессия недействительна или истекла'
            });
        }
    } catch (error) {
        console.error('Ошибка проверки сессии:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка проверки сессии'
        });
    }
});

// API для выхода
app.post('/api/admin-logout', async (req, res) => {
    const { sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({
            success: false,
            message: 'ID сессии обязателен'
        });
    }
    
    try {
        await authDB.deleteSession(sessionId);
        res.json({
            success: true,
            message: 'Успешный выход'
        });
    } catch (error) {
        console.error('Ошибка выхода:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка выхода'
        });
    }
});

// API для получения списка пользователей
app.get('/api/admin-users', async (req, res) => {
    try {
        const users = await authDB.getAllUsers();
        res.json({
            success: true,
            users: users
        });
    } catch (error) {
        console.error('Ошибка получения списка пользователей:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения списка пользователей'
        });
    }
});

// API для получения информации о проекте (включая URL админки)
app.get('/api/projects/:id/info', (req, res) => {
    const projectId = req.params.id;
    
    try {
        const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON_PATH, 'utf8'));
        const project = projects.find(p => p.id === projectId);

        if (!project) {
            return res.status(404).json({ message: 'Проект не найден.' });
        }

        // Формируем URL админки (через nginx порт)
        const adminUrl = `http://localhost:${project.ports.nginx}`;
        
        // Получаем список сервисов из docker-compose
        const dockerComposeFilePath = path.join(project.path, 'docker-compose.yml');
        let services = [];
        
        if (fs.existsSync(dockerComposeFilePath)) {
            try {
                const composeContent = fs.readFileSync(dockerComposeFilePath, 'utf8');
                // Простой парсинг сервисов из docker-compose.yml
                const serviceMatches = composeContent.match(/^\s+(\w+):/gm);
                if (serviceMatches) {
                    services = serviceMatches.map(match => match.trim().replace(':', ''));
                }
            } catch (parseError) {
                console.warn(`Ошибка парсинга docker-compose.yml для проекта ${projectId}:`, parseError);
            }
        }

        res.json({
            id: project.id,
            name: project.name,
            status: project.status,
            ports: project.ports,
            adminUrl: adminUrl,
            services: services,
            path: project.path,
            settings: project.settings || {}
        });
    } catch (error) {
        console.error(`Ошибка получения информации о проекте ${projectId}:`, error);
        res.status(500).json({ message: `Ошибка получения информации: ${error.message}` });
    }
});

// API для получения настроек проекта
app.get('/api/projects/:id/settings', (req, res) => {
    const projectId = req.params.id;
    
    try {
        const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON_PATH, 'utf8'));
        const project = projects.find(p => p.id === projectId);

        if (!project) {
            return res.status(404).json({ message: 'Проект не найден.' });
        }

        res.json({
            adb: project.settings?.adb || {
                enabled: false,
                path: process.platform === 'win32' ? 'adb.exe' : 'adb',
                port: 5037,
                autoStart: false
            },
            ...(project.settings || {})
        });
    } catch (error) {
        console.error(`Ошибка получения настроек проекта ${projectId}:`, error);
        res.status(500).json({ message: `Ошибка получения настроек: ${error.message}` });
    }
});

// API для сохранения настроек проекта
app.put('/api/projects/:id/settings', (req, res) => {
    const projectId = req.params.id;
    const { adb, ...otherSettings } = req.body;
    
    try {
        const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON_PATH, 'utf8'));
        const projectIndex = projects.findIndex(p => p.id === projectId);

        if (projectIndex === -1) {
            return res.status(404).json({ message: 'Проект не найден.' });
        }

        // Инициализируем settings, если его нет
        if (!projects[projectIndex].settings) {
            projects[projectIndex].settings = {};
        }

        // Обновляем настройки ADB
        if (adb !== undefined) {
            projects[projectIndex].settings.adb = {
                enabled: adb.enabled !== undefined ? adb.enabled : false,
                path: adb.path || (process.platform === 'win32' ? 'adb.exe' : 'adb'),
                port: adb.port || 5037,
                autoStart: adb.autoStart !== undefined ? adb.autoStart : false
            };
        }

        // Обновляем другие настройки
        if (otherSettings && Object.keys(otherSettings).length > 0) {
            projects[projectIndex].settings = {
                ...projects[projectIndex].settings,
                ...otherSettings
            };
        }

        // Сохраняем обновленные проекты
        fs.writeFileSync(PROJECTS_JSON_PATH, JSON.stringify(projects, null, 2), 'utf8');

        res.json({ 
            message: 'Настройки проекта успешно сохранены.',
            settings: projects[projectIndex].settings
        });
    } catch (error) {
        console.error(`Ошибка сохранения настроек проекта ${projectId}:`, error);
        res.status(500).json({ message: `Ошибка сохранения настроек: ${error.message}` });
    }
});

// API для управления VSS DEMIURGE инфраструктурой
app.post('/api/vss-infrastructure/start', (req, res) => {
    startVSSInfrastructure().then(success => {
        if (success) {
            res.json({ message: 'VSS DEMIURGE инфраструктура запускается...' });
        } else {
            res.status(500).json({ message: 'Не удалось запустить инфраструктуру. Проверьте логи.' });
        }
    });
});

app.get('/api/vss-infrastructure/status', (req, res) => {
    const composeCommand = getDockerComposeCommand();
    if (!composeCommand) {
        return res.status(500).json({ message: 'Docker Compose не найден' });
    }

    // Пробуем сначала полную версию, затем упрощенную
    let composeFile = path.join(BASE_DIR, 'docker-compose.vss-demiurge.yml');
    const simpleComposeFile = path.join(BASE_DIR, 'docker-compose.vss-demiurge-simple.yml');
    if (!fs.existsSync(composeFile)) {
        if (fs.existsSync(simpleComposeFile)) {
            composeFile = simpleComposeFile;
        } else {
            return res.status(404).json({ message: 'docker-compose файлы не найдены' });
        }
    }

    try {
        const statusCmd = `${composeCommand} -f "${composeFile}" ps --format json`;
        const statusOutput = execSync(statusCmd, { encoding: 'utf8', cwd: BASE_DIR, stdio: 'pipe' });
        const containers = statusOutput.trim().split('\n').filter(line => line.trim()).map(line => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        }).filter(c => c);

        const running = containers.filter(c => c.State === 'running');
        const stopped = containers.filter(c => c.State !== 'running');

        res.json({
            total: containers.length,
            running: running.length,
            stopped: stopped.length,
            containers: containers.map(c => ({
                name: c.Name,
                state: c.State,
                status: c.Status
            }))
        });
    } catch (error) {
        res.status(500).json({ message: `Ошибка получения статуса: ${error.message}` });
    }
});

app.post('/api/vss-infrastructure/stop', (req, res) => {
    const composeCommand = getDockerComposeCommand();
    if (!composeCommand) {
        return res.status(500).json({ message: 'Docker Compose не найден' });
    }

    // Пробуем сначала полную версию, затем упрощенную
    let composeFile = path.join(BASE_DIR, 'docker-compose.vss-demiurge.yml');
    const simpleComposeFile = path.join(BASE_DIR, 'docker-compose.vss-demiurge-simple.yml');
    if (!fs.existsSync(composeFile)) {
        if (fs.existsSync(simpleComposeFile)) {
            composeFile = simpleComposeFile;
        } else {
            return res.status(404).json({ message: 'docker-compose файлы не найдены' });
        }
    }

    exec(`${composeCommand} -f "${composeFile}" down`, { cwd: BASE_DIR }, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ message: `Ошибка остановки: ${error.message}`, details: stderr });
        }
        res.json({ message: 'VSS DEMIURGE инфраструктура остановлена.', stdout, stderr });
    });
});

// API для создания пользователя VSS
app.post('/api/create-vss-user', async (req, res) => {
    const { username, password, projectId } = req.body;
    if (!username || !password || !projectId) {
        return res.status(400).json({ message: 'Имя пользователя, пароль и ID проекта обязательны.' });
    }

    try {
        // Получаем информацию о проекте
        const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON_PATH, 'utf8') || '[]');
        const project = projects.find(p => p.id === projectId);
        
        if (!project) {
            return res.status(404).json({ message: 'Проект не найден для создания пользователя.' });
        }

        // Проверяем, запущен ли проект
        if (project.status !== 'running') {
            return res.status(400).json({ 
                message: `Проект ${projectId} не запущен. Запустите проект перед созданием пользователя.` 
            });
        }

        // Вызываем API бэкенда проекта для создания пользователя
        const vssApiUrl = `http://localhost:${project.ports.backend}/api/vss-users`;
        
        try {
            const fetch = (await import('node-fetch')).default;
            const vssApiResponse = await fetch(vssApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                timeout: 10000 // 10 секунд таймаут
            });

            if (!vssApiResponse.ok) {
                const errorText = await vssApiResponse.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { message: errorText || 'Неизвестная ошибка' };
                }
                return res.status(vssApiResponse.status).json({ 
                    message: `Ошибка VSS API: ${errorData.message || 'Не удалось создать пользователя'}` 
                });
            }

            const vssResult = await vssApiResponse.json();
            res.json({ 
                message: `Пользователь ${username} успешно создан в проекте ${projectId}.`,
                details: vssResult
            });
        } catch (fetchError) {
            // Если fetch не доступен, используем встроенный http/https
            const http = require('http');
            const url = require('url');
            
            return new Promise((resolve) => {
                const parsedUrl = url.parse(vssApiUrl);
                const postData = JSON.stringify({ username, password });
                
                const options = {
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port || 80,
                    path: parsedUrl.path,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    },
                    timeout: 10000
                };

                const req = http.request(options, (response) => {
                    let data = '';
                    response.on('data', (chunk) => { data += chunk; });
                    response.on('end', () => {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            try {
                                const result = JSON.parse(data);
                                resolve(res.json({ 
                                    message: `Пользователь ${username} успешно создан в проекте ${projectId}.`,
                                    details: result
                                }));
                            } catch {
                                resolve(res.json({ 
                                    message: `Пользователь ${username} успешно создан в проекте ${projectId}.`
                                }));
                            }
                        } else {
                            resolve(res.status(response.statusCode).json({ 
                                message: `Ошибка VSS API: ${data || 'Не удалось создать пользователя'}` 
                            }));
                        }
                    });
                });

                req.on('error', (error) => {
                    console.error(`[CREATE-VSS-USER] Ошибка запроса к бэкенду проекта:`, error);
                    resolve(res.status(500).json({ 
                        message: `Ошибка связи с бэкендом проекта: ${error.message}. Убедитесь, что проект запущен.` 
                    }));
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve(res.status(500).json({ 
                        message: 'Таймаут при обращении к бэкенду проекта. Проверьте, что проект запущен и доступен.' 
                    }));
                });

                req.write(postData);
                req.end();
            });
        }
    } catch (error) {
        console.error(`[CREATE-VSS-USER] Ошибка при создании пользователя в VSS для проекта ${projectId}:`, error);
        res.status(500).json({ 
            message: `Ошибка при создании пользователя: ${error.message}` 
        });
    }
});


// Маршрут для загрузки отдельной страницы дашборда
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Функция для проверки доступности порта
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

// Функция для поиска свободного порта для основного сервера (использует утилиту)
async function findAvailablePortForServer(startPort = DEFAULT_PORT, maxAttempts = 10000) {
    // Ищем в широком диапазоне, начиная с указанного порта
    try {
        return await findPort(startPort, maxAttempts, true);
    } catch (error) {
        // Если не нашли в основном диапазоне, пробуем с другого места
        console.log(`⚠️  Не удалось найти порт в диапазоне ${startPort}-${startPort + maxAttempts - 1}, пробуем другой диапазон...`);
        try {
            // Пробуем с порта 10000
            return await findPort(10000, 50000, true);
        } catch (error2) {
            // Если и это не помогло, пробуем с 49152 (динамические порты)
            console.log(`⚠️  Пробуем диапазон динамических портов (49152-65535)...`);
            return await findPort(49152, 16383, true);
        }
    }
}

// Запуск сервера с автоматическим поиском свободного порта
async function startServer() {
    try {
        // Пытаемся найти свободный порт
        PORT = await findAvailablePortForServer(DEFAULT_PORT);
        
        if (PORT !== DEFAULT_PORT) {
            console.log(`⚠️  Порт ${DEFAULT_PORT} занят. Используется порт ${PORT}`);
        }
        
        app.listen(PORT, () => {
            console.log('\n==========================================');
            console.log('VSS OMNI TELECOM - Install Wizard');
            console.log('==========================================');
            console.log(`Сервер запущен на http://localhost:${PORT}`);
            console.log(`Откройте http://localhost:${PORT} в вашем браузере.`);
            console.log(`Для быстрого доступа к управлению проектами: http://localhost:${PORT}/dashboard`);
            console.log('==========================================\n');
            
            // Автоматический запуск VSS DEMIURGE инфраструктуры
            console.log('[VSS] Инициализация VSS DEMIURGE инфраструктуры...');
            startVSSInfrastructure().then(success => {
                if (success) {
                    // Проверяем статус инфраструктуры через 5 секунд после запуска
                    setTimeout(() => {
                        checkVSSInfrastructureStatus();
                    }, 5000);
                } else {
                    console.log('[VSS] Инфраструктура не запущена автоматически. Используйте API для ручного запуска.');
                }
            });
        });
    } catch (error) {
        console.error('❌ Ошибка запуска сервера:', error.message);
        process.exit(1);
    }
}

// Запускаем сервер
startServer();
