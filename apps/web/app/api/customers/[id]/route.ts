import { NextRequest, NextResponse } from 'next/server';
import { getCustomerWithUsage, getUser, getUserWithTeam } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { customers, callLogs, usage, integrations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

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

    const customerData = await getCustomerWithUsage(customerId);
    if (!customerData) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(customerData);

  } catch (error) {
    console.error('Get customer error:', error);
    return NextResponse.json({
      error: 'Failed to fetch customer',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function PATCH(
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
    const { contactName, contactPhone, contactEmail, twilioNumber, agentId, elevenlabsApiKey, websiteUrl, restaurantSlug, knowledgeBaseId } = body;

    // First verify the customer belongs to the user's team
    const customer = await db
      .select()
      .from(customers)
      .where(and(
        eq(customers.id, customerId),
        eq(customers.teamId, userWithTeam.teamId)
      ))
      .limit(1);

    if (customer.length === 0) {
      return NextResponse.json({ error: 'Kunden hittades inte eller så har du inte behörighet att redigera denna kund. Endast team-ägare kan redigera kundinställningar.' }, { status: 403 });
    }

    console.log(`📝 Uppdaterar kund: ${customer[0].name}`);

    // Update customer
    await db
      .update(customers)
      .set({
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || null,
        twilioNumber: twilioNumber || null,
        agentId: agentId || null,
        elevenlabsApiKey: elevenlabsApiKey || null,
        websiteUrl: websiteUrl || null,
        restaurantSlug: restaurantSlug || null,
        knowledgeBaseId: knowledgeBaseId || null,
      })
      .where(eq(customers.id, customerId));

    console.log(`✅ Kund ${customer[0].name} uppdaterad`);

    return NextResponse.json({
      success: true,
      message: `Kund ${customer[0].name} har uppdaterats`,
    });

  } catch (error) {
    console.error('Update customer error:', error);
    return NextResponse.json({
      error: 'Failed to update customer',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function DELETE(
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

    // First verify the customer belongs to the user's team
    const customer = await db
      .select()
      .from(customers)
      .where(and(
        eq(customers.id, customerId),
        eq(customers.teamId, userWithTeam.teamId)
      ))
      .limit(1);

    if (customer.length === 0) {
      return NextResponse.json({ error: 'Kunden hittades inte eller så har du inte behörighet att ta bort denna kund. Endast team-ägare kan ta bort kunder.' }, { status: 403 });
    }

    console.log(`🗑️ Tar bort kund: ${customer[0].name}`);

    // Delete related data first (foreign key constraints)
    await db.delete(callLogs).where(eq(callLogs.customerId, customerId));
    await db.delete(usage).where(eq(usage.customerId, customerId));
    await db.delete(integrations).where(eq(integrations.customerId, customerId));

    // Finally delete the customer
    await db.delete(customers).where(eq(customers.id, customerId));

    console.log(`✅ Kund ${customer[0].name} borttagen`);

    return NextResponse.json({
      success: true,
      message: `Kund ${customer[0].name} har tagits bort`,
      deletedCustomer: customer[0].name
    });

  } catch (error) {
    console.error('Delete customer error:', error);
    return NextResponse.json({
      error: 'Failed to delete customer',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}