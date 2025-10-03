#!/usr/bin/env node

import { WebhookManager } from './webhook-manager.js';
import cron from 'node-cron';

/**
 * Webhook Queue Worker
 * Handles background processing of failed webhooks with retry logic
 */
export class WebhookQueue {
  constructor(options = {}) {
    this.webhookManager = new WebhookManager();
    this.maxRetries = options.maxRetries || 3;
    this.retryInterval = options.retryInterval || 5; // minutes
    this.cleanupDays = options.cleanupDays || 30;
    this.running = false;
    this.cronJob = null;
  }

  /**
   * Start the queue worker
   */
  start() {
    if (this.running) {
      console.log('⚠️  Webhook queue already running');
      return;
    }

    this.running = true;
    console.log('🚀 Starting webhook queue worker...');

    // Run retry every 5 minutes
    this.cronJob = cron.schedule(`*/${this.retryInterval} * * * *`, async () => {
      await this.processRetries();
    });

    // Run cleanup daily at 3 AM
    this.cleanupJob = cron.schedule('0 3 * * *', async () => {
      await this.cleanup();
    });

    console.log(`✅ Webhook queue started`);
    console.log(`   - Retry interval: every ${this.retryInterval} minutes`);
    console.log(`   - Max retries: ${this.maxRetries}`);
    console.log(`   - Cleanup: daily at 3 AM (keep ${this.cleanupDays} days)`);
  }

  /**
   * Stop the queue worker
   */
  stop() {
    if (!this.running) {
      console.log('⚠️  Webhook queue not running');
      return;
    }

    if (this.cronJob) {
      this.cronJob.stop();
    }

    if (this.cleanupJob) {
      this.cleanupJob.stop();
    }

    this.running = false;
    console.log('🛑 Webhook queue stopped');
  }

  /**
   * Process webhook retries
   */
  async processRetries() {
    try {
      console.log('🔄 Processing webhook retries...');
      const results = await this.webhookManager.retryFailedWebhooks(this.maxRetries);

      if (results.length > 0) {
        const successful = results.filter(r => r.sent).length;
        const failed = results.filter(r => !r.sent).length;

        console.log(`✅ Retry batch complete: ${successful} successful, ${failed} failed`);
      } else {
        console.log('   No webhooks to retry');
      }
    } catch (error) {
      console.error('❌ Error processing webhook retries:', error.message);
    }
  }

  /**
   * Clean up old webhook logs
   */
  async cleanup() {
    try {
      console.log('🗑️  Running webhook log cleanup...');
      const deletedCount = await this.webhookManager.cleanupOldLogs(this.cleanupDays);
      console.log(`✅ Cleanup complete: ${deletedCount} logs removed`);
    } catch (error) {
      console.error('❌ Error during cleanup:', error.message);
    }
  }

  /**
   * Process retries manually (run once)
   */
  async processOnce() {
    return await this.processRetries();
  }

  /**
   * Get queue status
   */
  async getStatus() {
    const { getDatabase } = await import('../../server/database/db.js');
    const db = getDatabase();

    // Count pending webhooks
    const pendingStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM webhook_logs
      WHERE status = 'pending'
    `);
    const pendingCount = pendingStmt.get().count;

    // Count webhooks by status (last 7 days)
    const statsStmt = db.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM webhook_logs
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY status
    `);
    const stats = statsStmt.all();

    return {
      running: this.running,
      pending_webhooks: pendingCount,
      max_retries: this.maxRetries,
      retry_interval_minutes: this.retryInterval,
      cleanup_days: this.cleanupDays,
      last_7_days: stats.reduce((acc, s) => {
        acc[s.status] = s.count;
        return acc;
      }, {})
    };
  }
}

/**
 * Start webhook queue as standalone service
 */
export async function startWebhookQueueService(options = {}) {
  const queue = new WebhookQueue(options);
  queue.start();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down webhook queue...');
    queue.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down webhook queue...');
    queue.stop();
    process.exit(0);
  });

  return queue;
}

// If running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Starting Webhook Queue Service...');

  const options = {
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES) || 3,
    retryInterval: parseInt(process.env.WEBHOOK_RETRY_INTERVAL) || 5,
    cleanupDays: parseInt(process.env.WEBHOOK_CLEANUP_DAYS) || 30
  };

  startWebhookQueueService(options);
}

export default WebhookQueue;
