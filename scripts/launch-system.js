#!/usr/bin/env node

/**
 * VSS DEMIURGE System Launcher
 * Comprehensive system startup script
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class VSSSystemLauncher {
    constructor() {
        this.services = [];
        this.startTime = Date.now();
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[LAUNCH ${timestamp}] ${message}`);
    }

    async executeCommand(command, cwd = null, description = '') {
        return new Promise((resolve, reject) => {
            this.log(`🔧 Executing: ${command}${description ? ` (${description})` : ''}`);

            const options = {
                stdio: 'inherit',
                shell: true
            };

            if (cwd) {
                options.cwd = cwd;
            }

            const child = exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    this.log(`❌ Command failed: ${error.message}`);
                    reject(error);
                } else {
                    this.log(`✅ Command completed successfully`);
                    resolve({ stdout, stderr });
                }
            });
        });
    }

    async checkDockerServices() {
        try {
            this.log('🔍 Checking Docker services status...');
            await this.executeCommand('docker ps', null, 'Check running containers');

            const { stdout } = await this.executeCommand('docker ps --format "{{.Names}}"', null, 'Get container names');
            const containers = stdout.trim().split('\n').filter(name => name.length > 0);

            this.log(`📋 Running containers: ${containers.join(', ')}`);

            const requiredServices = ['postgres', 'redis', 'rabbitmq'];
            const missingServices = requiredServices.filter(service =>
                !containers.some(container => container.includes(service))
            );

            if (missingServices.length > 0) {
                this.log(`⚠️  Missing services: ${missingServices.join(', ')}`);
                return false;
            }

            this.log('✅ All required Docker services are running');
            return true;
        } catch (error) {
            this.log(`❌ Docker services check failed: ${error.message}`);
            return false;
        }
    }

    async startDockerServices() {
        try {
            this.log('🐳 Starting Docker infrastructure services...');

            // Clean up any existing containers first
            await this.executeCommand('docker-compose down', null, 'Clean up existing containers');

            // Start only the infrastructure services (not the Node.js apps)
            await this.executeCommand('docker-compose up -d redis postgres rabbitmq', null, 'Start infrastructure');

            // Wait for services to be healthy
            this.log('⏳ Waiting for services to be healthy...');
            await new Promise(resolve => setTimeout(resolve, 10000));

            return await this.checkDockerServices();
        } catch (error) {
            this.log(`❌ Failed to start Docker services: ${error.message}`);
            return false;
        }
    }

    async installDependencies(servicePath, serviceName) {
        const packageJsonPath = path.join(servicePath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            this.log(`⚠️  No package.json found for ${serviceName}, skipping`);
            return true;
        }

        try {
            await this.executeCommand('npm install', servicePath, `Install ${serviceName} dependencies`);
            return true;
        } catch (error) {
            this.log(`❌ Failed to install dependencies for ${serviceName}: ${error.message}`);
            return false;
        }
    }

    async startService(servicePath, serviceName, startCommand = 'npm start') {
        try {
            this.log(`🚀 Starting ${serviceName}...`);

            const packageJsonPath = path.join(servicePath, 'package.json');
            if (!fs.existsSync(packageJsonPath)) {
                this.log(`⚠️  No package.json found for ${serviceName}, cannot start`);
                return false;
            }

            // Install dependencies first
            await this.installDependencies(servicePath, serviceName);

            // Start the service in background
            const child = spawn(startCommand, [], {
                cwd: servicePath,
                detached: true,
                stdio: 'ignore',
                shell: true
            });

            child.unref();

            this.log(`✅ ${serviceName} started (PID: ${child.pid})`);
            this.services.push({ name: serviceName, pid: child.pid, path: servicePath });

            // Wait a bit for service to start
            await new Promise(resolve => setTimeout(resolve, 3000));

            return true;
        } catch (error) {
            this.log(`❌ Failed to start ${serviceName}: ${error.message}`);
            return false;
        }
    }

    async waitForService(url, serviceName, timeout = 30000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    this.log(`✅ ${serviceName} is responding at ${url}`);
                    return true;
                }
            } catch (error) {
                // Service not ready yet
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.log(`❌ ${serviceName} failed to respond within ${timeout}ms`);
        return false;
    }

    async launchSystem() {
        this.log('🚀 Starting VSS DEMIURGE System Launch Sequence');
        this.log('===============================================');

        let success = true;

        // Step 1: Start Docker infrastructure
        this.log('\n📦 Step 1: Docker Infrastructure');
        const dockerReady = await this.startDockerServices();
        if (!dockerReady) {
            this.log('❌ Docker infrastructure failed to start');
            success = false;
        }

        // Step 2: Start Admin Backend
        this.log('\n🔧 Step 2: Admin Backend Service');
        const adminStarted = await this.startService('./admin-backend', 'Admin Backend');
        if (adminStarted) {
            await this.waitForService('http://localhost:8181/health', 'Admin Backend');
        } else {
            success = false;
        }

        // Step 3: Start Main Backend
        this.log('\n🔧 Step 3: Main Backend Service');
        const backendStarted = await this.startService('./backend', 'Main Backend');
        if (backendStarted) {
            await this.waitForService('http://localhost:3001/', 'Main Backend');
        } else {
            success = false;
        }

        // Step 4: Start Workspace Service
        this.log('\n🔧 Step 4: Workspace Service');
        const workspaceStarted = await this.startService('./services/workspace', 'Workspace Service');
        if (workspaceStarted) {
            await this.waitForService('http://localhost:3000/health', 'Workspace Service');
        } else {
            success = false;
        }

        // Step 5: Start DCI Service
        this.log('\n🔧 Step 5: DCI Service');
        const dciStarted = await this.startService('./services/dci', 'DCI Service');
        if (dciStarted) {
            await this.waitForService('http://localhost:3002/health', 'DCI Service');
        } else {
            success = false;
        }

        // Step 6: Start OTTB Service
        this.log('\n🔧 Step 6: OTTB Service');
        const ottbStarted = await this.startService('./services/ottb', 'OTTB Service');
        if (ottbStarted) {
            await this.waitForService('http://localhost:3003/health', 'OTTB Service');
        } else {
            success = false;
        }

        // Step 7: Run Final Audit
        this.log('\n🔍 Step 7: Final System Audit');
        try {
            await this.executeCommand('node scripts/comprehensive-audit.js', null, 'Run final system audit');
        } catch (error) {
            this.log('⚠️  Final audit encountered issues');
        }

        const totalTime = Date.now() - this.startTime;

        this.log('\n🎯 LAUNCH COMPLETE');
        this.log('==================');
        this.log(`Total launch time: ${totalTime}ms`);
        this.log(`Services started: ${this.services.length}`);

        if (success) {
            this.log('✅ System launch completed successfully!');
            this.log('\n🌐 Access Points:');
            this.log('   • Admin Dashboard: http://localhost:8181');
            this.log('   • Main Backend API: http://localhost:3001');
            this.log('   • Workspace Service: http://localhost:3000');
            this.log('   • DCI Service: http://localhost:3002');
            this.log('   • OTTB Service: http://localhost:3003');
            this.log('   • RabbitMQ Management: http://localhost:15672');
        } else {
            this.log('⚠️  System launch completed with issues');
        }

        return success;
    }
}

// Main execution
async function main() {
    const launcher = new VSSSystemLauncher();

    try {
        const success = await launcher.launchSystem();
        process.exit(success ? 0 : 1);
    } catch (error) {
        console.error('Launch failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = VSSSystemLauncher;
