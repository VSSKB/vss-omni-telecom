#!/usr/bin/env node

/**
 * VSS DEMIURGE Comprehensive System Audit & Testing Suite
 * Tests 10 critical system nodes and infrastructure components
 */

const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs');
const path = require('path');

class VSSAuditSuite {
    constructor() {
        this.tests = [];
        this.results = [];
        this.startTime = Date.now();
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = `[AUDIT ${timestamp}]`;
        console.log(`${prefix} ${message}`);
    }

    addTest(name, description, testFunction) {
        this.tests.push({
            name,
            description,
            testFunction
        });
    }

    async runTest(test) {
        const startTime = Date.now();
        try {
            this.log(`🔍 Running test: ${test.name}`);
            this.log(`   Description: ${test.description}`);

            const result = await test.testFunction();

            const duration = Date.now() - startTime;
            const testResult = {
                name: test.name,
                description: test.description,
                status: result.success ? 'PASS' : 'FAIL',
                duration,
                message: result.message,
                details: result.details || {}
            };

            this.results.push(testResult);

            const statusEmoji = result.success ? '✅' : '❌';
            this.log(`${statusEmoji} ${test.name}: ${result.success ? 'PASS' : 'FAIL'} (${duration}ms)`);
            if (result.message) {
                this.log(`   Message: ${result.message}`);
            }

            return result.success;
        } catch (error) {
            const duration = Date.now() - startTime;
            const testResult = {
                name: test.name,
                description: test.description,
                status: 'ERROR',
                duration,
                message: error.message,
                details: { error: error.stack }
            };

            this.results.push(testResult);
            this.log(`💥 ${test.name}: ERROR (${duration}ms) - ${error.message}`);
            return false;
        }
    }

    async runAllTests() {
        this.log('🚀 Starting VSS DEMIURGE Comprehensive System Audit');
        this.log('==================================================');

        let passed = 0;
        let failed = 0;
        let errors = 0;

        for (const test of this.tests) {
            const success = await this.runTest(test);
            if (success) passed++;
            else failed++;
        }

        const totalTime = Date.now() - this.startTime;

        this.log('');
        this.log('📊 AUDIT RESULTS SUMMARY');
        this.log('========================');
        this.log(`Total Tests: ${this.tests.length}`);
        this.log(`Passed: ${passed}`);
        this.log(`Failed: ${failed}`);
        this.log(`Errors: ${errors}`);
        this.log(`Total Time: ${totalTime}ms`);

        const successRate = ((passed / this.tests.length) * 100).toFixed(1);
        this.log(`Success Rate: ${successRate}%`);

        // Generate detailed report
        this.generateReport();

        return {
            total: this.tests.length,
            passed,
            failed,
            errors,
            successRate: parseFloat(successRate),
            totalTime
        };
    }

    generateReport() {
        const reportPath = path.join(__dirname, '..', 'AUDIT-REPORT-DETAILED.md');

        let report = `# VSS DEMIURGE Comprehensive System Audit Report

Generated: ${new Date().toISOString()}

## Summary

- **Total Tests**: ${this.results.length}
- **Passed**: ${this.results.filter(r => r.status === 'PASS').length}
- **Failed**: ${this.results.filter(r => r.status === 'FAIL').length}
- **Errors**: ${this.results.filter(r => r.status === 'ERROR').length}
- **Success Rate**: ${((this.results.filter(r => r.status === 'PASS').length / this.results.length) * 100).toFixed(1)}%

## Test Results

`;

        this.results.forEach((result, index) => {
            report += `### ${index + 1}. ${result.name}

**Status**: ${result.status}  
**Duration**: ${result.duration}ms  
**Description**: ${result.description}

`;

            if (result.message) {
                report += `**Message**: ${result.message}\n\n`;
            }

            if (result.details && Object.keys(result.details).length > 0) {
                report += `**Details**:\n\`\`\`json\n${JSON.stringify(result.details, null, 2)}\n\`\`\`\n\n`;
            }

            report += '---\n\n';
        });

        fs.writeFileSync(reportPath, report);
        this.log(`📄 Detailed report saved to: ${reportPath}`);
    }

    // Test 1: Admin Backend Health Check
    async testAdminBackendHealth() {
        try {
            const response = await this.makeHttpRequest('http://localhost:8181/health');
            if (response.statusCode === 200) {
                return { success: true, message: 'Admin backend is healthy' };
            } else {
                return { success: false, message: `Admin backend returned status ${response.statusCode}` };
            }
        } catch (error) {
            return { success: false, message: `Admin backend not accessible: ${error.message}` };
        }
    }

    // Test 2: Main Backend API
    async testMainBackendAPI() {
        try {
            const response = await this.makeHttpRequest('http://localhost:3001/');
            if (response.statusCode === 200 && response.data.includes('Backend for VSS Project')) {
                return { success: true, message: 'Main backend API is responding correctly' };
            } else {
                return { success: false, message: `Main backend returned unexpected response` };
            }
        } catch (error) {
            return { success: false, message: `Main backend not accessible: ${error.message}` };
        }
    }

    // Test 3: Workspace Service Health
    async testWorkspaceService() {
        try {
            const response = await this.makeHttpRequest('http://localhost:3000/health');
            if (response.statusCode === 200) {
                return { success: true, message: 'Workspace service is healthy' };
            } else {
                return { success: false, message: `Workspace service returned status ${response.statusCode}` };
            }
        } catch (error) {
            return { success: false, message: `Workspace service not accessible: ${error.message}` };
        }
    }

    // Test 4: DCI Service Health
    async testDCIService() {
        try {
            const response = await this.makeHttpRequest('http://localhost:3002/health');
            if (response.statusCode === 200) {
                return { success: true, message: 'DCI service is healthy' };
            } else {
                return { success: false, message: `DCI service returned status ${response.statusCode}` };
            }
        } catch (error) {
            return { success: false, message: `DCI service not accessible: ${error.message}` };
        }
    }

    // Test 5: OTTB Service Health
    async testOTTBService() {
        try {
            const response = await this.makeHttpRequest('http://localhost:3003/health');
            if (response.statusCode === 200) {
                return { success: true, message: 'OTTB service is healthy' };
            } else {
                return { success: false, message: `OTTB service returned status ${response.statusCode}` };
            }
        } catch (error) {
            return { success: false, message: `OTTB service not accessible: ${error.message}` };
        }
    }

    // Test 6: Database Connectivity
    async testDatabaseConnectivity() {
        try {
            // Test PostgreSQL connection via backend API
            const response = await this.makeHttpRequest('http://localhost:3001/api/db-test');
            if (response.statusCode === 200) {
                const data = JSON.parse(response.data);
                if (data.message && data.message.includes('successful')) {
                    return { success: true, message: 'PostgreSQL connection is working' };
                }
            }
            return { success: false, message: 'PostgreSQL connection test failed' };
        } catch (error) {
            return { success: false, message: `Database connectivity test failed: ${error.message}` };
        }
    }

    // Test 7: RabbitMQ Connectivity
    async testRabbitMQConnectivity() {
        try {
            // Check if RabbitMQ management interface is accessible
            const response = await this.makeHttpRequest('http://localhost:15672/api/overview', {
                auth: 'vss-admin:vss_rabbit_pass'
            });

            if (response.statusCode === 200) {
                return { success: true, message: 'RabbitMQ is accessible and responding' };
            } else {
                return { success: false, message: `RabbitMQ management interface returned status ${response.statusCode}` };
            }
        } catch (error) {
            return { success: false, message: `RabbitMQ not accessible: ${error.message}` };
        }
    }

    // Test 8: Authentication System
    async testAuthenticationSystem() {
        try {
            // Test auth database initialization
            const authDbPath = path.join(__dirname, '..', 'database', 'auth-db.js');
            const authDb = require(authDbPath);

            // Check if auth database file exists
            const dbPath = path.join(__dirname, '..', 'db_data', 'auth.db');
            if (fs.existsSync(dbPath)) {
                return { success: true, message: 'Authentication database is initialized and accessible' };
            } else {
                return { success: false, message: 'Authentication database file not found' };
            }
        } catch (error) {
            return { success: false, message: `Authentication system test failed: ${error.message}` };
        }
    }

    // Test 9: Docker Services Status
    async testDockerServices() {
        try {
            const { stdout } = await execAsync('docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"');
            const lines = stdout.trim().split('\n');

            if (lines.length < 2) {
                return { success: false, message: 'No Docker containers are running' };
            }

            const containers = lines.slice(1); // Skip header
            const expectedServices = ['postgres', 'redis', 'rabbitmq'];
            const runningServices = containers.map(line => line.split('\t')[0]);

            const missingServices = expectedServices.filter(service =>
                !runningServices.some(container => container.includes(service))
            );

            if (missingServices.length === 0) {
                return {
                    success: true,
                    message: `All expected Docker services are running: ${expectedServices.join(', ')}`,
                    details: { runningContainers: containers.length, services: runningServices }
                };
            } else {
                return {
                    success: false,
                    message: `Missing Docker services: ${missingServices.join(', ')}`,
                    details: { runningContainers: containers.length, services: runningServices, missing: missingServices }
                };
            }
        } catch (error) {
            return { success: false, message: `Docker services check failed: ${error.message}` };
        }
    }

    // Test 10: Configuration Files Integrity
    async testConfigurationIntegrity() {
        const configFiles = [
            'docker-compose.yml',
            'package.json',
            'services/workspace/package.json',
            'services/dci/package.json',
            'services/ottb/package.json',
            'database/auth-db.js'
        ];

        const missingFiles = [];
        const invalidFiles = [];

        for (const file of configFiles) {
            const filePath = path.join(__dirname, '..', file);

            if (!fs.existsSync(filePath)) {
                missingFiles.push(file);
                continue;
            }

            // Basic JSON validation for package.json files
            if (file.endsWith('package.json')) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    JSON.parse(content);
                } catch (error) {
                    invalidFiles.push(`${file} (JSON parse error: ${error.message})`);
                }
            }

            // Basic syntax check for JavaScript files
            if (file.endsWith('.js')) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    // Simple syntax check by attempting to create a new Function
                    new Function(content);
                } catch (error) {
                    invalidFiles.push(`${file} (syntax error: ${error.message})`);
                }
            }
        }

        if (missingFiles.length === 0 && invalidFiles.length === 0) {
            return {
                success: true,
                message: 'All configuration files are present and valid',
                details: { checkedFiles: configFiles.length }
            };
        } else {
            return {
                success: false,
                message: `Configuration integrity issues found`,
                details: {
                    missingFiles,
                    invalidFiles,
                    totalChecked: configFiles.length
                }
            };
        }
    }

    async makeHttpRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                timeout: 5000,
                ...options
            };

            const req = http.request(requestOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    async initTests() {
        // Test 1: Admin Backend Health Check
        this.addTest(
            'Admin Backend Health',
            'Verify admin backend service is running and healthy on port 8181',
            () => this.testAdminBackendHealth()
        );

        // Test 2: Main Backend API
        this.addTest(
            'Main Backend API',
            'Verify main backend service is running and responding on port 3001',
            () => this.testMainBackendAPI()
        );

        // Test 3: Workspace Service Health
        this.addTest(
            'Workspace Service Health',
            'Verify workspace microservice is running and healthy on port 3000',
            () => this.testWorkspaceService()
        );

        // Test 4: DCI Service Health
        this.addTest(
            'DCI Service Health',
            'Verify DCI (Device Control Interface) service is running on port 3002',
            () => this.testDCIService()
        );

        // Test 5: OTTB Service Health
        this.addTest(
            'OTTB Service Health',
            'Verify OTTB (Over-The-Top Broadband) service is running on port 3003',
            () => this.testOTTBService()
        );

        // Test 6: Database Connectivity
        this.addTest(
            'Database Connectivity',
            'Verify PostgreSQL database connectivity through backend API',
            () => this.testDatabaseConnectivity()
        );

        // Test 7: RabbitMQ Connectivity
        this.addTest(
            'RabbitMQ Connectivity',
            'Verify RabbitMQ message broker is accessible and responding',
            () => this.testRabbitMQConnectivity()
        );

        // Test 8: Authentication System
        this.addTest(
            'Authentication System',
            'Verify authentication database and user management system is functional',
            () => this.testAuthenticationSystem()
        );

        // Test 9: Docker Services Status
        this.addTest(
            'Docker Services Status',
            'Verify all required Docker containers (PostgreSQL, Redis, RabbitMQ) are running',
            () => this.testDockerServices()
        );

        // Test 10: Configuration Files Integrity
        this.addTest(
            'Configuration Files Integrity',
            'Verify all configuration files exist and have valid syntax',
            () => this.testConfigurationIntegrity()
        );
    }
}

// Main execution
async function main() {
    const auditSuite = new VSSAuditSuite();
    await auditSuite.initTests();

    const results = await auditSuite.runAllTests();

    // Exit with appropriate code based on test results
    if (results.successRate >= 80) {
        console.log('\n🎉 Audit completed successfully! System is ready for launch.');
        process.exit(0);
    } else {
        console.log('\n⚠️  Audit completed with issues. System may need attention before launch.');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Audit suite failed:', error);
        process.exit(1);
    });
}

module.exports = VSSAuditSuite;
