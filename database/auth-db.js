/**
 * Локальная база данных для авторизации и аутентификации
 * Использует SQLite для хранения пользователей и сессий
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const DB_DIR = path.join(__dirname, '..', 'db_data');
const DB_PATH = path.join(DB_DIR, 'auth.db');

// Убеждаемся, что директория существует
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

class AuthDatabase {
    constructor() {
        this.db = null;
    }

    // Инициализация базы данных
    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(DB_PATH, (err) => {
                if (err) {
                    console.error('Ошибка открытия базы данных:', err);
                    reject(err);
                    return;
                }
                console.log('База данных авторизации подключена:', DB_PATH);
                this.createTables().then(resolve).catch(reject);
            });
        });
    }

    // Создание таблиц
    async createTables() {
        return new Promise((resolve, reject) => {
            const queries = [
                // Таблица пользователей
                `CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    email TEXT,
                    role TEXT NOT NULL DEFAULT 'operator',
                    full_name TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_login DATETIME,
                    is_active INTEGER DEFAULT 1,
                    failed_login_attempts INTEGER DEFAULT 0,
                    locked_until DATETIME
                )`,
                
                // Таблица сессий
                `CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    project_id TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )`,
                
                // Таблица попыток входа
                `CREATE TABLE IF NOT EXISTS login_attempts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL,
                    ip_address TEXT,
                    success INTEGER DEFAULT 0,
                    attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    failure_reason TEXT
                )`,
                
                // Индексы для производительности
                `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
                `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
                `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
                `CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username)`
            ];

            let completed = 0;
            queries.forEach((query, index) => {
                this.db.run(query, (err) => {
                    if (err) {
                        console.error(`Ошибка выполнения запроса ${index + 1}:`, err);
                        reject(err);
                        return;
                    }
                    completed++;
                    if (completed === queries.length) {
                        console.log('Таблицы базы данных авторизации созданы');
                        this.createDefaultAdmin().then(resolve).catch(reject);
                    }
                });
            });
        });
    }

    // Создание администратора по умолчанию
    async createDefaultAdmin() {
        return new Promise((resolve) => {
            const defaultUsername = 'admin';
            const defaultPassword = 'admin123';
            const defaultRole = 'admin';

            // Проверяем, существует ли уже администратор
            this.db.get('SELECT id FROM users WHERE username = ?', [defaultUsername], async (err, row) => {
                if (err) {
                    console.error('Ошибка проверки администратора:', err);
                    resolve();
                    return;
                }

                if (!row) {
                    // Создаем администратора по умолчанию
                    const passwordHash = await bcrypt.hash(defaultPassword, 10);
                    this.db.run(
                        'INSERT INTO users (username, password_hash, role, full_name, email) VALUES (?, ?, ?, ?, ?)',
                        [defaultUsername, passwordHash, defaultRole, 'System Administrator', 'admin@vss.local'],
                        (err) => {
                            if (err) {
                                console.error('Ошибка создания администратора по умолчанию:', err);
                            } else {
                                console.log('Администратор по умолчанию создан:');
                                console.log(`  Username: ${defaultUsername}`);
                                console.log(`  Password: ${defaultPassword}`);
                                console.log('  ⚠️  ВАЖНО: Измените пароль после первого входа!');
                            }
                            resolve();
                        }
                    );
                } else {
                    resolve();
                }
            });
        });
    }

    // Регистрация нового пользователя
    async registerUser(username, password, role = 'operator', email = null, fullName = null) {
        return new Promise(async (resolve, reject) => {
            try {
                // Проверяем, существует ли пользователь
                const existingUser = await this.getUserByUsername(username);
                if (existingUser) {
                    reject(new Error('Пользователь с таким именем уже существует'));
                    return;
                }

                // Хешируем пароль
                const passwordHash = await bcrypt.hash(password, 10);

                // Создаем пользователя
                this.db.run(
                    'INSERT INTO users (username, password_hash, role, email, full_name) VALUES (?, ?, ?, ?, ?)',
                    [username, passwordHash, role, email, fullName],
                    function(err) {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve({
                            id: this.lastID,
                            username: username,
                            role: role,
                            email: email,
                            fullName: fullName
                        });
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    }

    // Аутентификация пользователя
    async authenticateUser(username, password, ipAddress = null, userAgent = null) {
        return new Promise(async (resolve, reject) => {
            try {
                // Проверяем, что база данных инициализирована
                if (!this.db) {
                    reject(new Error('База данных не инициализирована'));
                    return;
                }
                
                // Получаем пользователя
                const user = await this.getUserByUsername(username);
                
                if (!user) {
                    await this.logLoginAttempt(username, ipAddress, false, 'User not found');
                    reject(new Error('Неверное имя пользователя или пароль'));
                    return;
                }

                // Проверяем, активен ли пользователь
                if (!user.is_active) {
                    await this.logLoginAttempt(username, ipAddress, false, 'User account is disabled');
                    reject(new Error('Учетная запись отключена'));
                    return;
                }

                // Проверяем, не заблокирован ли пользователь
                if (user.locked_until && new Date(user.locked_until) > new Date()) {
                    await this.logLoginAttempt(username, ipAddress, false, 'User account is locked');
                    reject(new Error(`Учетная запись заблокирована до ${new Date(user.locked_until).toLocaleString()}`));
                    return;
                }

                // Проверяем пароль
                const passwordMatch = await bcrypt.compare(password, user.password_hash);
                
                if (!passwordMatch) {
                    // Увеличиваем счетчик неудачных попыток
                    const newAttempts = user.failed_login_attempts + 1;
                    let lockedUntil = null;
                    
                    // Блокируем после 5 неудачных попыток на 30 минут
                    if (newAttempts >= 5) {
                        lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
                    }

                    this.db.run(
                        'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
                        [newAttempts, lockedUntil, user.id]
                    );

                    await this.logLoginAttempt(username, ipAddress, false, 'Invalid password');
                    reject(new Error('Неверное имя пользователя или пароль'));
                    return;
                }

                // Сбрасываем счетчик неудачных попыток и обновляем время последнего входа
                this.db.run(
                    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = CURRENT_TIMESTAMP WHERE id = ?',
                    [user.id]
                );

                await this.logLoginAttempt(username, ipAddress, true, null);

                // Удаляем пароль из результата
                delete user.password_hash;
                resolve(user);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Получение пользователя по имени
    async getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE username = ?',
                [username],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(row || null);
                }
            );
        });
    }

    // Получение пользователя по ID
    async getUserById(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT id, username, email, role, full_name, created_at, last_login, is_active FROM users WHERE id = ?',
                [userId],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(row || null);
                }
            );
        });
    }

    // Создание сессии
    async createSession(userId, projectId = null, ipAddress = null, userAgent = null, expiresInHours = 24) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('База данных не инициализирована'));
                return;
            }
            
            const sessionId = require('crypto').randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

            this.db.run(
                'INSERT INTO sessions (id, user_id, project_id, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
                [sessionId, userId, projectId, expiresAt, ipAddress, userAgent],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({
                        sessionId: sessionId,
                        expiresAt: expiresAt
                    });
                }
            );
        });
    }

    // Проверка сессии
    async validateSession(sessionId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT s.*, u.username, u.role, u.is_active FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP',
                [sessionId],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    if (!row || !row.is_active) {
                        resolve(null);
                        return;
                    }
                    resolve(row);
                }
            );
        });
    }

    // Удаление сессии
    async deleteSession(sessionId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM sessions WHERE id = ?', [sessionId], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    // Удаление истекших сессий
    async cleanupExpiredSessions() {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP', (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    // Логирование попытки входа
    async logLoginAttempt(username, ipAddress, success, failureReason = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO login_attempts (username, ip_address, success, failure_reason) VALUES (?, ?, ?, ?)',
                [username, ipAddress, success ? 1 : 0, failureReason],
                (err) => {
                    if (err) {
                        console.error('Ошибка логирования попытки входа:', err);
                    }
                    resolve();
                }
            );
        });
    }

    // Получение списка пользователей
    async getAllUsers() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT id, username, email, role, full_name, created_at, last_login, is_active FROM users ORDER BY created_at DESC',
                [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(rows || []);
                }
            );
        });
    }

    // Обновление пароля пользователя
    async updateUserPassword(userId, newPassword) {
        return new Promise(async (resolve, reject) => {
            try {
                const passwordHash = await bcrypt.hash(newPassword, 10);
                this.db.run(
                    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [passwordHash, userId],
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve();
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    }

    // Обновление роли пользователя
    async updateUserRole(userId, newRole) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newRole, userId],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                }
            );
        });
    }

    // Активация/деактивация пользователя
    async setUserActive(userId, isActive) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [isActive ? 1 : 0, userId],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                }
            );
        });
    }

    // Удаление пользователя
    async deleteUser(userId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    // Закрытие соединения
    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    console.log('Соединение с базой данных авторизации закрыто');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

// Создаем единственный экземпляр базы данных
const authDB = new AuthDatabase();

// Флаг инициализации
let isInitialized = false;
let initPromise = null;

// Функция инициализации с защитой от повторных вызовов
function ensureInitialized() {
    if (isInitialized && authDB.db) {
        return Promise.resolve();
    }
    
    if (initPromise) {
        return initPromise;
    }
    
    initPromise = authDB.init()
        .then(() => {
            isInitialized = true;
            initPromise = null;
            console.log('База данных авторизации успешно инициализирована');
        })
        .catch(err => {
            console.error('Ошибка инициализации базы данных авторизации:', err);
            initPromise = null;
            throw err;
        });
    
    return initPromise;
}

// Инициализируем при загрузке модуля
ensureInitialized().catch(err => {
    console.error('Критическая ошибка инициализации базы данных авторизации:', err);
});

// Очистка истекших сессий каждые 30 минут
setInterval(() => {
    if (authDB.db) {
        authDB.cleanupExpiredSessions().catch(err => {
            console.error('Ошибка очистки истекших сессий:', err);
        });
    }
}, 30 * 60 * 1000);

// Экспортируем объект с методом ensureInitialized
const authDBProxy = new Proxy(authDB, {
    get(target, prop) {
        // Исключаем ensureInitialized из обертки, чтобы избежать двойной инициализации
        if (prop === 'ensureInitialized') {
            return ensureInitialized;
        }
        // Для методов, требующих БД, проверяем инициализацию
        if (typeof target[prop] === 'function' && prop !== 'init' && prop !== 'close') {
            return async function(...args) {
                await ensureInitialized();
                return await target[prop].apply(target, args);
            };
        }
        return target[prop];
    },
    set(target, prop, value) {
        // Разрешаем установку свойств на Proxy, включая ensureInitialized
        if (prop === 'ensureInitialized') {
            // Сохраняем в отдельном объекте, чтобы избежать конфликта с get trap
            target._ensureInitialized = value;
            return true;
        }
        target[prop] = value;
        return true;
    }
});

// Устанавливаем ensureInitialized через set trap
authDBProxy.ensureInitialized = ensureInitialized;

module.exports = authDBProxy;

