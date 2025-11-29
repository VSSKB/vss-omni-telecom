-- VSS DEMIURGE Database Initialization
-- This file is executed automatically when PostgreSQL container starts for the first time

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE trunk_type AS ENUM ('auto', 'mf', 'local_script');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE trunk_status AS ENUM ('active', 'inactive', 'maintenance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE slot_status AS ENUM ('free', 'busy', 'reserved', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE device_type AS ENUM ('auto', 'mf', 'local_script');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE call_status AS ENUM ('initiated', 'ringing', 'connected', 'ended', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table: roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(32) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    guacamole_permissions JSONB DEFAULT '{
        "allowed_protocols": ["rdp", "vnc", "ssh"],
        "max_connections": 5,
        "allowed_slots": ["*"],
        "session_timeout": 3600,
        "read_only": false,
        "connection_limits": {
            "max_width": 1920,
            "max_height": 1080
        }
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    status user_status DEFAULT 'active',
    guacamole_attributes JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    last_guacamole_session TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Table: trunks
CREATE TABLE IF NOT EXISTS trunks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    type trunk_type NOT NULL,
    status trunk_status DEFAULT 'active',
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    region VARCHAR(32),
    config JSONB NOT NULL DEFAULT '{}',
    last_health_check TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: slots
CREATE TABLE IF NOT EXISTS slots (
    id SERIAL PRIMARY KEY,
    trunk_id INTEGER NOT NULL REFERENCES trunks(id) ON DELETE CASCADE,
    slot_number INTEGER NOT NULL,
    name VARCHAR(64),
    internal_sip_number VARCHAR(10) UNIQUE, -- Internal SIP number (97XXX for AUTO, 98XXX for MF, 99XXX for LS)
    sip_username VARCHAR(64), -- SIP username: slot_<id>@vss.internal
    sip_secret VARCHAR(128), -- SIP password (auto-generated)
    status slot_status DEFAULT 'free',
    device_type device_type NOT NULL,
    device_id VARCHAR(128), -- Device identifier (HeadUnit, Modem, etc.)
    ip_address INET, -- IP address for Guacamole connection
    protocol VARCHAR(16), -- rdp, vnc, ssh, telnet
    port INTEGER, -- Port for connection
    credentials JSONB, -- Encrypted credentials for Guacamole
    capabilities JSONB DEFAULT '{}', -- Device capabilities
    device_config JSONB NOT NULL DEFAULT '{}',
    network_config JSONB NOT NULL DEFAULT '{}',
    assigned_user UUID REFERENCES users(id),
    last_activity TIMESTAMP WITH TIME ZONE,
    health_metrics JSONB DEFAULT '{}',
    temperature DECIMAL(4,2), -- Device temperature
    power_consumption DECIMAL(6,2), -- Power consumption in watts
    fsm_state VARCHAR(32) DEFAULT 'IDLE', -- FSM state: IDLE, ASSIGNED, REGISTERING, READY, CALLING, ACTIVE_CALL, POSTCALL, FAULT
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(trunk_id, slot_number)
);

-- Table: calls
CREATE TABLE IF NOT EXISTS calls (
    id BIGSERIAL PRIMARY KEY,
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    user_id UUID NOT NULL REFERENCES users(id),
    client_number VARCHAR(32) NOT NULL,
    direction call_direction NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER CHECK (duration >= 0),
    status call_status NOT NULL,
    quality_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_calls_user_date ON calls(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calls_slot_status ON calls(slot_id, status);
CREATE INDEX IF NOT EXISTS idx_slots_trunk_status ON slots(trunk_id, status);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role_id, status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trunks_updated_at ON trunks;
CREATE TRIGGER update_trunks_updated_at BEFORE UPDATE ON trunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_slots_updated_at ON slots;
CREATE TRIGGER update_slots_updated_at BEFORE UPDATE ON slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default roles with detailed permissions
INSERT INTO roles (name, description, permissions) VALUES
    ('admin', 'Administrator with full access', '{
        "all": true,
        "users": ["create", "read", "update", "delete"],
        "roles": ["create", "read", "update", "delete"],
        "slots": ["create", "read", "update", "delete", "admin"],
        "trunks": ["create", "read", "update", "delete"],
        "calls": ["read", "monitor", "record"],
        "archonts": ["create", "read", "update", "delete"],
        "system": ["configure", "monitor", "restart"],
        "crm": ["read", "write", "admin"],
        "reports": ["read", "generate"],
        "pipelines": ["run", "stop", "create"]
    }'::jsonb),
    ('operator', 'Call center operator', '{
        "calls": true,
        "slots": true,
        "crm": ["read", "write"],
        "notes": ["create", "read"],
        "guacamole": ["connect"]
    }'::jsonb),
    ('viewer', 'Read-only access', '{
        "read": true
    }'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Table: crm_leads
CREATE TABLE IF NOT EXISTS crm_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_name VARCHAR(128),
    phone VARCHAR(32),
    email VARCHAR(128),
    assigned_seller UUID REFERENCES users(id),
    status VARCHAR(32) DEFAULT 'new',
    source VARCHAR(32) DEFAULT 'manual',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: ci_pipelines
CREATE TABLE IF NOT EXISTS ci_pipelines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    branch VARCHAR(128),
    status VARCHAR(32) DEFAULT 'queued',
    triggered_by UUID REFERENCES users(id),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    log_url TEXT,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: events_log
CREATE TABLE IF NOT EXISTS events_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    module VARCHAR(32) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    user_id UUID REFERENCES users(id)
);

-- Table: archont_centers (для ARCHONTs функционала)
CREATE TABLE IF NOT EXISTS archont_centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(64) NOT NULL,
    template_id INTEGER,
    status VARCHAR(32) DEFAULT 'deploying',
    created_by UUID REFERENCES users(id),
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: archont_trunks
CREATE TABLE IF NOT EXISTS archont_trunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES archont_centers(id) ON DELETE CASCADE,
    trunk_id INTEGER NOT NULL REFERENCES trunks(id),
    assigned_role VARCHAR(32),
    status VARCHAR(32) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: archont_slots
CREATE TABLE IF NOT EXISTS archont_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES archont_centers(id) ON DELETE CASCADE,
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    assigned_user UUID REFERENCES users(id),
    status VARCHAR(32) DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: archont_templates
CREATE TABLE IF NOT EXISTS archont_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) UNIQUE NOT NULL,
    description TEXT,
    stack_config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Добавляем внешний ключ для archont_centers.template_id
ALTER TABLE archont_centers 
    ADD CONSTRAINT fk_archont_centers_template 
    FOREIGN KEY (template_id) REFERENCES archont_templates(id);

-- Добавляем связь calls -> crm_leads
ALTER TABLE calls 
    ADD COLUMN IF NOT EXISTS crm_lead_id UUID REFERENCES crm_leads(id);

-- Индексы для новых таблиц
CREATE INDEX IF NOT EXISTS idx_crm_leads_seller_status ON crm_leads(assigned_seller, status);
CREATE INDEX IF NOT EXISTS idx_ci_pipelines_status ON ci_pipelines(status);
CREATE INDEX IF NOT EXISTS idx_events_log_module_severity ON events_log(module, severity);
CREATE INDEX IF NOT EXISTS idx_events_log_timestamp ON events_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_archont_centers_status ON archont_centers(status);
CREATE INDEX IF NOT EXISTS idx_archont_trunks_center ON archont_trunks(center_id);
CREATE INDEX IF NOT EXISTS idx_archont_slots_center ON archont_slots(center_id);

-- Триггеры для обновления updated_at
DROP TRIGGER IF EXISTS update_crm_leads_updated_at ON crm_leads;
CREATE TRIGGER update_crm_leads_updated_at BEFORE UPDATE ON crm_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_archont_centers_updated_at ON archont_centers;
CREATE TRIGGER update_archont_centers_updated_at BEFORE UPDATE ON archont_centers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Триггер для обновления Redis при изменении статуса слота
CREATE OR REPLACE FUNCTION notify_slot_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Это будет обработано через RabbitMQ или прямой вызов Redis из приложения
    PERFORM pg_notify('slot_status_changed', json_build_object(
        'slot_id', NEW.id,
        'status', NEW.status,
        'trunk_id', NEW.trunk_id
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_slot_status ON slots;
CREATE TRIGGER trg_slot_status AFTER UPDATE OF status ON slots
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION notify_slot_status_change();

-- Триггер для обновления CRM при завершении звонка
CREATE OR REPLACE FUNCTION update_crm_on_call_end()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'ended' AND OLD.status != 'ended' AND NEW.crm_lead_id IS NOT NULL THEN
        UPDATE crm_leads 
        SET updated_at = NOW(),
            metadata = jsonb_set(
                COALESCE(metadata, '{}'::jsonb),
                '{last_call}',
                json_build_object(
                    'call_id', NEW.id,
                    'duration', NEW.duration,
                    'end_time', NEW.end_time
                )::jsonb
            )
        WHERE id = NEW.crm_lead_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_call_end ON calls;
CREATE TRIGGER trg_call_end AFTER UPDATE OF status ON calls
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_crm_on_call_end();

-- Вставка шаблонов ARCHONTs
INSERT INTO archont_templates (name, description, stack_config) VALUES
    ('standard', 'Standard Call-Center Stack', '{
        "modules": ["OTTB", "CRM", "MONITORING", "CI_CD"],
        "trunks": 10,
        "slots_per_trunk": 5
    }'::jsonb),
    ('minimal', 'Minimal Stack', '{
        "modules": ["OTTB", "CRM"],
        "trunks": 5,
        "slots_per_trunk": 3
    }'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Table: guacamole_sessions_audit (для аудита Guacamole сессий)
CREATE TABLE IF NOT EXISTS guacamole_sessions_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    slot_id INTEGER REFERENCES slots(id),
    connection_id VARCHAR(256),
    protocol VARCHAR(16),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTERVAL,
    bytes_sent BIGINT DEFAULT 0,
    bytes_received BIGINT DEFAULT 0,
    status VARCHAR(32) DEFAULT 'active',
    error_message TEXT,
    client_ip INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: security_audit_log (расширенная система аудита безопасности)
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(32),
    resource_id VARCHAR(128),
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    details JSONB DEFAULT '{}',
    risk_level VARCHAR(16) DEFAULT 'low'
);

-- Индексы для новых таблиц
CREATE INDEX IF NOT EXISTS idx_guacamole_sessions_user ON guacamole_sessions_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_guacamole_sessions_slot ON guacamole_sessions_audit(slot_id);
CREATE INDEX IF NOT EXISTS idx_guacamole_sessions_start ON guacamole_sessions_audit(start_time);
CREATE INDEX IF NOT EXISTS idx_security_audit_user ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_action ON security_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_security_audit_timestamp ON security_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_audit_risk ON security_audit_log(risk_level);

-- Insert default admin user (password: admin123 - CHANGE IN PRODUCTION!)
INSERT INTO users (username, email, password_hash, role_id) VALUES
    ('admin', 'admin@vss.local', crypt('admin123', gen_salt('bf')), 
     (SELECT id FROM roles WHERE name = 'admin'))
ON CONFLICT (username) DO NOTHING;

-- Insert additional default roles with detailed permissions
INSERT INTO roles (name, description, permissions) VALUES
    ('supervisor', 'Supervisor with monitoring and reporting access', '{
        "read": true,
        "report": true,
        "monitor": true,
        "calls": ["read", "monitor"],
        "users": ["read"],
        "slots": ["read", "monitor"],
        "crm": ["read"],
        "reports": ["read", "generate"],
        "dashboard": true,
        "logs": ["read"]
    }'::jsonb),
    ('seller', 'Seller with CRM access', '{
        "crm": true,
        "leads": true,
        "calls": ["read"],
        "notes": ["create", "read", "update"],
        "dashboard": ["read"]
    }'::jsonb)
ON CONFLICT (name) DO NOTHING;

