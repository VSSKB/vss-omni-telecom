#!/usr/bin/env node
/**
 * VSS Infrastructure Audit and Start Script
 * Полный аудит инфраструктуры, тесты и запуск проекта
 */

const { runAudit } = require('./audit-and-test');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');
const fs = require('fs');

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Функция запуска VSS инфраструктуры
async function startVSSInfrastructure() {
    log('\n🚀 Запуск VSS инфраструктуры...', 'cyan');
    
    const composeFile = path.join(__dirname, '..', 'docker-compose.vss-demiurge.yml');
    const simpleComposeFile = path.join(__dirname, '..', 'docker-compose.vss-demiurge-simple.yml');
    
    let composeFileToUse = composeFile;
    if (!fs.existsSync(composeFile)) {
        if (fs.existsSync(simpleComposeFile)) {
            composeFileToUse = simpleComposeFile;
            log('   Используется упрощенная версия (без Kamailio/Asterisk)', 'yellow');
        } else {
            log('   ❌ Файлы docker-compose не найдены', 'red');
            return false;
        }
    }
    
    try {
        // Проверяем, какая версия docker-compose доступна
        let composeCommand = 'docker-compose';
        try {
            await execAsync('docker-compose --version');
        } catch {
            try {
                await execAsync('docker compose version');
                composeCommand = 'docker compose';
            } catch {
                log('   ❌ Docker Compose не найден', 'red');
                return false;
            }
        }
        
        log(`   Используется: ${path.basename(composeFileToUse)}`, 'blue');
        
        // Проверяем статус контейнеров
        try {
            const { stdout } = await execAsync(`${composeCommand} -f "${composeFileToUse}" ps --format json`, {
                cwd: path.join(__dirname, '..')
            });
            
            const containers = stdout.trim().split('\n')
                .filter(line => line.trim())
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch {
                        return null;
                    }
                })
                .filter(c => c);
            
            const running = containers.filter(c => c.State === 'running');
            if (running.length > 0) {
                log(`   ✅ Найдено ${running.length} запущенных контейнеров`, 'green');
                log('   Инфраструктура уже запущена', 'green');
                return true;
            }
        } catch (error) {
            // Игнорируем ошибки проверки статуса
        }
        
        // Запускаем инфраструктуру
        log('   Запуск контейнеров...', 'blue');
        const { stdout, stderr } = await execAsync(
            `${composeCommand} -f "${composeFileToUse}" up -d`,
            { 
                cwd: path.join(__dirname, '..'),
                maxBuffer: 10 * 1024 * 1024 
            }
        );
        
        log('   ✅ Инфраструктура запущена', 'green');
        
        // Ждем немного для инициализации
        log('   Ожидание готовности сервисов (10 секунд)...', 'blue');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        return true;
    } catch (error) {
        log(`   ❌ Ошибка запуска: ${error.message}`, 'red');
        if (error.stderr) {
            log(`   Детали: ${error.stderr}`, 'red');
        }
        return false;
    }
}

// Функция запуска основных сервисов Node.js
async function startNodeServices() {
    log('\n📦 Запуск Node.js сервисов...', 'cyan');
    log('   Примечание: Сервисы запускаются в отдельных процессах', 'yellow');
    log('   Для просмотра логов используйте отдельные терминалы', 'yellow');
    
    const services = [
        { name: 'VSS Workspace', path: 'services/workspace', port: 3000, command: 'npm run start' },
        { name: 'VSS OTTB', path: 'services/ottb', port: 8083, command: 'npm run start' },
        { name: 'VSS DCI', path: 'services/dci', port: 8082, command: 'npm run start' },
        { name: 'VSS POINT', path: 'services/point', port: 8081, command: 'npm run start' },
        { name: 'Admin Backend', path: 'admin-backend', port: 8181, command: 'npm run start' }
    ];
    
    const basePath = path.join(__dirname, '..');
    const startedServices = [];
    
    for (const service of services) {
        const servicePath = path.join(basePath, service.path);
        if (!fs.existsSync(servicePath)) {
            log(`   ⚠️  ${service.name}: директория не найдена`, 'yellow');
            continue;
        }
        
        const packageJsonPath = path.join(servicePath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            log(`   ⚠️  ${service.name}: package.json не найден`, 'yellow');
            continue;
        }
        
        try {
            log(`   Запуск ${service.name}...`, 'blue');
            
            // Проверяем, установлены ли зависимости
            const nodeModulesPath = path.join(servicePath, 'node_modules');
            if (!fs.existsSync(nodeModulesPath)) {
                log(`   ⚠️  ${service.name}: зависимости не установлены. Запускаем npm install...`, 'yellow');
                try {
                    await execAsync('npm install', { cwd: servicePath, timeout: 60000 });
                    log(`   ✅ ${service.name}: зависимости установлены`, 'green');
                } catch (installError) {
                    log(`   ❌ ${service.name}: ошибка установки зависимостей: ${installError.message}`, 'red');
                    continue;
                }
            }
            
            // Запускаем сервис в фоне
            const isWindows = process.platform === 'win32';
            const child = exec(service.command, {
                cwd: servicePath,
                stdio: 'pipe',
                shell: true
            });
            
            // Обработка вывода
            child.stdout.on('data', (data) => {
                process.stdout.write(`[${service.name}] ${data}`);
            });
            
            child.stderr.on('data', (data) => {
                process.stderr.write(`[${service.name}] ${data}`);
            });
            
            child.on('error', (error) => {
                log(`   ❌ ${service.name}: ошибка процесса: ${error.message}`, 'red');
            });
            
            startedServices.push({
                name: service.name,
                process: child,
                port: service.port,
                path: servicePath
            });
            
            // Даем время на запуск
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Проверяем, что процесс еще работает
            if (child.exitCode === null) {
                log(`   ✅ ${service.name} запущен (порт ${service.port})`, 'green');
            } else {
                log(`   ❌ ${service.name} завершился с кодом ${child.exitCode}`, 'red');
            }
        } catch (error) {
            log(`   ❌ Ошибка запуска ${service.name}: ${error.message}`, 'red');
        }
    }
    
    return startedServices;
}

// Главная функция
async function main() {
    log('\n' + '='.repeat(70), 'bright');
    log('🚀 VSS INFRASTRUCTURE AUDIT & START', 'bright');
    log('='.repeat(70) + '\n', 'bright');
    
    // Шаг 1: Аудит
    log('📋 ШАГ 1: Полный аудит инфраструктуры', 'bright');
    log('='.repeat(70), 'bright');
    const auditPassed = await runAudit();
    
    if (!auditPassed && process.argv.includes('--strict')) {
        log('\n❌ Аудит не пройден. Запуск отменен (используйте --force для принудительного запуска)', 'red');
        process.exit(1);
    }
    
    // Шаг 2: Запуск инфраструктуры
    log('\n📋 ШАГ 2: Запуск Docker инфраструктуры', 'bright');
    log('='.repeat(70), 'bright');
    const infraStarted = await startVSSInfrastructure();
    
    if (!infraStarted) {
        log('\n⚠️  Не удалось запустить Docker инфраструктуру', 'yellow');
        log('   Продолжаем запуск Node.js сервисов...', 'yellow');
    }
    
    // Шаг 3: Запуск Node.js сервисов
    log('\n📋 ШАГ 3: Запуск Node.js сервисов', 'bright');
    log('='.repeat(70), 'bright');
    const services = await startNodeServices();
    
    // Итоги
    log('\n' + '='.repeat(70), 'bright');
    log('✅ ЗАПУСК ЗАВЕРШЕН', 'bright');
    log('='.repeat(70), 'bright');
    
    if (infraStarted) {
        log('\n📡 Доступные сервисы:', 'cyan');
        log('   - VSS Workspace: http://localhost:3000', 'green');
        log('   - VSS OTTB: http://localhost:8083', 'green');
        log('   - VSS DCI: http://localhost:8082', 'green');
        log('   - VSS POINT: http://localhost:8081', 'green');
        log('   - Admin Backend: http://localhost:8181', 'green');
        log('   - RabbitMQ Management: http://localhost:15672', 'green');
        log('   - Guacamole: http://localhost:8080', 'green');
        log('   - Grafana: http://localhost:3001', 'green');
        log('   - Prometheus: http://localhost:9090', 'green');
    }
    
    if (services.length > 0) {
        log(`\n✅ Запущено Node.js сервисов: ${services.length}`, 'green');
    }
    
    log('\n💡 Для остановки нажмите Ctrl+C', 'yellow');
    log('='.repeat(70) + '\n', 'bright');
    
    // Обработка сигналов для корректного завершения
    process.on('SIGINT', () => {
        log('\n\n🛑 Остановка сервисов...', 'yellow');
        services.forEach(service => {
            if (service.process) {
                service.process.kill();
            }
        });
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        log('\n\n🛑 Остановка сервисов...', 'yellow');
        services.forEach(service => {
            if (service.process) {
                service.process.kill();
            }
        });
        process.exit(0);
    });
}

// Запуск
if (require.main === module) {
    main().catch(error => {
        log(`\n❌ Критическая ошибка: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    });
}

module.exports = { main };

