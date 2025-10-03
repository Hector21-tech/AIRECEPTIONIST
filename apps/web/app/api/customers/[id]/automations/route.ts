import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { automations, customers } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET - Hämta alla automations för en kund
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id, 10);

    if (isNaN(customerId)) {
      return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 });
    }

    // Verifiera att kunden finns
    const customer = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (customer.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Hämta alla automations för kunden
    const customerAutomations = await db
      .select()
      .from(automations)
      .where(eq(automations.customerId, customerId))
      .orderBy(desc(automations.createdAt));

    return NextResponse.json({
      automations: customerAutomations.map(automation => ({
        ...automation,
        // Parsa JSON fält
        triggerConfig: automation.triggerConfig ? JSON.parse(automation.triggerConfig) : null,
        actions: automation.actions ? JSON.parse(automation.actions) : [],
        // Skapa actions_list för UI kompatibilitet
        actions_list: automation.actions
          ? JSON.parse(automation.actions).map((action: any) => action.type || action.name || 'Unknown Action')
          : [],
        // Konvertera triggerType till camelCase för UI
        triggerType: automation.triggerType,
        triggers: 1, // Default för UI
        actionsCount: automation.actions ? JSON.parse(automation.actions).length : 0
      }))
    });

  } catch (error) {
    console.error('Error fetching automations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch automations' },
      { status: 500 }
    );
  }
}

// POST - Skapa ny automation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id, 10);

    if (isNaN(customerId)) {
      return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, triggerType, triggerConfig, actions, status = 'draft' } = body;

    if (!name || !triggerType) {
      return NextResponse.json(
        { error: 'Name and triggerType are required' },
        { status: 400 }
      );
    }

    // Verifiera att kunden finns
    const customer = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (customer.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Skapa ny automation
    const newAutomation = await db
      .insert(automations)
      .values({
        customerId,
        name,
        description,
        triggerType,
        triggerConfig: triggerConfig ? JSON.stringify(triggerConfig) : null,
        actions: actions ? JSON.stringify(actions) : '[]',
        status
      })
      .returning();

    return NextResponse.json({
      success: true,
      automation: {
        ...newAutomation[0],
        triggerConfig: newAutomation[0].triggerConfig ? JSON.parse(newAutomation[0].triggerConfig) : null,
        actions: newAutomation[0].actions ? JSON.parse(newAutomation[0].actions) : [],
        actions_list: newAutomation[0].actions
          ? JSON.parse(newAutomation[0].actions).map((action: any) => action.type || action.name || 'Unknown Action')
          : [],
        triggers: 1,
        actionsCount: newAutomation[0].actions ? JSON.parse(newAutomation[0].actions).length : 0
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating automation:', error);
    return NextResponse.json(
      { error: 'Failed to create automation' },
      { status: 500 }
    );
  }
}