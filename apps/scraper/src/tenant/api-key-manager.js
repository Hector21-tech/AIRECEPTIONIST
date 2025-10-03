#!/usr/bin/env node

import { getDatabase } from '../../server/database/db.js';
import crypto from 'crypto';

/**
 * API Key Manager
 * Handles CRUD operations for API keys
 */
export class ApiKeyManager {
  constructor() {
    this.db = getDatabase();
  }

  /**
   * Generate a new API key
   * Format: rsk_xxxxxxxxxxxxxxxxxxxxxxxx (restaurant scraper key)
   */
  generateKey() {
    const randomBytes = crypto.randomBytes(24).toString('hex');
    return `rsk_${randomBytes}`;
  }

  /**
   * Create a new API key for tenant
   */
  createApiKey(tenantId, name = null) {
    // Verify tenant exists
    const tenantStmt = this.db.prepare('SELECT id FROM tenants WHERE id = ? AND active = 1');
    const tenant = tenantStmt.get(tenantId);

    if (!tenant) {
      throw new Error(`Active tenant not found: ${tenantId}`);
    }

    const key = this.generateKey();

    const stmt = this.db.prepare(`
      INSERT INTO api_keys (key, tenant_id, name)
      VALUES (?, ?, ?)
    `);

    stmt.run(key, tenantId, name);

    return this.getApiKey(key);
  }

  /**
   * Get API key details
   */
  getApiKey(key) {
    const stmt = this.db.prepare(`
      SELECT
        ak.*,
        t.name as tenant_name,
        t.email as tenant_email,
        t.plan as tenant_plan,
        t.active as tenant_active
      FROM api_keys ak
      JOIN tenants t ON ak.tenant_id = t.id
      WHERE ak.key = ?
    `);

    const apiKey = stmt.get(key);

    if (!apiKey) {
      throw new Error(`API key not found: ${key}`);
    }

    return apiKey;
  }

  /**
   * Validate API key and return tenant info
   */
  validateApiKey(key) {
    const stmt = this.db.prepare(`
      SELECT
        ak.key,
        ak.tenant_id,
        ak.active as key_active,
        t.name as tenant_name,
        t.email as tenant_email,
        t.plan,
        t.active as tenant_active
      FROM api_keys ak
      JOIN tenants t ON ak.tenant_id = t.id
      WHERE ak.key = ?
    `);

    const result = stmt.get(key);

    if (!result) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (result.key_active !== 1) {
      return { valid: false, error: 'API key is disabled' };
    }

    if (result.tenant_active !== 1) {
      return { valid: false, error: 'Tenant account is disabled' };
    }

    // Update last_used_at
    this.updateLastUsed(key);

    return {
      valid: true,
      tenant_id: result.tenant_id,
      tenant_name: result.tenant_name,
      tenant_email: result.tenant_email,
      plan: result.plan
    };
  }

  /**
   * Update last_used_at timestamp
   */
  updateLastUsed(key) {
    const stmt = this.db.prepare(`
      UPDATE api_keys
      SET last_used_at = CURRENT_TIMESTAMP
      WHERE key = ?
    `);

    stmt.run(key);
  }

  /**
   * List API keys for tenant
   */
  listTenantApiKeys(tenantId, includeInactive = false) {
    let query = `
      SELECT * FROM api_keys
      WHERE tenant_id = ?
    `;

    if (!includeInactive) {
      query += ' AND active = 1';
    }

    query += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(tenantId);
  }

  /**
   * Deactivate API key (soft delete)
   */
  deactivateApiKey(key) {
    const apiKey = this.getApiKey(key); // Verify exists

    const stmt = this.db.prepare(`
      UPDATE api_keys
      SET active = 0
      WHERE key = ?
    `);

    stmt.run(key);

    return { deactivated: true };
  }

  /**
   * Reactivate API key
   */
  reactivateApiKey(key) {
    const apiKey = this.getApiKey(key); // Verify exists

    const stmt = this.db.prepare(`
      UPDATE api_keys
      SET active = 1
      WHERE key = ?
    `);

    stmt.run(key);

    return { reactivated: true };
  }

  /**
   * Delete API key permanently
   */
  deleteApiKey(key) {
    const apiKey = this.getApiKey(key); // Verify exists

    const stmt = this.db.prepare('DELETE FROM api_keys WHERE key = ?');
    stmt.run(key);

    return { deleted: true };
  }

  /**
   * Rotate API key (create new, deactivate old)
   */
  rotateApiKey(oldKey, name = null) {
    const apiKey = this.getApiKey(oldKey);

    // Create new key
    const newKey = this.createApiKey(apiKey.tenant_id, name || apiKey.name);

    // Deactivate old key
    this.deactivateApiKey(oldKey);

    return {
      rotated: true,
      old_key: oldKey,
      new_key: newKey.key
    };
  }

  /**
   * Log API usage
   */
  logApiUsage(data) {
    const { tenant_id, api_key, endpoint, method, status_code } = data;

    const stmt = this.db.prepare(`
      INSERT INTO api_usage_logs (tenant_id, api_key, endpoint, method, status_code)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(tenant_id, api_key, endpoint, method, status_code);
  }

  /**
   * Get API usage statistics
   */
  getUsageStats(tenantId, days = 30) {
    const stmt = this.db.prepare(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as request_count,
        COUNT(DISTINCT endpoint) as unique_endpoints
      FROM api_usage_logs
      WHERE tenant_id = ?
        AND created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    return stmt.all(tenantId, days);
  }

  /**
   * Check rate limit
   * Returns true if under limit, false if exceeded
   */
  checkRateLimit(tenantId, plan, windowMinutes = 60) {
    const limits = {
      free: 100,      // 100 requests per hour
      pro: 1000,      // 1000 requests per hour
      enterprise: 10000 // 10000 requests per hour
    };

    const limit = limits[plan] || limits.free;

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM api_usage_logs
      WHERE tenant_id = ?
        AND created_at >= datetime('now', '-' || ? || ' minutes')
    `);

    const result = stmt.get(tenantId, windowMinutes);

    return {
      under_limit: result.count < limit,
      current: result.count,
      limit: limit,
      remaining: Math.max(0, limit - result.count)
    };
  }
}

export default ApiKeyManager;
