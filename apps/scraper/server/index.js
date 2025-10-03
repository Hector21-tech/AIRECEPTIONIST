#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { protectedRoute, protectedRestaurantRoute, optionalAuth } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Data directory
const DATA_DIR = path.join(__dirname, '..', 'restaurants');

/**
 * GET /api/restaurants
 * Lista alla restauranger (eller endast tenant's restauranger om autentiserad)
 */
app.get('/api/restaurants', optionalAuth, async (req, res) => {
  try {
    const indexPath = path.join(DATA_DIR, 'index.json');
    const indexData = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(indexData);

    let restaurants = index.restaurants;

    // If authenticated, filter to only tenant's restaurants
    if (req.tenant) {
      const { TenantManager } = await import('../src/tenant/tenant-manager.js');
      const tenantManager = new TenantManager();
      const tenantRestaurants = tenantManager.getTenantRestaurants(req.tenant.id);
      const tenantSlugs = new Set(tenantRestaurants.map(r => r.restaurant_slug));

      restaurants = restaurants.filter(r => tenantSlugs.has(r.slug));
    }

    res.json({
      success: true,
      data: restaurants,
      total: restaurants.length,
      lastUpdated: index.last_updated,
      tenant: req.tenant ? req.tenant.name : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load restaurants',
      message: error.message
    });
  }
});

/**
 * GET /api/restaurants/:slug
 * Hämta en specifik restaurang (kräver autentisering och access)
 */
app.get('/api/restaurants/:slug', protectedRestaurantRoute, async (req, res) => {
  try {
    const { slug } = req.params;
    const infoPath = path.join(DATA_DIR, slug, 'info.json');
    const infoData = await fs.readFile(infoPath, 'utf-8');
    const info = JSON.parse(infoData);

    res.json({
      success: true,
      data: info
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Restaurant not found',
      message: error.message
    });
  }
});

/**
 * GET /api/restaurants/:slug/knowledge
 * Hämta knowledge base (JSONL)
 */
app.get('/api/restaurants/:slug/knowledge', protectedRestaurantRoute, async (req, res) => {
  try {
    const { slug } = req.params;
    const knowledgePath = path.join(DATA_DIR, slug, 'knowledge.jsonl');
    const knowledgeData = await fs.readFile(knowledgePath, 'utf-8');

    const knowledge = knowledgeData
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    res.json({
      success: true,
      data: knowledge,
      total: knowledge.length
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Knowledge base not found',
      message: error.message
    });
  }
});

/**
 * GET /api/restaurants/:slug/voice-ai
 * Hämta Voice AI text
 */
app.get('/api/restaurants/:slug/voice-ai', protectedRestaurantRoute, async (req, res) => {
  try {
    const { slug } = req.params;
    const txtPath = path.join(DATA_DIR, slug, 'voice-ai.txt');
    const txtData = await fs.readFile(txtPath, 'utf-8');

    res.type('text/plain').send(txtData);
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Voice AI text not found',
      message: error.message
    });
  }
});

/**
 * GET /api/restaurants/:slug/report
 * Hämta rapport
 */
app.get('/api/restaurants/:slug/report', protectedRestaurantRoute, async (req, res) => {
  try {
    const { slug } = req.params;
    const reportPath = path.join(DATA_DIR, slug, 'report.txt');
    const reportData = await fs.readFile(reportPath, 'utf-8');

    res.type('text/plain').send(reportData);
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Report not found',
      message: error.message
    });
  }
});

/**
 * POST /api/restaurants/:slug/scrape
 * Trigga scrape för en restaurang
 */
app.post('/api/restaurants/:slug/scrape', protectedRestaurantRoute, async (req, res) => {
  try {
    const { slug } = req.params;
    const { syncToElevenLabs = true } = req.body;

    // Import multi-scraper
    const { MultiScraper } = await import('../src/multi-restaurant/multi-scraper.js');
    const { multiConfig } = await import('../src/multi-restaurant/config.js');

    const scraper = new MultiScraper();

    // Starta scrape i bakgrunden
    scraper.scrapeRestaurant(slug, { syncToElevenLabs })
      .then(result => {
        console.log(`✅ Scrape completed for ${slug}`);
      })
      .catch(error => {
        console.error(`❌ Scrape failed for ${slug}:`, error.message);
      });

    res.json({
      success: true,
      message: `Scrape started for ${slug}`,
      slug
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to start scrape',
      message: error.message
    });
  }
});

/**
 * POST /api/scrape-all
 * Trigga scrape för alla restauranger (endast tenant's restauranger om autentiserad)
 */
app.post('/api/scrape-all', protectedRoute, async (req, res) => {
  try {
    const { syncToElevenLabs = true } = req.body;

    // Import multi-scraper
    const { MultiScraper } = await import('../src/multi-restaurant/multi-scraper.js');
    const { TenantManager } = await import('../src/tenant/tenant-manager.js');

    const scraper = new MultiScraper();
    const tenantManager = new TenantManager();

    // Get tenant's restaurants
    const tenantRestaurants = tenantManager.getTenantRestaurants(req.tenant.id);
    const restaurantSlugs = tenantRestaurants.map(r => r.restaurant_slug);

    if (restaurantSlugs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No restaurants linked to your account'
      });
    }

    // Starta scrape för varje tenant's restaurant i bakgrunden
    Promise.all(restaurantSlugs.map(slug =>
      scraper.scrapeRestaurant(slug, { syncToElevenLabs })
    ))
      .then(results => {
        console.log(`✅ Scrape-all completed for tenant ${req.tenant.name}: ${results.length} restaurants`);
      })
      .catch(error => {
        console.error(`❌ Scrape-all failed for tenant ${req.tenant.name}:`, error.message);
      });

    res.json({
      success: true,
      message: `Scrape started for ${restaurantSlugs.length} restaurants`,
      restaurants: restaurantSlugs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to start scrape-all',
      message: error.message
    });
  }
});

/**
 * POST /api/restaurants/:slug/sync-elevenlabs
 * Synka till ElevenLabs
 */
app.post('/api/restaurants/:slug/sync-elevenlabs', protectedRestaurantRoute, async (req, res) => {
  try {
    const { slug } = req.params;

    // Import elevenlabs sync
    const { ElevenLabsSync } = await import('../src/elevenlabs-sync.js');

    const sync = new ElevenLabsSync();

    // Läs restaurang info
    const infoPath = path.join(DATA_DIR, slug, 'info.json');
    const infoData = await fs.readFile(infoPath, 'utf-8');
    const info = JSON.parse(infoData);

    const restaurantPath = path.join(DATA_DIR, slug);
    const result = await sync.syncRestaurant(restaurantPath, info.name, info.city);

    res.json({
      success: true,
      data: result,
      message: `Successfully synced ${info.name} to ElevenLabs`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to sync to ElevenLabs',
      message: error.message
    });
  }
});

/**
 * POST /api/sync-elevenlabs-all
 * Synka alla tenant's restauranger till ElevenLabs
 */
app.post('/api/sync-elevenlabs-all', protectedRoute, async (req, res) => {
  try {
    // Import elevenlabs sync
    const { ElevenLabsSync } = await import('../src/elevenlabs-sync.js');
    const { TenantManager } = await import('../src/tenant/tenant-manager.js');

    const sync = new ElevenLabsSync();
    const tenantManager = new TenantManager();

    // Get tenant's restaurants
    const tenantRestaurants = tenantManager.getTenantRestaurants(req.tenant.id);

    if (tenantRestaurants.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No restaurants linked to your account'
      });
    }

    // Sync each restaurant
    const results = {
      successful: [],
      failed: [],
      total: tenantRestaurants.length
    };

    for (const restaurant of tenantRestaurants) {
      try {
        const infoPath = path.join(DATA_DIR, restaurant.restaurant_slug, 'info.json');
        const infoData = await fs.readFile(infoPath, 'utf-8');
        const info = JSON.parse(infoData);

        const restaurantPath = path.join(DATA_DIR, restaurant.restaurant_slug);
        const result = await sync.syncRestaurant(restaurantPath, info.name, info.city);

        results.successful.push({
          slug: restaurant.restaurant_slug,
          name: info.name,
          documentId: result.documentId
        });
      } catch (error) {
        results.failed.push({
          slug: restaurant.restaurant_slug,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: results,
      message: `Synced ${results.successful.length}/${results.total} restaurants to ElevenLabs`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to sync all to ElevenLabs',
      message: error.message
    });
  }
});

/**
 * GET /health
 * Health check
 */
app.get('/health', async (req, res) => {
  try {
    const indexPath = path.join(DATA_DIR, 'index.json');
    const indexExists = await fs.access(indexPath).then(() => true).catch(() => false);

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      dataDirectory: DATA_DIR,
      indexExists
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Restaurant Scraper API Server`);
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log(`📁 Data directory: ${DATA_DIR}`);
  console.log('');
  console.log('API Endpoints:');
  console.log(`  GET    /api/restaurants              - List all restaurants`);
  console.log(`  GET    /api/restaurants/:slug        - Get restaurant info`);
  console.log(`  GET    /api/restaurants/:slug/knowledge - Get knowledge base`);
  console.log(`  GET    /api/restaurants/:slug/voice-ai - Get Voice AI text`);
  console.log(`  GET    /api/restaurants/:slug/report  - Get scrape report`);
  console.log(`  POST   /api/restaurants/:slug/scrape  - Trigger scrape`);
  console.log(`  POST   /api/scrape-all                - Scrape all restaurants`);
  console.log(`  POST   /api/restaurants/:slug/sync-elevenlabs - Sync to ElevenLabs`);
  console.log(`  POST   /api/sync-elevenlabs-all       - Sync all to ElevenLabs`);
  console.log(`  GET    /health                        - Health check`);
  console.log('');
  console.log(`📊 Admin dashboard: http://localhost:${PORT}/`);
});
