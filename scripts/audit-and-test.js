#!/usr/bin/env node
/**
 * VSS Infrastructure Audit and Test Suite
 * Полный аудит инфраструктуры и набор тестов
 */

const http = require('http');
const https = require('https');
const net = require('net');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs');
const path = require('path');

// Цвета для консоли
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Результаты тестов
const testResults = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
};

// Конфигурация сервисов для проверки
const services = {
    rabbitmq: { port: 5672, name: 'RabbitMQ', type: 'tcp' },
    rabbitmqMgmt: { port: 15672, name: 'RabbitMQ Management', type: 'http', path: '/' },
    postgres: { port: 5432, name: 'PostgreSQL', type: 'tcp' },
    redis: { port: 6379, name: 'Redis', type: 'tcp' },
    workspace: { port: 3000, name: 'VSS Workspace', type: 'http', path: '/health' },
    ottb: { port: 8083, name: 'VSS OTTB', type: 'http', path: '/health' },
    dci: { port: 8082, name: 'VSS DCI', type: 'http', path: '/health' },
    point: { port: 8081, name: 'VSS POINT', type: 'http', path: '/health' },
    guacamole: { port: 8080, name: 'Guacamole', type: 'http', path: '/' },
    nginx: { port: 80, name: 'Nginx', type: 'http', path: '/' },
    prometheus: { port: 9090, name: 'Prometheus', type: 'http', path: '/api/v1/status/config' },
    grafana: { port: 3001, name: 'Grafana', type: 'http', path: '/api/health' },
    adminBackend: { port: 8181, name: 'Admin Backend', type: 'http', path: '/' }
};

// Утилиты
function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, status, message = '') {
    const statusColor = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
    const statusSymbol = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    log(`${statusSymbol} [${status}] ${name}${message ? ': ' + message : ''}`, statusColor);
    
    testResults.tests.push({ name, status, message });
    if (status === 'PASS') testResults.passed++;
    else if (status === 'FAIL') testResults.failed++;
    else testResults.warnings++;
}

// Проверка доступности порта (TCP)
function checkPort(host, port, timeout = 5000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let resolved = false;

        const onError = () => {
            if (!resolved) {
                resolved = true;
                socket.destroy();
                resolve(false);
            }
        };

        socket.setTimeout(timeout);
        socket.once('timeout', onError);
        socket.once('error', onError);
        socket.once('connect', () => {
            if (!resolved) {
                resolved = true;
                socket.destroy();
                resolve(true);
            }
        });

        socket.connect(port, host);
    });
}

// Проверка HTTP/HTTPS эндпоинта
function checkHttp(host, port, path = '/', timeout = 5000) {
    return new Promise((resolve) => {
        const options = {
            hostname: host,
            port: port,
            path: path,
            method: 'GET',
            timeout: timeout
        };

        const req = http.request(options, (res) => {
            resolve(res.statusCode >= 200 && res.statusCode < 500);
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

// Тест 1: Проверка Docker
async function testDocker() {
    try {
        const { stdout } = await execAsync('docker --version');
        const version = stdout.trim();
        logTest('Docker установлен', 'PASS', version);
        return true;
    } catch (error) {
        logTest('Docker установлен', 'FAIL', 'Docker не найден');
        return false;
    }
}

// Тест 2: Проверка Docker Compose
async function testDockerCompose() {
    try {
        let stdout;
        try {
            stdout = (await execAsync('docker-compose --version')).stdout;
        } catch {
            stdout = (await execAsync('docker compose version')).stdout;
        }
        const version = stdout.trim();
        logTest('Docker Compose установлен', 'PASS', version);
        return true;
    } catch (error) {
        logTest('Docker Compose установлен', 'FAIL', 'Docker Compose не найден');
        return false;
    }
}

// Тест 3: Проверка Node.js
async function testNodeJS() {
    try {
        const { stdout } = await execAsync('node -v');
        const version = stdout.trim();
        logTest('Node.js установлен', 'PASS', version);
        return true;
    } catch (error) {
        logTest('Node.js установлен', 'FAIL', 'Node.js не найден');
        return false;
    }
}

// Тест 4: Проверка доступности сервисов
async function testServices() {
    log('\n📡 Проверка доступности сервисов...', 'cyan');
    
    for (const [key, service] of Object.entries(services)) {
        let available = false;
        
        if (service.type === 'tcp') {
            available = await checkPort('localhost', service.port);
        } else if (service.type === 'http') {
            available = await checkHttp('localhost', service.port, service.path);
        }
        
        if (available) {
            logTest(`${service.name} (порт ${service.port})`, 'PASS', 'Доступен');
        } else {
            logTest(`${service.name} (порт ${service.port})`, 'WARN', 'Недоступен');
        }
    }
}

// Тест 5: Проверка Docker контейнеров
async function testDockerContainers() {
    log('\n🐳 Проверка Docker контейнеров...', 'cyan');
    
    try {
        const { stdout } = await execAsync('docker ps --format "{{.Names}}\t{{.Status}}"');
        const containers = stdout.trim().split('\n').filter(line => line.trim());
        
        if (containers.length === 0) {
            logTest('Docker контейнеры', 'WARN', 'Нет запущенных контейнеров');
            return;
        }
        
        const vssContainers = containers.filter(c => c.includes('vss-') || c.includes('rabbitmq') || c.includes('postgres') || c.includes('redis'));
        
        if (vssContainers.length > 0) {
            logTest('VSS контейнеры запущены', 'PASS', `${vssContainers.length} контейнеров`);
            vssContainers.forEach(container => {
                const [name, status] = container.split('\t');
                log(`   - ${name}: ${status}`, 'green');
            });
        } else {
            logTest('VSS контейнеры запущены', 'WARN', 'VSS контейнеры не найдены');
        }
    } catch (error) {
        logTest('Docker контейнеры', 'FAIL', error.message);
    }
}

// Тест 6: Проверка подключения к PostgreSQL
async function testPostgreSQL() {
    log('\n🗄️  Проверка PostgreSQL...', 'cyan');
    
    try {
        let pg;
        try {
            pg = require('pg');
        } catch (error) {
            logTest('PostgreSQL подключение', 'WARN', 'Модуль pg не установлен. Установите: npm install pg');
            return;
        }
        
        const { Pool } = pg;
        const pool = new Pool({
            host: 'localhost',
            port: 5432,
            database: 'vss_db',
            user: 'vss',
            password: 'vss_postgres_pass',
            connectionTimeoutMillis: 5000
        });
        
        const result = await pool.query('SELECT version()');
        const version = result.rows[0].version;
        logTest('PostgreSQL подключение', 'PASS', version.split(',')[0]);
        await pool.end();
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            logTest('PostgreSQL подключение', 'WARN', 'Сервис не запущен или недоступен');
        } else {
            logTest('PostgreSQL подключение', 'WARN', error.message);
        }
    }
}

// Тест 7: Проверка подключения к Redis
async function testRedis() {
    log('\n🔴 Проверка Redis...', 'cyan');
    
    try {
        let redis;
        try {
            redis = require('redis');
        } catch (error) {
            logTest('Redis подключение', 'WARN', 'Модуль redis не установлен. Установите: npm install redis');
            return;
        }
        
        const client = redis.createClient({
            socket: {
                host: 'localhost',
                port: 6379,
                connectTimeout: 5000
            }
        });
        
        await client.connect();
        const pong = await client.ping();
        if (pong === 'PONG') {
            logTest('Redis подключение', 'PASS', 'PONG получен');
        } else {
            logTest('Redis подключение', 'WARN', 'Неожиданный ответ');
        }
        await client.quit();
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
            logTest('Redis подключение', 'WARN', 'Сервис не запущен или недоступен');
        } else {
            logTest('Redis подключение', 'WARN', error.message);
        }
    }
}

// Тест 8: Проверка подключения к RabbitMQ
async function testRabbitMQ() {
    log('\n🐰 Проверка RabbitMQ...', 'cyan');
    
    try {
        let amqp;
        try {
            amqp = require('amqplib');
        } catch (error) {
            logTest('RabbitMQ подключение', 'WARN', 'Модуль amqplib не установлен. Установите: npm install amqplib');
            return;
        }
        
        const connection = await Promise.race([
            amqp.connect('amqp://vss-admin:vss_rabbit_pass@localhost:5672/vss', {
                heartbeat: 10,
                connection_timeout: 5000
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 5000)
            )
        ]);
        
        const channel = await connection.createChannel();
        logTest('RabbitMQ подключение', 'PASS', 'Подключено успешно');
        await channel.close();
        await connection.close();
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
            logTest('RabbitMQ подключение', 'WARN', 'Сервис не запущен или недоступен');
        } else {
            logTest('RabbitMQ подключение', 'WARN', error.message);
        }
    }
}

// Тест 9: Проверка API эндпоинтов
async function testAPIEndpoints() {
    log('\n🌐 Проверка API эндпоинтов...', 'cyan');
    
    const endpoints = [
        { name: 'Workspace Health', url: 'http://localhost:3000/health' },
        { name: 'OTTB Health', url: 'http://localhost:8083/health' },
        { name: 'DCI Health', url: 'http://localhost:8082/health' },
        { name: 'POINT Health', url: 'http://localhost:8081/health' }
    ];
    
    for (const endpoint of endpoints) {
        try {
            const available = await checkHttp('localhost', new URL(endpoint.url).port, new URL(endpoint.url).pathname);
            if (available) {
                logTest(endpoint.name, 'PASS', 'Доступен');
            } else {
                logTest(endpoint.name, 'WARN', 'Недоступен');
            }
        } catch (error) {
            logTest(endpoint.name, 'WARN', error.message);
        }
    }
}

// Тест 10: Проверка файлов конфигурации
async function testConfigFiles() {
    log('\n📋 Проверка файлов конфигурации...', 'cyan');
    
    const configFiles = [
        'docker-compose.vss-demiurge.yml',
        'config/rabbitmq/rabbitmq.conf',
        'config/postgresql/postgresql.conf',
        'config/redis/redis.conf',
        'config/nginx/nginx-vss.conf',
        'config/prometheus/prometheus.yml'
    ];
    
    for (const file of configFiles) {
        const filePath = path.join(__dirname, '..', file);
        if (fs.existsSync(filePath)) {
            logTest(`Конфиг: ${file}`, 'PASS', 'Существует');
        } else {
            logTest(`Конфиг: ${file}`, 'WARN', 'Не найден');
        }
    }
}

// Тест 11: Проверка портов на занятость
async function testPortAvailability() {
    log('\n🔌 Проверка доступности портов...', 'cyan');
    
    const requiredPorts = [3000, 8081, 8082, 8083, 5432, 6379, 5672, 15672, 80, 8080];
    const occupiedPorts = [];
    
    for (const port of requiredPorts) {
        const available = await checkPort('localhost', port);
        if (available) {
            logTest(`Порт ${port}`, 'PASS', 'Доступен');
        } else {
            logTest(`Порт ${port}`, 'WARN', 'Занят');
            occupiedPorts.push(port);
        }
    }
    
    if (occupiedPorts.length > 0) {
        log(`\n⚠️  Занятые порты: ${occupiedPorts.join(', ')}`, 'yellow');
        log('   Это нормально, если сервисы уже запущены', 'yellow');
    }
}

// Тест 12: Проверка переменных окружения
async function testEnvironmentVariables() {
    log('\n🔧 Проверка переменных окружения...', 'cyan');
    
    const envVars = [
        'RABBITMQ_URL',
        'POSTGRES_URL',
        'REDIS_URL',
        'NODE_ENV'
    ];
    
    for (const envVar of envVars) {
        if (process.env[envVar]) {
            logTest(`ENV: ${envVar}`, 'PASS', 'Установлена');
        } else {
            logTest(`ENV: ${envVar}`, 'WARN', 'Не установлена (используется значение по умолчанию)');
        }
    }
}

// Главная функция аудита
async function runAudit() {
    log('\n' + '='.repeat(60), 'bright');
    log('🔍 VSS INFRASTRUCTURE AUDIT & TEST SUITE', 'bright');
    log('='.repeat(60) + '\n', 'bright');
    
    // Базовые проверки
    log('📦 Проверка зависимостей...', 'cyan');
    await testDocker();
    await testDockerCompose();
    await testNodeJS();
    
    // Проверка портов
    await testPortAvailability();
    
    // Проверка конфигурации
    await testConfigFiles();
    await testEnvironmentVariables();
    
    // Проверка Docker контейнеров
    await testDockerContainers();
    
    // Проверка сервисов
    await testServices();
    
    // Проверка подключений
    await testPostgreSQL();
    await testRedis();
    await testRabbitMQ();
    
    // Проверка API
    await testAPIEndpoints();
    
    // Итоги
    log('\n' + '='.repeat(60), 'bright');
    log('📊 РЕЗУЛЬТАТЫ АУДИТА', 'bright');
    log('='.repeat(60), 'bright');
    log(`✅ Пройдено: ${testResults.passed}`, 'green');
    log(`❌ Провалено: ${testResults.failed}`, 'red');
    log(`⚠️  Предупреждений: ${testResults.warnings}`, 'yellow');
    log('='.repeat(60) + '\n', 'bright');
    
    // Рекомендации
    if (testResults.failed > 0) {
        log('⚠️  Обнаружены критические проблемы. Рекомендуется их исправить перед запуском.', 'yellow');
        return false;
    } else if (testResults.warnings > 0) {
        log('ℹ️  Обнаружены предупреждения. Система может работать, но некоторые функции могут быть недоступны.', 'yellow');
        return true;
    } else {
        log('✅ Все проверки пройдены успешно! Инфраструктура готова к работе.', 'green');
        return true;
    }
}

// Запуск
if (require.main === module) {
    runAudit()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            log(`\n❌ Критическая ошибка: ${error.message}`, 'red');
            console.error(error);
            process.exit(1);
        });
}

module.exports = { runAudit };

