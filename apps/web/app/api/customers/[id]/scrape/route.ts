import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { scrapeRestaurant, getKnowledgeBaseId } from '@/lib/scraper-service';
import { db } from '@/lib/db/drizzle';
import { customers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

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

    // Get customer and verify ownership
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

    if (!customer.websiteUrl) {
      return NextResponse.json({
        success: false,
        error: 'No website URL configured for this customer'
      }, { status: 400 });
    }

    console.log(`🌐 Starting scrape for customer ${customer.name}: ${customer.websiteUrl}`);

    // Trigger scraping with existing slug (or it will be generated if not present)
    const scrapeResult = await scrapeRestaurant(
      customer.websiteUrl,
      customer.name,
      customer.restaurantSlug || undefined
    );

    if (!scrapeResult.success) {
      console.error(`❌ Scraping failed for ${customer.name}:`, scrapeResult.error);
      return NextResponse.json({
        success: false,
        error: scrapeResult.error || 'Scraping failed'
      }, { status: 500 });
    }

    // Update customer with restaurant slug
    if (scrapeResult.slug) {
      await db
        .update(customers)
        .set({ restaurantSlug: scrapeResult.slug })
        .where(eq(customers.id, customerId));

      console.log(`✅ Restaurant slug updated: ${scrapeResult.slug}`);
    }

    // Wait for ElevenLabs sync to complete and get knowledge base ID
    // We'll poll for the knowledge base ID a few times
    let knowledgeBaseId = null;
    if (scrapeResult.slug) {
      // Try to get knowledge base ID immediately
      knowledgeBaseId = await getKnowledgeBaseId(scrapeResult.slug);

      // If not available yet, wait and try again (sync might be in progress)
      if (!knowledgeBaseId) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        knowledgeBaseId = await getKnowledgeBaseId(scrapeResult.slug);
      }

      if (knowledgeBaseId) {
        await db
          .update(customers)
          .set({ knowledgeBaseId })
          .where(eq(customers.id, customerId));

        console.log(`✅ Knowledge base ID updated: ${knowledgeBaseId}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Scraping completed successfully',
      slug: scrapeResult.slug,
      knowledgeBaseId,
    });

  } catch (error) {
    console.error('Scrape endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scrape website'
    }, { status: 500 });
  }
}
