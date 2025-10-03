/**
 * Simple health check and monitoring API
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { HealthChecker } from '../utils/health-checker.js';
import { Logger } from '../utils/logger.js';
import { config } from '../config.js';
import fs from 'fs/promises';

export class HealthAPI {
  constructor(port = 3001) {
    this.app = express();
    this.port = port;
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    this.healthChecker = new HealthChecker();
    this.logger = new Logger('HealthAPI');
    this.sessionData = new Map();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());

    // Serve static files from public directory
    this.app.use(express.static('public'));

    // Logging middleware
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const healthCheck = await this.healthChecker.performHealthCheck();
        const statusCode = healthCheck.overall === 'healthy' ? 200 :
                          healthCheck.overall === 'degraded' ? 202 : 503;

        res.status(statusCode).json(healthCheck);
      } catch (error) {
        this.logger.error('Health check endpoint error', { error: error.message });
        res.status(500).json({
          error: 'Health check failed',
          message: error.message
        });
      }
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.healthChecker.getMetrics();
        res.json(metrics);
      } catch (error) {
        this.logger.error('Metrics endpoint error', { error: error.message });
        res.status(500).json({
          error: 'Metrics collection failed',
          message: error.message
        });
      }
    });

    // Status endpoint (simple up/down)
    this.app.get('/status', (req, res) => {
      res.json({
        status: 'up',
        timestamp: new Date().toISOString(),
        service: 'torstens-voice-ai-scraper'
      });
    });

    // Knowledge base stats
    this.app.get('/knowledge/stats', async (req, res) => {
      try {
        const stats = await this.healthChecker.checkKnowledgeBase();
        res.json(stats);
      } catch (error) {
        this.logger.error('Knowledge stats endpoint error', { error: error.message });
        res.status(500).json({
          error: 'Could not retrieve knowledge base stats',
          message: error.message
        });
      }
    });

    // Knowledge base search (simple)
    this.app.get('/knowledge/search', async (req, res) => {
      const { q, type } = req.query;

      if (!q) {
        return res.status(400).json({
          error: 'Query parameter "q" is required'
        });
      }

      try {
        const knowledgeData = await fs.readFile(config.knowledgeBasePath, 'utf-8');
        const lines = knowledgeData.split('\n').filter(line => line.trim());
        const entries = lines.map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        }).filter(Boolean);

        const results = entries.filter(entry => {
          if (type && entry.type !== type) return false;

          const searchText = [
            entry.q || '',
            entry.a || '',
            entry.text || '',
            ...(entry.tags || [])
          ].join(' ').toLowerCase();

          return searchText.includes(q.toLowerCase());
        });

        res.json({
          query: q,
          type: type || 'all',
          results: results.slice(0, 10), // Limit to 10 results
          totalFound: results.length
        });

      } catch (error) {
        this.logger.error('Knowledge search endpoint error', { error: error.message });
        res.status(500).json({
          error: 'Search failed',
          message: error.message
        });
      }
    });

    // Configuration info
    this.app.get('/config', (req, res) => {
      res.json({
        baseUrl: config.baseUrl,
        crawlDelay: config.crawlDelayMs,
        maxRetries: config.maxRetries,
        concurrency: config.maxConcurrentRequests,
        schedule: config.cronSchedule,
        knowledgeBasePath: config.knowledgeBasePath,
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // API endpoints for web scraping
    this.app.post('/api/scrape-single', async (req, res) => {
      try {
        const { url, extractionType } = req.body;

        if (!url) {
          return res.status(400).json({ error: 'URL is required' });
        }

        this.logger.info('Single URL scraping requested', { url, extractionType });

        // Import modules dynamically to avoid circular dependencies
        const { TorstensCrawler } = await import('../crawler.js');
        const { ContentExtractor } = await import('../extractor.js');
        const { KnowledgeBuilder } = await import('../knowledge-builder.js');

        // Step 1: Crawl the single URL
        const crawler = new TorstensCrawler();
        const crawledData = await crawler.crawlPage(url);

        if (crawledData.failed) {
          return res.status(400).json({
            error: 'Failed to crawl URL',
            details: crawledData.error
          });
        }

        // Step 2: Extract content
        const extractor = new ContentExtractor();
        const extractedContent = extractor.extractTextFromHtml(crawledData.html);

        // Step 3: Generate Voice AI data based on extraction type
        let result = {
          url,
          extractionType,
          crawledAt: crawledData.crawledAt,
          extractedContent: {
            title: extractedContent.title,
            mainText: extractedContent.mainText,
            menuItems: extractedContent.menuItems,
            prices: extractedContent.prices
          }
        };

        if (extractionType === 'voice-ai' || extractionType === 'all') {
          // Generate FAQ and knowledge base entries
          const knowledgeBuilder = new KnowledgeBuilder();

          // Create mock extracted data structure
          const mockData = {
            content: [{
              url,
              title: extractedContent.title,
              mainText: extractedContent.mainText,
              menuItems: extractedContent.menuItems,
              allergens: extractor.extractAllergens(extractedContent.mainText)
            }],
            menus: extractedContent.menuItems.length > 0 ? [{
              source: url,
              items: extractedContent.menuItems
            }] : [],
            contact: [],
            hours: []
          };

          // Extract contact and hours if available
          const contact = extractor.extractContact(extractedContent.mainText);
          const hours = extractor.extractHours(extractedContent.mainText);

          if (contact) {
            mockData.contact.push({ source: url, contact });
          }
          if (hours) {
            mockData.hours.push({ source: url, hours });
          }

          // Generate FAQ
          const faqs = knowledgeBuilder.generateFAQs(mockData);

          // Create knowledge base entries
          const knowledgeBase = [];
          faqs.forEach(faq => {
            knowledgeBase.push({
              id: knowledgeBuilder.generateId(faq.q, 'faq'),
              type: 'qa',
              q: faq.q,
              a: faq.a,
              tags: faq.tags || [],
              priority: faq.priority || 'medium'
            });
          });

          result.knowledgeBase = knowledgeBase;
        }

        res.json(result);

      } catch (error) {
        this.logger.error('Scrape single URL error', {
          error: error.message,
          stack: error.stack
        });
        res.status(500).json({
          error: 'Scraping failed',
          message: error.message
        });
      }
    });

    // Full system update endpoint
    this.app.post('/api/full-update', async (req, res) => {
      try {
        this.logger.info('Full update requested via API');

        const { AutomationScheduler } = await import('../scheduler.js');
        const scheduler = new AutomationScheduler();

        const result = await scheduler.runFullUpdate();
        res.json(result);

      } catch (error) {
        this.logger.error('Full update API error', { error: error.message });
        res.status(500).json({
          error: 'Full update failed',
          message: error.message
        });
      }
    });

    // System status endpoint
    this.app.post('/api/status', async (req, res) => {
      try {
        const healthCheck = await this.healthChecker.performHealthCheck();
        res.json(healthCheck);
      } catch (error) {
        res.status(500).json({
          error: 'Status check failed',
          message: error.message
        });
      }
    });

    // Presets endpoint for web interface - now generic
    this.app.get('/api/presets', (req, res) => {
      const presets = {
        'custom': {
          name: 'Anpassad URL',
          urls: []
        }
      };
      res.json(presets);
    });

    // Web scraping endpoint for the interface - NEW AUTO-SCRAPER VERSION
    this.app.post('/api/scrape', async (req, res) => {
      try {
        const { urls, location, type } = req.body;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
          return res.status(400).json({ error: 'URLs are required' });
        }

        const firstUrl = urls[0];
        this.logger.info('Auto-scraping requested from web interface', { url: firstUrl, location, type });

        // Emit progress updates via Socket.IO
        this.io.emit('progress', {
          status: 'starting',
          message: 'Startar auto-scraping...'
        });

        // Import the new AutoScraper
        const { AutoScraper } = await import('../auto-scraper.js');

        // Create AutoScraper with progress callback for Socket.IO updates
        const autoScraper = new AutoScraper((progress) => {
          this.io.emit('progress', progress);
        });

        // Run the auto-scraper with full multi-location support
        const result = await autoScraper.scrapeUrl(firstUrl);

        // Return result for web interface (compatible format)
        const sessionId = Date.now().toString();
        const knowledgeBase = result.knowledge.map(item => ({
          id: item.id,
          type: 'qa',
          q: item.question,
          a: item.answer,
          tags: item.tags || [],
          location: item.location
        }));

        // Calculate total words for display
        const totalWords = knowledgeBase.reduce((total, item) => {
          return total + (item.q?.split(' ').length || 0) + (item.a?.split(' ').length || 0);
        }, 0);

        const responseData = {
          sessionId: sessionId,
          restaurant: {
            slug: result.slug,
            name: result.info.name,
            directory: `restaurants/${result.slug}/`
          },
          stats: {
            pages: 1,
            knowledge: knowledgeBase.length,
            contacts: result.info.phone ? 1 : 0,
            menus: result.info.menu?.length || 0,
            words: totalWords
          },
          extractedContent: {
            title: result.info.name,
            mainText: `Auto-generated content for ${result.info.name}`,
            menuItems: result.info.menu || [],
            contact: result.info.phone || result.info.email ? {
              phone: result.info.phone,
              email: result.info.email,
              address: result.info.address
            } : null
          },
          knowledgeBase: knowledgeBase,
          files: {
            info: `restaurants/${result.slug}/info.json`,
            knowledge: `restaurants/${result.slug}/knowledge.jsonl`,
            report: `restaurants/${result.slug}/report.txt`
          },
          url: firstUrl
        };

        res.json(responseData);

      } catch (error) {
        this.logger.error('Web scraping error', {
          error: error.message,
          stack: error.stack
        });
        res.status(500).json({
          error: 'Scraping failed',
          message: error.message
        });
      }
    });


    // Download endpoint for web interface
    this.app.get('/api/download/:sessionId/:type', async (req, res) => {
      try {
        const { sessionId, type } = req.params;

        this.logger.info(`Download requested`, { sessionId, type });

        // First try to get from session data
        let sessionResult = this.sessionData.get(sessionId);

        // If not in memory, try to read from temp files
        if (!sessionResult) {
          try {
            const dataPath = `temp/${sessionId}_data.json`;
            const dataContent = await fs.readFile(dataPath, 'utf-8');
            sessionResult = JSON.parse(dataContent);
            this.logger.info(`Loaded session data from file`, { sessionId });
          } catch (fileError) {
            this.logger.warn(`Session file not found`, { sessionId, error: fileError.message });
          }
        }

        if (type === 'knowledge') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="scraped-knowledge-${sessionId}.jsonl"`);

          if (sessionResult && sessionResult.knowledgeBase && sessionResult.knowledgeBase.length > 0) {
            res.send(sessionResult.knowledgeBase.map(item => JSON.stringify(item)).join('\n'));
          } else {
            // Try to read from JSONL file
            try {
              const knowledgePath = `temp/${sessionId}_knowledge.jsonl`;
              const knowledgeContent = await fs.readFile(knowledgePath, 'utf-8');
              res.send(knowledgeContent);
            } catch (fileError) {
              res.status(404).json({
                error: 'Knowledge data not found',
                message: `Session ${sessionId} not found or expired`,
                sessionId
              });
            }
          }
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="scraped-data-${sessionId}.json"`);

          if (sessionResult) {
            res.json(sessionResult);
          } else {
            res.status(404).json({
              error: 'Session data not found',
              message: `Session ${sessionId} not found or expired`,
              sessionId,
              type
            });
          }
        }
      } catch (error) {
        this.logger.error('Download error', { error: error.message });
        res.status(500).json({
          error: 'Download failed',
          message: error.message
        });
      }
    });


    // Root endpoint - serve web interface
    this.app.get('/', (req, res) => {
      res.sendFile('voice-ai-scraper.html', { root: 'public' });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
      });
    });
  }

  setupSocketIO() {
    this.io.on('connection', (socket) => {
      this.logger.info('Client connected', { socketId: socket.id });

      socket.on('disconnect', () => {
        this.logger.info('Client disconnected', { socketId: socket.id });
      });
    });
  }

  async start() {
    const ports = [this.port, 3006, 3007, 3008, 3009, 3010];

    for (const tryPort of ports) {
      try {
        await new Promise((resolve, reject) => {
          this.server.listen(tryPort, () => {
            this.port = tryPort; // Update the port to the one that worked
            this.logger.info(`Health API server started on port ${this.port}`);
            resolve();
          });

          this.server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
              reject(error);
            } else {
              this.logger.error('Health API server error', { error: error.message });
              reject(error);
            }
          });
        });

        // If we get here, the server started successfully
        break;

      } catch (error) {
        if (error.code !== 'EADDRINUSE') {
          this.logger.error('Failed to start Health API server', {
            error: error.message,
            port: tryPort
          });
          throw error;
        }
        // Continue to next port if this one is in use
        continue;
      }
    }

    if (!this.server || !this.server.listening) {
      throw new Error('Could not find available port for Health API');
    }

    try {
      // Perform initial health check
      const initialHealth = await this.healthChecker.performHealthCheck();
      await this.healthChecker.saveHealthCheck(initialHealth);

      this.logger.info('Health API ready', {
        port: this.port,
        initialStatus: initialHealth.overall,
        endpoints: 6
      });

    } catch (error) {
      this.logger.error('Failed to complete Health API initialization', {
        error: error.message
      });
      throw error;
    }
  }

  async stop() {
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(() => {
          this.logger.info('Health API server stopped');
          resolve();
        });
      });
    }
  }
}