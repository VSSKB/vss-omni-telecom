const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const net = require('net');
const fs = require('fs');
const SlotEngine = require('./slot-engine');
const { findAvailablePort } = require('../../utils/port-finder');
require('dotenv').config();

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT) || 8082;
let PORT = DEFAULT_PORT;

app.use(cors());
app.use(express.json());

// Определяем, запущен ли сервис в Docker или локально
const isDocker = process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv');
const POSTGRES_HOST = isDocker ? 'postgres' : 'localhost';
const RABBITMQ_HOST = isDocker ? 'rabbitmq' : 'localhost';

// Database connection
const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || `postgresql://vss:vss_postgres_pass@${POSTGRES_HOST}:5432/vss_db`,
});

// RabbitMQ connection
let rabbitmqChannel = null;
let rabbitmqConnection = null;

// Slot engines cache (вынесен на уровень модуля для доступа из всех функций)
const slotEngines = new Map();

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
    } catch (error) {
        console.error('[DCI] RabbitMQ connection error:', error.message);
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
        
        res.json({ status: 'logged' });
    } catch (error) {
        console.error('[DCI] Error logging event:', error);
        res.status(500).json({ error: true, code: 'LOG_EVENT_ERROR', message: error.message });
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

        app.listen(PORT, () => {
            console.log(`VSS DCI service listening on port ${PORT}`);
        });
    } catch (error) {
        console.error('❌ [DCI] Ошибка запуска сервера:', error.message);
        process.exit(1);
    }
}

startServer();
