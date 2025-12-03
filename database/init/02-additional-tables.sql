-- Additional tables for VSS OMNI TELECOM
-- Tables referenced in the application code but missing from the initial schema

-- Table: campaigns (для автодозвона)
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(128) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(32) DEFAULT 'autodial',
    status VARCHAR(32) DEFAULT 'pending',
    total_leads INTEGER DEFAULT 0,
    completed_leads INTEGER DEFAULT 0,
    success_leads INTEGER DEFAULT 0,
    failed_leads INTEGER DEFAULT 0,
    config JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: autodialer_leads (для автодозвона)
CREATE TABLE IF NOT EXISTS autodialer_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id_ref UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    phone_number VARCHAR(32) NOT NULL,
    lead_data JSONB DEFAULT '{}',
    status VARCHAR(32) DEFAULT 'pending',
    slot_id INTEGER REFERENCES slots(id),
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    result VARCHAR(32),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Table: gacs_scripts (для GACS автоматизации)
CREATE TABLE IF NOT EXISTS gacs_scripts (
    id SERIAL PRIMARY KEY,
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    script_name VARCHAR(128) NOT NULL,
    script_type VARCHAR(32) NOT NULL, -- adb, powershell, autohotkey, etc.
    script_content TEXT,
    script_path VARCHAR(512),
    status VARCHAR(32) DEFAULT 'pending', -- pending, executing, completed, failed
    result JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: rtmp_streams (для RTMP стриминга)
CREATE TABLE IF NOT EXISTS rtmp_streams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    stream_key VARCHAR(256) UNIQUE NOT NULL,
    stream_url VARCHAR(512),
    status VARCHAR(32) DEFAULT 'inactive', -- inactive, active, stopped, error
    resolution VARCHAR(32) DEFAULT '1280x720',
    framerate INTEGER DEFAULT 30,
    bitrate INTEGER DEFAULT 2500,
    started_at TIMESTAMP WITH TIME ZONE,
    stopped_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_slot_id UNIQUE (slot_id)
);

-- Indexes for additional tables
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_autodialer_leads_campaign ON autodialer_leads(campaign_id_ref);
CREATE INDEX IF NOT EXISTS idx_autodialer_leads_status ON autodialer_leads(status);
CREATE INDEX IF NOT EXISTS idx_autodialer_leads_phone ON autodialer_leads(phone_number);
CREATE INDEX IF NOT EXISTS idx_gacs_scripts_slot ON gacs_scripts(slot_id);
CREATE INDEX IF NOT EXISTS idx_gacs_scripts_status ON gacs_scripts(status);
CREATE INDEX IF NOT EXISTS idx_rtmp_streams_slot ON rtmp_streams(slot_id);
CREATE INDEX IF NOT EXISTS idx_rtmp_streams_status ON rtmp_streams(status);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_autodialer_leads_updated_at ON autodialer_leads;
CREATE TRIGGER update_autodialer_leads_updated_at BEFORE UPDATE ON autodialer_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rtmp_streams_updated_at ON rtmp_streams;
CREATE TRIGGER update_rtmp_streams_updated_at BEFORE UPDATE ON rtmp_streams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update campaign statistics when lead is completed
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status != OLD.status AND (NEW.status = 'completed' OR NEW.status = 'failed') THEN
        UPDATE campaigns
        SET completed_leads = completed_leads + 1,
            success_leads = CASE WHEN NEW.status = 'completed' THEN success_leads + 1 ELSE success_leads END,
            failed_leads = CASE WHEN NEW.status = 'failed' THEN failed_leads + 1 ELSE failed_leads END,
            updated_at = NOW()
        WHERE id = NEW.campaign_id_ref;
        
        -- Check if campaign is completed
        PERFORM 1 FROM campaigns c
        WHERE c.id = NEW.campaign_id_ref
        AND c.completed_leads >= c.total_leads;
        
        IF FOUND THEN
            UPDATE campaigns
            SET status = 'completed',
                completed_at = NOW()
            WHERE id = NEW.campaign_id_ref AND status = 'running';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_campaign_stats ON autodialer_leads;
CREATE TRIGGER trg_update_campaign_stats AFTER UPDATE OF status ON autodialer_leads
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_campaign_stats();

-- Function to notify about RTMP stream status changes
CREATE OR REPLACE FUNCTION notify_rtmp_stream_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('rtmp_stream_changed', json_build_object(
        'stream_id', NEW.id,
        'slot_id', NEW.slot_id,
        'status', NEW.status,
        'stream_key', NEW.stream_key
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rtmp_stream_status ON rtmp_streams;
CREATE TRIGGER trg_rtmp_stream_status AFTER UPDATE OF status ON rtmp_streams
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION notify_rtmp_stream_change();

-- Insert sample data for testing (optional, can be removed in production)
-- This is commented out by default, uncomment if needed for testing
/*
INSERT INTO campaigns (name, description, campaign_type, status, total_leads, created_by) VALUES
    ('Test Campaign', 'Test autodial campaign', 'autodial', 'pending', 0, 
     (SELECT id FROM users WHERE username = 'admin'));
*/

