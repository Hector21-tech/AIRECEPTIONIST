#!/usr/bin/env node

import { config } from './config.js';
import { AutomationScheduler } from './scheduler.js';
import { TorstensCrawler } from './crawler.js';
import { ContentExtractor } from './extractor.js';
import { KnowledgeBuilder } from './knowledge-builder.js';
import { HealthChecker } from './utils/health-checker.js';
import { HealthAPI } from './api/health-api.js';
import { multiCLI, multiRestaurantCommands } from './multi-restaurant/index.js';

console.log('🍽️ Torstens Voice AI Scraper');
console.log('================================');

const args = process.argv.slice(2);
const command = args[0] || 'start';

async function showStatus() {
  console.log('📊 Status Information');
  console.log('--------------------');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Crawl Delay: ${config.crawlDelayMs}ms`);
  console.log(`Schedule: ${config.cronSchedule}`);
  console.log(`Knowledge Base: ${config.knowledgeBasePath}`);
  console.log(`Voice AI Webhook: ${config.voiceAiWebhookUrl ? '✅ Konfigurerad' : '❌ Ej konfigurerad'}`);

  // Perform health check
  const healthChecker = new HealthChecker();
  const healthCheck = await healthChecker.performHealthCheck();
  console.log(`System Health: ${healthCheck.overall === 'healthy' ? '✅' : healthCheck.overall === 'degraded' ? '⚠️' : '❌'} ${healthCheck.overall}`);
}

async function runCrawl() {
  console.log('🕷️ Startar crawling...');
  const crawler = new TorstensCrawler();
  const result = await crawler.crawlAll();
  console.log(`✅ Crawling klar: ${result.length} sidor`);
  return result;
}

async function runExtraction() {
  console.log('🔍 Startar extraktion...');
  const extractor = new ContentExtractor();
  const result = await extractor.extractFromCrawledData();
  console.log(`✅ Extraktion klar: ${result.content.length} sidor analyserade`);
  return result;
}

async function runKnowledgeBuilder() {
  console.log('🧠 Bygger knowledge base...');
  const builder = new KnowledgeBuilder();
  const result = await builder.buildKnowledgeBase();
  console.log(`✅ Knowledge base klar: ${result.knowledgeBase.length} poster`);
  return result;
}

async function runFullUpdate() {
  console.log('🚀 Kör komplett uppdatering...');
  const scheduler = new AutomationScheduler();
  const result = await scheduler.runFullUpdate();
  console.log('✅ Komplett uppdatering klar');
  return result;
}

async function startScheduler() {
  console.log('⏰ Startar scheduler...');
  const scheduler = new AutomationScheduler();

  // Start health API if port is available
  let healthAPI = null;
  let apiPort = null;

  try {
    // Try different ports if 3001 is busy
    const ports = [3001, 3002, 3003, 3004];

    for (const tryPort of ports) {
      try {
        healthAPI = new HealthAPI(tryPort);
        await healthAPI.start();
        apiPort = tryPort;
        break;
      } catch (error) {
        if (error.code !== 'EADDRINUSE') throw error;
      }
    }

    if (apiPort) {
      console.log(`🏥 Health API started on http://localhost:${apiPort}`);
    } else {
      console.log('⚠️ Could not find available port for Health API');
    }
  } catch (error) {
    console.log('⚠️ Could not start Health API:', error.message);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down...');
    scheduler.stopScheduler();
    if (healthAPI) {
      await healthAPI.stop();
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  scheduler.startScheduler();

  // Håll processen igång
  console.log('✅ Scheduler is running. Press Ctrl+C to stop.');
  if (healthAPI && apiPort) {
    console.log(`📊 Health checks available at: http://localhost:${apiPort}/health`);
    console.log(`📈 Metrics available at: http://localhost:${apiPort}/metrics`);
  }
  process.stdin.resume();
}

async function main() {
  try {
    // Multi-restaurant kommandon
    if (multiRestaurantCommands[command]) {
      const subCommand = args[1];
      await multiRestaurantCommands[command](subCommand);
      return;
    }

    switch (command) {
      case 'status':
        await showStatus();
        break;

      case 'crawl':
        await runCrawl();
        break;

      case 'extract':
        await runExtraction();
        break;

      case 'knowledge':
        await runKnowledgeBuilder();
        break;

      case 'update':
      case 'full-update':
        await runFullUpdate();
        break;

      case 'start':
      case 'schedule':
        await startScheduler();
        break;

      case 'health':
        const healthChecker = new HealthChecker();
        const healthCheck = await healthChecker.performHealthCheck();
        console.log(JSON.stringify(healthCheck, null, 2));
        break;

      case 'api':
        const healthAPI = new HealthAPI(3001);
        await healthAPI.start();
        console.log(`🏥 Health API running on http://localhost:${healthAPI.port}`);
        console.log(`📊 Health endpoint: http://localhost:${healthAPI.port}/health`);
        console.log(`📈 Metrics endpoint: http://localhost:${healthAPI.port}/metrics`);
        console.log(`🔍 Search endpoint: http://localhost:${healthAPI.port}/knowledge/search?q=query`);
        process.stdin.resume();
        break;

      case 'auto-scrape':
        const url = args[1];
        if (!url) {
          console.log('❌ URL saknas!');
          console.log('Användning: node src/index.js auto-scrape <URL>');
          console.log('Exempel: node src/index.js auto-scrape https://restaurangmavi.se');
          break;
        }

        const { AutoScraper } = await import('./auto-scraper.js');
        const autoScraper = new AutoScraper();
        console.log(`🍽️ Auto-scraping: ${url}`);
        await autoScraper.scrapeUrl(url);
        break;

      case 'help':
      case '--help':
      case '-h':
        console.log(`
Användning: node src/index.js [kommando]

SINGLE-RESTAURANT (original):
  start, schedule    Starta scheduler med health API (standard)
  update             Kör en komplett uppdatering
  crawl              Crawla endast webbsidor
  extract            Extrahera endast innehåll
  knowledge          Bygg endast knowledge base
  status             Visa statusinformation med health check
  health             Kör health check och visa resultat
  api                Starta endast health API på port 3001

MULTI-RESTAURANT (nytt):
  multi-init         Initiera med exempel-restauranger (Torstens)
  multi-load [fil]   Ladda restauranger från JSON-fil
  multi-save [fil]   Spara restauranger till JSON-fil
  multi-scrape-all   Scrapa alla registrerade restauranger
  multi-scrape [slug] Scrapa en specifik restaurang
  multi-status       Visa multi-restaurant system status
  multi-list         Lista alla registrerade restauranger
  multi-health       Health check för multi-restaurant system
  multi-clean        Rensa all multi-restaurant data

  help               Visa denna hjälp

Exempel:
  # Original single-restaurant
  npm start                    # Starta scheduler med API
  npm run full-update          # Kör komplett uppdatering

  # Multi-restaurant
  node src/index.js multi-init              # Initiera med Torstens exempel
  node src/index.js multi-scrape-all        # Scrapa alla restauranger
  node src/index.js multi-status            # Visa system status
  node src/index.js multi-scrape torstens-angelholm  # Scrapa bara Ängelholm
        `);
        break;

      default:
        console.log(`❌ Okänt kommando: ${command}`);
        console.log('Kör "node src/index.js help" för hjälp');
        process.exit(1);
    }

  } catch (error) {
    console.error('❌ Ett fel uppstod:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Kör bara om detta är huvudfilen - Windows fix
main();