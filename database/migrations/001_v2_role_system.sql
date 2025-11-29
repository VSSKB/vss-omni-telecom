-- Migration: V2 Role System Upgrade
-- Version: 2.1.0
-- Date: 2024-01-15

BEGIN;

-- Create new role system tables
CREATE TABLE IF NOT EXISTS v2_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]',
    constraints JSONB NOT NULL DEFAULT '[]',
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
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS v2_user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_hash VARCHAR(512) NOT NULL UNIQUE,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate existing roles
INSERT INTO v2_roles (id, name, description, permissions, created_at, updated_at)
SELECT 
    id,
    name,
    description,
    COALESCE(permissions, '[]'::jsonb),
    created_at,
    updated_at
FROM roles
ON CONFLICT (id) DO NOTHING;

-- Add guacamole_permissions to existing roles if missing
UPDATE roles SET guacamole_permissions = '{
    "allowed_protocols": ["rdp", "vnc", "ssh"],
    "max_connections": 5,
    "session_timeout": 3600
}'::jsonb
WHERE guacamole_permissions IS NULL;

-- Add missing columns to users table
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS guacamole_attributes JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS last_guacamole_session TIMESTAMPTZ;

-- Create indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_v2_roles_name ON v2_roles(name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_v2_user_sessions_user_id ON v2_user_sessions(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_v2_user_sessions_expires_at ON v2_user_sessions(expires_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_v2_user_sessions_token_hash ON v2_user_sessions(token_hash);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS update_v2_roles_updated_at ON v2_roles;
CREATE TRIGGER update_v2_roles_updated_at 
    BEFORE UPDATE ON v2_roles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_v2_user_sessions_updated_at ON v2_user_sessions;
CREATE TRIGGER update_v2_user_sessions_updated_at 
    BEFORE UPDATE ON v2_user_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version VARCHAR(20) PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_version (version, description) 
VALUES ('2.1.0', 'Role system upgrade with Guacamole integration')
ON CONFLICT (version) DO NOTHING;

COMMIT;

