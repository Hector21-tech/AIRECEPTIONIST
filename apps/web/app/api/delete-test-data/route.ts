import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { customers, callLogs, usage, integrations } from '@/lib/db/schema';
import { eq, like } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🗑️ Tar bort test-data...');

    // Find test customers
    const testCustomers = await db
      .select()
      .from(customers)
      .where(like(customers.name, '%Test%'));

    let deletedCount = 0;

    for (const customer of testCustomers) {
      console.log(`🗑️ Tar bort kund: ${customer.name}`);

      // Delete related data first
      await db.delete(callLogs).where(eq(callLogs.customerId, customer.id));
      await db.delete(usage).where(eq(usage.customerId, customer.id));
      await db.delete(integrations).where(eq(integrations.customerId, customer.id));

      // Delete customer
      await db.delete(customers).where(eq(customers.id, customer.id));

      deletedCount++;
    }

    console.log(`✅ ${deletedCount} test-kunder borttagna`);

    return NextResponse.json({
      success: true,
      message: `${deletedCount} test-kunder borttagna`,
      deletedCustomers: testCustomers.map(c => c.name)
    });

  } catch (error) {
    console.error('Delete test data error:', error);
    return NextResponse.json({
      error: 'Failed to delete test data',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}