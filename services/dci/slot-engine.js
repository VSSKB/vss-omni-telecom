/**
 * VSS DCI - Slot Functional Model Engine
 * Implements Control, Media, Access, and DRP planes for slots
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class SlotEngine {
    constructor(slotId, slotType, pool, rabbitmqChannel) {
        this.slotId = slotId;
        this.slotType = slotType; // 'auto', 'mf', 'local_script'
        this.pool = pool;
        this.rabbitmqChannel = rabbitmqChannel;
        this.fsmState = 'IDLE';
        this.status = 'free';
    }

    // ============================================
    // CONTROL PLANE (F-01, F-05, F-11)
    // ============================================

    /**
     * Handle Autodial Lead (F-01)
     */
    async handleAutodialLead(lead) {
        try {
            // Update slot status
            await this.updateSlotStatus('busy', 'ASSIGNED');

            // Log F-Flow event
            await this.logFFlowEvent('F-01', 'autodial.lead', {
                lead_id: lead.lead_id,
                phone_number: lead.phone_number,
                campaign_id: lead.campaign_id
            });

            // Initiate SIP call (F-03)
            await this.initiateSipCall(lead.phone_number);

            return { status: 'processing', slot_id: this.slotId };
        } catch (error) {
            console.error(`[SlotEngine] Error handling autodial lead:`, error);
            await this.updateSlotStatus('error', 'FAULT');
            throw error;
        }
    }

    /**
     * Update Slot Status (F-05: Slot Status Sync)
     */
    async updateSlotStatus(status, fsmState) {
        this.status = status;
        this.fsmState = fsmState;

        // Update database
        await this.pool.query(`
            UPDATE slots 
            SET status = $1, fsm_state = $2, updated_at = NOW()
            WHERE id = $3
        `, [status, fsmState, this.slotId]);

        // Log status history
        await this.pool.query(`
            INSERT INTO slot_status_history (slot_id, fsm_state, status, event_source)
            VALUES ($1, $2, $3, 'DCI')
        `, [this.slotId, fsmState, status]);

        // Publish F-05 event
        if (this.rabbitmqChannel) {
            this.rabbitmqChannel.publish('vss.events', 'slot.update', Buffer.from(JSON.stringify({
                event: 'slot.update',
                slot_id: this.slotId,
                status: status,
                fsm_state: fsmState,
                f_flow: 'F-05',
                timestamp: new Date().toISOString()
            })));
        }
    }

    /**
     * Handle Campaign Status (F-11)
     */
    async handleCampaignStatus(campaignId, status, metrics) {
        await this.logFFlowEvent('F-11', 'campaign.status', {
            campaign_id: campaignId,
            status: status,
            metrics: metrics
        });
    }

    // ============================================
    // MEDIA PLANE (F-03, F-04, F-09, F-10, F-13, F-14)
    // ============================================

    /**
     * Initiate SIP Call (F-03: SIP Outbound Call)
     * Uses RabbitMQ to send command to PBX service (Asterisk AMI) for actual call initiation
     */
    async initiateSipCall(phoneNumber) {
        try {
            await this.updateSlotStatus('busy', 'CALLING');

            // Get slot SIP info
            const slotResult = await this.pool.query(`
                SELECT internal_sip_number, sip_username, trunk_id
                FROM slots WHERE id = $1
            `, [this.slotId]);

            if (slotResult.rows.length === 0) {
                throw new Error('Slot not found');
            }

            const slotData = slotResult.rows[0];

            if (!slotData.internal_sip_number) {
                throw new Error('Slot SIP number not allocated');
            }

            // Log F-Flow event
            await this.logFFlowEvent('F-03', 'sip.outbound.call', {
                phone_number: phoneNumber,
                slot_sip_number: slotData.internal_sip_number
            });

            console.log(`[SlotEngine] Initiating SIP call from ${slotData.internal_sip_number} to ${phoneNumber}`);

            // Publish SIP call command via RabbitMQ for PBX service to handle
            // The PBX service (OTTB or admin-backend) will use Asterisk AMI to initiate the call
            if (this.rabbitmqChannel) {
                // Send command to initiate call via Asterisk AMI
                this.rabbitmqChannel.publish('vss.commands', 'sip.dial', Buffer.from(JSON.stringify({
                    command: 'originate',
                    from: slotData.internal_sip_number,
                    from_username: slotData.sip_username,
                    to: phoneNumber,
                    slot_id: this.slotId,
                    trunk_id: slotData.trunk_id,
                    context: 'outbound-auto', // Context based on slot type
                    f_flow: 'F-03',
                    timestamp: new Date().toISOString()
                })));

                // Also publish event for tracking
                this.rabbitmqChannel.publish('vss.events', 'call.start', Buffer.from(JSON.stringify({
                    event: 'call.start',
                    slot_id: this.slotId,
                    phone_number: phoneNumber,
                    slot_sip_number: slotData.internal_sip_number,
                    slot_sip_username: slotData.sip_username,
                    f_flow: 'F-03',
                    timestamp: new Date().toISOString()
                })));
            } else {
                console.warn(`[SlotEngine] RabbitMQ channel not available. Call command not sent.`);
                // Fallback: try to use Asterisk AMI directly if available
                // This would require AMI connection, which is typically handled by admin-backend
                console.warn(`[SlotEngine] Direct AMI call initiation not implemented. Use RabbitMQ or admin-backend service.`);
            }

            return { 
                status: 'calling', 
                phone_number: phoneNumber,
                slot_sip_number: slotData.internal_sip_number,
                message: 'SIP call command sent via RabbitMQ to PBX service'
            };
        } catch (error) {
            console.error(`[SlotEngine] Error initiating SIP call:`, error);
            await this.updateSlotStatus('error', 'FAULT');
            throw error;
        }
    }

    /**
     * Start RTMP Stream (F-04: RTMP Video/Audio Push)
     */
    async startRtmpStream(streamType = 'screen') {
        try {
            const streamKey = `slot_${this.slotId}_${Date.now()}`;
            const streamUrl = `rtmp://nginx-rtmp:1935/live/${streamKey}`;

            // Insert RTMP stream record
            const result = await this.pool.query(`
                INSERT INTO rtmp_streams (slot_id, stream_key, stream_url, stream_type, status, started_at)
                VALUES ($1, $2, $3, $4, 'active', NOW())
                RETURNING id
            `, [this.slotId, streamKey, streamUrl, streamType]);

            // Log F-Flow event
            await this.logFFlowEvent('F-04', 'rtmp.stream.start', {
                stream_id: result.rows[0].id,
                stream_key: streamKey,
                stream_url: streamUrl
            });

            // Publish RTMP stream event
            if (this.rabbitmqChannel) {
                this.rabbitmqChannel.publish('vss.events', 'rtmp.stream.start', Buffer.from(JSON.stringify({
                    event: 'rtmp.stream.start',
                    slot_id: this.slotId,
                    stream_key: streamKey,
                    stream_url: streamUrl,
                    f_flow: 'F-04',
                    timestamp: new Date().toISOString()
                })));
            }

            return { stream_key, stream_url, stream_id: result.rows[0].id };
        } catch (error) {
            console.error(`[SlotEngine] Error starting RTMP stream:`, error);
            throw error;
        }
    }

    /**
     * Register SIP (F-09: SIP Registration)
     */
    async registerSip() {
        try {
            await this.updateSlotStatus('free', 'REGISTERING');

            const slotResult = await this.pool.query(`
                SELECT sip_username, internal_sip_number
                FROM slots WHERE id = $1
            `, [this.slotId]);

            if (slotResult.rows.length === 0) {
                throw new Error('Slot not found');
            }

            const slotData = slotResult.rows[0];

            // Update SIP registration
            await this.pool.query(`
                INSERT INTO sip_registrations (slot_id, sip_username, internal_sip_number, registration_status, last_registered_at)
                VALUES ($1, $2, $3, 'registered', NOW())
                ON CONFLICT (slot_id) DO UPDATE
                SET registration_status = 'registered', last_registered_at = NOW(), registration_count = sip_registrations.registration_count + 1
            `, [this.slotId, slotData.sip_username, slotData.internal_sip_number]);

            await this.updateSlotStatus('free', 'READY');

            // Log F-Flow event
            await this.logFFlowEvent('F-09', 'sip.registration', {
                sip_username: slotData.sip_username,
                registration_status: 'registered'
            });

            return { status: 'registered', sip_username: slotData.sip_username };
        } catch (error) {
            console.error(`[SlotEngine] Error registering SIP:`, error);
            throw error;
        }
    }

    /**
     * Record Call (F-14: SIP Call Recording)
     */
    async startCallRecording(callId, recordingType = 'audio') {
        try {
            const filePath = `/recordings/call_${callId}_${Date.now()}.wav`;

            const result = await this.pool.query(`
                INSERT INTO call_recordings (call_id, slot_id, recording_type, file_path, status, started_at)
                VALUES ($1, $2, $3, $4, 'recording', NOW())
                RETURNING id
            `, [callId, this.slotId, recordingType, filePath]);

            // Log F-Flow event
            await this.logFFlowEvent('F-14', 'call.recording.start', {
                call_id: callId,
                recording_id: result.rows[0].id,
                file_path: filePath
            });

            return { recording_id: result.rows[0].id, file_path };
        } catch (error) {
            console.error(`[SlotEngine] Error starting call recording:`, error);
            throw error;
        }
    }

    // ============================================
    // ACCESS/AUTOMATION PLANE (F-02, F-12)
    // ============================================

    /**
     * Execute GACS Script (F-02: GACS Script Execution)
     */
    async executeGacsScript(scriptName, scriptType, scriptContent) {
        try {
            await this.updateSlotStatus('busy', 'BUSY');

            // Insert GACS script record
            const result = await this.pool.query(`
                INSERT INTO gacs_scripts (slot_id, script_name, script_type, script_content, status, started_at)
                VALUES ($1, $2, $3, $4, 'running', NOW())
                RETURNING id
            `, [this.slotId, scriptName, scriptType, scriptContent]);

            const scriptId = result.rows[0].id;

            // Log F-Flow event
            await this.logFFlowEvent('F-02', 'gacs.execute', {
                script_id: scriptId,
                script_name: scriptName,
                script_type: scriptType
            });

            // Execute script based on type
            let executionResult = {};
            try {
                if (scriptType === 'adb') {
                    executionResult = await this.executeAdbCommand(scriptContent);
                } else if (scriptType === 'powershell') {
                    executionResult = await this.executePowerShellScript(scriptContent);
                } else if (scriptType === 'bash') {
                    executionResult = await this.executeBashScript(scriptContent);
                } else if (scriptType === 'whatsapp' || scriptType === 'telegram') {
                    executionResult = await this.executeChatScript(scriptType, scriptContent);
                }

                // Update script status
                await this.pool.query(`
                    UPDATE gacs_scripts 
                    SET status = 'completed', result = $1, completed_at = NOW()
                    WHERE id = $2
                `, [JSON.stringify(executionResult), scriptId]);

                // Publish F-12 event
                if (this.rabbitmqChannel) {
                    this.rabbitmqChannel.publish('vss.events', 'gacs.event', Buffer.from(JSON.stringify({
                        event: 'gacs.event',
                        script_id: scriptId,
                        slot_id: this.slotId,
                        status: 'completed',
                        result: executionResult,
                        f_flow: 'F-12',
                        timestamp: new Date().toISOString()
                    })));
                }

                await this.updateSlotStatus('free', 'READY');
                return { script_id: scriptId, status: 'completed', result: executionResult };
            } catch (execError) {
                // Update script status to failed
                await this.pool.query(`
                    UPDATE gacs_scripts 
                    SET status = 'failed', error_message = $1, completed_at = NOW()
                    WHERE id = $2
                `, [execError.message, scriptId]);

                await this.updateSlotStatus('free', 'READY');
                throw execError;
            }
        } catch (error) {
            console.error(`[SlotEngine] Error executing GACS script:`, error);
            await this.updateSlotStatus('error', 'FAULT');
            throw error;
        }
    }

    /**
     * Execute ADB command
     */
    async executeAdbCommand(command) {
        try {
            const { stdout, stderr } = await execAsync(`adb -s device_${this.slotId} ${command}`);
            return { stdout, stderr, exit_code: 0 };
        } catch (error) {
            return { stdout: '', stderr: error.message, exit_code: error.code || 1 };
        }
    }

    /**
     * Execute PowerShell script
     */
    async executePowerShellScript(script) {
        try {
            const { stdout, stderr } = await execAsync(`powershell -Command "${script}"`);
            return { stdout, stderr, exit_code: 0 };
        } catch (error) {
            return { stdout: '', stderr: error.message, exit_code: error.code || 1 };
        }
    }

    /**
     * Execute Bash script
     */
    async executeBashScript(script) {
        try {
            const { stdout, stderr } = await execAsync(`bash -c "${script}"`);
            return { stdout, stderr, exit_code: 0 };
        } catch (error) {
            return { stdout: '', stderr: error.message, exit_code: error.code || 1 };
        }
    }

    /**
     * Execute Chat script (WhatsApp/Telegram)
     */
    async executeChatScript(platform, script) {
        // In real implementation, integrate with WhatsApp/Telegram APIs
        // For now, simulate execution
        return {
            platform: platform,
            message_sent: true,
            timestamp: new Date().toISOString()
        };
    }

    // ============================================
    // DRP PLANE (F-06)
    // ============================================

    /**
     * Execute DRP Operation (F-06: Hardware DRP)
     */
    async executeDrpOperation(operationType, triggerReason = 'manual') {
        try {
            // Insert DRP operation record
            const result = await this.pool.query(`
                INSERT INTO drp_operations (slot_id, operation_type, trigger_reason, status, started_at)
                VALUES ($1, $2, $3, 'executing', NOW())
                RETURNING id
            `, [this.slotId, operationType, triggerReason]);

            const drpId = result.rows[0].id;

            // Log F-Flow event
            await this.logFFlowEvent('F-06', 'drp.operation', {
                drp_id: drpId,
                operation_type: operationType
            });

            let operationResult = {};
            try {
                if (operationType === 'usb_power_cycle') {
                    operationResult = await this.usbPowerCycle();
                } else if (operationType === 'adb_restart') {
                    operationResult = await this.adbRestart();
                } else if (operationType === 'sip_re_register') {
                    operationResult = await this.sipReRegister();
                } else if (operationType === 'container_restart') {
                    operationResult = await this.containerRestart();
                } else if (operationType === 'device_reboot') {
                    operationResult = await this.deviceReboot();
                }

                // Update DRP operation status
                await this.pool.query(`
                    UPDATE drp_operations 
                    SET status = 'completed', result = $1, completed_at = NOW()
                    WHERE id = $2
                `, [JSON.stringify(operationResult), drpId]);

                return { drp_id: drpId, status: 'completed', result: operationResult };
            } catch (drpError) {
                // Update DRP operation status to failed
                await this.pool.query(`
                    UPDATE drp_operations 
                    SET status = 'failed', error_message = $1, completed_at = NOW()
                    WHERE id = $2
                `, [drpError.message, drpId]);

                throw drpError;
            }
        } catch (error) {
            console.error(`[SlotEngine] Error executing DRP operation:`, error);
            throw error;
        }
    }

    /**
     * USB Power Cycle
     */
    async usbPowerCycle() {
        try {
            // In real implementation, use uhubctl or similar
            // For now, simulate power cycle
            const { stdout } = await execAsync(`uhubctl -a cycle -p ${this.slotId}`);
            return { success: true, output: stdout };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * ADB Restart
     */
    async adbRestart() {
        try {
            await execAsync(`adb kill-server`);
            await execAsync(`adb start-server`);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * SIP Re-register
     */
    async sipReRegister() {
        return await this.registerSip();
    }

    /**
     * Container Restart
     */
    async containerRestart() {
        try {
            const { stdout } = await execAsync(`docker restart slot_${this.slotId}`);
            return { success: true, output: stdout };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Device Reboot
     */
    async deviceReboot() {
        try {
            const { stdout } = await execAsync(`adb -s device_${this.slotId} reboot`);
            return { success: true, output: stdout };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    /**
     * Log F-Flow event
     */
    async logFFlowEvent(flowNumber, eventType, payload) {
        try {
            await this.pool.query(`
                INSERT INTO f_flow_events (flow_number, event_type, slot_id, protocol, module, plane, payload, status, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW())
            `, [
                flowNumber,
                eventType,
                this.slotId,
                this.getProtocolForFlow(flowNumber),
                'SlotEngine',
                this.getPlaneForFlow(flowNumber),
                JSON.stringify(payload)
            ]);
        } catch (error) {
            console.error(`[SlotEngine] Error logging F-Flow event:`, error);
        }
    }

    /**
     * Get protocol for F-Flow
     */
    getProtocolForFlow(flowNumber) {
        const protocolMap = {
            'F-01': 'RabbitMQ',
            'F-02': 'SSH/ADB',
            'F-03': 'SIP/RTP',
            'F-04': 'RTMP',
            'F-05': 'WebSocket',
            'F-06': 'SSH/uhubctl',
            'F-07': 'HTTPS',
            'F-08': 'PostgreSQL',
            'F-09': 'SIP',
            'F-10': 'RTP',
            'F-11': 'WebSocket',
            'F-12': 'WebSocket',
            'F-13': 'PostgreSQL',
            'F-14': 'RTP'
        };
        return protocolMap[flowNumber] || 'Unknown';
    }

    /**
     * Get plane for F-Flow
     */
    getPlaneForFlow(flowNumber) {
        const planeMap = {
            'F-01': 'Control',
            'F-02': 'Access',
            'F-03': 'Media',
            'F-04': 'Media',
            'F-05': 'Control',
            'F-06': 'DRP',
            'F-07': 'Control',
            'F-08': 'Control',
            'F-09': 'Media',
            'F-10': 'Media',
            'F-11': 'Control',
            'F-12': 'Access',
            'F-13': 'Media',
            'F-14': 'Media'
        };
        return planeMap[flowNumber] || 'Unknown';
    }
}

module.exports = SlotEngine;

