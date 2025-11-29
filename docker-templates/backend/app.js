/**
 * Backend Application Template for VSS Projects
 * Полноценный Express сервер с поддержкой PostgreSQL, CORS, и базовыми API endpoints
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const { findAvailablePort } = require('../../utils/port-finder');

const app = express();
const DEFAULT_PORT = process.env.APP_PORT ? parseInt(process.env.APP_PORT) : 3001;
let PORT = DEFAULT_PORT;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Конфигурация PostgreSQL
const dbConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
};

let pool = null;

// Инициализация подключения к БД (если настроено)
if (dbConfig.user && dbConfig.host && dbConfig.database && dbConfig.password) {
    try {
        pool = new Pool(dbConfig);
        console.log('[DB] PostgreSQL Pool initialized');
        
        // Проверка соединения
        pool.connect()
            .then(client => {
                console.log('[DB] Connected to PostgreSQL successfully');
                client.release();
            })
            .catch(err => {
                console.warn('[DB] Failed to connect to PostgreSQL:', err.message);
                console.warn('[DB] Database functionality will be limited');
            });
    } catch (error) {
        console.warn('[DB] PostgreSQL configuration error:', error.message);
    }
} else {
    console.warn('[DB] PostgreSQL environment variables not fully set. Database functionality unavailable.');
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: pool ? 'configured' : 'not configured'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'VSS Project Backend API',
        version: '1.0.0',
        port: PORT,
        database: pool ? 'available' : 'unavailable',
        endpoints: [
            'GET /health - Health check',
            'GET /api/db-test - Test database connection',
            'POST /api/vss-users - Create VSS user',
            'GET /api/vss-users - List VSS users',
            'GET /api/status - Server status'
        ]
    });
});

// Database test endpoint
app.get('/api/db-test', async (req, res) => {
    if (!pool) {
        return res.status(503).json({
            success: false,
            message: 'Database is not configured for this project'
        });
    }
    
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
        client.release();
        
        res.json({
            success: true,
            message: 'Database connection successful',
            data: {
                current_time: result.rows[0].current_time,
                pg_version: result.rows[0].pg_version.split(' ')[0] + ' ' + result.rows[0].pg_version.split(' ')[1]
            }
        });
    } catch (err) {
        console.error('[DB] Query error:', err);
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: err.message
        });
    }
});

// Create VSS user endpoint
app.post('/api/vss-users', async (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Username and password are required'
        });
    }

    // Валидация
    if (username.length < 3 || username.length > 50) {
        return res.status(400).json({
            success: false,
            message: 'Username must be between 3 and 50 characters'
        });
    }
    
    if (password.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 6 characters long'
        });
    }

    console.log(`[API] Creating VSS user: ${username}`);

    try {
        if (pool) {
            // Используем PostgreSQL
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Проверка существования пользователя
            const checkUser = await pool.query(
                'SELECT id FROM users WHERE username = $1',
                [username]
            );
            
            if (checkUser.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: `User ${username} already exists`
                });
            }

            // Создание пользователя
            const result = await pool.query(
                `INSERT INTO users (username, email, password_hash, created_at, updated_at) 
                 VALUES ($1, $2, $3, NOW(), NOW()) 
                 RETURNING id, username, email, created_at`,
                [username, email || null, hashedPassword]
            );

            console.log(`[API] VSS user ${username} created successfully in database`);
            
            res.status(201).json({
                success: true,
                message: `VSS User ${username} created successfully`,
                user: result.rows[0]
            });
        } else {
            // Fallback: сохранение в файл
            const usersFilePath = path.join(__dirname, 'vss-users.json');
            let users = {};
            
            try {
                if (fs.existsSync(usersFilePath)) {
                    users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
                }
            } catch (e) {
                console.warn('[API] Could not read users file, creating new one');
            }

            if (users[username]) {
                return res.status(409).json({
                    success: false,
                    message: `User ${username} already exists`
                });
            }

            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            users[username] = {
                password_hash: hashedPassword,
                email: email || null,
                created_at: new Date().toISOString()
            };

            fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
            console.log(`[API] VSS user ${username} created successfully in file`);
            
            res.status(201).json({
                success: true,
                message: `VSS User ${username} created successfully (saved to file)`,
                user: {
                    username: username,
                    email: email || null,
                    created_at: users[username].created_at
                }
            });
        }
    } catch (error) {
        console.error('[API] Error creating VSS user:', error);
        res.status(500).json({
            success: false,
            message: `Error creating user: ${error.message}`
        });
    }
});

// List VSS users endpoint
app.get('/api/vss-users', async (req, res) => {
    try {
        if (pool) {
            // Из БД
            const result = await pool.query(
                'SELECT id, username, email, created_at FROM users ORDER BY created_at DESC'
            );
            
            res.json({
                success: true,
                count: result.rows.length,
                users: result.rows
            });
        } else {
            // Из файла
            const usersFilePath = path.join(__dirname, 'vss-users.json');
            let users = {};
            
            if (fs.existsSync(usersFilePath)) {
                users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
            }
            
            const userList = Object.keys(users).map(username => ({
                username: username,
                email: users[username].email,
                created_at: users[username].created_at
            }));
            
            res.json({
                success: true,
                count: userList.length,
                users: userList
            });
        }
    } catch (error) {
        console.error('[API] Error listing users:', error);
        res.status(500).json({
            success: false,
            message: `Error listing users: ${error.message}`
        });
    }
});

// Server status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        uptime: process.uptime(),
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
        },
        database: pool ? 'connected' : 'not configured',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[ERROR]', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.path
    });
});

// Автоматический поиск свободного порта и запуск сервера
(async () => {
    try {
        const net = require('net');
        const testServer = net.createServer();
        
        testServer.once('error', async (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`⚠️  Порт ${DEFAULT_PORT} занят, ищем свободный...`);
                try {
                    PORT = await findAvailablePort(DEFAULT_PORT, 100);
                    console.log(`✅ Найден свободный порт: ${PORT}`);
                    startServer();
                } catch (error) {
                    console.error('❌ Не удалось найти свободный порт:', error.message);
                    process.exit(1);
                }
            } else {
                console.error('❌ Ошибка проверки порта:', err.message);
                process.exit(1);
            }
        });
        
        testServer.once('listening', () => {
            testServer.close(() => {
                PORT = DEFAULT_PORT;
                startServer();
            });
        });
        
        testServer.listen(DEFAULT_PORT);
    } catch (error) {
        console.error('❌ Ошибка при запуске сервера:', error.message);
        process.exit(1);
    }
})();

function startServer() {
    app.listen(PORT, () => {
        console.log('═══════════════════════════════════════════════════════');
        console.log('🚀 VSS Project Backend Server');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`📍 Server running on http://localhost:${PORT}`);
        console.log(`💾 Database: ${pool ? '✅ Configured' : '❌ Not configured'}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log(`📚 API docs: http://localhost:${PORT}/`);
        console.log('═══════════════════════════════════════════════════════');
    });
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    if (pool) {
        pool.end();
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    if (pool) {
        pool.end();
    }
    process.exit(0);
});
