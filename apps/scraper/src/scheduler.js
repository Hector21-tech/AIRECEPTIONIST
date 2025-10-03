import cron from 'node-cron';
import { config } from './config.js';
import { TorstensCrawler } from './crawler.js';
import { ContentExtractor } from './extractor.js';
import { KnowledgeBuilder } from './knowledge-builder.js';
import { HealthChecker } from './utils/health-checker.js';
import { Logger } from './utils/logger.js';
import axios from 'axios';

export class AutomationScheduler {
  constructor() {
    this.isRunning = false;
    this.lastRunResult = null;
    this.healthChecker = new HealthChecker();
    this.logger = new Logger('Scheduler');
  }

  async runFullUpdate() {
    if (this.isRunning) {
      this.logger.warn('Update already in progress, skipping');
      return;
    }

    this.logger.info('Starting automated update of Torstens data');
    this.isRunning = true;

    try {
      const startTime = new Date();

      // 1. Pre-update health check
      const preHealthCheck = await this.healthChecker.performHealthCheck();
      this.logger.info('Pre-update health check', { status: preHealthCheck.overall });

      // 2. Crawl webbsidor
      this.logger.info('Step 1/4: Crawling web pages');
      const crawler = new TorstensCrawler();
      const crawledData = await crawler.crawlAll();

      // 3. Extrahera innehåll
      this.logger.info('Step 2/4: Extracting content');
      const extractor = new ContentExtractor();
      const extractedData = await extractor.extractFromCrawledData();

      // 4. Bygg knowledge base
      this.logger.info('Step 3/4: Building knowledge base');
      const knowledgeBuilder = new KnowledgeBuilder();
      const knowledgeData = await knowledgeBuilder.buildKnowledgeBase();

      // 5. Post-update health check
      this.logger.info('Step 4/4: Post-update health check');
      const postHealthCheck = await this.healthChecker.performHealthCheck();
      await this.healthChecker.saveHealthCheck(postHealthCheck);

      const endTime = new Date();
      const duration = Math.round((endTime - startTime) / 1000);

      this.lastRunResult = {
        success: true,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationSeconds: duration,
        crawledPages: crawledData.length,
        extractedContent: extractedData.content.length,
        knowledgeEntries: knowledgeData.knowledgeBase.length,
        preHealthStatus: preHealthCheck.overall,
        postHealthStatus: postHealthCheck.overall,
        error: null
      };

      this.logger.info('Update completed successfully', {
        duration: `${duration}s`,
        crawledPages: crawledData.length,
        knowledgeEntries: knowledgeData.knowledgeBase.length,
        healthStatus: postHealthCheck.overall
      });

      // Notifiera Voice AI-system om uppdatering (om konfigurerat)
      await this.notifyVoiceAI();

      return this.lastRunResult;

    } catch (error) {
      this.lastRunResult = {
        success: false,
        startTime: new Date().toISOString(),
        error: error.message
      };

      console.error('❌ Fel vid automatisk uppdatering:', error.message);
      throw error;

    } finally {
      this.isRunning = false;
    }
  }

  async notifyVoiceAI() {
    if (!config.voiceAiWebhookUrl) {
      console.log('📞 Ingen Voice AI webhook konfigurerad');
      return;
    }

    try {
      console.log('📞 Notifierar Voice AI om uppdatering...');

      const payload = {
        event: 'knowledge_base_updated',
        timestamp: new Date().toISOString(),
        data: this.lastRunResult,
        knowledgeBasePath: config.knowledgeBasePath,
        restaurantDataPath: config.restaurantDataFile
      };

      const response = await axios.post(config.voiceAiWebhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': config.voiceAiApiKey ? `Bearer ${config.voiceAiApiKey}` : undefined
        },
        timeout: 10000
      });

      console.log('✅ Voice AI notifierad:', response.status);

    } catch (error) {
      console.log('⚠️ Kunde inte notifiera Voice AI:', error.message);
    }
  }

  startScheduler() {
    console.log(`⏰ Startar scheduler med schema: ${config.cronSchedule}`);

    // Validera cron-uttryck
    if (!cron.validate(config.cronSchedule)) {
      throw new Error(`Ogiltigt cron-schema: ${config.cronSchedule}`);
    }

    // Schemalägg automatisk uppdatering
    cron.schedule(config.cronSchedule, async () => {
      console.log('⏰ Schemalagd uppdatering startar...');
      try {
        await this.runFullUpdate();
      } catch (error) {
        console.error('❌ Schemalagd uppdatering misslyckades:', error.message);
      }
    });

    console.log('✅ Scheduler startad');

    // Kör initial uppdatering efter 5 sekunder
    setTimeout(async () => {
      console.log('🚀 Kör initial uppdatering...');
      try {
        await this.runFullUpdate();
      } catch (error) {
        console.error('❌ Initial uppdatering misslyckades:', error.message);
      }
    }, 5000);
  }

  stopScheduler() {
    console.log('🛑 Stoppar scheduler...');
    cron.getTasks().forEach(task => task.stop());
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRunResult,
      schedule: config.cronSchedule,
      nextRun: this.getNextRunTime()
    };
  }

  getNextRunTime() {
    // Enkel beräkning av nästa körning (förbättras vid behov)
    const now = new Date();
    const [minute, hour] = config.cronSchedule.split(' ').slice(0, 2);

    if (hour === '*') return 'Kontinuerligt';
    if (minute === '*') return 'Varje minut';

    const nextRun = new Date();
    nextRun.setHours(parseInt(hour), parseInt(minute), 0, 0);

    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun.toISOString();
  }
}