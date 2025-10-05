import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { customers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { calculateHash, hasContentChanged } from '@/lib/utils/hash';

export const dynamic = 'force-dynamic';

/**
 * Manual trigger endpoint för KB document update
 *
 * POST /api/customers/[id]/update-kb
 *
 * Flow:
 * 1. Scrape restaurant website
 * 2. Extract dagens special content
 * 3. Calculate hash
 * 4. Compare with lastDailyHash
 * 5. If changed: Add document to existing KB (not recreate!)
 * 6. Update lastDailyHash and lastUpdateDate
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return NextResponse.json({ error: 'User must be part of a team' }, { status: 400 });
    }

    const { id } = await params;
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 });
    }

    // Get customer
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(
        eq(customers.id, customerId),
        eq(customers.teamId, userWithTeam.teamId)
      ))
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Validate prerequisites
    if (!customer.websiteUrl) {
      return NextResponse.json({
        success: false,
        error: 'No website URL configured for this customer'
      }, { status: 400 });
    }

    if (!customer.knowledgeBaseId) {
      return NextResponse.json({
        success: false,
        error: 'No Knowledge Base ID configured. Please run initial scrape first.'
      }, { status: 400 });
    }

    if (!customer.restaurantSlug) {
      return NextResponse.json({
        success: false,
        error: 'No restaurant slug found. Please run initial scrape first.'
      }, { status: 400 });
    }

    console.log(`\n🔄 Manual KB update triggered for: ${customer.name}`);
    console.log(`   Website: ${customer.websiteUrl}`);
    console.log(`   KB ID: ${customer.knowledgeBaseId}`);
    console.log(`   Slug: ${customer.restaurantSlug}`);

    // Step 1: Scrape website for dagens content
    const scraperApiUrl = process.env.SCRAPER_SERVICE_URL || 'http://localhost:4001';

    console.log(`📡 Fetching dagens content from scraper...`);
    const scrapeResponse = await fetch(`${scraperApiUrl}/api/restaurant/${customer.restaurantSlug}/dagens`);

    if (!scrapeResponse.ok) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch dagens content: ${scrapeResponse.statusText}`
      }, { status: 500 });
    }

    const dagensData = await scrapeResponse.json();
    const dagensContent = dagensData.content || dagensData.text || '';

    if (!dagensContent) {
      return NextResponse.json({
        success: false,
        error: 'No dagens content found from scraper'
      }, { status: 404 });
    }

    console.log(`✅ Dagens content fetched (${dagensContent.length} chars)`);

    // Step 2: Calculate hash and check if changed
    const newHash = calculateHash(dagensContent);
    const contentHasChanged = hasContentChanged(dagensContent, customer.lastDailyHash);

    console.log(`   Current hash: ${customer.lastDailyHash || 'NONE'}`);
    console.log(`   New hash: ${newHash}`);
    console.log(`   Content changed: ${contentHasChanged ? 'YES ✅' : 'NO ❌'}`);

    if (!contentHasChanged) {
      return NextResponse.json({
        success: true,
        message: 'Content has not changed - no update needed',
        contentChanged: false,
        currentHash: customer.lastDailyHash,
        newHash,
      });
    }

    // Step 3: Add document to existing KB (NOT recreate KB!)
    console.log(`📄 Adding new document to KB...`);

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
      return NextResponse.json({
        success: false,
        error: `Failed to add document to KB: ${errorData.error || elevenlabsResponse.statusText}`
      }, { status: 500 });
    }

    const kbResult = await elevenlabsResponse.json();
    console.log(`✅ Document added to KB (Document ID: ${kbResult.documentId || kbResult.id})`);

    // Step 4: Update hash and date in database
    await db
      .update(customers)
      .set({
        lastDailyHash: newHash,
        lastUpdateDate: new Date(),
      })
      .where(eq(customers.id, customerId));

    console.log(`✅ Database updated with new hash\n`);

    return NextResponse.json({
      success: true,
      message: 'KB document updated successfully',
      contentChanged: true,
      oldHash: customer.lastDailyHash,
      newHash,
      documentId: kbResult.documentId || kbResult.id,
      documentName,
      knowledgeBaseId: customer.knowledgeBaseId,
      contentPreview: dagensContent.substring(0, 100) + '...',
    });

  } catch (error) {
    console.error('Manual KB update error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }, { status: 500 });
  }
}
