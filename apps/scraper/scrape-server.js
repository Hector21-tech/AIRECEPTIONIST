#!/usr/bin/env node

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import slugify from 'slugify';
import { AutoScraper } from './src/auto-scraper.js';
import { ElevenLabsSync } from './src/elevenlabs-sync.js';
import { convertKnowledgeToVoiceAI } from './src/knowledge-converter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * POST /api/scrape-url
 * Scrapa en ny restaurang från URL
 */
app.post('/api/scrape-url', async (req, res) => {
  try {
    const { url, name, syncToElevenLabs = true } = req.body;

    if (!url || !name) {
      return res.status(400).json({
        success: false,
        error: 'URL och namn krävs'
      });
    }

    console.log(`🚀 Starting scrape for: ${name} (${url})`);

    // Generera slug från namnet
    const slug = slugify(name, { lower: true, strict: true });

    const scraper = new AutoScraper();

    // Starta scrape i bakgrunden
    scraper.scrapeUrl(url)
      .then(async result => {
        console.log(`✅ Auto-scrape completed for ${name}: ${result.slug || slug}`);

        const restaurantPath = path.join(__dirname, 'restaurants', result.slug || slug);

        // Konvertera knowledge.jsonl till voice-ai.txt
        try {
          await convertKnowledgeToVoiceAI(restaurantPath);
        } catch (err) {
          console.warn(`⚠️  Could not create voice-ai.txt: ${err.message}`);
        }

        // Synka till ElevenLabs om önskat
        if (syncToElevenLabs) {
          const sync = new ElevenLabsSync();
          sync.syncRestaurant(restaurantPath, result.name || name, result.city || 'N/A')
            .then(() => console.log(`✅ Synced ${name} to ElevenLabs`))
            .catch(err => console.error(`❌ ElevenLabs sync failed:`, err.message));
        }
      })
      .catch(error => {
        console.error(`❌ Auto-scrape failed for ${name}:`, error.message);
      });

    res.json({
      success: true,
      message: `Scraping startad för ${name}`,
      slug,
      url
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
 * GET /health
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Scrape Server`);
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log('');
  console.log('API Endpoints:');
  console.log(`  POST   /api/scrape-url  - Scrape a new restaurant`);
  console.log(`  GET    /health          - Health check`);
  console.log('');
  console.log(`📊 Open scraper-ui-new.html in your browser to scrape restaurants`);
});
