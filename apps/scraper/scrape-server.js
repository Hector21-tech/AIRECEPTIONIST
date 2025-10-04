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
const PORT = process.env.PORT || 4001;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * POST /api/scrape-url
 * Scrapa en ny restaurang från URL
 */
app.post('/api/scrape-url', async (req, res) => {
  try {
    const { url, name, slug: providedSlug, syncToElevenLabs = true } = req.body;

    if (!url || !name) {
      return res.status(400).json({
        success: false,
        error: 'URL och namn krävs'
      });
    }

    console.log(`🚀 Starting scrape for: ${name} (${url})`);

    // Använd slug från request eller generera ett nytt
    const slug = providedSlug || slugify(name, { lower: true, strict: true });
    console.log(`📋 Using slug: ${slug}${providedSlug ? ' (provided)' : ' (generated)'}`);

    const scraper = new AutoScraper();

    // Starta scrape i bakgrunden med slug
    scraper.scrapeUrl(url, slug)
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
          const fs = await import('fs/promises');
          sync.syncRestaurant(restaurantPath, result.name || name, result.city || 'N/A')
            .then(async (syncResult) => {
              console.log(`✅ Synced ${name} to ElevenLabs`);
              console.log(`   Knowledge Base ID: ${syncResult.documentId}`);

              // Save knowledge_base_id to info.json (local only)
              try {
                const infoPath = path.join(restaurantPath, 'info.json');
                const infoContent = await fs.readFile(infoPath, 'utf-8');
                const info = JSON.parse(infoContent);
                info.knowledgeBaseId = syncResult.documentId;
                await fs.writeFile(infoPath, JSON.stringify(info, null, 2));
                console.log(`   ✅ Saved knowledge_base_id to info.json`);
              } catch (err) {
                console.error(`   ⚠️  Failed to save knowledge_base_id:`, err.message);
              }

              // Update database via Next.js API
              const nextApiUrl = process.env.NEXT_API_URL;
              const apiSecret = process.env.SCRAPER_API_SECRET;

              if (nextApiUrl && apiSecret) {
                try {
                  const updateResponse = await fetch(`${nextApiUrl}/api/scraper/update-kb`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-api-secret': apiSecret,
                    },
                    body: JSON.stringify({
                      restaurantSlug: result.slug || slug,
                      knowledgeBaseId: syncResult.documentId,
                    }),
                  });

                  if (updateResponse.ok) {
                    const updateResult = await updateResponse.json();
                    console.log(`   ✅ Updated database for customer: ${updateResult.customerName}`);
                  } else {
                    const errorData = await updateResponse.json();
                    console.error(`   ⚠️  Failed to update database:`, errorData.error);
                  }
                } catch (err) {
                  console.error(`   ⚠️  Failed to call Next.js API:`, err.message);
                }
              } else {
                console.warn(`   ⚠️  NEXT_API_URL or SCRAPER_API_SECRET not set - database not updated`);
              }
            })
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
 * GET /api/restaurant/:slug/info
 * Get restaurant info including knowledge base ID
 */
app.get('/api/restaurant/:slug/info', async (req, res) => {
  try {
    const { slug } = req.params;
    const fs = await import('fs/promises');

    const restaurantPath = path.join(__dirname, 'restaurants', slug);
    const infoPath = path.join(restaurantPath, 'info.json');

    try {
      const infoContent = await fs.readFile(infoPath, 'utf-8');
      const info = JSON.parse(infoContent);

      res.json({
        success: true,
        slug,
        name: info.name,
        city: info.city,
        knowledgeBaseId: info.knowledgeBaseId || null
      });
    } catch (err) {
      res.status(404).json({
        success: false,
        error: 'Restaurant not found or info not available yet'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
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
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Scrape Server`);
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log('');
  console.log('API Endpoints:');
  console.log(`  POST   /api/scrape-url  - Scrape a new restaurant`);
  console.log(`  GET    /health          - Health check`);
  console.log('');
  console.log(`📊 Open scraper-ui-new.html in your browser to scrape restaurants`);
});
