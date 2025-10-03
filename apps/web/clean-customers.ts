import { db } from './lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function cleanCustomers() {
  console.log('🧹 CLEANING OLD CUSTOMER DATA...\n');

  try {
    console.log('1. Deleting all call logs...');
    await db.execute(sql`DELETE FROM call_logs`);
    console.log('   ✅ Deleted all call logs');

    console.log('\n2. Deleting all usage records...');
    await db.execute(sql`DELETE FROM usage`);
    console.log('   ✅ Deleted all usage records');

    console.log('\n3. Deleting all integrations...');
    await db.execute(sql`DELETE FROM integrations`);
    console.log('   ✅ Deleted all integrations');

    console.log('\n4. Deleting all customers...');
    await db.execute(sql`DELETE FROM customers`);
    console.log('   ✅ Deleted all customers');

    console.log('\n5. Adding team_id column...');
    await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id)`);
    console.log('   ✅ Added team_id column');

    console.log('\n✅ Clean slate! Ready for team-based customers!');
    console.log('   All new customers will be properly assigned to teams');

  } catch (error) {
    console.error('❌ Failed:', error instanceof Error ? error.message : String(error));
  }
}

// Run if called directly
if (require.main === module) {
  cleanCustomers().catch(console.error);
}

export default cleanCustomers;