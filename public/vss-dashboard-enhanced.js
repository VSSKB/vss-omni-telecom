/**
 * VSS OTTB Enhanced Frontend - Complete Event Mapping Implementation
 * Implements all screens and F-Flow events according to EVENT-MAPPING.md
 */

class VSSEnhancedUI {
    constructor() {
        // Определяем базовые URL для API
        const origin = window.location.origin;
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        
        // Если работаем через прокси (nginx), используем тот же хост с разными портами
        // Иначе используем localhost
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
        
        if (isLocalhost) {
            this.apiBase = {
                ottb: 'http://localhost:8083',
                dci: 'http://localhost:8082',
                point: 'http://localhost:8081',
                workspace: 'http://localhost:3000'
            };
        } else {
            // В продакшене используем тот же хост с разными портами или поддоменами
            this.apiBase = {
                ottb: `${protocol}//${hostname}:8083`,
                dci: `${protocol}//${hostname}:8082`,
                point: `${protocol}//${hostname}:8081`,
                workspace: `${protocol}//${hostname}:3000`
            };
        }
        this.authToken = localStorage.getItem('vss_auth_token');
        this.userRole = localStorage.getItem('vss_user_role') || 'viewer';
        this.wsConnection = null;
        this.currentPage = 'dashboard';
        this.slots = [];
        this.calls = [];
        this.campaigns = [];
        this.gacsScripts = [];
        this.rtmpStreams = new Map();
    }

    async init() {
        this.connectWebSocket();
        await this.loadInitialData();
        this.setupEventHandlers();
        this.startAutoRefresh();
    }

    // ============================================
    // WebSocket Connection & Event Handlers
    // ============================================

    connectWebSocket() {
        try {
            this.wsConnection = io(this.apiBase.workspace, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5
            });

            this.wsConnection.on('connect', () => {
                console.log('[VSS] WebSocket connected');
                this.onWebSocketConnected();
            });

            // Control Plane Events (F-01, F-05, F-11)
            this.wsConnection.on('slot.update', (data) => this.handleSlotUpdate(data));
            this.wsConnection.on('call.update', (data) => this.handleCallUpdate(data));
            this.wsConnection.on('campaign.status', (data) => this.handleCampaignStatus(data));
            this.wsConnection.on('autodial.lead.update', (data) => this.handleAutodialLeadUpdate(data));
            this.wsConnection.on('pipeline.update', (data) => this.handlePipelineUpdate(data));

            // Media Plane Events (F-03, F-04, F-09, F-10, F-13, F-14)
            this.wsConnection.on('call.start', (data) => this.handleCallStart(data));
            this.wsConnection.on('call.end', (data) => this.handleCallEnd(data));
            this.wsConnection.on('rtmp.stream.start', (data) => this.handleRtmpStreamStart(data));
            this.wsConnection.on('rtmp.stream.stop', (data) => this.handleRtmpStreamStop(data));
            this.wsConnection.on('sip.registration', (data) => this.handleSipRegistration(data));
            this.wsConnection.on('cdr.update', (data) => this.handleCdrUpdate(data));
            this.wsConnection.on('recording.update', (data) => this.handleRecordingUpdate(data));
            this.wsConnection.on('recording.start', (data) => this.handleRecordingStart(data));
            this.wsConnection.on('recording.completed', (data) => this.handleRecordingCompleted(data));

            // Access/Automation Events (F-02, F-12)
            this.wsConnection.on('gacs.execute', (data) => this.handleGacsExecute(data));
            this.wsConnection.on('gacs.event', (data) => this.handleGacsEvent(data));
            this.wsConnection.on('chat.message', (data) => this.handleChatMessage(data));

            // DRP Events (F-06)
            this.wsConnection.on('slot.reboot', (data) => this.handleSlotReboot(data));
            this.wsConnection.on('drp.operation', (data) => this.handleDrpOperation(data));

            // Notification Events (F-07)
            this.wsConnection.on('system.alert', (data) => this.handleSystemAlert(data));
            this.wsConnection.on('notification.update', (data) => this.handleNotificationUpdate(data));

            this.wsConnection.on('disconnect', () => {
                console.warn('[VSS] WebSocket disconnected');
            });

            this.wsConnection.on('error', (error) => {
                console.error('[VSS] WebSocket error:', error);
            });
        } catch (error) {
            console.error('[VSS] WebSocket connection error:', error);
        }
    }

    // ============================================
    // Event Handlers
    // ============================================

    handleSlotUpdate(data) {
        // F-05: Slot Status Sync
        console.log('[VSS] Slot update:', data);
        this.updateSlotInList(data);
        this.updateMetrics();
        if (this.currentPage === 'slots') {
            this.renderSlotsGrid();
        }
    }

    handleCallUpdate(data) {
        // F-03, F-08: Call status changes
        console.log('[VSS] Call update:', data);
        this.updateCallInList(data);
        this.updateMetrics();
        if (this.currentPage === 'calls') {
            this.renderCallsFeed();
        }
    }

    handleCampaignStatus(data) {
        // F-11: Campaign Status
        console.log('[VSS] Campaign status:', data);
        this.updateCampaignInList(data);
        if (this.currentPage === 'autodialer') {
            this.renderCampaigns();
        }
    }

    handleAutodialLeadUpdate(data) {
        // F-01: Autodial Lead Queue
        console.log('[VSS] Autodial lead update:', data);
        if (this.currentPage === 'autodialer') {
            this.renderLeads();
        }
    }

    handlePipelineUpdate(data) {
        // F-11: Pipeline Status
        console.log('[VSS] Pipeline update:', data);
        if (this.currentPage === 'dashboard') {
            this.updateMetrics();
        }
    }

    handleCallStart(data) {
        // F-03: SIP Outbound Call
        console.log('[VSS] Call started:', data);
        this.addCallToList(data);
        this.updateMetrics();
    }

    handleCallEnd(data) {
        // F-08: DB Logging / CDR
        console.log('[VSS] Call ended:', data);
        this.updateCallInList({ ...data, status: 'ended' });
        this.updateMetrics();
    }

    handleRtmpStreamStart(data) {
        // F-04: RTMP Video/Audio Push
        console.log('[VSS] RTMP stream started:', data);
        this.rtmpStreams.set(data.slot_id, data);
        if (this.currentPage === 'slots') {
            this.updateSlotRtmpStatus(data.slot_id, true);
        }
    }

    handleRtmpStreamStop(data) {
        // F-04: RTMP Video/Audio Push
        console.log('[VSS] RTMP stream stopped:', data);
        this.rtmpStreams.delete(data.slot_id);
        if (this.currentPage === 'slots') {
            this.updateSlotRtmpStatus(data.slot_id, false);
        }
    }

    handleSipRegistration(data) {
        // F-09: SIP Registration
        console.log('[VSS] SIP registration:', data);
        this.updateSlotSipStatus(data.slot_id, data.registration_status);
    }

    handleCdrUpdate(data) {
        // F-13: CDR Collection
        console.log('[VSS] CDR update:', data);
        if (this.currentPage === 'calls') {
            this.updateCallCdr(data);
        }
    }

    handleRecordingUpdate(data) {
        // F-14: SIP Call Recording
        console.log('[VSS] Recording update:', data);
        if (this.currentPage === 'calls') {
            this.updateCallRecording(data);
        }
    }

    handleRecordingStart(data) {
        // F-14: SIP Call Recording
        console.log('[VSS] Recording started:', data);
    }

    handleRecordingCompleted(data) {
        // F-14: SIP Call Recording
        console.log('[VSS] Recording completed:', data);
    }

    handleGacsExecute(data) {
        // F-02: GACS Script Execution
        console.log('[VSS] GACS execute:', data);
        this.addGacsScriptToList(data);
    }

    handleGacsEvent(data) {
        // F-12: GACS Event Logging
        console.log('[VSS] GACS event:', data);
        this.updateGacsScriptStatus(data);
    }

    handleChatMessage(data) {
        // F-09: Chat Messaging
        console.log('[VSS] Chat message:', data);
        if (this.currentPage === 'gacs') {
            this.addChatMessage(data);
        }
    }

    handleSlotReboot(data) {
        // F-06: Hardware DRP
        console.log('[VSS] Slot reboot:', data);
        this.updateSlotInList({ ...data, fsm_state: 'FAULT' });
    }

    handleDrpOperation(data) {
        // F-06: Hardware DRP
        console.log('[VSS] DRP operation:', data);
    }

    handleSystemAlert(data) {
        // F-07: Notification / Alerts
        console.log('[VSS] System alert:', data);
        this.showAlert(data);
    }

    handleNotificationUpdate(data) {
        // F-07: Notification / Alerts
        console.log('[VSS] Notification update:', data);
        if (this.currentPage === 'notifications') {
            this.updateNotificationList(data);
        }
    }

    // ============================================
    // API Methods
    // ============================================

    async apiCall(method, url, data = null) {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (this.authToken) {
            options.headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            
            // Проверяем, есть ли тело ответа
            let result;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                const text = await response.text();
                try {
                    result = JSON.parse(text);
                } catch {
                    result = { message: text || 'Unknown error' };
                }
            }
            
            return { ok: response.ok, status: response.status, data: result };
        } catch (error) {
            console.error(`[VSS] API call error (${method} ${url}):`, error);
            return { ok: false, status: 0, error: error.message, data: { message: error.message } };
        }
    }

    // ============================================
    // Screen Navigation
    // ============================================

    switchPage(page) {
        this.currentPage = page;
        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
        const pageElement = document.getElementById(`page-${page}`);
        if (pageElement) {
            pageElement.style.display = 'block';
        }

        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const navItem = document.getElementById(`nav-${page}`);
        if (navItem) {
            navItem.classList.add('active');
        }

        // Load page-specific data
        this.loadPageData(page);
    }

    async loadPageData(page) {
        try {
            switch (page) {
                case 'dashboard':
                    await this.loadMetrics();
                    break;
                case 'slots':
                    await this.loadSlots();
                    break;
                case 'calls':
                    await this.loadCalls();
                    break;
                case 'autodialer':
                    await this.loadCampaigns();
                    await this.loadLeads();
                    break;
                case 'gacs':
                    await this.loadGacsScripts();
                    break;
                case 'notifications':
                    await this.loadNotifications();
                    break;
                case 'settings':
                    await this.loadSettings();
                    break;
                case 'hosts':
                    await this.loadSlots(); // Hosts page shows slots
                    break;
                case 'archonts':
                    // ARCHONTs page will be loaded separately
                    break;
            }
        } catch (error) {
            console.error(`[VSS] Error loading page data for ${page}:`, error);
            this.showNotification(`Ошибка загрузки данных: ${error.message}`, 'error');
        }
    }

    // ============================================
    // Action Methods (Event Triggers)
    // ============================================

    async startCall(slotId, number) {
        // EVENT: call.start | TRIGGER: onClick | TARGET: /api/call/start | F-FLOW: F-03
        const result = await this.apiCall('POST', `${this.apiBase.ottb}/api/call/start`, {
            slot: slotId,
            number: number
        });

        if (result.ok) {
            this.showNotification('Звонок инициирован', 'success');
            await this.loadCalls();
        } else {
            this.showNotification(`Ошибка: ${result.data.message || result.error}`, 'error');
        }
    }

    async endCall(callId) {
        // EVENT: call.end | TRIGGER: onClick | TARGET: /api/call/end | F-FLOW: F-08
        const result = await this.apiCall('POST', `${this.apiBase.ottb}/api/call/end`, {
            call_id: callId
        });

        if (result.ok) {
            this.showNotification('Звонок завершен', 'success');
            await this.loadCalls();
        } else {
            this.showNotification(`Ошибка: ${result.data.message || result.error}`, 'error');
        }
    }

    async restartSlot(slotId) {
        // EVENT: slot.restart | TRIGGER: onClick | TARGET: /api/slots/:id/restart | F-FLOW: F-05, F-06
        const result = await this.apiCall('POST', `${this.apiBase.ottb}/api/slots/${slotId}/restart`);

        if (result.ok) {
            this.showNotification('Слот перезапускается', 'info');
        } else {
            this.showNotification(`Ошибка: ${result.data.message || result.error}`, 'error');
        }
    }

    async rebootDevice(slotId) {
        // EVENT: slot.reboot | TRIGGER: onClick | TARGET: /api/slots/:id/reboot-device | F-FLOW: F-06
        const result = await this.apiCall('POST', `${this.apiBase.ottb}/api/slots/${slotId}/reboot-device`);

        if (result.ok) {
            this.showNotification('Устройство перезагружается', 'info');
        } else {
            this.showNotification(`Ошибка: ${result.data.message || result.error}`, 'error');
        }
    }

    async executeGacs(slotId, scriptName, scriptType, scriptContent) {
        // EVENT: gacs.execute | TRIGGER: onClick | TARGET: /api/slots/:id/gacs | F-FLOW: F-02
        const result = await this.apiCall('POST', `${this.apiBase.ottb}/api/slots/${slotId}/gacs`, {
            script_name: scriptName,
            script_type: scriptType,
            script_content: scriptContent
        });

        if (result.ok) {
            this.showNotification('GACS скрипт запущен', 'success');
            await this.loadGacsScripts();
        } else {
            this.showNotification(`Ошибка: ${result.data.message || result.error}`, 'error');
        }
    }

    async startCampaign(campaignId, leads) {
        // EVENT: campaign.start | TRIGGER: onClick | TARGET: /api/autodialer/run-campaign | F-FLOW: F-01
        const result = await this.apiCall('POST', `${this.apiBase.ottb}/api/autodialer/run-campaign`, {
            campaign_id: campaignId,
            leads: leads
        });

        if (result.ok) {
            this.showNotification('Кампания запущена', 'success');
            await this.loadCampaigns();
        } else {
            this.showNotification(`Ошибка: ${result.data.message || result.error}`, 'error');
        }
    }

    async startRecording(callId, slotId, recordingType = 'audio') {
        // EVENT: call.record | TRIGGER: onClick | TARGET: /api/recordings/start | F-FLOW: F-14
        const result = await this.apiCall('POST', `${this.apiBase.ottb}/api/recordings/start`, {
            call_id: callId,
            slot_id: slotId,
            recording_type: recordingType
        });

        if (result.ok) {
            this.showNotification('Запись начата', 'success');
        } else {
            this.showNotification(`Ошибка: ${result.data.message || result.error}`, 'error');
        }
    }

    async openGuacamole(slotId, protocol = 'rdp') {
        // EVENT: guacamole.open | TRIGGER: onClick | TARGET: GUACAMOLE
        const result = await this.apiCall('POST', `${this.apiBase.workspace}/api/guacamole/connect`, {
            slot_id: slotId,
            protocol: protocol
        });

        if (result.ok && result.data.connection_id) {
            window.open(`/guacamole/#/client/${result.data.connection_id}`, '_blank');
        } else {
            this.showNotification(`Ошибка: ${result.data.message || result.error}`, 'error');
        }
    }

    async startRtmpStream(slotId, streamUrl, resolution, framerate) {
        // EVENT: rtmp.start | TRIGGER: onClick | TARGET: /api/rtmp/stream/:slot_id/start | F-FLOW: F-04
        const result = await this.apiCall('POST', `${this.apiBase.workspace}/api/rtmp/stream/${slotId}/start`, {
            stream_url: streamUrl,
            resolution: resolution || '1280x720',
            framerate: framerate || 30
        });

        if (result.ok) {
            this.showNotification('RTMP поток запущен', 'success');
            await this.loadRtmpStreams();
        } else {
            this.showNotification(`Ошибка запуска RTMP: ${result.data?.message || result.error}`, 'error');
        }
    }

    async stopRtmpStream(slotId) {
        // EVENT: rtmp.stop | TRIGGER: onClick | TARGET: /api/rtmp/stream/:slot_id/stop | F-FLOW: F-04
        const result = await this.apiCall('POST', `${this.apiBase.workspace}/api/rtmp/stream/${slotId}/stop`);

        if (result.ok) {
            this.showNotification('RTMP поток остановлен', 'success');
            await this.loadRtmpStreams();
        } else {
            this.showNotification(`Ошибка остановки RTMP: ${result.data?.message || result.error}`, 'error');
        }
    }

    async viewRtmpStream(slotId) {
        // EVENT: rtmp.view | TRIGGER: onClick | TARGET: RTMP_PLAYER | F-FLOW: F-04
        const result = await this.apiCall('GET', `${this.apiBase.workspace}/api/rtmp/stream/${slotId}`);

        if (result.ok && result.data.hls_url) {
            // Open HLS player in modal or new window
            this.showRtmpPlayer(result.data.hls_url, slotId);
        } else {
            this.showNotification('RTMP поток не найден', 'warning');
        }
    }

    async loadRtmpStreams() {
        const result = await this.apiCall('GET', `${this.apiBase.workspace}/api/rtmp/streams`);
        if (result.ok) {
            this.rtmpStreams = new Map();
            result.data.forEach(stream => {
                this.rtmpStreams.set(stream.slot_id, stream);
            });
        }
    }

    // ============================================
    // Data Loading Methods
    // ============================================

    async loadInitialData() {
        await Promise.all([
            this.loadMetrics(),
            this.loadSlots(),
            this.loadCalls()
        ]);
    }

    async loadMetrics() {
        try {
            const result = await this.apiCall('GET', `${this.apiBase.workspace}/api/dashboard`);
            if (result.ok) {
                this.updateMetricsDisplay(result.data);
            }
        } catch (error) {
            console.error('[VSS] Error loading metrics:', error);
        }
    }

    async loadSlots() {
        try {
            const result = await this.apiCall('GET', `${this.apiBase.ottb}/api/slots`);
            if (result.ok) {
                this.slots = result.data;
                if (this.currentPage === 'slots') {
                    this.renderSlotsGrid();
                }
            }
        } catch (error) {
            console.error('[VSS] Error loading slots:', error);
        }
    }

    async loadCalls() {
        try {
            const result = await this.apiCall('GET', `${this.apiBase.ottb}/api/calls/feed`);
            if (result.ok) {
                this.calls = result.data;
                if (this.currentPage === 'calls') {
                    this.renderCallsFeed();
                }
            }
        } catch (error) {
            console.error('[VSS] Error loading calls:', error);
        }
    }

    async loadCampaigns() {
        try {
            const result = await this.apiCall('GET', `${this.apiBase.ottb}/api/autodialer/campaigns`);
            if (result.ok) {
                this.campaigns = result.data;
                if (this.currentPage === 'autodialer') {
                    this.renderCampaigns();
                }
            }
        } catch (error) {
            console.error('[VSS] Error loading campaigns:', error);
        }
    }

    async loadLeads() {
        // Load autodialer leads
        try {
            const result = await this.apiCall('GET', `${this.apiBase.ottb}/api/autodialer/leads`);
            if (result.ok && this.currentPage === 'autodialer') {
                this.renderLeads(result.data);
            }
        } catch (error) {
            console.error('[VSS] Error loading leads:', error);
        }
    }

    async loadGacsScripts() {
        try {
            const result = await this.apiCall('GET', `${this.apiBase.ottb}/api/gacs/scripts`);
            if (result.ok) {
                this.gacsScripts = result.data;
                if (this.currentPage === 'gacs') {
                    this.renderGacsScripts();
                }
            }
        } catch (error) {
            console.error('[VSS] Error loading GACS scripts:', error);
        }
    }

    async loadNotifications() {
        try {
            const result = await this.apiCall('GET', `${this.apiBase.workspace}/api/notifier/history`);
            if (result.ok && this.currentPage === 'notifications') {
                this.renderNotifications(result.data);
            }
        } catch (error) {
            console.error('[VSS] Error loading notifications:', error);
        }
    }

    // ============================================
    // Rendering Methods
    // ============================================

    updateMetricsDisplay(data) {
        if (data.slots) {
            document.getElementById('metric-total-slots')?.setTextContent(data.slots.total || 0);
            document.getElementById('metric-free-slots')?.setTextContent(data.slots.free || 0);
        }
        if (data.calls) {
            document.getElementById('metric-active-calls')?.setTextContent(data.calls.active || 0);
        }
        if (data.trunks) {
            document.getElementById('metric-total-hosts')?.setTextContent(data.trunks.total || 0);
            document.getElementById('metric-online-hosts')?.setTextContent(data.trunks.online || 0);
        }
    }

    renderSlotsGrid() {
        // Render slots grid with all actions
        const container = document.getElementById('slots-grid-container');
        if (!container) return;

        container.innerHTML = this.slots.map(slot => `
            <div class="slot-card" data-slot-id="${slot.id}">
                <div class="slot-header">
                    <h3>Slot ${slot.slot_number} - ${slot.name || 'Unnamed'}</h3>
                    <span class="slot-status status-${slot.status.toLowerCase()}">${slot.status}</span>
                </div>
                <div class="slot-info">
                    <p><strong>Type:</strong> ${slot.device_type}</p>
                    <p><strong>SIP:</strong> ${slot.internal_sip_number || 'N/A'}</p>
                    <p><strong>FSM:</strong> ${slot.fsm_state || 'IDLE'}</p>
                    <p><strong>Trunk:</strong> ${slot.trunk || 'N/A'}</p>
                </div>
                <div class="slot-actions">
                    <button onclick="window.vssEnhancedUI.startCall(${slot.id}, prompt('Enter phone number:'))" 
                            class="btn btn-primary">Call</button>
                    <button onclick="window.vssEnhancedUI.restartSlot(${slot.id})" 
                            class="btn btn-warning">Restart</button>
                    <button onclick="window.vssEnhancedUI.rebootDevice(${slot.id})" 
                            class="btn btn-danger">Reboot</button>
                    <button onclick="window.vssEnhancedUI.openGuacamole(${slot.id})" 
                            class="btn btn-info">View</button>
                    <button onclick="window.vssEnhancedUI.viewRtmpStream(${slot.id})" 
                            class="btn btn-success">RTMP</button>
                    <button onclick="window.vssEnhancedUI.executeGacs(${slot.id}, 'test', 'adb', 'adb shell input tap 100 200')" 
                            class="btn btn-secondary">GACS</button>
                </div>
            </div>
        `).join('');
    }

    renderCallsFeed() {
        // Render calls feed
        const container = document.getElementById('calls-feed-container');
        if (!container) return;

        container.innerHTML = this.calls.map(call => `
            <div class="call-item" data-call-id="${call.call_id}">
                <div class="call-info">
                    <span class="call-number">${call.number}</span>
                    <span class="call-status status-${call.status}">${call.status}</span>
                    <span class="call-slot">Slot: ${call.slot}</span>
                </div>
                <div class="call-actions">
                    <button onclick="window.vssEnhancedUI.endCall('${call.call_id}')" 
                            class="btn btn-danger">End</button>
                    <button onclick="window.vssEnhancedUI.startRecording('${call.call_id}', ${call.slot})" 
                            class="btn btn-info">Record</button>
                </div>
            </div>
        `).join('');
    }

    renderCampaigns() {
        // Render campaigns list
        const container = document.getElementById('campaigns-container');
        if (!container) return;

        container.innerHTML = this.campaigns.map(campaign => `
            <div class="campaign-item" data-campaign-id="${campaign.id}">
                <h4>${campaign.name}</h4>
                <p>Status: ${campaign.status}</p>
                <p>Leads: ${campaign.total_leads} / ${campaign.dialed_leads}</p>
            </div>
        `).join('');
    }

    renderGacsScripts() {
        // Render GACS scripts list
        const container = document.getElementById('gacs-scripts-container');
        if (!container) return;

        container.innerHTML = this.gacsScripts.map(script => `
            <div class="gacs-script-item" data-script-id="${script.id}">
                <h4>${script.script_name}</h4>
                <p>Type: ${script.script_type}</p>
                <p>Status: ${script.status}</p>
                <p>Slot: ${script.slot_id}</p>
            </div>
        `).join('');
    }

    renderNotifications(data) {
        // Render notifications list
        const container = document.getElementById('notifications-container');
        if (!container) return;

        container.innerHTML = data.map(notif => `
            <div class="notification-item severity-${notif.severity}">
                <p>${notif.message}</p>
                <span class="notification-time">${new Date(notif.timestamp).toLocaleString()}</span>
            </div>
        `).join('');
    }

    // ============================================
    // Helper Methods
    // ============================================

    showNotification(message, type = 'info') {
        // Show toast notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showAlert(data) {
        // Show system alert
        this.showNotification(`${data.type}: ${data.message}`, data.severity || 'error');
    }

    showRtmpPlayer(hlsUrl, slotId) {
        // Show RTMP/HLS player modal
        const modal = document.createElement('div');
        modal.className = 'rtmp-player-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h3>RTMP Stream - Slot ${slotId}</h3>
                <video id="rtmp-player-${slotId}" controls autoplay>
                    <source src="${hlsUrl}" type="application/x-mpegURL">
                </video>
            </div>
        `;
        document.body.appendChild(modal);
    }

    updateSlotInList(data) {
        const index = this.slots.findIndex(s => s.id === data.slot_id);
        if (index >= 0) {
            this.slots[index] = { ...this.slots[index], ...data };
        }
    }

    updateCallInList(data) {
        const index = this.calls.findIndex(c => c.call_id === data.call_id);
        if (index >= 0) {
            this.calls[index] = { ...this.calls[index], ...data };
        }
    }

    addCallToList(data) {
        if (!this.calls.find(c => c.call_id === data.call_id)) {
            this.calls.unshift(data);
        }
    }

    updateCampaignInList(data) {
        const index = this.campaigns.findIndex(c => c.id === data.campaign_id);
        if (index >= 0) {
            this.campaigns[index] = { ...this.campaigns[index], ...data };
        }
    }

    addGacsScriptToList(data) {
        if (!this.gacsScripts.find(s => s.id === data.script_id)) {
            this.gacsScripts.unshift(data);
        }
    }

    updateGacsScriptStatus(data) {
        const index = this.gacsScripts.findIndex(s => s.id === data.script_id);
        if (index >= 0) {
            this.gacsScripts[index] = { ...this.gacsScripts[index], ...data };
        }
    }

    updateSlotRtmpStatus(slotId, isActive) {
        const slotElement = document.querySelector(`[data-slot-id="${slotId}"]`);
        if (slotElement) {
            const rtmpBtn = slotElement.querySelector('.btn-success');
            if (rtmpBtn) {
                rtmpBtn.textContent = isActive ? 'RTMP (Active)' : 'RTMP';
                rtmpBtn.classList.toggle('active', isActive);
            }
        }
    }

    updateSlotSipStatus(slotId, status) {
        const slotElement = document.querySelector(`[data-slot-id="${slotId}"]`);
        if (slotElement) {
            const sipInfo = slotElement.querySelector('.slot-info p');
            if (sipInfo) {
                sipInfo.textContent = `SIP: ${status}`;
            }
        }
    }

    updateCallCdr(data) {
        const callElement = document.querySelector(`[data-call-id="${data.call_id}"]`);
        if (callElement) {
            const cdrInfo = document.createElement('div');
            cdrInfo.className = 'cdr-info';
            cdrInfo.innerHTML = `
                <p>Duration: ${data.duration}s</p>
                <p>RTP Bytes: ${data.rtp_bytes_sent + data.rtp_bytes_received}</p>
            `;
            callElement.appendChild(cdrInfo);
        }
    }

    updateCallRecording(data) {
        const callElement = document.querySelector(`[data-call-id="${data.call_id}"]`);
        if (callElement) {
            const recordingInfo = document.createElement('div');
            recordingInfo.className = 'recording-info';
            recordingInfo.innerHTML = `
                <p>Recording: ${data.file_path}</p>
                <a href="/api/recordings/${data.recording_id}/download">Download</a>
            `;
            callElement.appendChild(recordingInfo);
        }
    }

    addChatMessage(data) {
        const chatContainer = document.getElementById('chat-messages-container');
        if (chatContainer) {
            const messageElement = document.createElement('div');
            messageElement.className = `chat-message direction-${data.direction}`;
            messageElement.innerHTML = `
                <p>${data.message_text}</p>
                <span class="chat-time">${new Date(data.created_at).toLocaleString()}</span>
            `;
            chatContainer.appendChild(messageElement);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    updateNotificationList(data) {
        // Update notification in list
    }

    setupEventHandlers() {
        // Setup global event handlers
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action]')) {
                const action = e.target.getAttribute('data-action');
                const params = JSON.parse(e.target.getAttribute('data-params') || '{}');
                this.handleAction(action, params);
            }
        });
    }

    handleAction(action, params) {
        // Generic action handler
        switch (action) {
            case 'start-call':
                this.startCall(params.slotId, params.number);
                break;
            case 'end-call':
                this.endCall(params.callId);
                break;
            case 'restart-slot':
                this.restartSlot(params.slotId);
                break;
            case 'reboot-device':
                this.rebootDevice(params.slotId);
                break;
            case 'execute-gacs':
                this.executeGacs(params.slotId, params.scriptName, params.scriptType, params.scriptContent);
                break;
            case 'start-campaign':
                this.startCampaign(params.campaignId, params.leads);
                break;
            case 'start-recording':
                this.startRecording(params.callId, params.slotId, params.recordingType);
                break;
            case 'open-guacamole':
                this.openGuacamole(params.slotId, params.protocol);
                break;
            case 'view-rtmp':
                this.viewRtmpStream(params.slotId);
                break;
        }
    }

    startAutoRefresh() {
        // Auto-refresh metrics every 5 seconds
        setInterval(() => {
            if (this.currentPage === 'dashboard') {
                this.loadMetrics();
            }
        }, 5000);
    }

    onWebSocketConnected() {
        console.log('[VSS] WebSocket connected, subscribing to events');
    }
}

// Initialize on page load
if (typeof window !== 'undefined') {
    // Инициализация происходит после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.vssUI = new VSSEnhancedUI();
            window.vssUI.init();
        });
    } else {
        window.vssUI = new VSSEnhancedUI();
        window.vssUI.init();
    }
}

