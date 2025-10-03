import { db } from './lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function manualTeamMigration() {
  console.log('🔧 MANUAL TEAM MIGRATION...\n');

  try {
    // Step 1: Check if column exists
    console.log('1. Checking if team_id column exists...');
    const columnCheck = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'customers' AND column_name = 'team_id'
    `);

    if (columnCheck.length > 0) {
      console.log('   ✅ team_id column already exists');
    } else {
      console.log('   ➕ Adding team_id column as nullable...');
      // Step 2: Add nullable column
      await db.execute(sql`ALTER TABLE customers ADD COLUMN team_id INTEGER`);
      console.log('   ✅ Added team_id column');
    }

    // Step 3: Get first team to use as default
    console.log('\n2. Finding default team...');
    const firstTeam = await db.execute(sql`SELECT id, name FROM teams LIMIT 1`);

    if (firstTeam.length === 0) {
      console.log('   ❌ No teams found! Cannot continue.');
      return;
    }

    const defaultTeamId = firstTeam[0].id;
    const teamName = firstTeam[0].name;
    console.log(`   ✅ Using team "${teamName}" (ID: ${defaultTeamId}) as default`);

    // Step 4: Update all customers with null team_id
    console.log('\n3. Assigning customers to default team...');
    const updateResult = await db.execute(sql`
      UPDATE customers
      SET team_id = ${defaultTeamId}
      WHERE team_id IS NULL
    `);
    console.log(`   ✅ Updated customers with default team`);

    // Step 5: Add NOT NULL constraint
    console.log('\n4. Adding NOT NULL constraint...');
    await db.execute(sql`ALTER TABLE customers ALTER COLUMN team_id SET NOT NULL`);
    console.log('   ✅ Added NOT NULL constraint');

    // Step 6: Add foreign key constraint
    console.log('\n5. Adding foreign key constraint...');
    try {
      await db.execute(sql`
        ALTER TABLE customers
        ADD CONSTRAINT customers_team_id_teams_id_fk
        FOREIGN KEY (team_id) REFERENCES teams(id)
      `);
      console.log('   ✅ Added foreign key constraint');
    } catch (error) {
      console.log('   ⚠️ Foreign key constraint already exists or failed:', error instanceof Error ? error.message : String(error));
    }

    console.log('\n✅ Manual team migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  manualTeamMigration().catch(console.error);
}

export default manualTeamMigration;