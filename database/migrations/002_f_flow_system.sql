-- VSS OTTB F-Flow System Migration
-- Adds tables for F-Flow events, GACS scripts, Autodialer leads, CDR, and Recording

-- Table: f_flow_events (F-01 to F-14 event tracking)
CREATE TABLE IF NOT EXISTS f_flow_events (
    id BIGSERIAL PRIMARY KEY,
    flow_number VARCHAR(4) NOT NULL, -- F-01, F-02, ..., F-14
    event_type VARCHAR(64) NOT NULL, -- call.start, slot.update, gacs.execute, etc.
    slot_id INTEGER REFERENCES slots(id),
    call_id BIGINT REFERENCES calls(id),
    direction VARCHAR(16), -- HUB->Slot, Slot->HUB, Slot->External
    protocol VARCHAR(32), -- RabbitMQ, WS, SIP, RTP, RTMP, SSH, ADB, etc.
    module VARCHAR(64), -- Agent, Autodialer, GACS, SIP Trunk, etc.
    plane VARCHAR(32), -- Control, Media, Access, DRP
    payload JSONB DEFAULT '{}',
    status VARCHAR(32) DEFAULT 'pending', -- pending, processing, completed, failed
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Table: gacs_scripts (F-02: GACS Script Execution)
CREATE TABLE IF NOT EXISTS gacs_scripts (
    id BIGSERIAL PRIMARY KEY,
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    script_name VARCHAR(128) NOT NULL,
    script_type VARCHAR(32) NOT NULL, -- whatsapp, telegram, adb, powershell, bash, gui
    script_content TEXT,
    script_path VARCHAR(512),
    status VARCHAR(32) DEFAULT 'pending', -- pending, running, completed, failed
    result JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: autodialer_leads (F-01: Autodial Lead Queue)
CREATE TABLE IF NOT EXISTS autodialer_leads (
    id BIGSERIAL PRIMARY KEY,
    slot_id INTEGER REFERENCES slots(id),
    campaign_id VARCHAR(64),
    phone_number VARCHAR(32) NOT NULL,
    lead_data JSONB DEFAULT '{}', -- Additional lead information
    status VARCHAR(32) DEFAULT 'pending', -- pending, queued, dialing, connected, completed, failed
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    result VARCHAR(64), -- answered, no_answer, busy, failed, voicemail
    call_id BIGINT REFERENCES calls(id),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    dialed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: cdr_records (F-13: CDR Collection from SIP Trunk)
CREATE TABLE IF NOT EXISTS cdr_records (
    id BIGSERIAL PRIMARY KEY,
    call_id BIGINT REFERENCES calls(id),
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    sip_call_id VARCHAR(128), -- SIP Call-ID header
    from_number VARCHAR(32),
    to_number VARCHAR(32),
    direction VARCHAR(16) NOT NULL, -- outbound, inbound, internal
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    answer_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- seconds
    billable_duration INTEGER, -- seconds
    rtp_bytes_sent BIGINT DEFAULT 0,
    rtp_bytes_received BIGINT DEFAULT 0,
    sip_status_code INTEGER, -- 200, 404, 486, etc.
    hangup_cause VARCHAR(64), -- NORMAL_CLEARING, USER_BUSY, etc.
    quality_metrics JSONB DEFAULT '{}', -- MOS, jitter, packet loss, etc.
    asterisk_channel VARCHAR(128),
    kamailio_route VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: call_recordings (F-12: SIP Call Recording)
CREATE TABLE IF NOT EXISTS call_recordings (
    id BIGSERIAL PRIMARY KEY,
    call_id BIGINT NOT NULL REFERENCES calls(id),
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    recording_type VARCHAR(32) NOT NULL, -- audio, video, screen, combined
    file_path VARCHAR(512) NOT NULL,
    file_format VARCHAR(16), -- wav, mp3, mp4, webm
    file_size BIGINT, -- bytes
    duration INTEGER, -- seconds
    storage_location VARCHAR(128), -- local, s3, nfs
    rtmp_stream_url VARCHAR(512), -- For live streams
    status VARCHAR(32) DEFAULT 'recording', -- recording, completed, failed, archived
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: rtmp_streams (F-04: RTMP Video/Audio Push)
CREATE TABLE IF NOT EXISTS rtmp_streams (
    id BIGSERIAL PRIMARY KEY,
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    stream_key VARCHAR(128) UNIQUE NOT NULL,
    stream_url VARCHAR(512) NOT NULL,
    stream_type VARCHAR(32) NOT NULL, -- video, audio, screen, combined
    resolution VARCHAR(16), -- 1920x1080, 1280x720, etc.
    bitrate INTEGER, -- kbps
    fps INTEGER, -- frames per second
    status VARCHAR(32) DEFAULT 'active', -- active, paused, stopped, error
    viewer_count INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    stopped_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: slot_status_history (F-05: Slot Status Sync tracking)
CREATE TABLE IF NOT EXISTS slot_status_history (
    id BIGSERIAL PRIMARY KEY,
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    fsm_state VARCHAR(32) NOT NULL, -- IDLE, ASSIGNED, REGISTERING, READY, CALLING, ACTIVE_CALL, POSTCALL, FAULT
    previous_state VARCHAR(32),
    status VARCHAR(32), -- free, busy, reserved, error
    health_metrics JSONB DEFAULT '{}',
    event_source VARCHAR(64), -- HUB, DCI, SIP, DRP
    event_payload JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: drp_operations (F-06: Hardware DRP operations)
CREATE TABLE IF NOT EXISTS drp_operations (
    id BIGSERIAL PRIMARY KEY,
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    operation_type VARCHAR(32) NOT NULL, -- usb_power_cycle, adb_restart, sip_re_register, container_restart, device_reboot
    trigger_reason VARCHAR(128), -- fault, manual, scheduled, health_check
    status VARCHAR(32) DEFAULT 'pending', -- pending, executing, completed, failed
    result JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: notifications (F-07: Notification / Alerts)
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    slot_id INTEGER REFERENCES slots(id),
    call_id BIGINT REFERENCES calls(id),
    notification_type VARCHAR(32) NOT NULL, -- alert, chat, event, error
    severity VARCHAR(16) DEFAULT 'info', -- info, warning, error, critical
    channel VARCHAR(32), -- telegram, whatsapp, email, slack, sms
    recipient VARCHAR(255),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    status VARCHAR(32) DEFAULT 'pending', -- pending, sent, delivered, failed
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: chat_messages (F-09: Chat Messaging via WhatsApp/Telegram)
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    gacs_script_id BIGINT REFERENCES gacs_scripts(id),
    platform VARCHAR(32) NOT NULL, -- whatsapp, telegram
    direction VARCHAR(16) NOT NULL, -- inbound, outbound
    phone_number VARCHAR(32),
    chat_id VARCHAR(128),
    message_text TEXT,
    message_type VARCHAR(32), -- text, image, video, audio, document
    media_url VARCHAR(512),
    status VARCHAR(32) DEFAULT 'pending', -- pending, sent, delivered, read, failed
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: sip_registrations (F-09: SIP Registration tracking)
CREATE TABLE IF NOT EXISTS sip_registrations (
    id BIGSERIAL PRIMARY KEY,
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    sip_username VARCHAR(128) NOT NULL,
    sip_domain VARCHAR(128) DEFAULT 'vss.internal',
    internal_sip_number VARCHAR(10) NOT NULL,
    kamailio_contact VARCHAR(255),
    registration_status VARCHAR(32) DEFAULT 'unregistered', -- unregistered, registering, registered, failed
    expires_at TIMESTAMP WITH TIME ZONE,
    last_registered_at TIMESTAMP WITH TIME ZONE,
    last_unregistered_at TIMESTAMP WITH TIME ZONE,
    registration_count INTEGER DEFAULT 0,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: campaigns (F-11: Campaign Status tracking)
CREATE TABLE IF NOT EXISTS campaigns (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(32) NOT NULL, -- autodial, test, ivr, load_test
    status VARCHAR(32) DEFAULT 'draft', -- draft, scheduled, running, paused, completed, cancelled
    total_leads INTEGER DEFAULT 0,
    dialed_leads INTEGER DEFAULT 0,
    connected_leads INTEGER DEFAULT 0,
    completed_leads INTEGER DEFAULT 0,
    failed_leads INTEGER DEFAULT 0,
    config JSONB DEFAULT '{}', -- Campaign configuration
    scheduled_start TIMESTAMP WITH TIME ZONE,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_f_flow_events_flow_number ON f_flow_events(flow_number);
CREATE INDEX IF NOT EXISTS idx_f_flow_events_slot_id ON f_flow_events(slot_id);
CREATE INDEX IF NOT EXISTS idx_f_flow_events_created_at ON f_flow_events(created_at);
CREATE INDEX IF NOT EXISTS idx_gacs_scripts_slot_status ON gacs_scripts(slot_id, status);
CREATE INDEX IF NOT EXISTS idx_autodialer_leads_status ON autodialer_leads(status);
CREATE INDEX IF NOT EXISTS idx_autodialer_leads_slot_id ON autodialer_leads(slot_id);
CREATE INDEX IF NOT EXISTS idx_cdr_records_slot_id ON cdr_records(slot_id);
CREATE INDEX IF NOT EXISTS idx_cdr_records_start_time ON cdr_records(start_time);
CREATE INDEX IF NOT EXISTS idx_call_recordings_call_id ON call_recordings(call_id);
CREATE INDEX IF NOT EXISTS idx_rtmp_streams_slot_id ON rtmp_streams(slot_id);
CREATE INDEX IF NOT EXISTS idx_rtmp_streams_status ON rtmp_streams(status);
CREATE INDEX IF NOT EXISTS idx_slot_status_history_slot_id ON slot_status_history(slot_id);
CREATE INDEX IF NOT EXISTS idx_slot_status_history_created_at ON slot_status_history(created_at);
CREATE INDEX IF NOT EXISTS idx_drp_operations_slot_id ON drp_operations(slot_id);
CREATE INDEX IF NOT EXISTS idx_drp_operations_status ON drp_operations(status);
CREATE INDEX IF NOT EXISTS idx_notifications_slot_id ON notifications(slot_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_slot_id ON chat_messages(slot_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_platform ON chat_messages(platform);
CREATE INDEX IF NOT EXISTS idx_sip_registrations_slot_id ON sip_registrations(slot_id);
CREATE INDEX IF NOT EXISTS idx_sip_registrations_status ON sip_registrations(registration_status);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sip_registrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sip_registrations_updated_at BEFORE UPDATE ON sip_registrations
    FOR EACH ROW EXECUTE FUNCTION update_sip_registrations_updated_at();

CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_campaigns_updated_at();

-- Add foreign key from autodialer_leads to campaigns
ALTER TABLE autodialer_leads 
    ADD COLUMN IF NOT EXISTS campaign_id_ref BIGINT REFERENCES campaigns(id);

-- Add indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_autodialer_leads_campaign ON autodialer_leads(campaign_id_ref);

