import { db } from './lib/db/drizzle';
import { customers, teams } from './lib/db/schema';
import { eq } from 'drizzle-orm';

async function addTeamToCustomers() {
  console.log('🔧 ADDING TEAM RELATIONSHIP TO EXISTING CUSTOMERS...\n');

  // First, get all existing customers
  const allCustomers = await db.select().from(customers);
  console.log(`📋 Found ${allCustomers.length} existing customers`);

  if (allCustomers.length === 0) {
    console.log('✅ No customers to migrate - all done!');
    return;
  }

  // Get the first team (we'll assign all existing customers to it)
  const firstTeam = await db.select().from(teams).limit(1);

  if (firstTeam.length === 0) {
    console.log('❌ No teams found! Need to create a team first.');
    return;
  }

  const defaultTeamId = firstTeam[0].id;
  console.log(`🏢 Using team "${firstTeam[0].name}" (ID: ${defaultTeamId}) as default for existing customers`);

  // Update all existing customers to belong to the first team
  console.log('\n📝 Assigning existing customers to default team...');

  for (const customer of allCustomers) {
    await db
      .update(customers)
      .set({ teamId: defaultTeamId })
      .where(eq(customers.id, customer.id));

    console.log(`  ✅ Customer "${customer.name}" → Team "${firstTeam[0].name}"`);
  }

  console.log(`\n✅ Successfully migrated ${allCustomers.length} customers to team-based system!`);
  console.log(`   All existing customers now belong to team: "${firstTeam[0].name}"`);
}

// Run if called directly
if (require.main === module) {
  addTeamToCustomers().catch(console.error);
}

export default addTeamToCustomers;