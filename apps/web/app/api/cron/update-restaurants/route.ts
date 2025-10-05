import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { customers } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { calculateHash, hasContentChanged } from '@/lib/utils/hash';

export const dynamic = 'force-dynamic';

/**
 * Cron endpoint för automatiska KB-uppdateringar
 *
 * GET /api/cron/update-restaurants?hour=6
 *
 * Detta endpoint körs av Vercel/Railway Cron enligt schema.
 * Det uppdaterar alla restauranger som matchar:
 * - updateFrequency = 'daily' OCH dailyUpdateTime matchar nuvarande timme
 * - updateFrequency = 'weekly' OCH idag är måndag OCH dailyUpdateTime matchar
 *
 * Returnerar: Sammanfattning av uppdateringar (success, failed, skipped)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Optional: Verify cron secret för säkerhet
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const hourParam = searchParams.get('hour');

    const currentHour = hourParam ? parseInt(hourParam, 10) : new Date().getHours();
    const currentDay = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.

    console.log(`\n🕐 Starting cron job for hour ${currentHour}`);
    console.log(`📅 Current day: ${currentDay} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][currentDay]})`);

    // Build time filter for customers
    const timeFilter = `${currentHour.toString().padStart(2, '0')}:00`;

    // Find customers that should be updated
    const customersToUpdate = await db
      .select()
      .from(customers)
      .where(
        and(
          or(
            // Daily updates at specified time
            and(
              eq(customers.updateFrequency, 'daily'),
              eq(customers.dailyUpdateTime, timeFilter)
            ),
            // Weekly updates on Monday at specified time
            and(
              eq(customers.updateFrequency, 'weekly'),
              eq(customers.dailyUpdateTime, timeFilter)
            )
          ),
          // Must have required data
          eq(customers.websiteUrl, customers.websiteUrl), // Not null check
        )
      );

    // Filter weekly updates to only run on Monday
    const filteredCustomers = customersToUpdate.filter(customer => {
      if (customer.updateFrequency === 'weekly' && currentDay !== 1) {
        return false; // Skip weekly updates if not Monday
      }
      return customer.knowledgeBaseId && customer.restaurantSlug && customer.websiteUrl;
    });

    console.log(`📋 Found ${filteredCustomers.length} customers to update`);

    const results = {
      total: filteredCustomers.length,
      success: [] as any[],
      failed: [] as any[],
      skipped: [] as any[],
      startTime: new Date().toISOString(),
    };

    // Process each customer
    for (const customer of filteredCustomers) {
      console.log(`\n🔄 Processing: ${customer.name}`);

      try {
        // Step 1: Fetch dagens content
        const scraperApiUrl = process.env.SCRAPER_SERVICE_URL || 'http://localhost:4001';

        const scrapeResponse = await fetch(`${scraperApiUrl}/api/restaurant/${customer.restaurantSlug}/dagens`);

        if (!scrapeResponse.ok) {
          throw new Error(`Failed to fetch dagens: ${scrapeResponse.statusText}`);
        }

        const dagensData = await scrapeResponse.json();
        const dagensContent = dagensData.content || dagensData.text || '';

        if (!dagensContent) {
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
        const contentHasChanged = hasContentChanged(dagensContent, customer.lastDailyHash);

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

        const elevenlabsResponse = await fetch(`${scraperApiUrl}/api/elevenlabs/add-document`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            kbId: customer.knowledgeBaseId,
            text: dagensContent,
            name: documentName,
            apiKey: customer.elevenlabsApiKey || process.env.ELEVENLABS_API_KEY
          }),
        });

        if (!elevenlabsResponse.ok) {
          const errorData = await elevenlabsResponse.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(`Failed to add KB document: ${errorData.error || elevenlabsResponse.statusText}`);
        }

        const kbResult = await elevenlabsResponse.json();

        // Step 4: Update database
        await db
          .update(customers)
          .set({
            lastDailyHash: newHash,
            lastUpdateDate: new Date(),
          })
          .where(eq(customers.id, customer.id));

        results.success.push({
          id: customer.id,
          name: customer.name,
          documentId: kbResult.documentId || kbResult.id,
          documentName,
          oldHash: customer.lastDailyHash?.substring(0, 8),
          newHash: newHash.substring(0, 8),
        });

        console.log(`   ✅ Success: Document added`);

      } catch (error) {
        results.failed.push({
          id: customer.id,
          name: customer.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const duration = Date.now() - startTime;
    const endTime = new Date().toISOString();

    console.log(`\n📊 Cron job completed in ${duration}ms`);
    console.log(`   ✅ Success: ${results.success.length}`);
    console.log(`   ❌ Failed: ${results.failed.length}`);
    console.log(`   ⏭️  Skipped: ${results.skipped.length}\n`);

    return NextResponse.json({
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

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      duration: `${Date.now() - startTime}ms`
    }, { status: 500 });
  }
}
