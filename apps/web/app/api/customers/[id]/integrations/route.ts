import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { customers, integrations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createElevenlabsWebhook } from '@/lib/webhook-service';

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

    // Parse request body
    const body = await request.json();
    const { type, name, method, config } = body;

    // Verify customer belongs to user's team
    const customer = await db
      .select()
      .from(customers)
      .where(and(
        eq(customers.id, customerId),
        eq(customers.teamId, userWithTeam.teamId)
      ))
      .limit(1);

    if (customer.length === 0) {
      return NextResponse.json({ error: 'Kunden hittades inte eller så har du inte behörighet.' }, { status: 403 });
    }

    const customerData = customer[0];

    // Handle ElevenLabs integration specifically
    if (type === 'elevenlabs' && customerData.agentId) {
      console.log(`🤖 Skapar ElevenLabs integration för ${customerData.name}...`);

      // Create webhook via ElevenLabs API
      const webhookResult = await createElevenlabsWebhook({
        customerId: customerId,
        customerName: customerData.name,
        elevenlabsAgentId: customerData.agentId,
        elevenlabsApiKey: customerData.elevenlabsApiKey || undefined,
        twilioNumber: customerData.twilioNumber || undefined
      });

      if (webhookResult.status === 'active') {
        // Update customer webhook status
        await db
          .update(customers)
          .set({
            webhookElevenlabsStatus: 'active',
            webhookElevenlabsUrl: webhookResult.url,
          })
          .where(eq(customers.id, customerId));
      }

      // Create integration record
      const integration = await db.insert(integrations).values({
        customerId: customerId,
        type: type,
        name: name,
        method: method,
        status: webhookResult.status === 'active' ? 'active' : 'inactive',
        config: JSON.stringify({
          ...config,
          webhookId: webhookResult.webhookId || null,
          status: webhookResult.status,
          message: webhookResult.message
        }),
        createdAt: new Date(),
      }).returning();

      console.log(`✅ Integration skapad för ${customerData.name}`);

      return NextResponse.json({
        success: true,
        message: 'ElevenLabs integration skapad och webhook konfigurerad',
        integration: integration[0],
        webhook: webhookResult
      });
    }

    // Handle other integration types (generic)
    const integration = await db.insert(integrations).values({
      customerId: customerId,
      type: type,
      name: name,
      method: method,
      status: 'inactive', // Default to inactive for manual integrations
      config: JSON.stringify(config),
      createdAt: new Date(),
    }).returning();

    return NextResponse.json({
      success: true,
      message: 'Integration skapad',
      integration: integration[0]
    });

  } catch (error) {
    console.error('Create integration error:', error);
    return NextResponse.json({
      error: 'Failed to create integration',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}