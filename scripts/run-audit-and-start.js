#!/usr/bin/env node
/**
 * VSS Infrastructure Audit and Start
 * Полный аудит и запуск проекта
 */

const { execSync, spawn } = require('child_process');
const net = require('net');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Принудительно устанавливаем кодировку для Windows
if (process.platform === 'win32') {
    try {
        execSync('chcp 65001 >nul 2>&1', { shell: true });
    } catch {}
}

console.log('\n============================================================');
console.log('VSS INFRASTRUCTURE AUDIT & TEST SUITE');
console.log('============================================================\n');

let passed = 0, failed = 0, warnings = 0;

function test(name, fn) {
    try {
        const result = fn();
        if (result === true) {
            console.log(`✅ ${name}`);
            passed++;
            return true;
        } else if (result === false) {
            console.log(`⚠️  ${name} - предупреждение`);
            warnings++;
            return false;
        }
    } catch (error) {
        console.log(`❌ ${name} - ${error.message}`);
        failed++;
        return false;
    }
}

function checkPort(port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);
        socket.once('error', () => resolve(false));
        socket.once('timeout', () => { socket.destroy(); resolve(false); });
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.connect(port, 'localhost');
    });
}

// Тест 1: Docker
console.log('📦 Проверка зависимостей:\n');
test('Docker установлен', () => {
    try {
        const version = execSync('docker --version', { encoding: 'utf8' }).trim();
        console.log(`   ${version}`);
        return true;
    } catch { return false; }
});

test('Docker Compose установлен', () => {
    try {
        try {
            const version = execSync('docker-compose --version', { encoding: 'utf8' }).trim();
            console.log(`   ${version}`);
        } catch {
            const version = execSync('docker compose version', { encoding: 'utf8' }).trim();
            console.log(`   ${version}`);
        }
        return true;
    } catch { return false; }
});

test('Node.js установлен', () => {
    try {
        const version = execSync('node -v', { encoding: 'utf8' }).trim();
        console.log(`   ${version}`);
        return true;
    } catch { return false; }
});

// Тест 2-11: Проверка портов
console.log('\n📡 Проверка портов:\n');
const ports = [
    { port: 3000, name: 'VSS Workspace' },
    { port: 8083, name: 'VSS OTTB' },
    { port: 8082, name: 'VSS DCI' },
    { port: 8081, name: 'VSS POINT' },
    { port: 8181, name: 'Admin Backend' },
    { port: 5432, name: 'PostgreSQL' },
    { port: 6379, name: 'Redis' },
    { port: 5672, name: 'RabbitMQ' },
    { port: 15672, name: 'RabbitMQ Management' },
    { port: 80, name: 'Nginx' }
];

(async () => {
    for (const { port, name } of ports) {
        const available = await checkPort(port);
        test(`${name} (порт ${port})`, () => available);
    }
    
    // Тест 12: Docker контейнеры
    console.log('\n🐳 Проверка Docker контейнеров:\n');
    test('VSS контейнеры', () => {
        try {
            const output = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
            const containers = output.trim().split('\n').filter(c => c.includes('vss-') || c.includes('rabbitmq') || c.includes('postgres') || c.includes('redis'));
            if (containers.length > 0) {
                console.log(`   Найдено ${containers.length} контейнеров:`);
                containers.forEach(c => console.log(`   - ${c}`));
                return true;
            }
            return false;
        } catch { return false; }
    });
    
    // Итоги
    console.log('\n============================================================');
    console.log('📊 РЕЗУЛЬТАТЫ АУДИТА');
    console.log('============================================================');
    console.log(`✅ Пройдено: ${passed}`);
    console.log(`❌ Провалено: ${failed}`);
    console.log(`⚠️  Предупреждений: ${warnings}`);
    console.log('============================================================\n');
    
    // Запуск инфраструктуры
    if (failed === 0) {
        console.log('🚀 Запуск VSS инфраструктуры...\n');
        
        const basePath = path.join(__dirname, '..');
        let composeCmd = 'docker-compose';
        try {
            execSync('docker-compose --version', { stdio: 'ignore' });
        } catch {
            composeCmd = 'docker compose';
        }
        
        const composeFile = path.join(basePath, 'docker-compose.vss-demiurge.yml');
        const simpleComposeFile = path.join(basePath, 'docker-compose.vss-demiurge-simple.yml');
        
        let fileToUse = composeFile;
        if (!fs.existsSync(composeFile)) {
            if (fs.existsSync(simpleComposeFile)) {
                fileToUse = simpleComposeFile;
                console.log('   Используется упрощенная версия\n');
            } else {
                console.log('   ⚠️  Файлы docker-compose не найдены\n');
                return;
            }
        }
        
        try {
            // Проверяем запущенные контейнеры
            const output = execSync(`${composeCmd} -f "${fileToUse}" ps --format json`, { 
                cwd: basePath,
                encoding: 'utf8',
                stdio: 'pipe'
            });
            
            const containers = output.trim().split('\n')
                .filter(l => l.trim())
                .map(l => {
                    try { return JSON.parse(l); } catch { return null; }
                })
                .filter(c => c && c.State === 'running');
            
            if (containers.length > 0) {
                console.log(`   ✅ Найдено ${containers.length} запущенных контейнеров`);
                console.log('   Инфраструктура уже запущена\n');
            } else {
                console.log('   Запуск контейнеров...');
                execSync(`${composeCmd} -f "${fileToUse}" up -d`, { 
                    cwd: basePath,
                    stdio: 'inherit'
                });
                console.log('   ✅ Инфраструктура запущена');
                console.log('   Ожидание готовности сервисов (10 секунд)...\n');
                await new Promise(r => setTimeout(r, 10000));
            }
        } catch (error) {
            console.log(`   ❌ Ошибка: ${error.message}\n`);
        }
        
        console.log('============================================================');
        console.log('✅ ЗАПУСК ЗАВЕРШЕН');
        console.log('============================================================');
        console.log('\n📡 Доступные сервисы:');
        console.log('   - VSS Workspace: http://localhost:3000');
        console.log('   - VSS OTTB: http://localhost:8083');
        console.log('   - VSS DCI: http://localhost:8082');
        console.log('   - VSS POINT: http://localhost:8081');
        console.log('   - Admin Backend: http://localhost:8181');
        console.log('   - RabbitMQ Management: http://localhost:15672');
        console.log('   - Guacamole: http://localhost:8080');
        console.log('   - Grafana: http://localhost:3001');
        console.log('   - Prometheus: http://localhost:9090');
        console.log('\n');
    } else {
        console.log('❌ Обнаружены критические проблемы. Запуск отменен.\n');
        process.exit(1);
    }
})();

