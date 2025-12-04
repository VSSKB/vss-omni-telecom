const express = require('express');
const cors = require('cors');
const modesl = require('modesl');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.FREESWITCH_ADMIN_PORT || 8088;
const FS_HOST = process.env.FREESWITCH_HOST || '127.0.0.1';
const FS_PORT = process.env.FREESWITCH_ESL_PORT || 8021;
const FS_PASSWORD = process.env.FREESWITCH_PASSWORD || 'ClueCon';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// FreeSWITCH ESL Connection
let fsConnection = null;

function connectToFreeSWITCH() {
    return new Promise((resolve, reject) => {
        try {
            const conn = new modesl.Connection(FS_HOST, FS_PORT, FS_PASSWORD, () => {
                console.log('[FS-ADMIN] ✅ Connected to FreeSWITCH ESL');
                fsConnection = conn;
                resolve(conn);
            });

            conn.on('error', (err) => {
                console.error('[FS-ADMIN] ❌ FreeSWITCH connection error:', err.message);
                fsConnection = null;
                // Auto-reconnect after 5 seconds
                setTimeout(connectToFreeSWITCH, 5000);
            });

            conn.on('esl::end', () => {
                console.log('[FS-ADMIN] ⚠️  FreeSWITCH connection closed');
                fsConnection = null;
                setTimeout(connectToFreeSWITCH, 5000);
            });
        } catch (error) {
            console.error('[FS-ADMIN] ❌ Failed to connect to FreeSWITCH:', error.message);
            setTimeout(connectToFreeSWITCH, 5000);
            reject(error);
        }
    });
}

// API: Execute FreeSWITCH command
app.post('/api/command', async (req, res) => {
    const { command } = req.body;

    if (!command) {
        return res.status(400).json({ error: 'Command is required' });
    }

    if (!fsConnection) {
        return res.status(503).json({ error: 'Not connected to FreeSWITCH' });
    }

    try {
        fsConnection.api(command, (result) => {
            const body = result.getBody();
            res.json({ 
                success: true, 
                result: body,
                command: command 
            });
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API: Get status
app.get('/api/status', (req, res) => {
    if (!fsConnection) {
        return res.json({ 
            connected: false,
            message: 'Not connected to FreeSWITCH'
        });
    }

    fsConnection.api('status', (result) => {
        res.json({
            connected: true,
            status: result.getBody()
        });
    });
});

// API: Get channels (active calls)
app.get('/api/channels', (req, res) => {
    if (!fsConnection) {
        return res.status(503).json({ error: 'Not connected to FreeSWITCH' });
    }

    fsConnection.api('show channels as json', (result) => {
        try {
            const data = JSON.parse(result.getBody());
            res.json(data);
        } catch (error) {
            res.json({ rows: [], row_count: 0 });
        }
    });
});

// API: Get registrations
app.get('/api/registrations', (req, res) => {
    if (!fsConnection) {
        return res.status(503).json({ error: 'Not connected to FreeSWITCH' });
    }

    fsConnection.api('show registrations as json', (result) => {
        try {
            const data = JSON.parse(result.getBody());
            res.json(data);
        } catch (error) {
            res.json({ rows: [], row_count: 0 });
        }
    });
});

// API: Get calls (detailed)
app.get('/api/calls', (req, res) => {
    if (!fsConnection) {
        return res.status(503).json({ error: 'Not connected to FreeSWITCH' });
    }

    fsConnection.api('show calls as json', (result) => {
        try {
            const data = JSON.parse(result.getBody());
            res.json(data);
        } catch (error) {
            res.json({ rows: [], row_count: 0 });
        }
    });
});

// API: Originate call
app.post('/api/originate', (req, res) => {
    const { from, to } = req.body;

    if (!from || !to) {
        return res.status(400).json({ error: 'From and To are required' });
    }

    if (!fsConnection) {
        return res.status(503).json({ error: 'Not connected to FreeSWITCH' });
    }

    const command = `originate {origination_caller_id_number=${from}}user/${from} &bridge(user/${to})`;
    
    fsConnection.bgapi(command, (result) => {
        res.json({
            success: true,
            message: 'Call initiated',
            jobId: result.getHeader('Job-UUID')
        });
    });
});

// API: Hangup call
app.post('/api/hangup', (req, res) => {
    const { uuid } = req.body;

    if (!uuid) {
        return res.status(400).json({ error: 'UUID is required' });
    }

    if (!fsConnection) {
        return res.status(503).json({ error: 'Not connected to FreeSWITCH' });
    }

    fsConnection.api(`uuid_kill ${uuid}`, (result) => {
        res.json({
            success: true,
            message: 'Call terminated',
            result: result.getBody()
        });
    });
});

// API: Reload configuration
app.post('/api/reload', (req, res) => {
    if (!fsConnection) {
        return res.status(503).json({ error: 'Not connected to FreeSWITCH' });
    }

    fsConnection.api('reloadxml', (result) => {
        res.json({
            success: true,
            message: 'Configuration reloaded',
            result: result.getBody()
        });
    });
});

// API: Get Sofia status
app.get('/api/sofia/status', (req, res) => {
    if (!fsConnection) {
        return res.status(503).json({ error: 'Not connected to FreeSWITCH' });
    }

    fsConnection.api('sofia status', (result) => {
        res.json({
            success: true,
            status: result.getBody()
        });
    });
});

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, async () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║                                                       ║');
    console.log('║       FreeSWITCH Web Admin - VSS OMNI TELECOM        ║');
    console.log('║                                                       ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`[FS-ADMIN] 🌐 Web interface: http://localhost:${PORT}`);
    console.log(`[FS-ADMIN] 📞 FreeSWITCH: ${FS_HOST}:${FS_PORT}`);
    console.log('');
    console.log('[FS-ADMIN] 🔌 Connecting to FreeSWITCH...');
    
    try {
        await connectToFreeSWITCH();
    } catch (error) {
        console.error('[FS-ADMIN] ⚠️  Initial connection failed, will retry...');
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[FS-ADMIN] 🛑 Shutting down...');
    if (fsConnection) {
        fsConnection.disconnect();
    }
    process.exit(0);
});

