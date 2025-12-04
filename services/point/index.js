const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const amqp = require('amqplib');
const net = require('net');
const fs = require('fs');
const { findAvailablePort } = require('../../utils/port-finder');
require('dotenv').config();

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT) || 8081;
let PORT = DEFAULT_PORT;
const JWT_SECRET = process.env.JWT_SECRET || 'vss_jwt_secret_change_me';

// CORS configuration
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost', 'http://127.0.0.1', 'http://79.137.207.215'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

// Определяем, запущен ли сервис в Docker или локально
const isDocker = process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv');
const POSTGRES_HOST = isDocker ? 'postgres' : 'localhost';
const RABBITMQ_HOST = isDocker ? 'rabbitmq' : 'localhost';

// Database connection with retry logic
const { createPoolWithRetry, initDatabaseWithRetry } = require('../../utils/db-helper');

const pool = createPoolWithRetry({
    connectionString: process.env.POSTGRES_URL || `postgresql://vss:vss_postgres_pass@${POSTGRES_HOST}:5432/vss_db`
}, 'POINT');

initDatabaseWithRetry(pool, 'POINT').catch(error => {
    console.error('[POINT] ❌ Failed to initialize database.');
});

// Redis connection (for ACL cache)
// In production, use Redis client
let redisClient = null;

// RabbitMQ connection
let rabbitmqChannel = null;
const initRabbitMQ = async () => {
    try {
        const defaultRabbitMQUrl = `amqp://vss-admin:vss_rabbit_pass@${RABBITMQ_HOST}:5672/vss`;
        const rabbitmqUrl = process.env.RABBITMQ_URL || defaultRabbitMQUrl;
        const connection = await amqp.connect(rabbitmqUrl);
        rabbitmqChannel = await connection.createChannel();
        console.log('[POINT] Connected to RabbitMQ');
    } catch (error) {
        console.error('[POINT] RabbitMQ connection error:', error.message);
        if (!isDocker) {
            console.warn('[POINT] Для локальной разработки убедитесь, что RabbitMQ запущен на localhost:5672');
        }
    }
};

// JWT Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: true, code: 'AUTH_FAIL', message: 'Token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: true, code: 'AUTH_FAIL', message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'vss-point', timestamp: new Date().toISOString() });
});

// ============================================
// AUTHENTICATION API
// ============================================

// POST /api/auth/login - Вход в систему
const { validate, loginSchema } = require('../../utils/validation');
app.post('/api/auth/login', validate(loginSchema, 'body'), async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: true, code: 'AUTH_FAIL', message: 'Username and password required' });
        }
        
        const result = await pool.query(`
            SELECT u.*, r.name as role_name, r.permissions
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.username = $1 AND u.status = 'active'
        `, [username]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: true, code: 'AUTH_FAIL', message: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        
        // Verify password (assuming password_hash is bcrypt)
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: true, code: 'AUTH_FAIL', message: 'Invalid credentials' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role_name },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        // Update last login
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
        
        res.json({
            token: token,
            role: user.role_name,
            expires: 3600,
            permissions: user.permissions
        });
    } catch (error) {
        console.error('[POINT] Login error:', error);
        res.status(500).json({ error: true, code: 'AUTH_FAIL', message: error.message });
    }
});

// POST /api/auth/refresh - Обновление токена
app.post('/api/auth/refresh', authenticateToken, (req, res) => {
    try {
        const newToken = jwt.sign(
            { id: req.user.id, username: req.user.username, role: req.user.role },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        res.json({ token: newToken, expires: 3600 });
    } catch (error) {
        console.error('[POINT] Token refresh error:', error);
        res.status(500).json({ error: true, code: 'AUTH_FAIL', message: error.message });
    }
});

// POST /api/auth/logout - Выход из системы
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    // In production, invalidate token in Redis
    res.json({ success: true });
});

// ============================================
// RBAC / USERS API
// ============================================

// GET /api/point/rolecheck - Проверка прав пользователя
app.get('/api/point/rolecheck', authenticateToken, async (req, res) => {
    try {
        const { action } = req.query;
        
        if (!action) {
            return res.status(400).json({ error: true, code: 'INVALID_PARAMS', message: 'action parameter required' });
        }
        
        // Get user role and permissions
        const result = await pool.query(`
            SELECT r.permissions
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = $1
        `, [req.user.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, code: 'USER_NOT_FOUND', message: 'User not found' });
        }
        
        const permissions = result.rows[0].permissions || {};
        
        // Check if action is allowed
        const allowed = checkPermission(permissions, action);
        const permissionList = extractPermissions(permissions);
        
        res.json({
            allowed: allowed,
            permissions: permissionList
        });
    } catch (error) {
        console.error('[POINT] Role check error:', error);
        res.status(500).json({ error: true, code: 'ROLE_CHECK_ERROR', message: error.message });
    }
});

// Helper function to check permissions
function checkPermission(permissions, action) {
    if (permissions.all === true) return true;
    
    const [module, operation] = action.split('.');
    if (permissions[module]) {
        if (Array.isArray(permissions[module])) {
            return permissions[module].includes(operation);
        }
        return permissions[module] === true;
    }
    return false;
}

// Helper function to extract permissions list
function extractPermissions(permissions) {
    const list = [];
    if (permissions.all === true) {
        list.push('all');
        return list;
    }
    
    for (const [module, perms] of Object.entries(permissions)) {
        if (Array.isArray(perms)) {
            perms.forEach(p => list.push(`${module}.${p}`));
        } else if (perms === true) {
            list.push(module);
        }
    }
    return list;
}

// GET /api/roles - Список всех ролей
app.get('/api/roles', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM roles ORDER BY id');
        res.json(result.rows);
    } catch (error) {
        console.error('[POINT] Error fetching roles:', error);
        res.status(500).json({ error: true, code: 'ROLES_FETCH_ERROR', message: error.message });
    }
});

// POST /api/roles/:id - Обновление роли
app.post('/api/roles/:id', authenticateToken, async (req, res) => {
    try {
        const roleId = parseInt(req.params.id);
        const { permissions } = req.body;
        
        if (!permissions) {
            return res.status(400).json({ error: true, code: 'INVALID_PARAMS', message: 'permissions required' });
        }
        
        await pool.query('UPDATE roles SET permissions = $1 WHERE id = $2', [permissions, roleId]);
        
        res.json({ status: 'updated', role_id: roleId });
    } catch (error) {
        console.error('[POINT] Error updating role:', error);
        res.status(500).json({ error: true, code: 'ROLE_UPDATE_ERROR', message: error.message });
    }
});

// GET /api/users - Список пользователей
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.username, u.email, u.status, u.created_at, u.last_login,
                   r.name as role_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            ORDER BY u.created_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('[POINT] Error fetching users:', error);
        res.status(500).json({ error: true, code: 'USERS_FETCH_ERROR', message: error.message });
    }
});

// POST /api/users - Создание пользователя
app.post('/api/users', authenticateToken, async (req, res) => {
    try {
        const { username, password, email, role } = req.body;
        
        if (!username || !password || !email || !role) {
            return res.status(400).json({ error: true, code: 'INVALID_PARAMS', message: 'username, password, email, and role are required' });
        }
        
        // Get role ID
        const roleResult = await pool.query('SELECT id FROM roles WHERE name = $1', [role]);
        if (roleResult.rows.length === 0) {
            return res.status(400).json({ error: true, code: 'ROLE_NOT_FOUND', message: 'Role not found' });
        }
        
        const roleId = roleResult.rows[0].id;
        const passwordHash = await bcrypt.hash(password, 10);
        
        const result = await pool.query(`
            INSERT INTO users (username, email, password_hash, role_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, username, email, status
        `, [username, email, passwordHash, roleId]);
        
        res.json({ status: 'created', user: result.rows[0] });
    } catch (error) {
        console.error('[POINT] Error creating user:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: true, code: 'USER_EXISTS', message: 'User already exists' });
        }
        res.status(500).json({ error: true, code: 'USER_CREATE_ERROR', message: error.message });
    }
});

// PATCH /api/users/:id - Обновление пользователя
app.patch('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.id;
        const { email, role, status } = req.body;
        
        const updates = [];
        const values = [];
        let paramIndex = 1;
        
        if (email) {
            updates.push(`email = $${paramIndex++}`);
            values.push(email);
        }
        
        if (role) {
            const roleResult = await pool.query('SELECT id FROM roles WHERE name = $1', [role]);
            if (roleResult.rows.length === 0) {
                return res.status(400).json({ error: true, code: 'ROLE_NOT_FOUND', message: 'Role not found' });
            }
            updates.push(`role_id = $${paramIndex++}`);
            values.push(roleResult.rows[0].id);
        }
        
        if (status) {
            updates.push(`status = $${paramIndex++}`);
            values.push(status);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: true, code: 'INVALID_PARAMS', message: 'No fields to update' });
        }
        
        values.push(userId);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);
        
        res.json({ status: 'updated', user_id: userId });
    } catch (error) {
        console.error('[POINT] Error updating user:', error);
        res.status(500).json({ error: true, code: 'USER_UPDATE_ERROR', message: error.message });
    }
});

// DELETE /api/users/:id - Удаление пользователя
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.id;
        
        await pool.query('UPDATE users SET status = $1 WHERE id = $2', ['inactive', userId]);
        
        res.json({ status: 'deleted', user_id: userId });
    } catch (error) {
        console.error('[POINT] Error deleting user:', error);
        res.status(500).json({ error: true, code: 'USER_DELETE_ERROR', message: error.message });
    }
});

// Initialize RabbitMQ on startup
initRabbitMQ();

// Используем утилиту для поиска свободного порта

// Запуск сервера
async function startServer() {
    try {
        if (!isDocker) {
            try {
                const availablePort = await findAvailablePort(DEFAULT_PORT, 500);
                if (availablePort !== DEFAULT_PORT) {
                    console.log(`[POINT] ⚠️  Порт ${DEFAULT_PORT} занят. Используется ${availablePort}`);
                }
                PORT = availablePort;
            } catch (portError) {
                console.error('❌ [POINT] Не удалось подобрать свободный порт:', portError.message);
                process.exit(1);
            }
        } else {
            PORT = DEFAULT_PORT;
        }

        const server = app.listen(PORT, () => {
            console.log(`VSS POINT service listening on port ${PORT}`);
            
            // Graceful shutdown
            const { setupGracefulShutdown } = require('../../utils/graceful-shutdown');
            setupGracefulShutdown({ server, pool }, 'POINT');
        });
    } catch (error) {
        console.error('❌ [POINT] Ошибка запуска сервера:', error.message);
        process.exit(1);
    }
}

startServer();
