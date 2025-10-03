-- Multitenant Restaurant Scraper Database Schema
-- SQLite Database for managing tenants, API keys, and restaurant associations

-- Tenants table: Stores customer/tenant information
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  company TEXT,
  plan TEXT DEFAULT 'free', -- free, pro, enterprise
  webhook_url TEXT, -- Optional webhook URL for notifications
  active INTEGER DEFAULT 1, -- 1 = active, 0 = disabled
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API Keys table: Stores API keys for tenant authentication
CREATE TABLE IF NOT EXISTS api_keys (
  key TEXT PRIMARY KEY, -- Format: rsk_xxxxxxxxxxxxxx (restaurant scraper key)
  tenant_id TEXT NOT NULL,
  name TEXT, -- Optional name/description for the key
  active INTEGER DEFAULT 1,
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Tenant Restaurants table: Links tenants to restaurants (many-to-many)
CREATE TABLE IF NOT EXISTS tenant_restaurants (
  tenant_id TEXT NOT NULL,
  restaurant_slug TEXT NOT NULL,
  custom_config TEXT, -- JSON string for tenant-specific config
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, restaurant_slug),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Webhook Logs table: Track webhook deliveries
CREATE TABLE IF NOT EXISTS webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- scrape_started, scrape_completed, scrape_failed, sync_completed
  restaurant_slug TEXT,
  payload TEXT, -- JSON payload sent
  status TEXT DEFAULT 'pending', -- pending, success, failed
  response_code INTEGER,
  response_body TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- API Usage Logs table: Track API usage for rate limiting
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  api_key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (api_key) REFERENCES api_keys(key) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(active) WHERE active = 1;
CREATE INDEX IF NOT EXISTS idx_tenant_restaurants_slug ON tenant_restaurants(restaurant_slug);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant ON webhook_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status, next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_api_usage_tenant ON api_usage_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_usage_logs(api_key, created_at);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_tenant_timestamp
AFTER UPDATE ON tenants
BEGIN
  UPDATE tenants SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
