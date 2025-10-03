import { db } from './lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function fixDatabase() {
  try {
    console.log('🔧 Fixar databas-kolumner...');

    // Add missing columns to call_logs table
    await db.execute(sql`
      ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_sid VARCHAR(100)
    `);
    console.log('✅ call_sid kolumn tillagd');

    await db.execute(sql`
      ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS from_number VARCHAR(20)
    `);
    console.log('✅ from_number kolumn tillagd');

    await db.execute(sql`
      ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS to_number VARCHAR(20)
    `);
    console.log('✅ to_number kolumn tillagd');

    await db.execute(sql`
      ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS elevenlabs_cost DECIMAL(10,4)
    `);
    console.log('✅ elevenlabs_cost kolumn tillagd');

    // Check if customers table has team_id
    await db.execute(sql`
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS team_id INTEGER
    `);
    console.log('✅ team_id kolumn tillagd till customers');

    // Check if usage table has call_count
    await db.execute(sql`
      ALTER TABLE usage ADD COLUMN IF NOT EXISTS call_count INTEGER DEFAULT 0 NOT NULL
    `);
    console.log('✅ call_count kolumn tillagd till usage');

    console.log('✅ Databas-fix klart!');

  } catch (error) {
    console.error('❌ Databas-fix misslyckades:', error);
    throw error;
  }
}

// Run the fix
fixDatabase().catch(console.error);