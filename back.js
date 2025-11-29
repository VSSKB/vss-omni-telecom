// server.js
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const WebSocket = require('ws');
const Manager = require('asterisk-manager');
const adb = require('adbkit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { findAvailablePort } = require('./utils/port-finder');

// ---------- CONFIG ----------
const DEFAULT_WEB_PORT = process.env.WEB_PORT ? Number(process.env.WEB_PORT) : 8181;
let WEB_PORT = DEFAULT_WEB_PORT;

// Asterisk AMI config (edit as needed)
const AMI_HOST = process.env.AMI_HOST || '172.30.206.128';
const AMI_PORT = process.env.AMI_PORT ? Number(process.env.AMI_PORT) : 5038;
const AMI_USER = process.env.AMI_USER || 'vss';
const AMI_PASS = process.env.AMI_PASS || 'UZzdzBjdVZzWms9';

// JWT secret (in production: strong secret, env var)
const JWT_SECRET = process.env.JWT_SECRET || 'vss_demo_secret_change_me';

// Files
const USERS_FILE = path.join(__dirname, 'users.json');
const CLIENT_HTML = path.join(__dirname, 'client.html');

// Heartbeat interval for ws
const HEARTBEAT_MS = 10000;
const ADB_POLL_MS = 30000;

// ---------- Storage ----------
let users = {}; // username -> { passwordHash, createdAt }

// Load users from file
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const txt = fs.readFileSync(USERS_FILE, 'utf8');
      users = JSON.parse(txt);
      console.log('[AUTH] Loaded users.json');
    } else {
      // start with empty and write
      users = {};
      saveUsers();
      console.log('[AUTH] Created initial users.json');
    }
  } catch (err) {
    console.error('[AUTH] Failed loading users.json', err);
    users = {};
  }
}
function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    console.log('[AUTH] Saved users.json');
  } catch (err) {
    console.error('[AUTH] Failed saving users.json', err);
  }
}
loadUsers();

// ---------- HTTP server ----------
const server = http.createServer(async (req, res) => {
  // CORS headers for local dev (adjust in prod)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.url === '/' && req.method === 'GET') {
      // Serve the client UI
      if (fs.existsSync(CLIENT_HTML)) {
        const html = fs.readFileSync(CLIENT_HTML, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      } else {
        res.writeHead(500);
        res.end('client.html not found on server.');
        return;
      }
    } else if (req.url === '/login' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c.toString());
      req.on('end', () => {
        try {
          const { username, password } = JSON.parse(body || '{}');
          if (!username || !password) {
            res.writeHead(400); res.end(JSON.stringify({ error: 'username & password required' })); return;
          }
          const record = users[username];
          if (!record) {
            res.writeHead(401); res.end(JSON.stringify({ error: 'Invalid credentials' })); return;
          }
          const ok = bcrypt.compareSync(password, record.passwordHash);
          if (!ok) {
            res.writeHead(401); res.end(JSON.stringify({ error: 'Invalid credentials' })); return;
          }
          const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '12h' });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ token, username }));
          console.log('[AUTH] user logged in:', username);
        } catch (e) {
          res.writeHead(400); res.end(JSON.stringify({ error: 'Bad request' }));
        }
      });
      return;
    } else if (req.url === '/register' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c.toString());
      req.on('end', () => {
        try {
          const { username, password } = JSON.parse(body || '{}');
          if (!username || !password) {
            res.writeHead(400); res.end(JSON.stringify({ error: 'username & password required' })); return;
          }
          if (users[username]) {
            res.writeHead(409); res.end(JSON.stringify({ error: 'User exists' })); return;
          }
          const passwordHash = bcrypt.hashSync(password, 10);
          users[username] = { passwordHash, createdAt: new Date().toISOString() };
          saveUsers();
          const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '12h' });
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ token, username }));
          console.log('[AUTH] user registered:', username);
        } catch (e) {
          res.writeHead(400); res.end(JSON.stringify({ error: 'Bad request' }));
        }
      });
      return;
    } else if (req.url === '/status' && req.method === 'GET') {
      // status endpoint for monitoring
      const uptime = process.uptime();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        uptime,
        clients: wss ? wss.clients.size : 0,
        agents: amiPool.size,
        adbDevices
      }));
      return;
    } else {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
  } catch (e) {
    console.error('HTTP handler error', e);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

// ---------- WebSocket ----------
const wss = new WebSocket.Server({ server });
const clientContexts = new Map(); // ws -> context {username, authenticated, ami, amiStatus, amiReconnectAttempts}
const amiPool = new Map(); // arbitrary pool of AMI per ws id if desired
let adbDevices = [];

// helper send
function send(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(obj)); } catch (e) { /* ignore */ }
  }
}

// heartbeat
function noop() {}
setInterval(() => {
  wss.clients.forEach(ws => {
    const ctx = clientContexts.get(ws) || {};
    if (ws.isAlive === false) {
      // terminate dead connection
      console.log('[WS] terminating dead connection');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping(noop);
  });
}, HEARTBEAT_MS);

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  const ctx = { authenticated: false, username: null, ami: null, amiStatus: 'disconnected', amiReconnectAttempts: 0 };
  clientContexts.set(ws, ctx);

  console.log('[WS] client connected, total:', wss.clients.size);
  send(ws, { type: 'server_ready', time: new Date().toISOString() });

  ws.on('message', async (msg) => {
    let parsed = null;
    try { parsed = JSON.parse(msg); } catch (e) {
      send(ws, { type: 'error', message: 'Invalid JSON' }); return;
    }

    // auth via JWT
    if (parsed.type === 'auth_jwt') {
      try {
        const decoded = jwt.verify(parsed.token, JWT_SECRET);
        ctx.authenticated = true;
        ctx.username = decoded.username;
        send(ws, { type: 'auth_ok', username: ctx.username });
        // start AMI connection for this ws
        await ensureAmiForClient(ws);
        // send current ADB devices
        send(ws, { type: 'adb_devices', devices: adbDevices });
      } catch (e) {
        send(ws, { type: 'auth_error', message: 'Invalid token' });
      }
      return;
    }

    if (!ctx.authenticated) {
      send(ws, { type: 'error', message: 'not authenticated' });
      return;
    }

    // handle other messages
    switch (parsed.type) {
      case 'ami_action':
        if (!ctx.ami || ctx.amiStatus !== 'connected') {
          send(ws, { type: 'ami_error', message: 'AMI not connected' });
          break;
        }
        try {
          // parsed.action is an object according to asterisk-manager API
          ctx.ami.action(parsed.action, (err, res) => {
            if (err) {
              send(ws, { type: 'ami_action_response', success: false, error: err.message });
            } else {
              send(ws, { type: 'ami_action_response', success: true, response: res });
            }
          });
        } catch (e) {
          send(ws, { type: 'ami_error', message: e.message });
        }
        break;

      case 'adb_action':
        // body: { deviceId, action, args... }
        handleAdbAction(ws, parsed).catch(err => {
          send(ws, { type: 'adb_action_response', success: false, error: err.message });
        });
        break;

      case 'ping':
        send(ws, { type: 'pong' });
        break;

      default:
        send(ws, { type: 'error', message: 'unknown action' });
    }
  });

  ws.on('close', () => {
    console.log('[WS] client disconnected');
    // teardown AMI for this client
    if (ctx.ami) {
      try { ctx.ami.disconnect(); } catch (e) {}
      ctx.ami = null;
    }
    clientContexts.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('[WS] error', err);
  });
});

// ---------- AMI management per-client with reconnect/backoff ----------
async function ensureAmiForClient(ws) {
  const ctx = clientContexts.get(ws);
  if (!ctx) return;
  if (ctx.ami && ctx.amiConnected) return;
  try {
    // Create manager instance
    const ami = new Manager(AMI_PORT, AMI_HOST, AMI_USER, AMI_PASS, true);
    ctx.ami = ami;
    ctx.amiStatus = 'connecting';
    send(ws, { type: 'ami_status', status: 'connecting' });

    ami.on('connect', () => {
      ctx.amiConnected = true;
      ctx.amiStatus = 'connected';
      ctx.amiReconnectAttempts = 0;
      send(ws, { type: 'ami_status', status: 'connected' });
      console.log('[AMI] connected for ws client');
    });

    ami.on('managerevent', (evt) => {
      // forward events to the client
      send(ws, { type: 'ami_event', event: evt });
    });

    ami.on('response', (resp) => {
      // forward if needed
      send(ws, { type: 'ami_response', response: resp });
    });

    ami.on('disconnect', () => {
      ctx.amiConnected = false;
      ctx.amiStatus = 'disconnected';
      send(ws, { type: 'ami_status', status: 'disconnected' });
      console.warn('[AMI] disconnected for ws client, will try reconnect');
      // reconnect with backoff
      attemptAmiReconnect(ws);
    });

    ami.on('error', (err) => {
      ctx.amiConnected = false;
      ctx.amiStatus = 'error';
      send(ws, { type: 'ami_status', status: 'error', message: err.message });
      console.error('[AMI] error', err);
      setTimeout(() => attemptAmiReconnect(ws), 2000);
    });

    // No explicit .connect() needed; Manager attempts to connect on construction
    amiPool.set(ws, ami);
  } catch (e) {
    console.error('[AMI] ensure error', e);
    send(ws, { type: 'ami_status', status: 'error', message: e.message });
    attemptAmiReconnect(ws);
  }
}

function attemptAmiReconnect(ws) {
  const ctx = clientContexts.get(ws);
  if (!ctx) return;
  ctx.amiReconnectAttempts = (ctx.amiReconnectAttempts || 0) + 1;
  const backoff = Math.min(30, Math.pow(2, Math.min(6, ctx.amiReconnectAttempts))) * 1000;
  console.log(`[AMI] will reconnect in ${backoff}ms`);
  setTimeout(() => {
    if (clientContexts.has(ws)) ensureAmiForClient(ws);
  }, backoff);
}

// ---------- ADB: device discovery & command handling ----------
const adbClient = adb.createClient();
async function discoverAdbDevices() {
  try {
    const devices = await adbClient.listDevices();
    adbDevices = devices.map(d => ({ id: d.id, type: d.type || 'device' }));
    // notify all ws clients
    wss.clients.forEach(ws => send(ws, { type: 'adb_devices', devices: adbDevices }));
    console.log('[ADB] devices', adbDevices);
  } catch (e) {
    console.error('[ADB] discover error', e);
  }
}

// handle adb action message
async function handleAdbAction(ws, msg) {
  // msg: { type:'adb_action', deviceId, action: 'dial'|'answer'|'hangup', value }
  if (!msg.deviceId || !msg.action) throw new Error('deviceId and action required');
  const dev = adbDevices.find(d => d.id === msg.deviceId);
  if (!dev) throw new Error('Device not found');
  switch (msg.action) {
    case 'dial':
      if (!msg.value) throw new Error('phone number required');
      await adbClient.startActivity(msg.deviceId, {
        action: 'android.intent.action.CALL',
        data: `tel:${msg.value}`
      });
      send(ws, { type: 'adb_action_response', success: true, action: 'dial' });
      break;
    case 'answer':
      await adbClient.shell(msg.deviceId, 'input keyevent KEYCODE_CALL'); // best-effort
      send(ws, { type: 'adb_action_response', success: true, action: 'answer' });
      break;
    case 'hangup':
      await adbClient.shell(msg.deviceId, 'input keyevent KEYCODE_ENDCALL');
      send(ws, { type: 'adb_action_response', success: true, action: 'hangup' });
      break;
    default:
      throw new Error('unknown adb action');
  }
}

// start initial discovery and schedule
discoverAdbDevices();
setInterval(discoverAdbDevices, ADB_POLL_MS);

// ---------- Start server ----------
(async () => {
  try {
    const testServer = net.createServer();

    testServer.once('error', async (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️  Порт ${DEFAULT_WEB_PORT} занят, ищем свободный...`);
        try {
          WEB_PORT = await findAvailablePort(DEFAULT_WEB_PORT, 100);
          console.log(`✅ Найден свободный порт: ${WEB_PORT}`);
          startServer();
        } catch (error) {
          console.error('❌ Не удалось найти свободный порт:', error.message);
          process.exit(1);
        }
      } else {
        console.error('❌ Ошибка проверки порта:', err.message);
        process.exit(1);
      }
    });

    testServer.once('listening', () => {
      testServer.close(() => {
        WEB_PORT = DEFAULT_WEB_PORT;
        startServer();
      });
    });

    testServer.listen(DEFAULT_WEB_PORT);
  } catch (error) {
    console.error('❌ Ошибка при запуске сервера:', error.message);
    process.exit(1);
  }
})();

function startServer() {
  server.listen(WEB_PORT, () => {
    console.log(`VSS DEMIURGE server running at http://localhost:${WEB_PORT}`);
    console.log(`Configured AMI: ${AMI_HOST}:${AMI_PORT} (user ${AMI_USER})`);
  });
}
