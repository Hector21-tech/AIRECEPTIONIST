import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { automations, customers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET - Hämta specifik automation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; automationId: string }> }
) {
  try {
    const { id, automationId } = await params;
    const customerId = parseInt(id, 10);
    const automationIdNum = parseInt(automationId, 10);

    if (isNaN(customerId) || isNaN(automationIdNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const automation = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.id, automationIdNum),
          eq(automations.customerId, customerId)
        )
      )
      .limit(1);

    if (automation.length === 0) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    const formattedAutomation = {
      ...automation[0],
      triggerConfig: automation[0].triggerConfig ? JSON.parse(automation[0].triggerConfig) : null,
      actions: automation[0].actions ? JSON.parse(automation[0].actions) : [],
      actions_list: automation[0].actions
        ? JSON.parse(automation[0].actions).map((action: any) => action.type || action.name || 'Unknown Action')
        : [],
      triggers: 1,
      actionsCount: automation[0].actions ? JSON.parse(automation[0].actions).length : 0
    };

    return NextResponse.json({ automation: formattedAutomation });

  } catch (error) {
    console.error('Error fetching automation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch automation' },
      { status: 500 }
    );
  }
}

// PUT - Uppdatera automation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; automationId: string }> }
) {
  try {
    const { id, automationId } = await params;
    const customerId = parseInt(id, 10);
    const automationIdNum = parseInt(automationId, 10);

    if (isNaN(customerId) || isNaN(automationIdNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, triggerType, triggerConfig, actions, status } = body;

    // Verifiera att automation finns och tillhör kunden
    const existingAutomation = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.id, automationIdNum),
          eq(automations.customerId, customerId)
        )
      )
      .limit(1);

    if (existingAutomation.length === 0) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    // Uppdatera automation
    const updatedAutomation = await db
      .update(automations)
      .set({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(triggerType && { triggerType }),
        ...(triggerConfig !== undefined && {
          triggerConfig: triggerConfig ? JSON.stringify(triggerConfig) : null
        }),
        ...(actions !== undefined && {
          actions: actions ? JSON.stringify(actions) : '[]'
        }),
        ...(status && { status }),
        updatedAt: new Date()
      })
      .where(eq(automations.id, automationIdNum))
      .returning();

    return NextResponse.json({
      success: true,
      automation: {
        ...updatedAutomation[0],
        triggerConfig: updatedAutomation[0].triggerConfig ? JSON.parse(updatedAutomation[0].triggerConfig) : null,
        actions: updatedAutomation[0].actions ? JSON.parse(updatedAutomation[0].actions) : [],
        actions_list: updatedAutomation[0].actions
          ? JSON.parse(updatedAutomation[0].actions).map((action: any) => action.type || action.name || 'Unknown Action')
          : [],
        triggers: 1,
        actionsCount: updatedAutomation[0].actions ? JSON.parse(updatedAutomation[0].actions).length : 0
      }
    });

  } catch (error) {
    console.error('Error updating automation:', error);
    return NextResponse.json(
      { error: 'Failed to update automation' },
      { status: 500 }
    );
  }
}

// DELETE - Ta bort automation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; automationId: string }> }
) {
  try {
    const { id, automationId } = await params;
    const customerId = parseInt(id, 10);
    const automationIdNum = parseInt(automationId, 10);

    if (isNaN(customerId) || isNaN(automationIdNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Verifiera att automation finns och tillhör kunden
    const existingAutomation = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.id, automationIdNum),
          eq(automations.customerId, customerId)
        )
      )
      .limit(1);

    if (existingAutomation.length === 0) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    // Ta bort automation
    await db
      .delete(automations)
      .where(eq(automations.id, automationIdNum));

    return NextResponse.json({
      success: true,
      message: `Automation "${existingAutomation[0].name}" har tagits bort`
    });

  } catch (error) {
    console.error('Error deleting automation:', error);
    return NextResponse.json(
      { error: 'Failed to delete automation' },
      { status: 500 }
    );
  }
}

// PATCH - Uppdatera automation status (t.ex. aktivera/pausa)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; automationId: string }> }
) {
  try {
    const { id, automationId } = await params;
    const customerId = parseInt(id, 10);
    const automationIdNum = parseInt(automationId, 10);

    if (isNaN(customerId) || isNaN(automationIdNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body; // 'play', 'pause', 'activate', 'deactivate'

    // Verifiera att automation finns och tillhör kunden
    const existingAutomation = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.id, automationIdNum),
          eq(automations.customerId, customerId)
        )
      )
      .limit(1);

    if (existingAutomation.length === 0) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    let newStatus = existingAutomation[0].status;

    switch (action) {
      case 'play':
      case 'activate':
        newStatus = 'active';
        break;
      case 'pause':
      case 'deactivate':
        newStatus = 'paused';
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Uppdatera status
    const updatedAutomation = await db
      .update(automations)
      .set({
        status: newStatus,
        updatedAt: new Date()
      })
      .where(eq(automations.id, automationIdNum))
      .returning();

    return NextResponse.json({
      success: true,
      automation: {
        ...updatedAutomation[0],
        triggerConfig: updatedAutomation[0].triggerConfig ? JSON.parse(updatedAutomation[0].triggerConfig) : null,
        actions: updatedAutomation[0].actions ? JSON.parse(updatedAutomation[0].actions) : [],
        actions_list: updatedAutomation[0].actions
          ? JSON.parse(updatedAutomation[0].actions).map((action: any) => action.type || action.name || 'Unknown Action')
          : [],
        triggers: 1,
        actionsCount: updatedAutomation[0].actions ? JSON.parse(updatedAutomation[0].actions).length : 0
      },
      message: `Automation ${newStatus === 'active' ? 'aktiverad' : 'pausad'}`
    });

  } catch (error) {
    console.error('Error updating automation status:', error);
    return NextResponse.json(
      { error: 'Failed to update automation status' },
      { status: 500 }
    );
  }
}