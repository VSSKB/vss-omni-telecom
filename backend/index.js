const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors'); // Добавляем CORS

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

// Эндпоинт для создания пользователя VSS (пример)
app.post('/api/vss-users', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    // Здесь должна быть ваша реальная логика создания пользователя VSS.
    // Например, вызов внешнего API VSS или запись в базу данных, связанную с VSS.
    console.log(`[Backend] Received request to create VSS user: ${username}`);
    // await someVSSIntegration.createUser(username, password);

    // Временная заглушка
    await new Promise(resolve => setTimeout(resolve, 1000));

    res.status(201).json({ message: `VSS User ${username} created successfully (simulated).` });
});


// Запуск сервера
app.listen(PORT, () => {
    console.log(`Backend server for VSS Project listening on port ${PORT}`);
});
