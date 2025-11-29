const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const net = require('net');
const fs = require('fs');
const { findAvailablePort } = require('../../utils/port-finder');
const { authenticateToken, optionalAuthenticateToken } = require('../../utils/auth');
const { loadPermissions, checkPermission } = require('../../utils/rbac');
require('dotenv').config();

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT) || 8083;
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

// JWT Authentication middleware - загружаем права из БД для всех аутентифицированных запросов
// Инициализируем ПОСЛЕ создания pool, чтобы избежать ReferenceError
const loadPermissionsMiddleware = loadPermissions(pool);

app.use((req, res, next) => {
    // Пропускаем health check
    if (req.path.startsWith('/health')) {
        return next();
    }
    
    // Для всех остальных эндпоинтов применяем опциональную аутентификацию
    optionalAuthenticateToken(req, res, () => {
        // Если пользователь аутентифицирован, загружаем его права
        if (req.user && req.user.id) {
            loadPermissionsMiddleware(req, res, next);
        } else {
            next();
        }
    });
});

// RabbitMQ connection
let rabbitmqChannel = null;
const initRabbitMQ = async () => {
    try {
        const defaultRabbitMQUrl = `amqp://vss-admin:vss_rabbit_pass@${RABBITMQ_HOST}:5672/vss`;
        const rabbitmqUrl = process.env.RABBITMQ_URL || defaultRabbitMQUrl;
        const connection = await amqp.connect(rabbitmqUrl);
        rabbitmqChannel = await connection.createChannel();
        
        // Assert exchanges and queues for F-Flow
        await rabbitmqChannel.assertExchange('vss.events', 'topic', { durable: true });
        await rabbitmqChannel.assertExchange('vss.commands', 'topic', { durable: true });
        await rabbitmqChannel.assertQueue('vss.call.events', { durable: true });
        await rabbitmqChannel.assertQueue('vss.slot.commands', { durable: true });
        await rabbitmqChannel.assertQueue('vss.autodial.leads', { durable: true });
        
        // Bind queues to exchanges
        await rabbitmqChannel.bindQueue('vss.call.events', 'vss.events', 'call.*');
        await rabbitmqChannel.bindQueue('vss.slot.commands', 'vss.commands', 'slot.*');
        
        console.log('[OTTB] Connected to RabbitMQ and configured F-Flow queues');
    } catch (error) {
        console.error('[OTTB] RabbitMQ connection error:', error.message);
    }
};

// ============================================
// OTTB Core Functions - SIP Numbering Engine
// ============================================

/**
 * Generate internal SIP number based on slot type and ID
 * AUTO: 97XXX (97001-97999)
 * MF: 98XXX (98001-98999)
 * LS: 99XXX (99001-99999)
 */
function generateInternalSipNumber(deviceType, slotId) {
    const base = {
        'auto': 97000,
        'mf': 98000,
        'local_script': 99000
    };
    
    const baseNumber = base[deviceType.toLowerCase()] || 97000;
    const number = baseNumber + slotId;
    
    // Ensure 5 digits
    return String(number).padStart(5, '0');
}

/**
 * Generate SIP username for slot
 */
function generateSipUsername(slotId) {
    return `slot_${slotId}@vss.internal`;
}

/**
 * Generate SIP secret (password)
 */
function generateSipSecret() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Allocate and assign internal SIP number to slot
 */
async function allocateSipNumber(slotId, deviceType) {
    try {
        const sipNumber = generateInternalSipNumber(deviceType, slotId);
        const sipUsername = generateSipUsername(slotId);
        const sipSecret = generateSipSecret();
        
        await pool.query(`
            UPDATE slots 
            SET internal_sip_number = $1, sip_username = $2, sip_secret = $3
            WHERE id = $4
        `, [sipNumber, sipUsername, sipSecret, slotId]);
        
        // Publish SIP registration event (F-09)
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.events', 'sip.register', Buffer.from(JSON.stringify({
                slot_id: slotId,
                sip_number: sipNumber,
                sip_username: sipUsername,
                timestamp: new Date().toISOString()
            })));
        }
        
        return { sipNumber, sipUsername, sipSecret };
    } catch (error) {
        console.error('[OTTB] Error allocating SIP number:', error);
        throw error;
    }
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'vss-ottb', timestamp: new Date().toISOString() });
});

// ============================================
// SLOTS API
// ============================================

// GET /api/slots - Список всех слотов
app.get('/api/slots', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.id, s.slot_number, s.status, s.device_type, s.assigned_user,
                   s.internal_sip_number, s.sip_username, s.fsm_state,
                   t.name as trunk_name, u.username as user_name,
                   s.last_activity, s.health_metrics
            FROM slots s
            LEFT JOIN trunks t ON s.trunk_id = t.id
            LEFT JOIN users u ON s.assigned_user = u.id
            ORDER BY s.id
        `);
        
        const slots = result.rows.map(row => {
            // Allocate SIP number if not exists
            if (!row.internal_sip_number && row.device_type) {
                // Async allocation will happen in background
                allocateSipNumber(row.id, row.device_type).catch(err => 
                    console.error(`[OTTB] Failed to allocate SIP for slot ${row.id}:`, err)
                );
            }
            
            return {
                id: row.id,
                status: row.status.toUpperCase(),
                device: row.device_type,
                user: row.user_name || null,
                trunk: row.trunk_name,
                sip_number: row.internal_sip_number || null,
                sip_username: row.sip_username || null,
                fsm_state: row.fsm_state || 'IDLE',
                last_activity: row.last_activity,
                metrics: row.health_metrics
            };
        });
        
        res.json(slots);
    } catch (error) {
        console.error('[OTTB] Error fetching slots:', error);
        res.status(500).json({ error: true, code: 'SLOT_FETCH_ERROR', message: error.message });
    }
});

// GET /api/slots/:id - Детали слота
app.get('/api/slots/:id', async (req, res) => {
    try {
        const slotId = parseInt(req.params.id);
        const result = await pool.query(`
            SELECT s.*, t.name as trunk_name, u.username as user_name
            FROM slots s
            LEFT JOIN trunks t ON s.trunk_id = t.id
            LEFT JOIN users u ON s.assigned_user = u.id
            WHERE s.id = $1
        `, [slotId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, code: 'SLOT_NOT_FOUND', message: 'Slot not found' });
        }
        
        const slot = result.rows[0];
        
        // Allocate SIP number if not exists
        if (!slot.internal_sip_number && slot.device_type) {
            try {
                const sipInfo = await allocateSipNumber(slotId, slot.device_type);
                slot.internal_sip_number = sipInfo.sipNumber;
                slot.sip_username = sipInfo.sipUsername;
            } catch (err) {
                console.error(`[OTTB] Failed to allocate SIP for slot ${slotId}:`, err);
            }
        }
        
        res.json({
            id: slot.id,
            status: slot.status.toUpperCase(),
            device: slot.device_type,
            user: slot.user_name || null,
            trunk: slot.trunk_name,
            sip_number: slot.internal_sip_number || null,
            sip_username: slot.sip_username || null,
            fsm_state: slot.fsm_state || 'IDLE',
            temperature: slot.health_metrics?.temperature || 'N/A',
            battery: slot.health_metrics?.battery || 'N/A',
            last_event: slot.last_activity ? 'call.start' : null,
            config: slot.device_config,
            network: slot.network_config
        });
    } catch (error) {
        console.error('[OTTB] Error fetching slot:', error);
        res.status(500).json({ error: true, code: 'SLOT_FETCH_ERROR', message: error.message });
    }
});

// POST /api/slots/:id/restart - Перезапуск слота
app.post('/api/slots/:id/restart', async (req, res) => {
    try {
        const slotId = parseInt(req.params.id);
        
        // Update slot status and FSM state
        await pool.query(`
            UPDATE slots 
            SET status = $1, fsm_state = $2, updated_at = NOW()
            WHERE id = $3
        `, ['free', 'IDLE', slotId]);
        
        // Publish F-05 event (Slot Status Sync) and F-06 (DRP)
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.events', 'slot.update', Buffer.from(JSON.stringify({
                event: 'slot.update',
                slot_id: slotId,
                status: 'free',
                fsm_state: 'IDLE',
                timestamp: new Date().toISOString()
            })));
            
            rabbitmqChannel.publish('vss.commands', 'slot.restart', Buffer.from(JSON.stringify({
                slot_id: slotId,
                action: 'restart',
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({ status: 'restarting', slot: slotId });
    } catch (error) {
        console.error('[OTTB] Error restarting slot:', error);
        res.status(500).json({ error: true, code: 'SLOT_RESTART_ERROR', message: error.message });
    }
});

// POST /api/slots/:id/reboot-device - Перезагрузка устройства (F-06: Hardware DRP)
app.post('/api/slots/:id/reboot-device', async (req, res) => {
    try {
        const slotId = parseInt(req.params.id);
        
        // Update FSM state to FAULT during reboot
        await pool.query(`
            UPDATE slots 
            SET fsm_state = $1, status = $2, updated_at = NOW()
            WHERE id = $3
        `, ['FAULT', 'error', slotId]);
        
        // Publish F-06 DRP event
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.commands', 'slot.drp.reboot', Buffer.from(JSON.stringify({
                slot_id: slotId,
                action: 'hardware_reboot',
                drp_type: 'usb_power_cycle',
                timestamp: new Date().toISOString()
            })));
            
            // Also publish F-05 status update
            rabbitmqChannel.publish('vss.events', 'slot.update', Buffer.from(JSON.stringify({
                event: 'slot.update',
                slot_id: slotId,
                status: 'error',
                fsm_state: 'FAULT',
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({ status: 'rebooting', slot: slotId });
    } catch (error) {
        console.error('[OTTB] Error rebooting device:', error);
        res.status(500).json({ error: true, code: 'DEVICE_REBOOT_ERROR', message: error.message });
    }
});

// POST /api/slots/:id/gacs - Выполнение GACS скрипта (F-02: GACS Script Execution)
app.post('/api/slots/:id/gacs', async (req, res) => {
    try {
        const slotId = parseInt(req.params.id);
        const { script_name, script_type, script_content, script_path } = req.body;
        
        if (!script_name || !script_type) {
            return res.status(400).json({ error: true, code: 'INVALID_PARAMS', message: 'script_name and script_type are required' });
        }
        
        // Insert GACS script record
        const scriptResult = await pool.query(`
            INSERT INTO gacs_scripts (slot_id, script_name, script_type, script_content, script_path, status, started_at)
            VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
            RETURNING id
        `, [slotId, script_name, script_type, script_content || null, script_path || null]);
        
        const scriptId = scriptResult.rows[0].id;
        
        // Publish F-02 GACS command
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.commands', 'gacs.execute', Buffer.from(JSON.stringify({
                script_id: scriptId,
                slot_id: slotId,
                script_name: script_name,
                script_type: script_type,
                script_content: script_content,
                script_path: script_path,
                f_flow: 'F-02',
                timestamp: new Date().toISOString()
            })));
            
            // Publish F-12 GACS Event Logging
            rabbitmqChannel.publish('vss.events', 'gacs.event', Buffer.from(JSON.stringify({
                event: 'gacs.event',
                script_id: scriptId,
                slot_id: slotId,
                script_name: script_name,
                script_type: script_type,
                status: 'executing',
                f_flow: 'F-12',
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({ status: 'executing', script_id: scriptId, slot: slotId });
    } catch (error) {
        console.error('[OTTB] Error executing GACS script:', error);
        res.status(500).json({ error: true, code: 'GACS_EXEC_ERROR', message: error.message });
    }
});

// POST /api/slots/:id/adb-command - Выполнение ADB команды (F-02: GACS Script Execution) - Legacy
app.post('/api/slots/:id/adb-command', async (req, res) => {
    try {
        const slotId = parseInt(req.params.id);
        const { command } = req.body;
        
        if (!command) {
            return res.status(400).json({ error: true, code: 'INVALID_COMMAND', message: 'Command is required' });
        }
        
        // Use GACS endpoint
        req.body = { script_name: 'adb_command', script_type: 'adb', script_content: command };
        return app._router.handle({ ...req, method: 'POST', url: `/api/slots/${slotId}/gacs` }, res);
    } catch (error) {
        console.error('[OTTB] Error executing ADB command:', error);
        res.status(500).json({ error: true, code: 'ADB_COMMAND_ERROR', message: error.message });
    }
});

// ============================================
// CALLS / AUTODIALER API
// ============================================

// POST /api/call/start - Запуск звонка
app.post('/api/call/start', async (req, res) => {
    try {
        const { number, slot: slotParam } = req.body;
        
        if (!number) {
            return res.status(400).json({ error: true, code: 'INVALID_NUMBER', message: 'Phone number is required' });
        }
        
        // Find available slot if not specified
        let slotId = slotParam;
        if (!slotId || slotParam === 'AUTO') {
            const availableSlotResult = await pool.query(
                'SELECT id FROM slots WHERE status = $1 AND device_type = $2 LIMIT 1',
                ['free', 'auto']
            );
            if (availableSlotResult.rows.length === 0) {
                return res.status(400).json({ error: true, code: 'SLOT_BUSY', message: 'No available slots' });
            }
            slotId = availableSlotResult.rows[0].id;
        }
        
        // Get slot SIP information
        const slotResult = await pool.query(`
            SELECT internal_sip_number, sip_username, device_type, fsm_state
            FROM slots WHERE id = $1
        `, [slotId]);
        
        if (slotResult.rows.length === 0) {
            return res.status(404).json({ error: true, code: 'SLOT_NOT_FOUND', message: 'Slot not found' });
        }
        
        const slotData = slotResult.rows[0];
        
        // Ensure SIP number is allocated
        if (!slotData.internal_sip_number) {
            await allocateSipNumber(slotId, slotData.device_type);
            // Re-fetch slot
            const updatedSlotResult = await pool.query('SELECT internal_sip_number, sip_username FROM slots WHERE id = $1', [slotId]);
            slotData.internal_sip_number = updatedSlotResult.rows[0].internal_sip_number;
            slotData.sip_username = updatedSlotResult.rows[0].sip_username;
        }
        
        // Create call record
        const callId = `c_${Date.now()}`;
        const userId = req.user?.id || null; // From auth middleware
        
        await pool.query(`
            INSERT INTO calls (slot_id, user_id, client_number, direction, start_time, status)
            VALUES ($1, $2, $3, $4, NOW(), $5)
        `, [slotId, userId, number, 'outbound', 'initiated']);
        
        // Update slot status and FSM state (F-05: Slot Status Sync)
        await pool.query(`
            UPDATE slots 
            SET status = $1, fsm_state = $2, last_activity = NOW(), updated_at = NOW()
            WHERE id = $3
        `, ['busy', 'CALLING', slotId]);
        
        // Publish F-03 SIP Outbound Call event
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.events', 'call.start', Buffer.from(JSON.stringify({
                event: 'call.start',
                call_id: callId,
                slot_id: slotId,
                slot_sip_number: slotData.internal_sip_number,
                slot_sip_username: slotData.sip_username,
                number: number,
                state: 'RING',
                f_flow: 'F-03',
                timestamp: new Date().toISOString()
            })));
            
            // Publish F-05 Slot Status Sync
            rabbitmqChannel.publish('vss.events', 'slot.update', Buffer.from(JSON.stringify({
                event: 'slot.update',
                slot_id: slotId,
                status: 'busy',
                fsm_state: 'CALLING',
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({
            call_id: callId,
            slot: slotId,
            state: 'RING'
        });
    } catch (error) {
        console.error('[OTTB] Error starting call:', error);
        res.status(500).json({ error: true, code: 'CALL_START_ERROR', message: error.message });
    }
});

// POST /api/call/end - Завершение звонка
app.post('/api/call/end', async (req, res) => {
    try {
        const { call_id } = req.body;
        
        if (!call_id) {
            return res.status(400).json({ error: true, code: 'INVALID_CALL_ID', message: 'Call ID is required' });
        }
        
        // Update call record
        const result = await pool.query(`
            UPDATE calls 
            SET status = $1, end_time = NOW(), 
                duration = EXTRACT(EPOCH FROM (NOW() - start_time))::int
            WHERE id = (SELECT id FROM calls WHERE id::text = $2 OR client_number = $2 ORDER BY start_time DESC LIMIT 1)
            RETURNING slot_id, duration
        `, ['ended', call_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, code: 'CALL_NOT_FOUND', message: 'Call not found' });
        }
        
        const slotId = result.rows[0].slot_id;
        
        // Update slot status and FSM state (F-05)
        await pool.query(`
            UPDATE slots 
            SET status = $1, fsm_state = $2, updated_at = NOW()
            WHERE id = $3
        `, ['free', 'IDLE', slotId]);
        
        // Publish F-08 DB Logging / CDR and F-05 Slot Status Sync
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.events', 'call.end', Buffer.from(JSON.stringify({
                event: 'call.end',
                call_id: call_id,
                slot_id: slotId,
                duration: result.rows[0].duration,
                f_flow: 'F-08',
                timestamp: new Date().toISOString()
            })));
            
            rabbitmqChannel.publish('vss.events', 'slot.update', Buffer.from(JSON.stringify({
                event: 'slot.update',
                slot_id: slotId,
                status: 'free',
                fsm_state: 'IDLE',
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({ status: 'ended', call_id: call_id });
    } catch (error) {
        console.error('[OTTB] Error ending call:', error);
        res.status(500).json({ error: true, code: 'CALL_END_ERROR', message: error.message });
    }
});

// GET /api/call/:id - Статус звонка
app.get('/api/call/:id', async (req, res) => {
    try {
        const callId = req.params.id;
        const result = await pool.query(`
            SELECT c.*, s.slot_number, u.username
            FROM calls c
            LEFT JOIN slots s ON c.slot_id = s.id
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.id::text = $1 OR c.client_number = $1
            ORDER BY c.start_time DESC
            LIMIT 1
        `, [callId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, code: 'CALL_NOT_FOUND', message: 'Call not found' });
        }
        
        const call = result.rows[0];
        res.json({
            call_id: call.id,
            slot: call.slot_id,
            number: call.client_number,
            status: call.status,
            start_time: call.start_time,
            end_time: call.end_time,
            duration: call.duration
        });
    } catch (error) {
        console.error('[OTTB] Error fetching call:', error);
        res.status(500).json({ error: true, code: 'CALL_FETCH_ERROR', message: error.message });
    }
});

// GET /api/calls/feed - Live feed всех звонков
app.get('/api/calls/feed', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, s.slot_number, u.username
            FROM calls c
            LEFT JOIN slots s ON c.slot_id = s.id
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.status IN ('initiated', 'ringing', 'connected')
            ORDER BY c.start_time DESC
            LIMIT 100
        `);
        
        const calls = result.rows.map(row => ({
            call_id: row.id,
            slot: row.slot_id,
            number: row.client_number,
            user: row.username,
            status: row.status,
            start_time: row.start_time
        }));
        
        res.json(calls);
    } catch (error) {
        console.error('[OTTB] Error fetching calls feed:', error);
        res.status(500).json({ error: true, code: 'CALLS_FEED_ERROR', message: error.message });
    }
});

// POST /api/autodialer/run-campaign - Запуск кампании (F-01: Autodial Lead Queue)
app.post('/api/autodialer/run-campaign', async (req, res) => {
    try {
        const { campaign_id, name, description, leads, config } = req.body;
        
        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ error: true, code: 'INVALID_LEADS', message: 'Leads array is required' });
        }
        
        const finalCampaignId = campaign_id || uuidv4();
        const userId = req.user?.id || null;
        
        // Create campaign record
        const campaignResult = await pool.query(`
            INSERT INTO campaigns (id, name, description, campaign_type, status, total_leads, config, created_by, started_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT (id) DO UPDATE
            SET status = 'running', started_at = NOW()
            RETURNING id
        `, [
            finalCampaignId,
            name || `Campaign ${finalCampaignId}`,
            description || null,
            'autodial',
            'running',
            leads.length,
            config || {},
            userId
        ]);
        
        // Insert leads into autodialer_leads table
        for (const lead of leads) {
            await pool.query(`
                INSERT INTO autodialer_leads (campaign_id_ref, phone_number, lead_data, status, created_at)
                VALUES ($1, $2, $3, 'pending', NOW())
            `, [finalCampaignId, lead.phone_number, lead.lead_data || {}]);
            
            // Publish F-01 Autodial Lead Queue event
            if (rabbitmqChannel) {
                rabbitmqChannel.publish('vss.commands', 'autodial.lead', Buffer.from(JSON.stringify({
                    campaign_id: finalCampaignId,
                    lead: lead,
                    f_flow: 'F-01',
                    timestamp: new Date().toISOString()
                })));
            }
        }
        
        // Publish F-11 Campaign Status
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.events', 'campaign.status', Buffer.from(JSON.stringify({
                event: 'campaign.status',
                campaign_id: finalCampaignId,
                status: 'started',
                leads_count: leads.length,
                f_flow: 'F-11',
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({ status: 'campaign_started', campaign_id: finalCampaignId, leads_count: leads.length });
    } catch (error) {
        console.error('[OTTB] Error starting campaign:', error);
        res.status(500).json({ error: true, code: 'CAMPAIGN_START_ERROR', message: error.message });
    }
});

// GET /api/autodialer/campaigns - Список кампаний
app.get('/api/autodialer/campaigns', async (req, res) => {
    try {
        const { status, limit = 100 } = req.query;
        
        let query = 'SELECT * FROM campaigns WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
        params.push(parseInt(limit));
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('[OTTB] Error fetching campaigns:', error);
        res.status(500).json({ error: true, code: 'CAMPAIGNS_FETCH_ERROR', message: error.message });
    }
});

// GET /api/autodialer/leads - Список лидов
app.get('/api/autodialer/leads', async (req, res) => {
    try {
        const { campaign_id, status, slot_id, limit = 100 } = req.query;
        
        let query = 'SELECT * FROM autodialer_leads WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (campaign_id) {
            query += ` AND campaign_id_ref = $${paramIndex++}`;
            params.push(campaign_id);
        }
        
        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        
        if (slot_id) {
            query += ` AND slot_id = $${paramIndex++}`;
            params.push(parseInt(slot_id));
        }
        
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
        params.push(parseInt(limit));
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('[OTTB] Error fetching leads:', error);
        res.status(500).json({ error: true, code: 'LEADS_FETCH_ERROR', message: error.message });
    }
});

// POST /api/autodialer/stop-campaign - Остановка кампании
app.post('/api/autodialer/stop-campaign', async (req, res) => {
    try {
        const { campaign_id } = req.body;
        
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.commands', 'autodial.stop', Buffer.from(JSON.stringify({
                campaign_id: campaign_id,
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({ status: 'campaign_stopped', campaign_id: campaign_id });
    } catch (error) {
        console.error('[OTTB] Error stopping campaign:', error);
        res.status(500).json({ error: true, code: 'CAMPAIGN_STOP_ERROR', message: error.message });
    }
});

// ============================================
// GACS / AUTOMATION API
// ============================================

// POST /api/gacs/run-script - Запуск скрипта
app.post('/api/gacs/run-script', async (req, res) => {
    try {
        const { slot_id, script, params } = req.body;
        
        if (!slot_id || !script) {
            return res.status(400).json({ error: true, code: 'INVALID_PARAMS', message: 'slot_id and script are required' });
        }
        
        const scriptId = `gacs_${Date.now()}`;
        
        // Publish GACS command
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.commands', 'gacs.execute', Buffer.from(JSON.stringify({
                script_id: scriptId,
                slot_id: slot_id,
                script: script,
                params: params || {},
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({ status: 'executing', script_id: scriptId });
    } catch (error) {
        console.error('[OTTB] Error running GACS script:', error);
        res.status(500).json({ error: true, code: 'GACS_EXEC_ERROR', message: error.message });
    }
});

// GET /api/gacs/status/:script_id - Статус скрипта
app.get('/api/gacs/status/:script_id', async (req, res) => {
    try {
        const scriptId = parseInt(req.params.script_id);
        
        const result = await pool.query(`
            SELECT id, slot_id, script_name, script_type, status, result, error_message, started_at, completed_at
            FROM gacs_scripts
            WHERE id = $1
        `, [scriptId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, code: 'SCRIPT_NOT_FOUND', message: 'Script not found' });
        }
        
        const script = result.rows[0];
        res.json({
            script_id: script.id,
            slot_id: script.slot_id,
            script_name: script.script_name,
            script_type: script.script_type,
            status: script.status,
            result: script.result,
            error_message: script.error_message,
            started_at: script.started_at,
            completed_at: script.completed_at
        });
    } catch (error) {
        console.error('[OTTB] Error fetching GACS status:', error);
        res.status(500).json({ error: true, code: 'GACS_STATUS_ERROR', message: error.message });
    }
});

// GET /api/gacs/scripts - Список всех GACS скриптов
app.get('/api/gacs/scripts', async (req, res) => {
    try {
        const { slot_id, status, limit = 100 } = req.query;
        
        let query = 'SELECT * FROM gacs_scripts WHERE 1=1';
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
        
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
        params.push(parseInt(limit));
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('[OTTB] Error fetching GACS scripts:', error);
        res.status(500).json({ error: true, code: 'GACS_SCRIPTS_FETCH_ERROR', message: error.message });
    }
});

// POST /api/gacs/stop/:script_id - Остановка скрипта
app.post('/api/gacs/stop/:script_id', async (req, res) => {
    try {
        const scriptId = req.params.script_id;
        
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.commands', 'gacs.stop', Buffer.from(JSON.stringify({
                script_id: scriptId,
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({ status: 'stopped', script_id: scriptId });
    } catch (error) {
        console.error('[OTTB] Error stopping GACS script:', error);
        res.status(500).json({ error: true, code: 'GACS_STOP_ERROR', message: error.message });
    }
});

// ============================================
// SIP / PBX API
// ============================================

// GET /api/pbx/status - Статус всех транков
app.get('/api/pbx/status', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, status, last_health_check
            FROM trunks
            ORDER BY id
        `);
        
        const trunks = result.rows.map(row => ({
            name: row.name,
            state: row.status === 'active' ? 'OK' : row.status === 'inactive' ? 'WARN' : 'ERROR',
            failed: row.status === 'inactive' ? 1 : 0,
            last_check: row.last_health_check
        }));
        
        res.json({ trunks: trunks });
    } catch (error) {
        console.error('[OTTB] Error fetching PBX status:', error);
        res.status(500).json({ error: true, code: 'PBX_STATUS_ERROR', message: error.message });
    }
});

// POST /api/pbx/dial - Инициация звонка через SIP (F-03: SIP Outbound Call)
app.post('/api/pbx/dial', async (req, res) => {
    try {
        const { from, to, trunk } = req.body;
        
        if (!from || !to) {
            return res.status(400).json({ error: true, code: 'INVALID_PARAMS', message: 'from and to are required' });
        }
        
        // Get slot info if 'from' is a slot ID
        let fromSipNumber = from;
        if (!isNaN(parseInt(from))) {
            const slotResult = await pool.query('SELECT internal_sip_number, sip_username FROM slots WHERE id = $1', [parseInt(from)]);
            if (slotResult.rows.length > 0 && slotResult.rows[0].internal_sip_number) {
                fromSipNumber = slotResult.rows[0].internal_sip_number;
            }
        }
        
        // Publish F-03 SIP dial command
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.commands', 'sip.dial', Buffer.from(JSON.stringify({
                from: fromSipNumber,
                to: to,
                trunk: trunk,
                f_flow: 'F-03',
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({ status: 'dialing', from: fromSipNumber, to: to });
    } catch (error) {
        console.error('[OTTB] Error dialing:', error);
        res.status(500).json({ error: true, code: 'PBX_DIAL_ERROR', message: error.message });
    }
});

// POST /api/pbx/route - Обновление плана набора (OTTB Dialplan Compiler)
app.post('/api/pbx/route', async (req, res) => {
    try {
        const { slot_id, target_slot_id, action } = req.body;
        
        if (!slot_id) {
            return res.status(400).json({ error: true, code: 'INVALID_PARAMS', message: 'slot_id is required' });
        }
        
        // Get slot SIP info
        const slotResult = await pool.query(`
            SELECT internal_sip_number, sip_username, device_type
            FROM slots WHERE id = $1
        `, [slot_id]);
        
        if (slotResult.rows.length === 0) {
            return res.status(404).json({ error: true, code: 'SLOT_NOT_FOUND', message: 'Slot not found' });
        }
        
        const slot = slotResult.rows[0];
        
        // Generate dialplan route (Asterisk format)
        const dialplan = {
            extension: slot.internal_sip_number,
            context: 'internal',
            priority: 1,
            application: 'Dial',
            data: `PJSIP/${slot.sip_username || `slot_${slot_id}`}`,
            timeout: 30
        };
        
        // Publish route update event
        if (rabbitmqChannel) {
            rabbitmqChannel.publish('vss.events', 'pbx.route.update', Buffer.from(JSON.stringify({
                event: 'pbx.route.update',
                slot_id: slot_id,
                dialplan: dialplan,
                timestamp: new Date().toISOString()
            })));
        }
        
        res.json({ status: 'route_updated', slot_id: slot_id, dialplan: dialplan });
    } catch (error) {
        console.error('[OTTB] Error updating route:', error);
        res.status(500).json({ error: true, code: 'PBX_ROUTE_ERROR', message: error.message });
    }
});

// GET /api/pbx/cdr/:id - Получить CDR звонка
app.get('/api/pbx/cdr/:id', async (req, res) => {
    try {
        const callId = req.params.id;
        const result = await pool.query(`
            SELECT * FROM calls WHERE id::text = $1 OR client_number = $1
            ORDER BY start_time DESC LIMIT 1
        `, [callId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, code: 'CDR_NOT_FOUND', message: 'CDR not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('[OTTB] Error fetching CDR:', error);
        res.status(500).json({ error: true, code: 'CDR_FETCH_ERROR', message: error.message });
    }
});

// ============================================
// MONITORING API
// ============================================

// GET /api/monitor/system - Системные метрики
app.get('/api/monitor/system', async (req, res) => {
    try {
        const os = require('os');
        
        // CPU usage (среднее за последнюю минуту)
        const cpus = os.cpus();
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return acc + (1 - idle / total);
        }, 0) / cpus.length * 100;
        
        // Memory usage
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memUsage = (usedMem / totalMem) * 100;
        
        // Uptime
        const uptimeSeconds = os.uptime();
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptime = `${hours}h${minutes}m`;
        
        res.json({
            cpu: Math.round(cpuUsage),
            ram: Math.round(memUsage),
            uptime: uptime,
            total_memory_mb: Math.round(totalMem / 1024 / 1024),
            free_memory_mb: Math.round(freeMem / 1024 / 1024),
            used_memory_mb: Math.round(usedMem / 1024 / 1024),
            load_average: os.loadavg(),
            platform: os.platform(),
            arch: os.arch()
        });
    } catch (error) {
        console.error('[OTTB] Error fetching system metrics:', error);
        res.status(500).json({ error: true, code: 'MONITOR_ERROR', message: error.message });
    }
});

// GET /api/monitor/usb - Статус USB HUB (F-13: RTMP Health Check related)
app.get('/api/monitor/usb', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.name as hub, 
                   t.type,
                   COUNT(CASE WHEN s.status IN ('free', 'busy') THEN 1 END) as online,
                   COUNT(*) as total,
                   COUNT(CASE WHEN s.status = 'busy' THEN 1 END) as busy
            FROM trunks t
            LEFT JOIN slots s ON t.id = s.trunk_id
            GROUP BY t.id, t.name, t.type
            ORDER BY t.id
        `);
        
        const hubs = result.rows.map(row => ({
            hub: row.hub,
            type: row.type,
            online: parseInt(row.online) || 0,
            total: parseInt(row.total) || 0,
            busy: parseInt(row.busy) || 0,
            available: (parseInt(row.total) || 0) - (parseInt(row.busy) || 0)
        }));
        
        res.json(hubs);
    } catch (error) {
        console.error('[OTTB] Error fetching USB status:', error);
        res.status(500).json({ error: true, code: 'USB_MONITOR_ERROR', message: error.message });
    }
});

// GET /api/monitor/network - Сетевые метрики
app.get('/api/monitor/network', async (req, res) => {
    try {
        const os = require('os');
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        // Получаем сетевые интерфейсы
        const networkInterfaces = os.networkInterfaces();
        const interfaces = [];
        
        for (const [name, addrs] of Object.entries(networkInterfaces)) {
            if (!addrs) continue;
            for (const addr of addrs) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    interfaces.push({
                        name: name,
                        address: addr.address,
                        netmask: addr.netmask,
                        mac: addr.mac
                    });
                }
            }
        }
        
        // Пытаемся получить реальную пропускную способность (если доступно)
        let bandwidthMbps = null;
        let latencyMs = null;
        
        try {
            // Для Windows используем netsh, для Linux - ifconfig/ip
            if (process.platform === 'win32') {
                // Windows: получаем скорость интерфейса через WMI или netsh
                const { stdout } = await execAsync('netsh interface show interface');
                // Парсим вывод для определения активных интерфейсов
                bandwidthMbps = 1000; // По умолчанию для Windows
            } else {
                // Linux: используем ethtool или ip
                try {
                    const { stdout } = await execAsync('ethtool eth0 2>/dev/null | grep Speed || echo "Speed: Unknown"');
                    const speedMatch = stdout.match(/Speed: (\d+)Mb\/s/);
                    if (speedMatch) {
                        bandwidthMbps = parseInt(speedMatch[1]);
                    }
                } catch {
                    // Если ethtool недоступен, используем значение по умолчанию
                    bandwidthMbps = 1000;
                }
            }
        } catch (error) {
            console.warn('[OTTB] Could not determine network bandwidth:', error.message);
            bandwidthMbps = 1000; // Значение по умолчанию
        }
        
        // Пытаемся измерить задержку до внешнего хоста (например, 8.8.8.8)
        try {
            if (process.platform === 'win32') {
                const { stdout } = await execAsync('ping -n 1 8.8.8.8');
                const latencyMatch = stdout.match(/time[<=](\d+)ms/i);
                if (latencyMatch) {
                    latencyMs = parseInt(latencyMatch[1]);
                }
            } else {
                const { stdout } = await execAsync('ping -c 1 8.8.8.8 2>/dev/null | grep "time=" || echo ""');
                const latencyMatch = stdout.match(/time=([\d.]+)\s*ms/);
                if (latencyMatch) {
                    latencyMs = Math.round(parseFloat(latencyMatch[1]));
                }
            }
        } catch (error) {
            console.warn('[OTTB] Could not measure network latency:', error.message);
            latencyMs = null;
        }
        
        res.json({
            bandwidth_mbps: bandwidthMbps,
            latency_ms: latencyMs,
            interfaces: interfaces,
            hostname: os.hostname()
        });
    } catch (error) {
        console.error('[OTTB] Error fetching network metrics:', error);
        res.status(500).json({ error: true, code: 'NETWORK_MONITOR_ERROR', message: error.message });
    }
});

// GET /api/monitor/slots/:id - Детальный мониторинг слота
app.get('/api/monitor/slots/:id', async (req, res) => {
    try {
        const slotId = parseInt(req.params.id);
        const result = await pool.query('SELECT health_metrics FROM slots WHERE id = $1', [slotId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, code: 'SLOT_NOT_FOUND', message: 'Slot not found' });
        }
        
        const metrics = result.rows[0].health_metrics || {};
        res.json({
            slot_id: slotId,
            cpu: metrics.cpu || 0,
            ram: metrics.ram || 0,
            temperature: metrics.temperature || 'N/A',
            battery: metrics.battery || 'N/A',
            latency: metrics.latency || 0
        });
    } catch (error) {
        console.error('[OTTB] Error fetching slot metrics:', error);
        res.status(500).json({ error: true, code: 'SLOT_MONITOR_ERROR', message: error.message });
    }
});

// Initialize RabbitMQ on startup
initRabbitMQ();

// Load CDR and Recording API endpoints
try {
    const apiCdrRecording = require('./api-cdr-recording');
    if (typeof apiCdrRecording === 'function') {
        apiCdrRecording(app, pool, rabbitmqChannel);
    }
} catch (error) {
    // File doesn't exist or has errors - skip it
    console.warn('[OTTB] api-cdr-recording.js not found or has errors, skipping CDR/Recording endpoints');
}

// Используем утилиту для поиска свободного порта

// Запуск сервера
async function startServer() {
    try {
        if (!isDocker) {
            try {
                const availablePort = await findAvailablePort(DEFAULT_PORT, 500);
                if (availablePort !== DEFAULT_PORT) {
                    console.log(`[OTTB] ⚠️  Порт ${DEFAULT_PORT} занят. Используется ${availablePort}`);
                }
                PORT = availablePort;
            } catch (portError) {
                console.error('❌ [OTTB] Не удалось подобрать свободный порт:', portError.message);
                process.exit(1);
            }
        } else {
            PORT = DEFAULT_PORT;
        }

        app.listen(PORT, () => {
            console.log(`VSS OTTB Core service listening on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('❌ [OTTB] Ошибка запуска сервера:', error.message);
        process.exit(1);
    }
}

startServer();
