const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const net = require('net');
const fs = require('fs');
const SlotEngine = require('./slot-engine');
const TelegramBotManager = require('./telegram-bot');
const { findAvailablePort } = require('../../utils/port-finder');
require('dotenv').config();

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT) || 8082;
let PORT = DEFAULT_PORT;

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
}, 'DCI');

initDatabaseWithRetry(pool, 'DCI').catch(error => {
    console.error('[DCI] ❌ Failed to initialize database.');
});

// RabbitMQ connection
let rabbitmqChannel = null;
let rabbitmqConnection = null;

// Slot engines cache (вынесен на уровень модуля для доступа из всех функций)
const slotEngines = new Map();

// Telegram Bot Manager
let telegramBot = null;

const initRabbitMQ = async () => {
    try {
        const defaultRabbitMQUrl = `amqp://vss-admin:vss_rabbit_pass@${RABBITMQ_HOST}:5672/vss`;
        const rabbitmqUrl = process.env.RABBITMQ_URL || defaultRabbitMQUrl;
        const connection = await amqp.connect(rabbitmqUrl);
        rabbitmqConnection = connection;
        rabbitmqChannel = await connection.createChannel();
        
        // Assert exchanges and queues for F-Flow
        await rabbitmqChannel.assertExchange('vss.events', 'topic', { durable: true });
        await rabbitmqChannel.assertExchange('vss.commands', 'topic', { durable: true });
        await rabbitmqChannel.assertQueue('vss.autodial.leads', { durable: true });
        await rabbitmqChannel.assertQueue('vss.gacs.commands', { durable: true });
        
        // Bind queues
        await rabbitmqChannel.bindQueue('vss.autodial.leads', 'vss.commands', 'autodial.lead');
        await rabbitmqChannel.bindQueue('vss.gacs.commands', 'vss.commands', 'gacs.execute');
        
        // Helper function to find available slot
        async function findAvailableSlot() {
            try {
                const result = await pool.query(
                    "SELECT id FROM slots WHERE status = 'free' LIMIT 1"
                );
                return result.rows.length > 0 ? result.rows[0].id : null;
            } catch (error) {
                console.error('[DCI] Error finding available slot:', error);
                return null;
            }
        }
        
        // Helper function to get or create slot engine
        async function getSlotEngine(slotId) {
            try {
                if (!slotEngines.has(slotId)) {
                    const slotResult = await pool.query('SELECT device_type FROM slots WHERE id = $1', [slotId]);
                    if (slotResult.rows.length > 0) {
                        slotEngines.set(slotId, new SlotEngine(slotId, slotResult.rows[0].device_type, pool, rabbitmqChannel));
                    } else {
                        return null;
                    }
                }
                return slotEngines.get(slotId);
            } catch (error) {
                console.error(`[DCI] Error getting slot engine for slot ${slotId}:`, error);
                return null;
            }
        }
        
        // Consume F-01: Autodial Lead Queue
        rabbitmqChannel.consume('vss.autodial.leads', async (msg) => {
            if (msg) {
                try {
                    const leadData = JSON.parse(msg.content.toString());
                    console.log('[DCI] Received autodial lead:', leadData);
                    
                    // Get or create slot engine
                    const slotId = leadData.slot_id || await findAvailableSlot();
                    if (!slotId) {
                        console.warn('[DCI] No available slot for autodial lead');
                        if (rabbitmqChannel) {
                            rabbitmqChannel.nack(msg, false, true); // Requeue
                        }
                        return;
                    }
                    
                    const slotEngine = await getSlotEngine(slotId);
                    if (slotEngine) {
                        await slotEngine.handleAutodialLead(leadData.lead || leadData);
                    }
                    
                    if (rabbitmqChannel) {
                        rabbitmqChannel.ack(msg);
                    }
                } catch (e) {
                    console.error('[DCI] Error processing autodial lead:', e);
                    if (rabbitmqChannel) {
                        rabbitmqChannel.nack(msg, false, false);
                    }
                }
            }
        });
        
        // Consume F-02: GACS Script Execution
        rabbitmqChannel.consume('vss.gacs.commands', async (msg) => {
            if (msg) {
                try {
                    const command = JSON.parse(msg.content.toString());
                    console.log('[DCI] Received GACS command:', command);
                    
                    const slotId = command.slot_id;
                    if (!slotId) {
                        console.warn('[DCI] No slot_id in GACS command');
                        if (rabbitmqChannel) {
                            rabbitmqChannel.nack(msg, false, false);
                        }
                        return;
                    }
                    
                    const slotEngine = await getSlotEngine(slotId);
                    if (slotEngine) {
                        await slotEngine.executeGacsScript(
                            command.script_name || command.script,
                            command.script_type || 'adb',
                            command.script_content || command.script
                        );
                    }
                    
                    if (rabbitmqChannel) {
                        rabbitmqChannel.ack(msg);
                    }
                } catch (e) {
                    console.error('[DCI] Error processing GACS command:', e);
                    if (rabbitmqChannel) {
                        rabbitmqChannel.nack(msg, false, false);
                    }
                }
            }
        });
        
        console.log('[DCI] Connected to RabbitMQ and configured F-Flow queues');
        
        // Инициализируем Telegram Bot Manager с RabbitMQ каналом
        if (!telegramBot) {
            telegramBot = new TelegramBotManager(pool, rabbitmqChannel);
        } else {
            // Обновляем канал если бот уже инициализирован
            telegramBot.rabbitmqChannel = rabbitmqChannel;
        }
    } catch (error) {
        console.error('[DCI] RabbitMQ connection error:', error.message);
        console.error('[DCI] RabbitMQ недоступен. Сервис будет работать без RabbitMQ.');
        console.error('[DCI] Для запуска RabbitMQ выполните: docker run -d --name rabbitmq-local -p 5672:5672 -p 15672:15672 -e RABBITMQ_DEFAULT_USER=vss-admin -e RABBITMQ_DEFAULT_PASS=vss_rabbit_pass -e RABBITMQ_DEFAULT_VHOST=/vss rabbitmq:3.12-management-alpine');
        
        // Пытаемся переподключиться через 30 секунд
        setTimeout(() => {
            console.log('[DCI] Попытка переподключения к RabbitMQ...');
            initRabbitMQ();
        }, 30000);
    }
};

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'vss-dci', timestamp: new Date().toISOString() });
});

// ============================================
// DCI / PIPELINES API
// ============================================

// GET /api/dci/pipelines - Список пайплайнов
app.get('/api/dci/pipelines', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, u.username as triggered_by_name
            FROM ci_pipelines p
            LEFT JOIN users u ON p.triggered_by = u.id
            ORDER BY p.created_at DESC
            LIMIT 100
        `);
        
        // Publish F-11 pipeline status if needed
        if (rabbitmqChannel && result.rows.length > 0) {
            result.rows.forEach(pipeline => {
                if (pipeline.status === 'running' || pipeline.status === 'completed') {
                    rabbitmqChannel.publish('vss.events', 'pipeline.update', Buffer.from(JSON.stringify({
                        event: 'pipeline.update',
                        pipeline_id: pipeline.id,
                        status: pipeline.status,
                        f_flow: 'F-11',
                        timestamp: new Date().toISOString()
                    })));
                }
            });
        }
        
        const pipelines = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            branch: row.branch,
            status: row.status,
            triggered_by: row.triggered_by_name,
            start_time: row.start_time,
            end_time: row.end_time,
            log_url: row.log_url
        }));
        
        res.json(pipelines);
    } catch (error) {
        console.error('[DCI] Error fetching pipelines:', error);
        res.status(500).json({ error: true, code: 'PIPELINE_FETCH_ERROR', message: error.message });
    }
});

// POST /api/dci/pipeline/:id/run - Запуск пайплайна
app.post('/api/dci/pipeline/:id/run', async (req, res) => {
    try {
        const pipelineId = parseInt(req.params.id);
        const userId = req.user?.id || null;
        
        // Update pipeline status
        await pool.query(`
            UPDATE ci_pipelines 
            SET status = $1, triggered_by = $2, start_time = NOW()
            WHERE id = $3
        `, ['running', userId, pipelineId]);
        
        // Publish pipeline event
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.events', 'pipeline.start', Buffer.from(JSON.stringify({
                pipeline_id: pipelineId,
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({ status: 'running', pipeline_id: pipelineId });
    } catch (error) {
        console.error('[DCI] Error running pipeline:', error);
        res.status(500).json({ error: true, code: 'PIPELINE_RUN_ERROR', message: error.message });
    }
});

// POST /api/dci/pipeline/:id/stop - Остановка пайплайна
app.post('/api/dci/pipeline/:id/stop', async (req, res) => {
    try {
        const pipelineId = parseInt(req.params.id);
        
        // Update pipeline status
        await pool.query(`
            UPDATE ci_pipelines 
            SET status = $1, end_time = NOW()
            WHERE id = $2
        `, ['failed', pipelineId]);
        
        // Publish pipeline event
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.events', 'pipeline.stop', Buffer.from(JSON.stringify({
                pipeline_id: pipelineId,
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({ status: 'stopped', pipeline_id: pipelineId });
    } catch (error) {
        console.error('[DCI] Error stopping pipeline:', error);
        res.status(500).json({ error: true, code: 'PIPELINE_STOP_ERROR', message: error.message });
    }
});

// GET /api/dci/pipeline/:id/status - Статус пайплайна
app.get('/api/dci/pipeline/:id/status', async (req, res) => {
    try {
        const pipelineId = parseInt(req.params.id);
        const result = await pool.query('SELECT * FROM ci_pipelines WHERE id = $1', [pipelineId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, code: 'PIPELINE_NOT_FOUND', message: 'Pipeline not found' });
        }
        
        const pipeline = result.rows[0];
        res.json({
            id: pipeline.id,
            name: pipeline.name,
            status: pipeline.status,
            start_time: pipeline.start_time,
            end_time: pipeline.end_time,
            log_url: pipeline.log_url
        });
    } catch (error) {
        console.error('[DCI] Error fetching pipeline status:', error);
        res.status(500).json({ error: true, code: 'PIPELINE_STATUS_ERROR', message: error.message });
    }
});

// ============================================
// MONITORING API
// ============================================

// GET /api/dci/status - Статус DCI системы
app.get('/api/dci/status', async (req, res) => {
    try {
        // Get database status
        const dbCheck = await pool.query('SELECT NOW() as time');
        
        // Get active pipelines count
        const activePipelines = await pool.query(
            "SELECT COUNT(*) as count FROM ci_pipelines WHERE status = 'running'"
        );
        
        res.json({
            database: 'connected',
            active_pipelines: parseInt(activePipelines.rows[0].count),
            timestamp: dbCheck.rows[0].time
        });
    } catch (error) {
        console.error('[DCI] Error fetching status:', error);
        res.status(500).json({ error: true, code: 'DCI_STATUS_ERROR', message: error.message });
    }
});

// GET /api/dci/logs - Логи пайплайнов
app.get('/api/dci/logs', async (req, res) => {
    try {
        const { module, severity, limit = 100 } = req.query;
        
        let query = 'SELECT * FROM events_log WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (module) {
            query += ` AND module = $${paramIndex++}`;
            params.push(module);
        }
        
        if (severity) {
            query += ` AND severity = $${paramIndex++}`;
            params.push(severity);
        }
        
        query += ` ORDER BY timestamp DESC LIMIT $${paramIndex++}`;
        params.push(parseInt(limit));
        
        const result = await pool.query(query, params);
        
        res.json(result.rows);
    } catch (error) {
        console.error('[DCI] Error fetching logs:', error);
        res.status(500).json({ error: true, code: 'LOGS_FETCH_ERROR', message: error.message });
    }
});

// POST /api/dci/log-event - Логирование события
app.post('/api/dci/log-event', async (req, res) => {
    try {
        const { module, severity, message, context, user_id } = req.body;
        
        if (!module || !severity || !message) {
            return res.status(400).json({ error: true, code: 'INVALID_PARAMS', message: 'module, severity, and message are required' });
        }
        
        await pool.query(`
            INSERT INTO events_log (module, severity, message, context, user_id)
            VALUES ($1, $2, $3, $4, $5)
        `, [module, severity, message, context || {}, user_id || null]);
        
        // Отправляем уведомление в Telegram если бот подключен и это критичное событие
        if (telegramBot && telegramBot.isConnected && (severity === 'error' || severity === 'critical')) {
            try {
                await telegramBot.sendMessage(
                    `⚠️ *${module.toUpperCase()}*\n\n` +
                    `*${severity.toUpperCase()}*: ${message}\n` +
                    (context ? `\nКонтекст: \`${JSON.stringify(context)}\`` : ''),
                    null,
                    { parse_mode: 'Markdown' }
                );
            } catch (tgError) {
                console.error('[DCI] Error sending Telegram notification:', tgError);
            }
        }
        
        res.json({ status: 'logged' });
    } catch (error) {
        console.error('[DCI] Error logging event:', error);
        res.status(500).json({ error: true, code: 'LOG_EVENT_ERROR', message: error.message });
    }
});

// ============================================
// TELEGRAM BOT API
// ============================================

// POST /api/dci/telegram/connect - Подключение к Telegram боту
app.post('/api/dci/telegram/connect', async (req, res) => {
    try {
        const { bot_token, chat_id } = req.body;
        
        if (!bot_token) {
            return res.status(400).json({ 
                error: true, 
                code: 'INVALID_PARAMS', 
                message: 'bot_token is required' 
            });
        }

        if (!telegramBot) {
            telegramBot = new TelegramBotManager(pool, rabbitmqChannel);
        }

        const result = await telegramBot.connect(bot_token, chat_id || null);
        res.json(result);
    } catch (error) {
        console.error('[DCI] Error connecting Telegram bot:', error);
        console.error('[DCI] Error stack:', error.stack);
        const errorMessage = error.message || 'Unknown error';
        res.status(500).json({ 
            error: true, 
            code: 'TELEGRAM_CONNECT_ERROR', 
            message: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// POST /api/dci/telegram/disconnect - Отключение от Telegram бота
app.post('/api/dci/telegram/disconnect', async (req, res) => {
    try {
        if (!telegramBot) {
            return res.status(400).json({ 
                error: true, 
                code: 'BOT_NOT_INITIALIZED', 
                message: 'Telegram bot is not initialized' 
            });
        }

        const result = await telegramBot.disconnect();
        res.json(result);
    } catch (error) {
        console.error('[DCI] Error disconnecting Telegram bot:', error);
        res.status(500).json({ 
            error: true, 
            code: 'TELEGRAM_DISCONNECT_ERROR', 
            message: error.message 
        });
    }
});

// GET /api/dci/telegram/status - Статус Telegram бота
app.get('/api/dci/telegram/status', async (req, res) => {
    try {
        if (!telegramBot) {
            return res.json({ 
                is_connected: false, 
                message: 'Telegram bot is not initialized' 
            });
        }

        const status = telegramBot.getStatus();
        res.json(status);
    } catch (error) {
        console.error('[DCI] Error getting Telegram bot status:', error);
        res.status(500).json({ 
            error: true, 
            code: 'TELEGRAM_STATUS_ERROR', 
            message: error.message 
        });
    }
});

// POST /api/dci/telegram/send - Отправка сообщения через Telegram бота
app.post('/api/dci/telegram/send', async (req, res) => {
    try {
        const { message, chat_id, parse_mode } = req.body;
        
        if (!message) {
            return res.status(400).json({ 
                error: true, 
                code: 'INVALID_PARAMS', 
                message: 'message is required' 
            });
        }

        if (!telegramBot || !telegramBot.isConnected) {
            return res.status(400).json({ 
                error: true, 
                code: 'BOT_NOT_CONNECTED', 
                message: 'Telegram bot is not connected' 
            });
        }

        const options = {};
        if (parse_mode) {
            options.parse_mode = parse_mode;
        }

        const result = await telegramBot.sendMessage(message, chat_id || null, options);
        res.json({ 
            success: true, 
            message_id: result.message_id,
            chat_id: result.chat.id 
        });
    } catch (error) {
        console.error('[DCI] Error sending Telegram message:', error);
        res.status(500).json({ 
            error: true, 
            code: 'TELEGRAM_SEND_ERROR', 
            message: error.message 
        });
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
                    console.log(`[DCI] ⚠️  Порт ${DEFAULT_PORT} занят. Используется свободный порт ${availablePort}`);
                }
                PORT = availablePort;
            } catch (portError) {
                console.error('❌ [DCI] Не удалось подобрать свободный порт:', portError.message);
                process.exit(1);
            }
        } else {
            PORT = DEFAULT_PORT;
        }

        const server = app.listen(PORT, async () => {
            console.log(`VSS DCI service listening on port ${PORT}`);
            
            // Автоматическое подключение Telegram бота при старте (если есть сохраненная конфигурация)
            if (telegramBot) {
                try {
                    await telegramBot.autoConnect();
                } catch (error) {
                    console.error('[DCI] Error auto-connecting Telegram bot:', error);
                }
            }
            
            // Graceful shutdown
            const { setupGracefulShutdown } = require('../../utils/graceful-shutdown');
            setupGracefulShutdown({ server, pool, rabbitmqConnection: global.rabbitmqConnection }, 'DCI');
        });
    } catch (error) {
        console.error('❌ [DCI] Ошибка запуска сервера:', error.message);
        process.exit(1);
    }
}

startServer();
