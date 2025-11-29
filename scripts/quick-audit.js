#!/usr/bin/env node
/**
 * Быстрый аудит инфраструктуры VSS
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const net = require('net');
const http = require('http');

let passed = 0;
let failed = 0;
let warnings = 0;

function checkPort(host, port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);
        socket.once('error', () => resolve(false));
        socket.once('timeout', () => { socket.destroy(); resolve(false); });
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.connect(port, host);
    });
}

async function test(name, fn) {
    try {
        const result = await fn();
        if (result) {
            console.log(`✅ ${name}`);
            passed++;
        } else {
            console.log(`⚠️  ${name} - предупреждение`);
            warnings++;
        }
    } catch (error) {
        console.log(`❌ ${name} - ${error.message}`);
        failed++;
    }
}

async function main() {
    console.log('\n🔍 VSS Infrastructure Audit\n');
    
    // Тест 1: Docker
    await test('Docker установлен', async () => {
        const { stdout } = await execAsync('docker --version');
        console.log(`   ${stdout.trim()}`);
        return true;
    });
    
    // Тест 2: Docker Compose
    await test('Docker Compose установлен', async () => {
        try {
            const { stdout } = await execAsync('docker-compose --version');
            console.log(`   ${stdout.trim()}`);
        } catch {
            const { stdout } = await execAsync('docker compose version');
            console.log(`   ${stdout.trim()}`);
        }
        return true;
    });
    
    // Тест 3: Node.js
    await test('Node.js установлен', async () => {
        const { stdout } = await execAsync('node -v');
        console.log(`   ${stdout.trim()}`);
        return true;
    });
    
    // Тест 4-13: Проверка портов
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
    
    for (const { port, name } of ports) {
        await test(`${name} (порт ${port})`, async () => {
            return await checkPort('localhost', port);
        });
    }
    
    // Итоги
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Пройдено: ${passed}`);
    console.log(`❌ Провалено: ${failed}`);
    console.log(`⚠️  Предупреждений: ${warnings}`);
    console.log('='.repeat(50) + '\n');
}

main().catch(console.error);

