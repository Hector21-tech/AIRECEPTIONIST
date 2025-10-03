import { Logger } from '../utils/logger.js';
import { TorstensCrawler } from '../crawler.js';
import { ContentExtractor } from '../extractor.js';
import { RestaurantNormalizer } from './restaurant-normalizer.js';
import { JsonlToTxtConverter } from '../jsonl-to-txt.js';
import { ElevenLabsSync } from '../elevenlabs-sync.js';
import { WebhookManager, WebhookEvents } from '../tenant/webhook-manager.js';
import { multiConfig } from './config.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * MultiScraper - Orchestrerar scraping för flera restauranger
 * Integrerar med befintlig infrastruktur men stödjer multi-restaurant output
 */
export class MultiScraper {
  constructor(config = {}) {
    this.config = { ...multiConfig.config, ...config };
    this.logger = new Logger('MultiScraper');
    this.normalizer = new RestaurantNormalizer(this.config);
    this.webhookManager = new WebhookManager();
    this.results = new Map();
  }

  /**
   * Registrera restauranger för scraping
   */
  async registerRestaurants(restaurants) {
    for (const restaurantConfig of restaurants) {
      multiConfig.validateRestaurantConfig(restaurantConfig);
      multiConfig.registerRestaurant(restaurantConfig);
    }

    this.logger.info(`Registered ${restaurants.length} restaurants for scraping`);
    return restaurants.length;
  }

  /**
   * Scrapa en enskild restaurang
   */
  async scrapeRestaurant(restaurantSlug, options = {}) {
    const config = multiConfig.getRestaurantConfig(restaurantSlug);
    this.logger.info(`Starting scrape for restaurant: ${restaurantSlug}`, {
      name: config.name,
      baseUrl: config.baseUrl,
      city: config.city
    });

    // Send scrape_started webhook
    await this.webhookManager.sendToRestaurantTenants(restaurantSlug, WebhookEvents.SCRAPE_STARTED, {
      restaurant_name: config.name,
      restaurant_city: config.city,
      base_url: config.baseUrl
    });

    try {
      // Skapa output-mapp
      await fs.mkdir(config.paths.output, { recursive: true });

      // Steg 1: Crawling
      const crawlResults = await this.crawlRestaurant(config);

      // Steg 2: Content extraction
      const extractedData = await this.extractContent(config, crawlResults);

      // Steg 3: Normalisering och output-generering (inkl. TXT)
      const normalizedData = await this.normalizeRestaurant(config, extractedData);

      // Steg 4: Synka till ElevenLabs (om konfigurerat)
      let elevenlabsResult = null;
      if (options.syncToElevenLabs !== false && config.elevenlabs?.apiKey) {
        // Send sync_started webhook
        await this.webhookManager.sendToRestaurantTenants(restaurantSlug, WebhookEvents.SYNC_STARTED, {
          restaurant_name: config.name,
          restaurant_city: config.city
        });

        try {
          elevenlabsResult = await this.syncToElevenLabs(config);

          // Send sync_completed webhook
          await this.webhookManager.sendToRestaurantTenants(restaurantSlug, WebhookEvents.SYNC_COMPLETED, {
            restaurant_name: config.name,
            restaurant_city: config.city,
            document_id: elevenlabsResult.documentId,
            action: elevenlabsResult.action
          });
        } catch (error) {
          this.logger.warn(`ElevenLabs sync failed for ${restaurantSlug}`, {
            error: error.message
          });

          // Send sync_failed webhook
          await this.webhookManager.sendToRestaurantTenants(restaurantSlug, WebhookEvents.SYNC_FAILED, {
            restaurant_name: config.name,
            restaurant_city: config.city,
            error: error.message
          });

          // Don't fail the whole scrape if sync fails
        }
      }

      // Spara resultat
      this.results.set(restaurantSlug, {
        config,
        crawlResults,
        extractedData,
        normalizedData,
        elevenlabsResult,
        status: 'completed',
        timestamp: new Date().toISOString()
      });

      this.logger.info(`Successfully scraped restaurant: ${restaurantSlug}`, {
        pages: crawlResults.length,
        knowledgeItems: normalizedData.knowledge.length,
        errors: normalizedData.report.includes('FEL:'),
        syncedToElevenLabs: !!elevenlabsResult
      });

      // Send scrape_completed webhook
      await this.webhookManager.sendToRestaurantTenants(restaurantSlug, WebhookEvents.SCRAPE_COMPLETED, {
        restaurant_name: config.name,
        restaurant_city: config.city,
        pages_scraped: crawlResults.length,
        knowledge_items: normalizedData.knowledge.length,
        synced_to_elevenlabs: !!elevenlabsResult,
        elevenlabs_document_id: elevenlabsResult?.documentId
      });

      return this.results.get(restaurantSlug);

    } catch (error) {
      this.logger.error(`Failed to scrape restaurant: ${restaurantSlug}`, {
        error: error.message,
        stack: error.stack
      });

      this.results.set(restaurantSlug, {
        config,
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      // Send scrape_failed webhook
      await this.webhookManager.sendToRestaurantTenants(restaurantSlug, WebhookEvents.SCRAPE_FAILED, {
        restaurant_name: config.name,
        restaurant_city: config.city,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Synka till ElevenLabs
   */
  async syncToElevenLabs(config) {
    this.logger.info(`Syncing to ElevenLabs: ${config.slug}`);

    try {
      const sync = new ElevenLabsSync({
        apiKey: config.elevenlabs?.apiKey || process.env.ELEVENLABS_API_KEY
      });

      const result = await sync.syncRestaurant(
        config.paths.output,
        config.name,
        config.city
      );

      this.logger.info(`ElevenLabs sync completed for ${config.slug}`, {
        documentId: result.documentId,
        action: result.action
      });

      return result;
    } catch (error) {
      this.logger.error(`ElevenLabs sync failed for ${config.slug}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Crawla webbsidor för en restaurang
   */
  async crawlRestaurant(config) {
    this.logger.info(`Crawling restaurant: ${config.slug}`, {
      baseUrl: config.baseUrl,
      sitemapPaths: config.sitemapPaths
    });

    // Skapa specialiserad crawler för denna restaurang
    const crawler = new TorstensCrawler();

    // Temporärt sätt baseUrl
    const originalBaseUrl = crawler.config?.baseUrl;
    if (crawler.config) {
      crawler.config.baseUrl = config.baseUrl;
    }

    try {
      // Kör crawling
      const results = await crawler.crawlAll();

      // Spara rådata för denna restaurang
      await fs.writeFile(
        config.paths.rawData,
        JSON.stringify(results, null, 2),
        'utf-8'
      );

      this.logger.info(`Crawling completed for ${config.slug}`, {
        pages: results.length,
        successful: results.filter(r => !r.error).length,
        errors: results.filter(r => r.error).length
      });

      return results;

    } finally {
      // Återställ original baseUrl
      if (crawler.config && originalBaseUrl) {
        crawler.config.baseUrl = originalBaseUrl;
      }
    }
  }

  /**
   * Extrahera innehåll från crawlad data
   */
  async extractContent(config, crawlResults) {
    this.logger.info(`Extracting content for: ${config.slug}`);

    const extractor = new ContentExtractor();

    // Simulera att data redan finns i expected location för extractor
    const tempDataFile = './data/temp_raw_pages.json';
    await fs.writeFile(tempDataFile, JSON.stringify(crawlResults, null, 2), 'utf-8');

    try {
      // Temporärt ändra config för att peka på vår temp-fil
      const originalRawFile = extractor.config?.rawPagesFile;

      // Kör extraktion
      const extractedData = await extractor.extractFromCrawledData();

      // Spara extraherad data för denna restaurang
      await fs.writeFile(
        config.paths.extractedData,
        JSON.stringify(extractedData, null, 2),
        'utf-8'
      );

      this.logger.info(`Content extraction completed for ${config.slug}`, {
        totalPages: extractedData.content.length,
        menus: extractedData.menus.length,
        hours: extractedData.hours.length,
        contact: extractedData.contact.length
      });

      return extractedData;

    } finally {
      // Rensa temp-fil
      try {
        await fs.unlink(tempDataFile);
      } catch (error) {
        // Ignorera fel vid cleanup
      }
    }
  }

  /**
   * Normalisera och generera output-filer
   */
  async normalizeRestaurant(config, extractedData) {
    this.logger.info(`Normalizing restaurant data: ${config.slug}`);

    // Konvertera extraherad data till format som normalizer förväntar sig
    const rawData = this.convertToNormalizerFormat(config, extractedData);

    // Kör normalisering
    const result = await this.normalizer.normalizeRestaurant(rawData, config.slug);

    // Generera TXT-fil för Voice AI (ElevenLabs)
    await this.generateVoiceAIText(config, result);

    this.logger.info(`Normalization completed for ${config.slug}`, {
      infoValid: !!result.info,
      knowledgeItems: result.knowledge.length,
      reportLines: result.report.split('\\n').length
    });

    return result;
  }

  /**
   * Generera voice-ai.txt från knowledge.jsonl
   */
  async generateVoiceAIText(config, normalizedData) {
    this.logger.info(`Generating voice-ai.txt for ${config.slug}`);

    try {
      const converter = new JsonlToTxtConverter({
        restaurantName: config.name,
        location: config.city,
        inputFile: path.join(config.paths.output, 'knowledge.jsonl'),
        outputDir: config.paths.output
      });

      // Skapa voice-ai.txt direkt i restaurang-mappen
      const knowledgePath = path.join(config.paths.output, 'knowledge.jsonl');
      const txtPath = path.join(config.paths.output, 'voice-ai.txt');

      // Läs knowledge.jsonl
      const knowledgeContent = await fs.readFile(knowledgePath, 'utf-8');
      const knowledgeBase = knowledgeContent
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      // Konvertera till TXT
      const txtContent = this.buildVoiceAIText(config, knowledgeBase);

      // Spara
      await fs.writeFile(txtPath, txtContent, 'utf-8');

      this.logger.info(`Generated voice-ai.txt for ${config.slug}`, {
        path: txtPath,
        size: txtContent.length
      });

      return txtPath;
    } catch (error) {
      this.logger.error(`Failed to generate voice-ai.txt for ${config.slug}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Bygg TXT-innehåll för Voice AI
   */
  buildVoiceAIText(config, knowledgeBase) {
    const lines = [];

    // Header
    lines.push('╔════════════════════════════════════════════════════════════════════╗');
    lines.push('║                                                                    ║');
    lines.push(`║               ${config.name.toUpperCase()} - ${config.city.toUpperCase()}${' '.repeat(Math.max(0, 36 - config.name.length - config.city.length))}║`);
    lines.push('║                    VOICE AI KUNSKAPSBAS                            ║');
    lines.push('║                                                                    ║');
    lines.push('╚════════════════════════════════════════════════════════════════════╝');
    lines.push('');
    lines.push(`Uppdaterad: ${new Date().toLocaleString('sv-SE')}`);
    lines.push('');
    lines.push('Denna fil innehåller all information som Voice AI-systemet behöver för att');
    lines.push('kunna svara på kundfrågor om restaurangen.');
    lines.push('');
    lines.push('─'.repeat(72));
    lines.push('');

    // Gruppera efter typ/kategori
    const grouped = this.groupKnowledgeByCategory(knowledgeBase);

    // Q&A sektion
    if (grouped.qa && grouped.qa.length > 0) {
      lines.push('=== VANLIGA FRÅGOR OCH SVAR ===');
      lines.push('');
      grouped.qa.forEach(item => {
        lines.push(`FRÅGA: ${item.q}`);
        lines.push(`SVAR: ${item.a}`);
        if (item.tags && item.tags.length > 0) {
          lines.push(`Nyckelord: ${item.tags.join(', ')}`);
        }
        lines.push('');
      });
    }

    // Footer med instruktioner
    lines.push('─'.repeat(72));
    lines.push('');
    lines.push('=== INSTRUKTIONER FÖR VOICE AI ===');
    lines.push('');
    lines.push('När du svarar på kundfrågor:');
    lines.push('1. Var vänlig och professionell');
    lines.push('2. Använd informationen ovan som källa');
    lines.push('3. Om du inte hittar svaret, erbjud att koppla till personal');
    lines.push('4. Vid bokning, fråga alltid: datum, tid och antal gäster');
    lines.push('5. Vid allergifrågor, rekommendera alltid att prata med personalen');
    lines.push('');
    lines.push('Vid tekniska problem, kontakta systemadministratör.');
    lines.push('');
    lines.push('─'.repeat(72));

    return lines.join('\n');
  }

  /**
   * Gruppera knowledge base efter kategori
   */
  groupKnowledgeByCategory(knowledgeBase) {
    const grouped = {
      qa: [],
      fact: [],
      menu: [],
      other: []
    };

    knowledgeBase.forEach(item => {
      const type = item.type || 'qa';
      if (grouped[type]) {
        grouped[type].push(item);
      } else {
        grouped.other.push(item);
      }
    });

    return grouped;
  }

  /**
   * Konvertera extraherad data till normalizerformat
   */
  convertToNormalizerFormat(config, extractedData) {
    // Samla kontaktinfo
    const contact = extractedData.contact.length > 0 ? extractedData.contact[0].contact : {};

    // Samla öppettider
    const hours = extractedData.hours.length > 0 ? extractedData.hours[0].hours : null;

    // Samla menydata
    const menu = extractedData.menus.flatMap(m => m.items.map(item => ({
      title: item.title,
      description: item.description,
      price: item.price,
      category: 'allmän'
    })));

    // Bygg normalizer input-format
    return {
      name: config.name,
      brand: config.brand,
      city: config.city,
      address: contact.address,
      phone: contact.phone,
      email: contact.email,
      website: config.baseUrl,
      url: config.baseUrl,
      source_urls: [config.baseUrl],
      hours: hours,
      menu: menu,
      booking: {
        min_guests: 1,
        max_guests: 8,
        lead_time_minutes: 120,
        dining_duration_minutes: 120,
        group_overflow_rule: 'manual',
        cancellation_policy: 'Avbokning senast 2 timmar före bokad tid'
      },
      messages: []
    };
  }

  /**
   * Scrapa alla registrerade restauranger
   */
  async scrapeAllRestaurants() {
    const restaurants = multiConfig.getAllRestaurants();
    this.logger.info(`Starting multi-restaurant scrape`, {
      totalRestaurants: restaurants.length,
      restaurants: restaurants.map(r => r.slug)
    });

    const results = {
      successful: [],
      failed: [],
      total: restaurants.length,
      startTime: new Date().toISOString()
    };

    for (const restaurant of restaurants) {
      try {
        await this.scrapeRestaurant(restaurant.slug);
        results.successful.push(restaurant.slug);
      } catch (error) {
        results.failed.push({
          slug: restaurant.slug,
          error: error.message
        });
      }
    }

    // Generera global index
    if (results.successful.length > 0) {
      await this.normalizer.generateIndex();
    }

    results.endTime = new Date().toISOString();
    results.duration = new Date(results.endTime) - new Date(results.startTime);

    this.logger.info(`Multi-restaurant scrape completed`, {
      successful: results.successful.length,
      failed: results.failed.length,
      duration: `${Math.round(results.duration / 1000)}s`
    });

    return results;
  }

  /**
   * Hämta resultat för en restaurang
   */
  getResult(restaurantSlug) {
    return this.results.get(restaurantSlug);
  }

  /**
   * Hämta alla resultat
   */
  getAllResults() {
    return Object.fromEntries(this.results);
  }

  /**
   * Health check för multi-restaurant systemet
   */
  async healthCheck() {
    const restaurants = multiConfig.getAllRestaurants();

    const health = {
      status: 'healthy',
      restaurants: {
        total: restaurants.length,
        configured: restaurants.length,
        lastScrape: null
      },
      outputs: {
        indexExists: false,
        restaurantDirs: 0
      },
      timestamp: new Date().toISOString()
    };

    try {
      // Kontrollera index-fil
      const indexPath = path.join(this.config.outputDir, 'index.json');
      try {
        await fs.access(indexPath);
        health.outputs.indexExists = true;

        const indexData = JSON.parse(await fs.readFile(indexPath, 'utf-8'));
        health.restaurants.lastScrape = indexData.last_updated;
      } catch (error) {
        // Index existerar inte än
      }

      // Räkna restaurang-mappar
      try {
        const entries = await fs.readdir(this.config.outputDir, { withFileTypes: true });
        health.outputs.restaurantDirs = entries.filter(entry => entry.isDirectory()).length;
      } catch (error) {
        // Output-mapp existerar inte än
      }

    } catch (error) {
      health.status = 'degraded';
      health.error = error.message;
    }

    return health;
  }
}