import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { customers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { configureTwilioWebhook, createElevenlabsWebhook, testWebhookConnection, generateWebhookUrls } from '@/lib/webhook-service';

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

    const body = await request.json();
    const { action, webhookType } = body; // action: 'configure' | 'test', webhookType: 'twilio' | 'elevenlabs'

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
      return NextResponse.json({ error: 'Customer not found or access denied' }, { status: 404 });
    }

    const customerData = customer[0];
    console.log(`🔧 Webhook ${action} för ${webhookType} - kund: ${customerData.name}`);

    if (action === 'test') {
      const webhookUrls = generateWebhookUrls(customerId);
      const testUrl = webhookType === 'twilio' ? webhookUrls.twilio : webhookUrls.elevenlabs;

      const testResult = await testWebhookConnection(testUrl);
      return NextResponse.json({
        success: testResult.success,
        message: testResult.message,
        url: testUrl
      });
    }

    if (action === 'configure') {
      let result;
      let updateData: any = {};

      if (webhookType === 'twilio') {
        result = await configureTwilioWebhook({
          customerId,
          twilioNumber: customerData.twilioNumber || undefined,
        });

        updateData = {
          webhookTwilioStatus: result.status,
          webhookTwilioUrl: result.url,
        };
      } else if (webhookType === 'elevenlabs') {
        result = await createElevenlabsWebhook({
          customerId,
          elevenlabsAgentId: customerData.agentId || undefined,
        });

        updateData = {
          webhookElevenlabsStatus: result.status,
          webhookElevenlabsUrl: result.url,
        };
      } else {
        return NextResponse.json({ error: 'Invalid webhook type' }, { status: 400 });
      }

      // Update customer record with webhook status
      await db
        .update(customers)
        .set(updateData)
        .where(eq(customers.id, customerId));

      return NextResponse.json({
        success: result.status === 'active',
        status: result.status,
        url: result.url,
        message: result.message
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Webhook configuration error:', error);
    return NextResponse.json({
      error: 'Failed to configure webhook',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET(
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

    // Get customer webhook status
    const customer = await db
      .select({
        id: customers.id,
        name: customers.name,
        webhookTwilioStatus: customers.webhookTwilioStatus,
        webhookElevenlabsStatus: customers.webhookElevenlabsStatus,
        webhookTwilioUrl: customers.webhookTwilioUrl,
        webhookElevenlabsUrl: customers.webhookElevenlabsUrl,
      })
      .from(customers)
      .where(and(
        eq(customers.id, customerId),
        eq(customers.teamId, userWithTeam.teamId)
      ))
      .limit(1);

    if (customer.length === 0) {
      return NextResponse.json({ error: 'Customer not found or access denied' }, { status: 404 });
    }

    const webhookUrls = generateWebhookUrls(customerId);

    return NextResponse.json({
      customer: customer[0],
      generatedUrls: webhookUrls,
    });

  } catch (error) {
    console.error('Get webhook status error:', error);
    return NextResponse.json({
      error: 'Failed to get webhook status',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}