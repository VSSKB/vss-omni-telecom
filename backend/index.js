const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.APP_PORT || 3001; // Используем переменную окружения APP_PORT

app.use(cors()); // Включаем CORS для всех запросов
app.use(bodyParser.json());

// Конфигурация PostgreSQL (будет использоваться только если проект включает DB)
const dbConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST, // Имя сервиса БД в Docker Compose
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT, // Внутренний порт DB контейнера
};

let pool;
if (dbConfig.user && dbConfig.host && dbConfig.database && dbConfig.password && dbConfig.port) {
    pool = new Pool(dbConfig);
    console.log('PostgreSQL Pool initialized.');

    // Простая проверка соединения с БД при запуске
    pool.connect()
        .then(client => {
            console.log('Connected to PostgreSQL successfully!');
            client.release();
        })
        .catch(err => {
            console.error('Failed to connect to PostgreSQL:', err.message);
        });

} else {
    console.warn('PostgreSQL environment variables are not fully set. Database functionality will be unavailable.');
}


// --- API Endpoints для шаблона бэкенда ---

app.get('/', (req, res) => {
    res.send(`Backend for VSS Project is running on port ${PORT}!`);
});

// Пример эндпоинта для проверки соединения с БД
app.get('/api/db-test', async (req, res) => {
    if (!pool) {
        return res.status(500).json({ message: 'Database is not configured for this project.' });
    }
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        res.json({ message: 'Database connection successful!', time: result.rows[0].now });
    } catch (err) {
        console.error('Database query error:', err.stack);
        res.status(500).json({ message: 'Database connection failed', error: err.message });
    }
});

// Эндпоинт для создания пользователя VSS
app.post('/api/vss-users', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    // Валидация имени пользователя и пароля
    if (username.length < 3 || username.length > 50) {
        return res.status(400).json({ message: 'Username must be between 3 and 50 characters.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    console.log(`[Backend] Received request to create VSS user: ${username}`);

    try {
        // Если база данных доступна, создаем пользователя в БД
        if (pool) {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Проверяем, существует ли пользователь
            const checkUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
            if (checkUser.rows.length > 0) {
                return res.status(409).json({ message: `User ${username} already exists.` });
            }

            // Создаем пользователя в БД
            const result = await pool.query(
                'INSERT INTO users (username, password_hash, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id, username, created_at',
                [username, hashedPassword]
            );

            console.log(`[Backend] VSS user ${username} created successfully in database.`);
            res.status(201).json({ 
                message: `VSS User ${username} created successfully.`,
                user: {
                    id: result.rows[0].id,
                    username: result.rows[0].username,
                    created_at: result.rows[0].created_at
                }
            });
        } else {
            // Если БД недоступна, сохраняем в файл (fallback)
            const usersFilePath = path.join(__dirname, 'vss-users.json');
            let users = {};
            
            try {
                if (fs.existsSync(usersFilePath)) {
                    users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
                }
            } catch (e) {
                console.warn('[Backend] Could not read users file, creating new one.');
            }

            // Проверяем, существует ли пользователь
            if (users[username]) {
                return res.status(409).json({ message: `User ${username} already exists.` });
            }

            // Хешируем пароль
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Сохраняем пользователя
            users[username] = {
                password_hash: hashedPassword,
                created_at: new Date().toISOString()
            };

            fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
            console.log(`[Backend] VSS user ${username} created successfully in file.`);
            res.status(201).json({ 
                message: `VSS User ${username} created successfully (saved to file).`,
                user: {
                    username: username,
                    created_at: users[username].created_at
                }
            });
        }
    } catch (error) {
        console.error('[Backend] Error creating VSS user:', error);
        res.status(500).json({ 
            message: `Error creating user: ${error.message}` 
        });
    }
});


// Запуск сервера
app.listen(PORT, () => {
    console.log(`Backend server for VSS Project listening on port ${PORT}`);
});
