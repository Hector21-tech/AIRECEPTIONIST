import { db } from './lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function simpleAddTeamId() {
  console.log('🔧 ADDING TEAM_ID COLUMN TO CUSTOMERS...\n');

  try {
    console.log('1. Adding nullable team_id column...');
    await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS team_id INTEGER`);
    console.log('   ✅ Added team_id column');

    console.log('\n2. Adding foreign key constraint...');
    await db.execute(sql`
      ALTER TABLE customers
      ADD CONSTRAINT IF NOT EXISTS customers_team_id_teams_id_fk
      FOREIGN KEY (team_id) REFERENCES teams(id)
    `);
    console.log('   ✅ Added foreign key constraint');

    console.log('\n✅ Simple team_id addition completed!');
    console.log('   Now all customers will have nullable team_id');
    console.log('   New customers will be assigned to user\'s team');

  } catch (error) {
    console.error('❌ Failed:', error instanceof Error ? error.message : String(error));
  }
}

// Run if called directly
if (require.main === module) {
  simpleAddTeamId().catch(console.error);
}

export default simpleAddTeamId;