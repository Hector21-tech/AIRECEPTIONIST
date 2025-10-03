#!/usr/bin/env node

import { getDatabase } from '../../server/database/db.js';
import axios from 'axios';

/**
 * Webhook Manager
 * Handles webhook delivery and logging
 */
export class WebhookManager {
  constructor() {
    this.db = getDatabase();
  }

  /**
   * Send webhook to tenant
   */
  async sendWebhook(tenantId, eventType, payload) {
    // Get tenant info
    const tenantStmt = this.db.prepare('SELECT webhook_url, name FROM tenants WHERE id = ? AND active = 1');
    const tenant = tenantStmt.get(tenantId);

    if (!tenant || !tenant.webhook_url) {
      console.log(`⏭️  No webhook URL configured for tenant ${tenantId}, skipping webhook`);
      return {
        sent: false,
        reason: 'No webhook URL configured'
      };
    }

    // Create webhook log entry
    const logStmt = this.db.prepare(`
      INSERT INTO webhook_logs (tenant_id, event_type, restaurant_slug, payload, status)
      VALUES (?, ?, ?, ?, 'pending')
      RETURNING id
    `);

    const logResult = logStmt.get(
      tenantId,
      eventType,
      payload.restaurant_slug || null,
      JSON.stringify(payload)
    );

    const webhookLogId = logResult.id;

    try {
      // Prepare webhook payload
      const webhookPayload = {
        event: eventType,
        tenant_id: tenantId,
        tenant_name: tenant.name,
        timestamp: new Date().toISOString(),
        data: payload
      };

      // Send webhook
      const response = await axios.post(tenant.webhook_url, webhookPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': eventType,
          'X-Webhook-Tenant': tenantId
        },
        timeout: 10000 // 10 second timeout
      });

      // Update log with success
      const updateStmt = this.db.prepare(`
        UPDATE webhook_logs
        SET status = 'success',
            response_code = ?,
            response_body = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      updateStmt.run(
        response.status,
        JSON.stringify(response.data).substring(0, 1000), // Limit response body
        webhookLogId
      );

      console.log(`✅ Webhook sent to ${tenant.name}: ${eventType}`);

      return {
        sent: true,
        status: response.status,
        webhookLogId
      };
    } catch (error) {
      // Update log with failure
      const errorMessage = error.response?.data || error.message;
      const statusCode = error.response?.status || 0;

      const updateStmt = this.db.prepare(`
        UPDATE webhook_logs
        SET status = 'failed',
            response_code = ?,
            response_body = ?,
            completed_at = CURRENT_TIMESTAMP,
            next_retry_at = datetime('now', '+5 minutes')
        WHERE id = ?
      `);

      updateStmt.run(
        statusCode,
        JSON.stringify({ error: errorMessage }).substring(0, 1000),
        webhookLogId
      );

      console.error(`❌ Webhook failed for ${tenant.name}: ${error.message}`);

      return {
        sent: false,
        error: error.message,
        webhookLogId
      };
    }
  }

  /**
   * Send webhook to all tenants for a restaurant
   */
  async sendToRestaurantTenants(restaurantSlug, eventType, payload) {
    // Get all tenants with access to this restaurant
    const stmt = this.db.prepare(`
      SELECT DISTINCT t.id, t.name, t.webhook_url
      FROM tenants t
      JOIN tenant_restaurants tr ON t.id = tr.tenant_id
      WHERE tr.restaurant_slug = ? AND t.active = 1
    `);

    const tenants = stmt.all(restaurantSlug);

    if (tenants.length === 0) {
      console.log(`⏭️  No tenants found for restaurant ${restaurantSlug}`);
      return [];
    }

    // Send webhook to each tenant
    const results = [];
    for (const tenant of tenants) {
      const result = await this.sendWebhook(tenant.id, eventType, {
        restaurant_slug: restaurantSlug,
        ...payload
      });

      results.push({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        ...result
      });
    }

    return results;
  }

  /**
   * Retry failed webhooks
   */
  async retryFailedWebhooks(maxRetries = 3) {
    // Get failed webhooks that are ready for retry
    const stmt = this.db.prepare(`
      SELECT
        wl.id,
        wl.tenant_id,
        wl.event_type,
        wl.restaurant_slug,
        wl.payload,
        wl.retry_count
      FROM webhook_logs wl
      WHERE wl.status = 'pending'
        AND wl.retry_count < ?
        AND (wl.next_retry_at IS NULL OR wl.next_retry_at <= CURRENT_TIMESTAMP)
      ORDER BY wl.created_at
      LIMIT 100
    `);

    const failedWebhooks = stmt.all(maxRetries);

    console.log(`🔄 Retrying ${failedWebhooks.length} failed webhooks...`);

    const results = [];
    for (const webhook of failedWebhooks) {
      // Increment retry count
      const updateRetryStmt = this.db.prepare(`
        UPDATE webhook_logs
        SET retry_count = retry_count + 1
        WHERE id = ?
      `);
      updateRetryStmt.run(webhook.id);

      // Retry sending
      const payload = JSON.parse(webhook.payload);
      const result = await this.sendWebhook(webhook.tenant_id, webhook.event_type, payload);

      results.push({
        webhook_id: webhook.id,
        retry_count: webhook.retry_count + 1,
        ...result
      });
    }

    return results;
  }

  /**
   * Get webhook logs for tenant
   */
  getWebhookLogs(tenantId, filters = {}) {
    let query = `
      SELECT * FROM webhook_logs
      WHERE tenant_id = ?
    `;
    const params = [tenantId];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.event_type) {
      query += ' AND event_type = ?';
      params.push(filters.event_type);
    }

    if (filters.restaurant_slug) {
      query += ' AND restaurant_slug = ?';
      params.push(filters.restaurant_slug);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(filters.limit || 100);

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  /**
   * Get webhook statistics
   */
  getWebhookStats(tenantId, days = 7) {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM webhook_logs
      WHERE tenant_id = ?
        AND created_at >= datetime('now', '-' || ? || ' days')
    `);

    return stmt.get(tenantId, days);
  }

  /**
   * Clean up old webhook logs
   */
  cleanupOldLogs(daysToKeep = 30) {
    const stmt = this.db.prepare(`
      DELETE FROM webhook_logs
      WHERE created_at < datetime('now', '-' || ? || ' days')
    `);

    const result = stmt.run(daysToKeep);
    console.log(`🗑️  Cleaned up ${result.changes} old webhook logs (older than ${daysToKeep} days)`);

    return result.changes;
  }

  /**
   * Test webhook URL
   */
  async testWebhook(tenantId) {
    return await this.sendWebhook(tenantId, 'webhook_test', {
      message: 'This is a test webhook',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Webhook Event Types
 */
export const WebhookEvents = {
  SCRAPE_STARTED: 'scrape_started',
  SCRAPE_COMPLETED: 'scrape_completed',
  SCRAPE_FAILED: 'scrape_failed',
  SYNC_STARTED: 'sync_started',
  SYNC_COMPLETED: 'sync_completed',
  SYNC_FAILED: 'sync_failed',
  WEBHOOK_TEST: 'webhook_test'
};

export default WebhookManager;
