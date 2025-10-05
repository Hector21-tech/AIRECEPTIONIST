import express from 'express';
import postgres from 'postgres';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { ElevenLabsSync } from '../src/elevenlabs-sync.js';

const router = express.Router();

// Database connection
const sql = postgres(process.env.POSTGRES_URL);

/**
 * Calculate SHA256 hash of content
 */
function calculateHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Check if content has changed
 */
function hasContentChanged(newContent, oldHash) {
  if (!oldHash) return true;
  const newHash = calculateHash(newContent);
  return newHash !== oldHash;
}

/**
 * Extract dagens section from voice-ai content
 */
function extractDagensSection(content) {
  const dagensRegex = /##\s*dagens.*?\n([\s\S]*?)(?=##|$)/i;
  const match = content.match(dagensRegex);

  if (match && match[1]) {
    return `## Dagens Special\n${match[1].trim()}`;
  }

  return content;
}

/**
 * GET /api/cron/update-restaurants
 *
 * Cron endpoint för automatiska KB-uppdateringar
 * Körs av GitHub Actions enligt schema
 */
router.get('/update-restaurants', async (req, res) => {
  const startTime = Date.now();

  try {
    // Verify CRON_SECRET
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hourParam = req.query.hour;
    const currentHour = hourParam ? parseInt(hourParam, 10) : new Date().getHours();
    const currentDay = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.

    console.log(`\n🕐 Starting cron job for hour ${currentHour}`);
    console.log(`📅 Current day: ${currentDay} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][currentDay]})`);

    // Build time filter for customers
    const timeFilter = `${currentHour.toString().padStart(2, '0')}:00`;

    // Find customers that should be updated
    const customersToUpdate = await sql`
      SELECT * FROM customers
      WHERE (
        (update_frequency = 'daily' AND daily_update_time = ${timeFilter})
        OR
        (update_frequency = 'weekly' AND daily_update_time = ${timeFilter})
      )
      AND website_url IS NOT NULL
      AND knowledge_base_id IS NOT NULL
      AND restaurant_slug IS NOT NULL
    `;

    // Filter weekly updates to only run on Monday
    const filteredCustomers = customersToUpdate.filter(customer => {
      if (customer.update_frequency === 'weekly' && currentDay !== 1) {
        return false; // Skip weekly updates if not Monday
      }
      return true;
    });

    console.log(`📋 Found ${filteredCustomers.length} customers to update`);

    const results = {
      total: filteredCustomers.length,
      success: [],
      failed: [],
      skipped: [],
      startTime: new Date().toISOString(),
    };

    // Process each customer
    for (const customer of filteredCustomers) {
      console.log(`\n🔄 Processing: ${customer.name}`);

      try {
        // Step 1: Read dagens content from scraped data
        const restaurantPath = path.join(process.cwd(), 'restaurants', customer.restaurant_slug);
        const voiceAiPath = path.join(restaurantPath, 'voice-ai.txt');

        let dagensContent;
        try {
          const content = await fs.readFile(voiceAiPath, 'utf-8');
          dagensContent = extractDagensSection(content);
        } catch (error) {
          console.log(`   ⚠️  No scraped data found, skipping...`);
          results.skipped.push({
            id: customer.id,
            name: customer.name,
            reason: 'No scraped data available'
          });
          continue;
        }

        if (!dagensContent || dagensContent.trim().length === 0) {
          results.skipped.push({
            id: customer.id,
            name: customer.name,
            reason: 'No dagens content found'
          });
          console.log(`   ⏭️  Skipped: No dagens content`);
          continue;
        }

        // Step 2: Check if content changed
        const newHash = calculateHash(dagensContent);
        const contentHasChanged = hasContentChanged(dagensContent, customer.last_daily_hash);

        console.log(`   Hash changed: ${contentHasChanged ? 'YES ✅' : 'NO ❌'}`);

        if (!contentHasChanged) {
          results.skipped.push({
            id: customer.id,
            name: customer.name,
            reason: 'Content unchanged'
          });
          console.log(`   ⏭️  Skipped: Content unchanged`);
          continue;
        }

        // Step 3: Add document to KB
        const today = new Date().toISOString().split('T')[0];
        const documentName = `${customer.name} - Dagens ${today}`;

        const sync = new ElevenLabsSync({
          apiKey: customer.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY
        });

        const kbResult = await sync.addDocumentToKB(
          customer.knowledge_base_id,
          dagensContent,
          documentName
        );

        // Step 4: Update database
        await sql`
          UPDATE customers
          SET
            last_daily_hash = ${newHash},
            last_update_date = NOW()
          WHERE id = ${customer.id}
        `;

        results.success.push({
          id: customer.id,
          name: customer.name,
          documentId: kbResult.id,
          documentName,
          oldHash: customer.last_daily_hash?.substring(0, 8),
          newHash: newHash.substring(0, 8),
        });

        console.log(`   ✅ Success: Document added`);

      } catch (error) {
        results.failed.push({
          id: customer.id,
          name: customer.name,
          error: error.message
        });

        console.error(`   ❌ Failed: ${error.message}`);
      }
    }

    const duration = Date.now() - startTime;
    const endTime = new Date().toISOString();

    console.log(`\n📊 Cron job completed in ${duration}ms`);
    console.log(`   ✅ Success: ${results.success.length}`);
    console.log(`   ❌ Failed: ${results.failed.length}`);
    console.log(`   ⏭️  Skipped: ${results.skipped.length}\n`);

    res.json({
      success: true,
      message: `Processed ${results.total} customers`,
      results: {
        ...results,
        endTime,
        duration: `${duration}ms`
      }
    });

  } catch (error) {
    console.error('❌ Cron job error:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      duration: `${Date.now() - startTime}ms`
    });
  }
});

export default router;
