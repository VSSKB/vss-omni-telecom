// FreeSWITCH Admin - Client Side JavaScript

const API_BASE = window.location.origin;

// Auto-refresh intervals
let statusInterval;
let callsInterval;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkConnection();
    loadSystemStatus();
    refreshCalls();
    refreshRegistrations();
    
    // Auto-refresh every 5 seconds
    statusInterval = setInterval(checkConnection, 5000);
    callsInterval = setInterval(refreshCalls, 10000);
});

// Check FreeSWITCH connection
async function checkConnection() {
    try {
        const response = await fetch(`${API_BASE}/api/status`);
        const data = await response.json();
        
        const statusEl = document.getElementById('connectionStatus');
        if (data.connected) {
            statusEl.className = 'status-badge status-connected';
            statusEl.innerHTML = '🟢 Connected';
        } else {
            statusEl.className = 'status-badge status-disconnected';
            statusEl.innerHTML = '🔴 Disconnected';
        }
    } catch (error) {
        console.error('Connection check failed:', error);
        const statusEl = document.getElementById('connectionStatus');
        statusEl.className = 'status-badge status-disconnected';
        statusEl.innerHTML = '🔴 Connection Error';
    }
}

// Load system status
async function loadSystemStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/status`);
        const data = await response.json();
        
        const statsEl = document.getElementById('systemStats');
        
        if (data.connected && data.status) {
            const lines = data.status.split('\n').filter(line => line.trim());
            let html = '';
            
            lines.forEach(line => {
                if (line.includes('UP')) {
                    const parts = line.split(',');
                    parts.forEach(part => {
                        const [label, value] = part.split(':').map(s => s.trim());
                        if (label && value) {
                            html += `
                                <div class="stat">
                                    <span class="stat-label">${label}</span>
                                    <span class="stat-value">${value}</span>
                                </div>
                            `;
                        }
                    });
                }
            });
            
            statsEl.innerHTML = html || '<div class="empty-state">No status data</div>';
        } else {
            statsEl.innerHTML = '<div class="empty-state">Not connected to FreeSWITCH</div>';
        }
    } catch (error) {
        console.error('Failed to load system status:', error);
        document.getElementById('systemStats').innerHTML = 
            '<div class="empty-state">Error loading status</div>';
    }
}

// Refresh active calls
async function refreshCalls() {
    try {
        const response = await fetch(`${API_BASE}/api/calls`);
        const data = await response.json();
        
        const countEl = document.getElementById('callsCount');
        const listEl = document.getElementById('callsList');
        
        const callCount = data.row_count || 0;
        countEl.innerHTML = `
            <span class="stat-label">Current Calls:</span>
            <span class="stat-value">${callCount}</span>
        `;
        
        if (callCount > 0 && data.rows) {
            let html = `
                <table>
                    <thead>
                        <tr>
                            <th>UUID</th>
                            <th>Direction</th>
                            <th>From</th>
                            <th>To</th>
                            <th>State</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            data.rows.forEach(call => {
                html += `
                    <tr>
                        <td>${call.uuid ? call.uuid.substring(0, 8) + '...' : 'N/A'}</td>
                        <td>${call.direction || 'N/A'}</td>
                        <td>${call.cid_num || 'N/A'}</td>
                        <td>${call.dest || 'N/A'}</td>
                        <td>${call.callstate || 'N/A'}</td>
                        <td>
                            <button class="btn btn-danger" onclick="hangupCall('${call.uuid}')">
                                Hangup
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table>';
            listEl.innerHTML = html;
        } else {
            listEl.innerHTML = '<div class="empty-state">No active calls</div>';
        }
    } catch (error) {
        console.error('Failed to refresh calls:', error);
    }
}

// Refresh registrations
async function refreshRegistrations() {
    try {
        const response = await fetch(`${API_BASE}/api/registrations`);
        const data = await response.json();
        
        const countEl = document.getElementById('registrationsCount');
        const listEl = document.getElementById('registrationsList');
        
        const regCount = data.row_count || 0;
        countEl.innerHTML = `
            <span class="stat-label">Registered Users:</span>
            <span class="stat-value">${regCount}</span>
        `;
        
        if (regCount > 0 && data.rows) {
            let html = `
                <table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Contact</th>
                            <th>Agent</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            data.rows.forEach(reg => {
                html += `
                    <tr>
                        <td>${reg.reg_user || 'N/A'}</td>
                        <td>${reg.url || 'N/A'}</td>
                        <td>${reg.agent || 'N/A'}</td>
                        <td>${reg.status || 'N/A'}</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table>';
            listEl.innerHTML = html;
        } else {
            listEl.innerHTML = '<div class="empty-state">No registrations</div>';
        }
    } catch (error) {
        console.error('Failed to refresh registrations:', error);
    }
}

// Make a call
async function makeCall() {
    const from = document.getElementById('callFrom').value;
    const to = document.getElementById('callTo').value;
    
    if (!from || !to) {
        alert('Please enter both From and To extensions');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/originate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Call initiated successfully!\nJob ID: ${data.jobId}`);
            // Switch to calls tab
            switchTab('calls');
            // Refresh calls list
            setTimeout(refreshCalls, 2000);
        } else {
            alert('Failed to initiate call: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Error making call: ' + error.message);
    }
}

// Hangup a call
async function hangupCall(uuid) {
    if (!confirm('Are you sure you want to hangup this call?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/hangup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uuid })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Call terminated successfully');
            refreshCalls();
        } else {
            alert('Failed to hangup call: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Error hanging up call: ' + error.message);
    }
}

// Execute FreeSWITCH command
async function executeCommand() {
    const input = document.getElementById('commandInput');
    const command = input.value.trim();
    
    if (!command) {
        return;
    }
    
    const output = document.getElementById('consoleOutput');
    output.innerHTML += `\n$ ${command}\n`;
    
    try {
        const response = await fetch(`${API_BASE}/api/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command })
        });
        
        const data = await response.json();
        
        if (data.success) {
            output.innerHTML += data.result + '\n';
        } else {
            output.innerHTML += `ERROR: ${data.error}\n`;
        }
        
        // Scroll to bottom
        output.scrollTop = output.scrollHeight;
        
        // Clear input
        input.value = '';
    } catch (error) {
        output.innerHTML += `ERROR: ${error.message}\n`;
        output.scrollTop = output.scrollHeight;
    }
}

// Clear console
function clearConsole() {
    document.getElementById('consoleOutput').innerHTML = 'Console cleared.\n';
}

// Refresh Sofia status
async function refreshSofia() {
    const output = document.getElementById('sofiaStatus');
    output.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
    
    try {
        const response = await fetch(`${API_BASE}/api/sofia/status`);
        const data = await response.json();
        
        if (data.success) {
            output.innerHTML = data.status;
        } else {
            output.innerHTML = 'Error loading Sofia status';
        }
    } catch (error) {
        output.innerHTML = `Error: ${error.message}`;
    }
}

// Switch tabs
function switchTab(tabName) {
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Add active class to clicked tab
    event.target.classList.add('active');
    
    // Show corresponding content
    document.getElementById(tabName).classList.add('active');
    
    // Refresh data when switching to certain tabs
    if (tabName === 'calls') {
        refreshCalls();
    } else if (tabName === 'registrations') {
        refreshRegistrations();
    } else if (tabName === 'sofia') {
        refreshSofia();
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    clearInterval(statusInterval);
    clearInterval(callsInterval);
});



