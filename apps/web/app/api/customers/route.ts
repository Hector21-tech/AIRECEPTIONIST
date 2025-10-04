import { NextRequest, NextResponse } from 'next/server';
import { getAllCustomers, createCustomer, getUser, getUserWithTeam } from '@/lib/db/queries';
import { configureTwilioWebhook, createElevenlabsWebhook } from '@/lib/webhook-service';
import { scrapeRestaurant, getKnowledgeBaseId } from '@/lib/scraper-service';
import { db } from '@/lib/db/drizzle';
import { customers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const customers = await getAllCustomers();
    return NextResponse.json(customers);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return NextResponse.json({ error: 'User must be part of a team' }, { status: 400 });
    }

    const body = await request.json();

    // Add teamId to customer data
    const customerData = { ...body, teamId: userWithTeam.teamId };
    const customer = await createCustomer(customerData);

    console.log(`🎯 Ny kund skapad: ${customer.name} (ID: ${customer.id})`);

    // Auto-configure webhooks if Twilio number or voice ID provided
    const webhookResults = {
      twilio: { status: 'skipped', message: 'Inget Twilio nummer angivet' },
      elevenlabs: { status: 'skipped', message: 'Inget Voice ID angivet' }
    };

    // Configure Twilio webhook if number provided
    if (customer.twilioNumber) {
      console.log('🔗 Auto-konfigurerar Twilio webhook...');
      const twilioResult = await configureTwilioWebhook({
        customerId: customer.id,
        twilioNumber: customer.twilioNumber,
      });

      await db
        .update(customers)
        .set({
          webhookTwilioStatus: twilioResult.status,
          webhookTwilioUrl: twilioResult.url,
        })
        .where(eq(customers.id, customer.id));

      webhookResults.twilio = twilioResult;
    }

    // Configure ElevenLabs webhook if agent ID provided
    if (customer.agentId) {
      console.log('🤖 Auto-konfigurerar ElevenLabs Agent webhook...');
      const elevenlabsResult = await createElevenlabsWebhook({
        customerId: customer.id,
        elevenlabsAgentId: customer.agentId,
      });

      await db
        .update(customers)
        .set({
          webhookElevenlabsStatus: elevenlabsResult.status,
          webhookElevenlabsUrl: elevenlabsResult.url,
        })
        .where(eq(customers.id, customer.id));

      webhookResults.elevenlabs = elevenlabsResult;
    }

    // Auto-scrape restaurant website if URL provided
    if (customer.websiteUrl) {
      console.log(`🌐 Auto-scraping restaurant website: ${customer.websiteUrl}`);
      try {
        const scrapeResult = await scrapeRestaurant(customer.websiteUrl, customer.name);

        if (scrapeResult.success && scrapeResult.slug) {
          // Update customer with restaurant_slug
          await db
            .update(customers)
            .set({ restaurantSlug: scrapeResult.slug })
            .where(eq(customers.id, customer.id));

          console.log(`✅ Restaurant slug saved: ${scrapeResult.slug}`);

          // Wait a bit for ElevenLabs sync to complete (happens in background)
          // Then fetch and update knowledge_base_id
          setTimeout(async () => {
            const knowledgeBaseId = await getKnowledgeBaseId(scrapeResult.slug!);
            if (knowledgeBaseId) {
              await db
                .update(customers)
                .set({ knowledgeBaseId })
                .where(eq(customers.id, customer.id));
              console.log(`✅ Knowledge base ID saved: ${knowledgeBaseId}`);
            }
          }, 10000); // Wait 10 seconds for sync to complete
        }
      } catch (error) {
        console.error(`⚠️  Scraping failed, but customer was created:`, error);
        // Don't fail the customer creation if scraping fails
      }
    }

    console.log('🎉 Kund och webhooks konfigurerade!');

    return NextResponse.json({
      customer,
      webhookResults
    }, { status: 201 });
  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to create customer'
    }, { status: 500 });
  }
}
