const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const amqp = require('amqplib');
const http = require('http');
const { Server } = require('socket.io');
const net = require('net');
const fs = require('fs');
const { findAvailablePort, isPortFullyAvailable } = require('../../utils/port-finder');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const DEFAULT_PORT = parseInt(process.env.PORT) || 3000;
let PORT = DEFAULT_PORT;

app.use(cors());
app.use(express.json());

// Health check endpoints
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/health/ready', async (req, res) => {
    try {
        // Check database connection
        await pool.query('SELECT 1');
        res.json({ status: 'ready', timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(503).json({ status: 'not ready', error: error.message });
    }
});

app.get('/health/live', (req, res) => {
    res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

app.get('/health/startup', (req, res) => {
    res.json({ status: 'started', timestamp: new Date().toISOString() });
});

// Определяем, запущен ли сервис в Docker или локально
const isDocker = process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv');
const RABBITMQ_HOST = isDocker ? 'rabbitmq' : 'localhost';
const POSTGRES_HOST = isDocker ? 'postgres' : 'localhost';

// Database connection
const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || `postgresql://vss:vss_postgres_pass@${POSTGRES_HOST}:5432/vss_db`,
});

// RabbitMQ connection
let rabbitmqChannel = null;
let rabbitmqConnection = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = parseInt(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS) || 5; // Уменьшено до 5 попыток
const INITIAL_RECONNECT_DELAY = parseInt(process.env.RABBITMQ_RECONNECT_DELAY) || 30000; // 30 секунд начальная задержка
const RABBITMQ_ENABLED = process.env.RABBITMQ_ENABLED !== 'false'; // Можно отключить через переменную окружения
const RABBITMQ_AUTO_RECONNECT = process.env.RABBITMQ_AUTO_RECONNECT !== 'false'; // Можно отключить автопереподключение
let lastErrorLogTime = 0;
const ERROR_LOG_INTERVAL = 60000; // Логировать ошибки не чаще раза в минуту

const initRabbitMQ = async () => {
    // Проверяем, включен ли RabbitMQ
    if (!RABBITMQ_ENABLED) {
        console.log('[WORKSPACE] ℹ️  RabbitMQ отключен через переменную окружения RABBITMQ_ENABLED=false');
        return;
    }

    try {
        const defaultRabbitMQUrl = `amqp://vss-admin:vss_rabbit_pass@${RABBITMQ_HOST}:5672/vss`;
        const rabbitmqUrl = process.env.RABBITMQ_URL || defaultRabbitMQUrl;
        
        // Логируем только при первой попытке или если прошло достаточно времени
        const now = Date.now();
        if (reconnectAttempts === 0 || (now - lastErrorLogTime) > ERROR_LOG_INTERVAL) {
            console.log(`[WORKSPACE] Подключение к RabbitMQ: ${rabbitmqUrl.replace(/:[^:@]+@/, ':****@')}`);
            lastErrorLogTime = now;
        }
        
        // Устанавливаем таймаут подключения
        const connection = await Promise.race([
            amqp.connect(rabbitmqUrl, {
                heartbeat: 60,
                connection_timeout: 10000 // 10 секунд таймаут
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
            )
        ]);
        
        rabbitmqConnection = connection;
        reconnectAttempts = 0; // Сбрасываем счетчик при успешном подключении
        lastErrorLogTime = 0; // Сбрасываем таймер ошибок
        
        // Обработка закрытия соединения
        connection.on('error', (err) => {
            // Логируем ошибки реже
            const now = Date.now();
            if ((now - lastErrorLogTime) > ERROR_LOG_INTERVAL) {
                console.error('[WORKSPACE] RabbitMQ connection error:', err.message);
                lastErrorLogTime = now;
            }
            rabbitmqChannel = null;
            if (RABBITMQ_AUTO_RECONNECT) {
                scheduleReconnect();
            }
        });
        
        connection.on('close', () => {
            // Логируем закрытие реже
            const now = Date.now();
            if ((now - lastErrorLogTime) > ERROR_LOG_INTERVAL) {
                console.warn('[WORKSPACE] RabbitMQ connection closed.');
                lastErrorLogTime = now;
            }
            rabbitmqChannel = null;
            if (RABBITMQ_AUTO_RECONNECT) {
                scheduleReconnect();
            }
        });
        
        rabbitmqChannel = await connection.createChannel();
        console.log('[WORKSPACE] ✅ Connected to RabbitMQ successfully');
        
        // Assert exchanges for F-Flow events
        await rabbitmqChannel.assertExchange('vss.events', 'topic', { durable: true });
        await rabbitmqChannel.assertExchange('vss.commands', 'topic', { durable: true });
        
        // Subscribe to all F-Flow events
        await rabbitmqChannel.assertQueue('vss.call.events', { durable: true });
        await rabbitmqChannel.assertQueue('vss.slot.events', { durable: true });
        await rabbitmqChannel.assertQueue('vss.pipeline.events', { durable: true });
        await rabbitmqChannel.assertQueue('vss.system.alerts', { durable: true });
        
        // Bind queues to exchanges for F-Flow routing
        await rabbitmqChannel.bindQueue('vss.call.events', 'vss.events', 'call.*');
        await rabbitmqChannel.bindQueue('vss.slot.events', 'vss.events', 'slot.*');
        await rabbitmqChannel.bindQueue('vss.pipeline.events', 'vss.events', 'pipeline.*');
        await rabbitmqChannel.bindQueue('vss.system.alerts', 'vss.events', 'system.alert');
        
        // Consume F-03, F-09, F-10: Call events (SIP Outbound/Inbound)
        rabbitmqChannel.consume('vss.call.events', (msg) => {
            if (msg) {
                try {
                    const event = JSON.parse(msg.content.toString());
                    // Emit to Socket.IO clients
                    io.emit('call.update', event);
                    io.emit(event.event || 'call.update', event);
                    rabbitmqChannel.ack(msg);
                } catch (e) {
                    console.error('[WORKSPACE] Error processing call event:', e);
                    if (rabbitmqChannel) {
                        rabbitmqChannel.nack(msg, false, false);
                    }
                }
            }
        });
        
        // Consume F-05: Slot Status Sync events
        rabbitmqChannel.consume('vss.slot.events', (msg) => {
            if (msg) {
                try {
                    const event = JSON.parse(msg.content.toString());
                    io.emit('slot.update', event);
                    io.emit(event.event || 'slot.update', event);
                    rabbitmqChannel.ack(msg);
                } catch (e) {
                    console.error('[WORKSPACE] Error processing slot event:', e);
                    if (rabbitmqChannel) {
                        rabbitmqChannel.nack(msg, false, false);
                    }
                }
            }
        });
        
        // Consume Pipeline events
        rabbitmqChannel.consume('vss.pipeline.events', (msg) => {
            if (msg) {
                try {
                    const event = JSON.parse(msg.content.toString());
                    io.emit('pipeline.update', event);
                    rabbitmqChannel.ack(msg);
                } catch (e) {
                    console.error('[WORKSPACE] Error processing pipeline event:', e);
                    if (rabbitmqChannel) {
                        rabbitmqChannel.nack(msg, false, false);
                    }
                }
            }
        });
        
        // Consume F-07: System alerts
        rabbitmqChannel.consume('vss.system.alerts', (msg) => {
            if (msg) {
                try {
                    const event = JSON.parse(msg.content.toString());
                    io.emit('system.alert', event);
                    rabbitmqChannel.ack(msg);
                } catch (e) {
                    console.error('[WORKSPACE] Error processing system alert:', e);
                    if (rabbitmqChannel) {
                        rabbitmqChannel.nack(msg, false, false);
                    }
                }
            }
        });
    } catch (error) {
        // Логируем ошибки только при первой попытке или если прошло достаточно времени
        const now = Date.now();
        const shouldLog = reconnectAttempts === 0 || (now - lastErrorLogTime) > ERROR_LOG_INTERVAL;
        
        if (shouldLog) {
            console.error('[WORKSPACE] ❌ RabbitMQ connection error:', error.message);
            if (error.code === 'ECONNREFUSED') {
                console.error('[WORKSPACE] Connection refused. Проверьте, что RabbitMQ запущен и доступен.');
            } else if (error.code === 'ETIMEDOUT') {
                console.error('[WORKSPACE] Connection timeout. Проверьте сетевые настройки и доступность RabbitMQ.');
            } else if (error.message.includes('timeout')) {
                console.error('[WORKSPACE] Connection timeout. RabbitMQ не отвечает в течение 10 секунд.');
            }
            
            if (reconnectAttempts === 0) {
                console.warn('[WORKSPACE] ⚠️  RabbitMQ недоступен. Сервис будет работать без RabbitMQ.');
                if (!isDocker) {
                    console.warn('[WORKSPACE] Для локальной разработки убедитесь, что RabbitMQ запущен на localhost:5672');
                    console.warn('[WORKSPACE] Или установите переменную окружения RABBITMQ_URL');
                    console.warn('[WORKSPACE] Для отключения RabbitMQ: RABBITMQ_ENABLED=false');
                    console.warn('[WORKSPACE] Для отключения автопереподключения: RABBITMQ_AUTO_RECONNECT=false');
                    console.warn('[WORKSPACE] Быстрый запуск: docker run -d --name rabbitmq-local -p 5672:5672 -p 15672:15672 -e RABBITMQ_DEFAULT_USER=vss-admin -e RABBITMQ_DEFAULT_PASS=vss_rabbit_pass rabbitmq:3.12-management-alpine');
                }
            }
            lastErrorLogTime = now;
        }
        
        if (RABBITMQ_AUTO_RECONNECT) {
            scheduleReconnect();
        } else if (reconnectAttempts === 0) {
            console.log('[WORKSPACE] ℹ️  Автоматическое переподключение отключено. Установите RABBITMQ_AUTO_RECONNECT=true для включения.');
        }
    }
};

// Функция для планирования переподключения
const scheduleReconnect = () => {
    if (!RABBITMQ_AUTO_RECONNECT) {
        return; // Автопереподключение отключено
    }

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        const now = Date.now();
        if ((now - lastErrorLogTime) > ERROR_LOG_INTERVAL) {
            console.error(`[WORKSPACE] ❌ Превышено максимальное количество попыток переподключения (${MAX_RECONNECT_ATTEMPTS}). Остановка попыток переподключения.`);
            console.log('[WORKSPACE] ℹ️  Для повторной попытки перезапустите сервис или установите RABBITMQ_AUTO_RECONNECT=true');
            lastErrorLogTime = now;
        }
        return;
    }
    
    reconnectAttempts++;
    // Используем экспоненциальную задержку с начальной задержкой
    const delay = INITIAL_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts - 1);
    const delaySeconds = Math.round(delay / 1000);
    
    // Логируем только каждую 3-ю попытку или если прошло достаточно времени
    const now = Date.now();
    if (reconnectAttempts % 3 === 0 || reconnectAttempts === 1 || (now - lastErrorLogTime) > ERROR_LOG_INTERVAL) {
        console.log(`[WORKSPACE] 🔄 Попытка переподключения к RabbitMQ через ${delaySeconds} секунд (попытка ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        lastErrorLogTime = now;
    }
    
    setTimeout(() => {
        if (!rabbitmqChannel || !rabbitmqConnection) {
            initRabbitMQ().catch(err => {
                // Ошибки уже обрабатываются в initRabbitMQ
            });
        }
    }, delay);
};

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'vss-workspace', timestamp: new Date().toISOString() });
});

// ============================================
// CRM / NOTES API
// ============================================

// POST /api/crm/note - Добавление заметки
app.post('/api/crm/note', async (req, res) => {
    try {
        const { call_id, text } = req.body;
        
        if (!call_id || !text) {
            return res.status(400).json({ error: true, code: 'INVALID_PARAMS', message: 'call_id and text are required' });
        }
        
        // Get call record
        const callResult = await pool.query('SELECT crm_lead_id FROM calls WHERE id::text = $1 LIMIT 1', [call_id]);
        
        let crmLeadId = null;
        if (callResult.rows.length > 0 && callResult.rows[0].crm_lead_id) {
            crmLeadId = callResult.rows[0].crm_lead_id;
        }
        
        // Update CRM lead metadata with note
        if (crmLeadId) {
            await pool.query(`
                UPDATE crm_leads 
                SET metadata = jsonb_set(
                    COALESCE(metadata, '{}'::jsonb),
                    '{notes}',
                    COALESCE(metadata->'notes', '[]'::jsonb) || $1::jsonb
                )
                WHERE id = $2
            `, [JSON.stringify([{ text: text, timestamp: new Date().toISOString() }]), crmLeadId]);
        }
        
        // Log event
        await pool.query(`
            INSERT INTO events_log (module, severity, message, context)
            VALUES ($1, $2, $3, $4)
        `, ['WORKSPACE', 'info', 'CRM note added', { call_id: call_id, note: text }]);
        
        res.json({ status: 'note_added', call_id: call_id });
    } catch (error) {
        console.error('[WORKSPACE] Error adding CRM note:', error);
        res.status(500).json({ error: true, code: 'CRM_NOTE_ERROR', message: error.message });
    }
});

// GET /api/crm/notes/:call_id - Получить все заметки по звонку
app.get('/api/crm/notes/:call_id', async (req, res) => {
    try {
        const callId = req.params.call_id;
        
        const callResult = await pool.query('SELECT crm_lead_id FROM calls WHERE id::text = $1 LIMIT 1', [callId]);
        
        if (callResult.rows.length === 0) {
            return res.status(404).json({ error: true, code: 'CALL_NOT_FOUND', message: 'Call not found' });
        }
        
        const crmLeadId = callResult.rows[0].crm_lead_id;
        if (!crmLeadId) {
            return res.json({ notes: [] });
        }
        
        const leadResult = await pool.query('SELECT metadata FROM crm_leads WHERE id = $1', [crmLeadId]);
        
        if (leadResult.rows.length === 0) {
            return res.json({ notes: [] });
        }
        
        const notes = leadResult.rows[0].metadata?.notes || [];
        res.json({ notes: notes });
    } catch (error) {
        console.error('[WORKSPACE] Error fetching CRM notes:', error);
        res.status(500).json({ error: true, code: 'CRM_NOTES_FETCH_ERROR', message: error.message });
    }
});

// GET /api/crm/leads - Получение лидов
app.get('/api/crm/leads', async (req, res) => {
    try {
        const { status, assigned_seller } = req.query;
        
        let query = 'SELECT * FROM crm_leads WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        
        if (assigned_seller) {
            query += ` AND assigned_seller = $${paramIndex++}`;
            params.push(assigned_seller);
        }
        
        query += ' ORDER BY created_at DESC LIMIT 100';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('[WORKSPACE] Error fetching CRM leads:', error);
        res.status(500).json({ error: true, code: 'CRM_LEADS_FETCH_ERROR', message: error.message });
    }
});

// ============================================
// NOTIFIER / CHAT API
// ============================================

// POST /api/notifier/send - Отправка уведомления
app.post('/api/notifier/send', async (req, res) => {
    try {
        const { type, target, message } = req.body;
        
        if (!type || !target || !message) {
            return res.status(400).json({ error: true, code: 'INVALID_PARAMS', message: 'type, target, and message are required' });
        }
        
        // Log notification
        await pool.query(`
            INSERT INTO events_log (module, severity, message, context)
            VALUES ($1, $2, $3, $4)
        `, ['NOTIFIER', type.toLowerCase(), message, { target: target }]);
        
        // Publish to RabbitMQ for external services (Telegram, Slack, etc.)
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.events', 'system.alert', Buffer.from(JSON.stringify({
                type: type,
                target: target,
                message: message,
                timestamp: new Date().toISOString()
            })));
        }
        
        // Emit via WebSocket
        io.emit('system.alert', {
            type: type,
            target: target,
            message: message,
            timestamp: new Date().toISOString()
        });
        
        res.json({ status: 'sent', type: type, target: target });
    } catch (error) {
        console.error('[WORKSPACE] Error sending notification:', error);
        res.status(500).json({ error: true, code: 'NOTIFIER_ERROR', message: error.message });
    }
});

// GET /api/notifier/history - История уведомлений
app.get('/api/notifier/history', async (req, res) => {
    try {
        const { limit = 100 } = req.query;
        
        const result = await pool.query(`
            SELECT * FROM events_log
            WHERE module = 'NOTIFIER'
            ORDER BY created_at DESC
            LIMIT $1
        `, [limit]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('[WORKSPACE] Error fetching notification history:', error);
        res.status(500).json({ error: true, code: 'NOTIFIER_HISTORY_ERROR', message: error.message });
    }
});

// ============================================
// DASHBOARD API
// ============================================

// GET /api/dashboard - Данные дашборда
app.get('/api/dashboard', async (req, res) => {
    try {
        // Get slots summary
        const slotsResult = await pool.query(`
            SELECT COUNT(*) as total, 
                   COUNT(CASE WHEN status = 'busy' THEN 1 END) as busy,
                   COUNT(CASE WHEN status = 'free' THEN 1 END) as free,
                   COUNT(CASE WHEN status = 'error' THEN 1 END) as error
            FROM slots
        `);
        
        // Get active calls
        const callsResult = await pool.query(`
            SELECT COUNT(*) as active
            FROM calls
            WHERE status IN ('initiated', 'ringing', 'connected')
        `);
        
        // Get trunks summary
        const trunksResult = await pool.query(`
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN status = 'active' THEN 1 END) as online
            FROM trunks
        `);
        
        // Get active Guacamole sessions
        const guacSessionsResult = await pool.query(`
            SELECT COUNT(*) as active_sessions
            FROM guacamole_sessions_audit
            WHERE end_time IS NULL
        `);
        
        res.json({
            slots: slotsResult.rows[0],
            calls: callsResult.rows[0],
            trunks: trunksResult.rows[0],
            guacamole_sessions: guacSessionsResult.rows[0]?.active_sessions || 0,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[WORKSPACE] Error fetching dashboard:', error);
        res.status(500).json({ error: true, code: 'DASHBOARD_ERROR', message: error.message });
    }
});

// GET /api/dashboard/slots - Получение списка слотов для дашборда
app.get('/api/dashboard/slots', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.id, s.slot_number, s.name, s.status, s.device_type, s.internal_sip_number,
                   s.fsm_state, s.ip_address, s.protocol, s.temperature, s.health_metrics,
                   t.name as trunk_name, u.username as user_name
            FROM slots s
            LEFT JOIN trunks t ON s.trunk_id = t.id
            LEFT JOIN users u ON s.assigned_user = u.id
            ORDER BY s.id
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('[WORKSPACE] Error fetching slots:', error);
        res.status(500).json({ error: true, code: 'SLOTS_FETCH_ERROR', message: error.message });
    }
});

// GET /api/dashboard/metrics - Получение системных метрик
app.get('/api/dashboard/metrics', async (req, res) => {
    try {
        const metricsResult = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM slots WHERE status = 'free') as free_slots,
                (SELECT COUNT(*) FROM slots WHERE status = 'busy') as busy_slots,
                (SELECT COUNT(*) FROM calls WHERE status IN ('initiated', 'ringing', 'connected')) as active_calls,
                (SELECT COUNT(*) FROM trunks WHERE status = 'active') as online_trunks,
                (SELECT COUNT(*) FROM guacamole_sessions_audit WHERE end_time IS NULL) as active_guac_sessions
        `);
        
        res.json(metricsResult.rows[0]);
    } catch (error) {
        console.error('[WORKSPACE] Error fetching metrics:', error);
        res.status(500).json({ error: true, code: 'METRICS_ERROR', message: error.message });
    }
});

// ============================================
// GUACAMOLE INTEGRATION API
// ============================================

// POST /api/guacamole/connect - Создание Guacamole подключения к слоту
app.post('/api/guacamole/connect', async (req, res) => {
    try {
        const { slot_id, user_id } = req.body;
        
        if (!slot_id) {
            return res.status(400).json({ error: true, code: 'INVALID_PARAMS', message: 'slot_id is required' });
        }
        
        // Get slot information
        const slotResult = await pool.query(`
            SELECT s.*, t.name as trunk_name
            FROM slots s
            LEFT JOIN trunks t ON s.trunk_id = t.id
            WHERE s.id = $1
        `, [slot_id]);
        
        if (slotResult.rows.length === 0) {
            return res.status(404).json({ error: true, code: 'SLOT_NOT_FOUND', message: 'Slot not found' });
        }
        
        const slot = slotResult.rows[0];
        
        // Determine protocol based on device type
        let protocol = slot.protocol || 'ssh';
        if (!protocol) {
            switch(slot.device_type) {
                case 'auto':
                    protocol = 'rdp';
                    break;
                case 'mf':
                    protocol = 'vnc';
                    break;
                case 'local_script':
                    protocol = 'ssh';
                    break;
                default:
                    protocol = 'ssh';
            }
        }
        
        // Create Guacamole connection parameters
        const connectionParams = {
            protocol: protocol,
            hostname: slot.ip_address || 'localhost',
            port: slot.port || (protocol === 'rdp' ? 3389 : protocol === 'vnc' ? 5900 : 22),
            username: slot.credentials?.username || 'admin',
            password: slot.credentials?.password || '',
            ...(protocol === 'rdp' && {
                'ignore-cert': 'true',
                'security': 'any',
                'width': 1024,
                'height': 768
            }),
            ...(protocol === 'vnc' && {
                'color-depth': '32',
                'cursor': 'remote'
            })
        };
        
        // Generate connection ID
        const connectionId = `guac_${slot_id}_${Date.now()}`;
        
        // Log session start
        const sessionResult = await pool.query(`
            INSERT INTO guacamole_sessions_audit 
            (user_id, slot_id, connection_id, protocol, start_time, status, client_ip)
            VALUES ($1, $2, $3, $4, NOW(), 'active', $5)
            RETURNING id
        `, [user_id || null, slot_id, connectionId, protocol, req.ip]);
        
        // Publish event
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.events', 'guacamole.session.start', Buffer.from(JSON.stringify({
                event: 'guacamole.session.start',
                session_id: sessionResult.rows[0].id,
                slot_id: slot_id,
                connection_id: connectionId,
                protocol: protocol,
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({
            connection_id: connectionId,
            connection_params: connectionParams,
            guacamole_url: `${process.env.GUACAMOLE_URL || 'http://localhost:8080'}/guacamole/#/client/${connectionId}`,
            slot: {
                id: slot.id,
                name: slot.name || `Slot ${slot.slot_number}`,
                type: slot.device_type,
                trunk: slot.trunk_name
            }
        });
    } catch (error) {
        console.error('[WORKSPACE] Error creating Guacamole connection:', error);
        res.status(500).json({ error: true, code: 'GUACAMOLE_CONNECT_ERROR', message: error.message });
    }
});

// POST /api/guacamole/disconnect - Завершение Guacamole сессии
app.post('/api/guacamole/disconnect', async (req, res) => {
    try {
        const { connection_id, session_id } = req.body;
        
        if (!connection_id && !session_id) {
            return res.status(400).json({ error: true, code: 'INVALID_PARAMS', message: 'connection_id or session_id is required' });
        }
        
        // Update session end time
        const updateQuery = session_id 
            ? 'UPDATE guacamole_sessions_audit SET end_time = NOW(), status = $1 WHERE id = $2 RETURNING *'
            : 'UPDATE guacamole_sessions_audit SET end_time = NOW(), status = $1 WHERE connection_id = $2 RETURNING *';
        
        const params = session_id ? ['ended', session_id] : ['ended', connection_id];
        
        const result = await pool.query(updateQuery, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, code: 'SESSION_NOT_FOUND', message: 'Session not found' });
        }
        
        const session = result.rows[0];
        
        // Calculate duration
        const duration = session.end_time - session.start_time;
        
        // Publish event
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.events', 'guacamole.session.end', Buffer.from(JSON.stringify({
                event: 'guacamole.session.end',
                session_id: session.id,
                slot_id: session.slot_id,
                connection_id: session.connection_id,
                duration: duration,
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({ status: 'disconnected', session_id: session.id, duration: duration });
    } catch (error) {
        console.error('[WORKSPACE] Error disconnecting Guacamole session:', error);
        res.status(500).json({ error: true, code: 'GUACAMOLE_DISCONNECT_ERROR', message: error.message });
    }
});

// GET /api/guacamole/sessions - Получение активных сессий
app.get('/api/guacamole/sessions', async (req, res) => {
    try {
        const { user_id, slot_id, active_only } = req.query;
        
        let query = `
            SELECT gsa.*, s.name as slot_name, s.device_type, u.username
            FROM guacamole_sessions_audit gsa
            LEFT JOIN slots s ON gsa.slot_id = s.id
            LEFT JOIN users u ON gsa.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;
        
        if (user_id) {
            query += ` AND gsa.user_id = $${paramIndex++}`;
            params.push(user_id);
        }
        
        if (slot_id) {
            query += ` AND gsa.slot_id = $${paramIndex++}`;
            params.push(slot_id);
        }
        
        if (active_only === 'true') {
            query += ` AND gsa.end_time IS NULL`;
        }
        
        query += ` ORDER BY gsa.start_time DESC LIMIT 100`;
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('[WORKSPACE] Error fetching Guacamole sessions:', error);
        res.status(500).json({ error: true, code: 'GUACAMOLE_SESSIONS_ERROR', message: error.message });
    }
});

// ============================================
// RTMP API (F-04: RTMP Video/Audio Push)
// ============================================

// POST /api/rtmp/publish - Callback when RTMP stream starts
app.post('/api/rtmp/publish', async (req, res) => {
    try {
        const { name, addr } = req.body;
        
        // Extract slot_id from stream name (format: slot_<id>_<timestamp>)
        const match = name.match(/slot_(\d+)_/);
        if (match) {
            const slotId = parseInt(match[1]);
            
            // Update RTMP stream status
            await pool.query(`
                UPDATE rtmp_streams 
                SET status = 'active', started_at = NOW()
                WHERE slot_id = $1 AND stream_key = $2
            `, [slotId, name]);
            
            // Publish F-04 event
            if (rabbitmqChannel) {
                rabbitmqChannel.publish('vss.events', 'rtmp.stream.start', Buffer.from(JSON.stringify({
                    event: 'rtmp.stream.start',
                    slot_id: slotId,
                    stream_key: name,
                    f_flow: 'F-04',
                    timestamp: new Date().toISOString()
                })));
            }
            
            io.emit('rtmp.stream.start', { slot_id: slotId, stream_key: name });
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('[WORKSPACE] Error handling RTMP publish:', error);
        res.status(500).send('Error');
    }
});

// POST /api/rtmp/publish_done - Callback when RTMP stream stops
app.post('/api/rtmp/publish_done', async (req, res) => {
    try {
        const { name } = req.body;
        
        const match = name.match(/slot_(\d+)_/);
        if (match) {
            const slotId = parseInt(match[1]);
            
            // Update RTMP stream status
            await pool.query(`
                UPDATE rtmp_streams 
                SET status = 'stopped', stopped_at = NOW()
                WHERE slot_id = $1 AND stream_key = $2
            `, [slotId, name]);
            
            // Publish F-04 event
            if (rabbitmqChannel) {
                rabbitmqChannel.publish('vss.events', 'rtmp.stream.stop', Buffer.from(JSON.stringify({
                    event: 'rtmp.stream.stop',
                    slot_id: slotId,
                    stream_key: name,
                    f_flow: 'F-04',
                    timestamp: new Date().toISOString()
                })));
            }
            
            io.emit('rtmp.stream.stop', { slot_id: slotId, stream_key: name });
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('[WORKSPACE] Error handling RTMP publish_done:', error);
        res.status(500).send('Error');
    }
});

// GET /api/rtmp/streams - Получить список активных RTMP потоков
app.get('/api/rtmp/streams', async (req, res) => {
    try {
        const { slot_id, status = 'active' } = req.query;
        
        let query = 'SELECT * FROM rtmp_streams WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (slot_id) {
            query += ` AND slot_id = $${paramIndex++}`;
            params.push(parseInt(slot_id));
        }
        
        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        
        query += ' ORDER BY started_at DESC LIMIT 100';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('[WORKSPACE] Error fetching RTMP streams:', error);
        res.status(500).json({ error: true, code: 'RTMP_STREAMS_ERROR', message: error.message });
    }
});

// GET /api/rtmp/stream/:slot_id - Получить RTMP поток для слота
app.get('/api/rtmp/stream/:slot_id', async (req, res) => {
    try {
        const slotId = parseInt(req.params.slot_id);
        
        const result = await pool.query(`
            SELECT * FROM rtmp_streams 
            WHERE slot_id = $1 AND status = 'active'
            ORDER BY started_at DESC
            LIMIT 1
        `, [slotId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, code: 'STREAM_NOT_FOUND', message: 'No active stream found' });
        }
        
        const stream = result.rows[0];
        res.json({
            stream_key: stream.stream_key,
            stream_url: stream.stream_url,
            hls_url: `http://localhost:8085/hls/${stream.stream_key}.m3u8`,
            status: stream.status
        });
    } catch (error) {
        console.error('[WORKSPACE] Error fetching RTMP stream:', error);
        res.status(500).json({ error: true, code: 'RTMP_STREAM_ERROR', message: error.message });
    }
});

// POST /api/rtmp/stream/:slot_id/start - Запуск RTMP потока (F-04)
app.post('/api/rtmp/stream/:slot_id/start', async (req, res) => {
    try {
        const slotId = parseInt(req.params.slot_id);
        const { stream_url, resolution, framerate } = req.body;

        // Publish F-04 RTMP Stream command
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.commands', 'rtmp.start', Buffer.from(JSON.stringify({
                slot_id: slotId,
                stream_url: stream_url || `rtmp://nginx-rtmp:1935/live/${slotId}`,
                resolution: resolution || '1280x720',
                framerate: framerate || 30,
                f_flow: 'F-04',
                timestamp: new Date().toISOString()
            })));
        }

        // Create RTMP stream record
        const streamKey = `slot_${slotId}_${Date.now()}`;
        await pool.query(`
            INSERT INTO rtmp_streams (slot_id, stream_key, stream_url, status, resolution, framerate, started_at)
            VALUES ($1, $2, $3, 'active', $4, $5, NOW())
            ON CONFLICT (slot_id) DO UPDATE SET
                stream_key = EXCLUDED.stream_key,
                stream_url = EXCLUDED.stream_url,
                status = 'active',
                resolution = EXCLUDED.resolution,
                framerate = EXCLUDED.framerate,
                started_at = NOW()
        `, [slotId, streamKey, stream_url || `rtmp://nginx-rtmp:1935/live/${slotId}`, resolution || '1280x720', framerate || 30]);

        res.json({ status: 'rtmp_stream_started', slot_id: slotId, stream_key: streamKey });
    } catch (error) {
        console.error('[WORKSPACE] Error starting RTMP stream:', error);
        res.status(500).json({ error: true, code: 'RTMP_START_ERROR', message: error.message });
    }
});

// POST /api/rtmp/stream/:slot_id/stop - Остановка RTMP потока (F-04)
app.post('/api/rtmp/stream/:slot_id/stop', async (req, res) => {
    try {
        const slotId = parseInt(req.params.slot_id);

        // Publish F-04 RTMP Stream stop command
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.commands', 'rtmp.stop', Buffer.from(JSON.stringify({
                slot_id: slotId,
                f_flow: 'F-04',
                timestamp: new Date().toISOString()
            })));
        }

        // Update RTMP stream status
        await pool.query(`
            UPDATE rtmp_streams 
            SET status = 'stopped', stopped_at = NOW()
            WHERE slot_id = $1 AND status = 'active'
        `, [slotId]);

        res.json({ status: 'rtmp_stream_stopped', slot_id: slotId });
    } catch (error) {
        console.error('[WORKSPACE] Error stopping RTMP stream:', error);
        res.status(500).json({ error: true, code: 'RTMP_STOP_ERROR', message: error.message });
    }
});

// ============================================
// ARCHONTs API (для администраторов)
// ============================================

// GET /api/archonts/centers - Список развернутых call-центров
app.get('/api/archonts/centers', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ac.*, u.username as created_by_name, at.name as template_name,
                   COUNT(DISTINCT atr.id) as trunks_count,
                   COUNT(DISTINCT ats.id) as slots_count
            FROM archont_centers ac
            LEFT JOIN users u ON ac.created_by = u.id
            LEFT JOIN archont_templates at ON ac.template_id = at.id
            LEFT JOIN archont_trunks atr ON ac.id = atr.center_id
            LEFT JOIN archont_slots ats ON ac.id = ats.center_id
            GROUP BY ac.id, u.username, at.name
            ORDER BY ac.created_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('[WORKSPACE] Error fetching ARCHONTs centers:', error);
        res.status(500).json({ error: true, code: 'ARCHONTS_CENTERS_ERROR', message: error.message });
    }
});

// POST /api/archonts/centers - Развертывание нового call-центра
app.post('/api/archonts/centers', async (req, res) => {
    try {
        const { name, template_id, config, created_by } = req.body;
        
        if (!name || !template_id) {
            return res.status(400).json({ error: true, code: 'INVALID_PARAMS', message: 'name and template_id are required' });
        }
        
        // Get template configuration
        const templateResult = await pool.query('SELECT stack_config FROM archont_templates WHERE id = $1', [template_id]);
        if (templateResult.rows.length === 0) {
            return res.status(404).json({ error: true, code: 'TEMPLATE_NOT_FOUND', message: 'Template not found' });
        }
        
        const template = templateResult.rows[0];
        const stackConfig = template.stack_config;
        
        // Create center
        const centerResult = await pool.query(`
            INSERT INTO archont_centers (name, template_id, status, created_by, config)
            VALUES ($1, $2, 'deploying', $3, $4)
            RETURNING *
        `, [name, template_id, created_by || null, config || stackConfig]);
        
        const center = centerResult.rows[0];
        
        // Allocate trunks and slots based on template
        const trunksCount = stackConfig.trunks || 5;
        const slotsPerTrunk = stackConfig.slots_per_trunk || 3;
        
        // Get available trunks
        const availableTrunks = await pool.query(`
            SELECT id FROM trunks WHERE status = 'active' LIMIT $1
        `, [trunksCount]);
        
        // Create archont_trunks entries
        for (const trunk of availableTrunks.rows) {
            await pool.query(`
                INSERT INTO archont_trunks (center_id, trunk_id, status)
                VALUES ($1, $2, 'active')
            `, [center.id, trunk.id]);
            
            // Get slots for this trunk
            const slots = await pool.query(`
                SELECT id FROM slots WHERE trunk_id = $1 LIMIT $2
            `, [trunk.id, slotsPerTrunk]);
            
            // Create archont_slots entries
            for (const slot of slots.rows) {
                await pool.query(`
                    INSERT INTO archont_slots (center_id, slot_id, status)
                    VALUES ($1, $2, 'free')
                `, [center.id, slot.id]);
            }
        }
        
        // Update center status to active
        await pool.query('UPDATE archont_centers SET status = $1 WHERE id = $2', ['active', center.id]);
        
        // Publish event
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.events', 'archonts.center.deployed', Buffer.from(JSON.stringify({
                event: 'archonts.center.deployed',
                center_id: center.id,
                name: center.name,
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({ status: 'deployed', center: center });
    } catch (error) {
        console.error('[WORKSPACE] Error deploying ARCHONTs center:', error);
        res.status(500).json({ error: true, code: 'ARCHONTS_DEPLOY_ERROR', message: error.message });
    }
});

// GET /api/archonts/templates - Список шаблонов развертывания
app.get('/api/archonts/templates', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM archont_templates ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('[WORKSPACE] Error fetching ARCHONTs templates:', error);
        res.status(500).json({ error: true, code: 'ARCHONTS_TEMPLATES_ERROR', message: error.message });
    }
});

// POST /api/archonts/centers/:id/assign - Назначение транков/слотов ролям
app.post('/api/archonts/centers/:id/assign', async (req, res) => {
    try {
        const centerId = req.params.id;
        const { trunk_id, slot_id, assigned_role, assigned_user } = req.body;
        
        if (trunk_id) {
            await pool.query(`
                UPDATE archont_trunks 
                SET assigned_role = $1 
                WHERE center_id = $2 AND trunk_id = $3
            `, [assigned_role, centerId, trunk_id]);
        }
        
        if (slot_id) {
            await pool.query(`
                UPDATE archont_slots 
                SET assigned_user = $1 
                WHERE center_id = $2 AND slot_id = $3
            `, [assigned_user, centerId, slot_id]);
        }
        
        res.json({ status: 'assigned' });
    } catch (error) {
        console.error('[WORKSPACE] Error assigning ARCHONTs resources:', error);
        res.status(500).json({ error: true, code: 'ARCHONTS_ASSIGN_ERROR', message: error.message });
    }
});

// ============================================
// SECURITY AUDIT API
// ============================================

// POST /api/security/audit - Запись события аудита безопасности
app.post('/api/security/audit', async (req, res) => {
    try {
        const { user_id, action, resource_type, resource_id, success, details, risk_level } = req.body;
        
        await pool.query(`
            INSERT INTO security_audit_log 
            (user_id, action, resource_type, resource_id, success, details, risk_level, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            user_id || null,
            action,
            resource_type || null,
            resource_id || null,
            success !== false,
            details || '{}',
            risk_level || 'low',
            req.ip,
            req.get('user-agent')
        ]);
        
        res.json({ status: 'logged' });
    } catch (error) {
        console.error('[WORKSPACE] Error logging security audit:', error);
        res.status(500).json({ error: true, code: 'AUDIT_LOG_ERROR', message: error.message });
    }
});

// GET /api/security/audit - Получение логов аудита безопасности
app.get('/api/security/audit', async (req, res) => {
    try {
        const { user_id, action, risk_level, limit = 100 } = req.query;
        
        let query = 'SELECT sal.*, u.username FROM security_audit_log sal LEFT JOIN users u ON sal.user_id = u.id WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (user_id) {
            query += ` AND sal.user_id = $${paramIndex++}`;
            params.push(user_id);
        }
        
        if (action) {
            query += ` AND sal.action = $${paramIndex++}`;
            params.push(action);
        }
        
        if (risk_level) {
            query += ` AND sal.risk_level = $${paramIndex++}`;
            params.push(risk_level);
        }
        
        query += ` ORDER BY sal.timestamp DESC LIMIT $${paramIndex++}`;
        params.push(limit);
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('[WORKSPACE] Error fetching security audit logs:', error);
        res.status(500).json({ error: true, code: 'AUDIT_FETCH_ERROR', message: error.message });
    }
});

// WebSocket connection handler
io.on('connection', (socket) => {
    console.log('[WORKSPACE] Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('[WORKSPACE] Client disconnected:', socket.id);
    });
    
    // Subscribe to call events
    socket.on('subscribe:calls', () => {
        socket.join('calls');
    });
    
    // Subscribe to slot events
    socket.on('subscribe:slots', () => {
        socket.join('slots');
    });
    
    // Handle native WebSocket-style messages
    socket.on('message', (data) => {
        try {
            const msg = typeof data === 'string' ? JSON.parse(data) : data;
            if (msg.type === 'subscribe') {
                if (msg.channels.includes('calls')) socket.join('calls');
                if (msg.channels.includes('slots')) socket.join('slots');
            }
        } catch (e) {
            console.error('[WORKSPACE] Error handling message:', e);
        }
    });
});

// Используем утилиту для поиска свободного порта

// Initialize RabbitMQ on startup
initRabbitMQ();

// Запуск сервера с автоматическим поиском свободного порта
async function startServer() {
    try {
        // Пытаемся найти свободный порт (используем утилиту)
        PORT = await findAvailablePort(DEFAULT_PORT, 100, true);
        
        if (PORT !== DEFAULT_PORT) {
            console.log(`⚠️  [WORKSPACE] Порт ${DEFAULT_PORT} занят. Используется порт ${PORT}`);
        }
        
        server.listen(PORT, () => {
            console.log(`VSS Workspace service listening on port ${PORT}`);
            console.log(`WebSocket server ready`);
        });
    } catch (error) {
        console.error('❌ [WORKSPACE] Ошибка запуска сервера:', error.message);
        process.exit(1);
    }
}

startServer();
