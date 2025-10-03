#!/usr/bin/env node

import { getDatabase } from '../../server/database/db.js';
import crypto from 'crypto';

/**
 * Tenant Manager
 * Handles CRUD operations for tenants
 */
export class TenantManager {
  constructor() {
    this.db = getDatabase();
  }

  /**
   * Create a new tenant
   */
  createTenant(data) {
    const { name, email, company, plan = 'free', webhook_url } = data;

    // Generate unique tenant ID
    const id = `tenant_${crypto.randomBytes(12).toString('hex')}`;

    const stmt = this.db.prepare(`
      INSERT INTO tenants (id, name, email, company, plan, webhook_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(id, name, email, company, plan, webhook_url);
      return this.getTenant(id);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error(`Tenant with email ${email} already exists`);
      }
      throw error;
    }
  }

  /**
   * Get tenant by ID
   */
  getTenant(id) {
    const stmt = this.db.prepare('SELECT * FROM tenants WHERE id = ?');
    const tenant = stmt.get(id);

    if (!tenant) {
      throw new Error(`Tenant not found: ${id}`);
    }

    return tenant;
  }

  /**
   * Get tenant by email
   */
  getTenantByEmail(email) {
    const stmt = this.db.prepare('SELECT * FROM tenants WHERE email = ?');
    const tenant = stmt.get(email);

    if (!tenant) {
      throw new Error(`Tenant not found with email: ${email}`);
    }

    return tenant;
  }

  /**
   * List all tenants
   */
  listTenants(filters = {}) {
    let query = 'SELECT * FROM tenants WHERE 1=1';
    const params = [];

    if (filters.active !== undefined) {
      query += ' AND active = ?';
      params.push(filters.active ? 1 : 0);
    }

    if (filters.plan) {
      query += ' AND plan = ?';
      params.push(filters.plan);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  /**
   * Update tenant
   */
  updateTenant(id, data) {
    const tenant = this.getTenant(id); // Verify exists

    const allowedFields = ['name', 'email', 'company', 'plan', 'webhook_url', 'active'];
    const updates = [];
    const params = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    params.push(id);
    const query = `UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`;

    const stmt = this.db.prepare(query);
    stmt.run(...params);

    return this.getTenant(id);
  }

  /**
   * Delete tenant (soft delete by setting active = 0)
   */
  deleteTenant(id, hard = false) {
    const tenant = this.getTenant(id); // Verify exists

    if (hard) {
      // Hard delete (cascades to api_keys, tenant_restaurants, etc.)
      const stmt = this.db.prepare('DELETE FROM tenants WHERE id = ?');
      stmt.run(id);
      return { deleted: true, hard: true };
    } else {
      // Soft delete
      this.updateTenant(id, { active: 0 });
      return { deleted: true, hard: false };
    }
  }

  /**
   * Link restaurant to tenant
   */
  linkRestaurant(tenantId, restaurantSlug, customConfig = null) {
    this.getTenant(tenantId); // Verify tenant exists

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tenant_restaurants (tenant_id, restaurant_slug, custom_config)
      VALUES (?, ?, ?)
    `);

    const configJson = customConfig ? JSON.stringify(customConfig) : null;
    stmt.run(tenantId, restaurantSlug, configJson);

    return {
      tenant_id: tenantId,
      restaurant_slug: restaurantSlug,
      custom_config: customConfig
    };
  }

  /**
   * Unlink restaurant from tenant
   */
  unlinkRestaurant(tenantId, restaurantSlug) {
    const stmt = this.db.prepare(`
      DELETE FROM tenant_restaurants
      WHERE tenant_id = ? AND restaurant_slug = ?
    `);

    const result = stmt.run(tenantId, restaurantSlug);

    if (result.changes === 0) {
      throw new Error(`Restaurant ${restaurantSlug} not linked to tenant ${tenantId}`);
    }

    return { unlinked: true };
  }

  /**
   * Get restaurants for tenant
   */
  getTenantRestaurants(tenantId) {
    this.getTenant(tenantId); // Verify tenant exists

    const stmt = this.db.prepare(`
      SELECT
        tr.restaurant_slug,
        tr.custom_config,
        tr.created_at
      FROM tenant_restaurants tr
      WHERE tr.tenant_id = ?
      ORDER BY tr.created_at DESC
    `);

    const restaurants = stmt.all(tenantId);

    return restaurants.map(r => ({
      ...r,
      custom_config: r.custom_config ? JSON.parse(r.custom_config) : null
    }));
  }

  /**
   * Get tenants for a restaurant
   */
  getRestaurantTenants(restaurantSlug) {
    const stmt = this.db.prepare(`
      SELECT
        t.id,
        t.name,
        t.email,
        t.plan,
        tr.custom_config,
        tr.created_at as linked_at
      FROM tenants t
      JOIN tenant_restaurants tr ON t.id = tr.tenant_id
      WHERE tr.restaurant_slug = ? AND t.active = 1
      ORDER BY tr.created_at DESC
    `);

    const tenants = stmt.all(restaurantSlug);

    return tenants.map(t => ({
      ...t,
      custom_config: t.custom_config ? JSON.parse(t.custom_config) : null
    }));
  }

  /**
   * Check if tenant has access to restaurant
   */
  hasAccess(tenantId, restaurantSlug) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM tenant_restaurants
      WHERE tenant_id = ? AND restaurant_slug = ?
    `);

    const result = stmt.get(tenantId, restaurantSlug);
    return result.count > 0;
  }

  /**
   * Get tenant statistics
   */
  getTenantStats(tenantId) {
    this.getTenant(tenantId); // Verify tenant exists

    // Count restaurants
    const restaurantStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM tenant_restaurants WHERE tenant_id = ?
    `);
    const restaurantCount = restaurantStmt.get(tenantId).count;

    // Count API keys
    const apiKeyStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM api_keys WHERE tenant_id = ? AND active = 1
    `);
    const apiKeyCount = apiKeyStmt.get(tenantId).count;

    // Count API usage (last 30 days)
    const usageStmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM api_usage_logs
      WHERE tenant_id = ?
        AND created_at >= datetime('now', '-30 days')
    `);
    const apiUsage30d = usageStmt.get(tenantId).count;

    // Count webhook logs (last 7 days)
    const webhookStmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM webhook_logs
      WHERE tenant_id = ?
        AND created_at >= datetime('now', '-7 days')
    `);
    const webhookCount7d = webhookStmt.get(tenantId).count;

    return {
      tenant_id: tenantId,
      restaurant_count: restaurantCount,
      api_key_count: apiKeyCount,
      api_usage_30d: apiUsage30d,
      webhook_deliveries_7d: webhookCount7d
    };
  }
}

export default TenantManager;
