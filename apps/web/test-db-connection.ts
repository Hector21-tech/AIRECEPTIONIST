import { db } from './lib/db/drizzle';
import { callLogs, usage, customers } from './lib/db/schema';
import { sql, eq } from 'drizzle-orm';

async function testConnection() {
  try {
    console.log('Testing database connection...');

    // Count total records across tables
    const callLogCount = await db.select({ count: sql<number>`count(*)` }).from(callLogs);
    const usageCount = await db.select({ count: sql<number>`count(*)` }).from(usage);
    const customerCount = await db.select({ count: sql<number>`count(*)` }).from(customers);

    console.log('Current record counts:');
    console.log('- Call logs:', callLogCount[0]?.count || 0);
    console.log('- Usage records:', usageCount[0]?.count || 0);
    console.log('- Customers:', customerCount[0]?.count || 0);

    // Get sample data from each table to understand structure
    console.log('\nSample data:');

    const sampleCallLogs = await db.select().from(callLogs).limit(2);
    console.log('Sample call logs:', JSON.stringify(sampleCallLogs, null, 2));

    const sampleUsage = await db.select().from(usage).limit(2);
    console.log('Sample usage:', JSON.stringify(sampleUsage, null, 2));

    const sampleCustomers = await db.select().from(customers).limit(2);
    console.log('Sample customers:', JSON.stringify(sampleCustomers, null, 2));

  } catch (error) {
    console.error('Database connection test failed:', error);
  } finally {
    process.exit(0);
  }
}

testConnection();