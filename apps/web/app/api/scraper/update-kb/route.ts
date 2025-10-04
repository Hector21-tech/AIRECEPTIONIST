import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { customers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scraper/update-kb
 * Called by scraper service after ElevenLabs sync completes
 * Updates knowledgeBaseId in database
 */
export async function POST(request: NextRequest) {
  try {
    // Verify API secret
    const apiSecret = request.headers.get('x-api-secret');
    if (!apiSecret || apiSecret !== process.env.SCRAPER_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { restaurantSlug, knowledgeBaseId } = body;

    if (!restaurantSlug || !knowledgeBaseId) {
      return NextResponse.json({
        success: false,
        error: 'restaurantSlug and knowledgeBaseId are required'
      }, { status: 400 });
    }

    console.log(`📥 Received KB update from scraper: ${restaurantSlug} -> ${knowledgeBaseId}`);

    // Find customer by restaurantSlug
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.restaurantSlug, restaurantSlug))
      .limit(1);

    if (!customer) {
      console.warn(`⚠️  No customer found with slug: ${restaurantSlug}`);
      return NextResponse.json({
        success: false,
        error: 'Customer not found with this restaurantSlug'
      }, { status: 404 });
    }

    // Update knowledgeBaseId
    await db
      .update(customers)
      .set({ knowledgeBaseId })
      .where(eq(customers.id, customer.id));

    console.log(`✅ Updated customer ${customer.name} (ID: ${customer.id}) with KB ID: ${knowledgeBaseId}`);

    return NextResponse.json({
      success: true,
      message: 'Knowledge base ID updated successfully',
      customerId: customer.id,
      customerName: customer.name
    });

  } catch (error) {
    console.error('Update KB endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update knowledge base ID'
    }, { status: 500 });
  }
}
