// admin-backend/logger.js
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info', // Уровень логирования: 'error', 'warn', 'info', 'verbose', 'debug', 'silly'
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({ filename: '/app/logs/error.log', level: 'error' }), // Путь внутри контейнера
        new winston.transports.File({ filename: '/app/logs/combined.log' }) // Путь внутри контейнера
    ]
});

module.exports = logger;
