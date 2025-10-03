import { db } from './lib/db/drizzle';
import { users, teams, teamMembers } from './lib/db/schema';
import { and, eq, isNull, like } from 'drizzle-orm';

async function fixHectorTeamless() {
  console.log('🔧 FIXING HECTOR\'S TEAMLESS STATE...\n');

  // Find Hector (batak@torstens.se)
  const hector = await db
    .select()
    .from(users)
    .where(and(
      eq(users.email, 'batak@torstens.se'),
      isNull(users.deletedAt)
    ))
    .limit(1);

  if (hector.length === 0) {
    console.log('❌ Hector not found');
    return;
  }

  const hectorUser = hector[0];
  console.log(`👤 Found Hector: ${hectorUser.email} (ID: ${hectorUser.id}, role: ${hectorUser.role})`);

  // Check if Hector has any team membership
  const hectorMemberships = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, hectorUser.id));

  console.log(`📋 Hector's current memberships: ${hectorMemberships.length}`);
  hectorMemberships.forEach(m =>
    console.log(`   - Team ${m.teamId} as ${m.role}`)
  );

  if (hectorMemberships.length === 0) {
    console.log('\n🏗️ Hector has no team! Creating a new team for him...');

    // Create new team for Hector
    const [newTeam] = await db
      .insert(teams)
      .values({
        name: "Hector's Team"
      })
      .returning();

    console.log(`✅ Created new team: "${newTeam.name}" (ID: ${newTeam.id})`);

    // Add Hector as owner
    await db
      .insert(teamMembers)
      .values({
        userId: hectorUser.id,
        teamId: newTeam.id,
        role: 'owner'
      });

    // Update Hector's global role to owner
    await db
      .update(users)
      .set({ role: 'owner' })
      .where(eq(users.id, hectorUser.id));

    console.log(`👑 Hector is now owner of "${newTeam.name}"`);
  } else {
    console.log(`✅ Hector already has team memberships - no action needed`);
  }

  console.log('\n✅ Hector fix completed!');
}

// Run if called directly
if (require.main === module) {
  fixHectorTeamless().catch(console.error);
}

export default fixHectorTeamless;