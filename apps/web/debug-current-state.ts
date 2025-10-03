import { db } from './lib/db/drizzle';
import { users, teams, teamMembers, invitations } from './lib/db/schema';
import { isNull, eq } from 'drizzle-orm';

async function debugCurrentState() {
  console.log('🔍 DEBUGGING CURRENT DATABASE STATE...\n');

  // Get all active users
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role
    })
    .from(users)
    .where(isNull(users.deletedAt));

  console.log(`📊 Total active users: ${allUsers.length}`);
  allUsers.forEach(user => console.log(`  - ${user.email} (ID: ${user.id}, role: ${user.role})`));

  // Get all teams
  const allTeams = await db
    .select()
    .from(teams);

  console.log(`\n🏢 Total teams: ${allTeams.length}`);
  for (const team of allTeams) {
    const memberCount = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, team.id));

    console.log(`  - Team ${team.id}: "${team.name}" (${memberCount.length} members)`);
  }

  // Get all team memberships
  console.log('\n👥 ALL TEAM MEMBERSHIPS:');
  const memberships = await db
    .select({
      userId: teamMembers.userId,
      userEmail: users.email,
      teamId: teamMembers.teamId,
      teamName: teams.name,
      role: teamMembers.role
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .innerJoin(teams, eq(teams.id, teamMembers.teamId));

  memberships.forEach(m =>
    console.log(`  - ${m.userEmail} → Team "${m.teamName}" as ${m.role}`)
  );

  // Get all invitations
  console.log('\n📧 ALL INVITATIONS:');
  const allInvitations = await db
    .select({
      email: invitations.email,
      teamId: invitations.teamId,
      teamName: teams.name,
      role: invitations.role,
      status: invitations.status
    })
    .from(invitations)
    .leftJoin(teams, eq(teams.id, invitations.teamId));

  allInvitations.forEach(inv =>
    console.log(`  - ${inv.email} invited to "${inv.teamName}" as ${inv.role} (${inv.status})`)
  );

  console.log('\n✅ Current state analysis complete!');
}

// Run if called directly
if (require.main === module) {
  debugCurrentState().catch(console.error);
}

export default debugCurrentState;