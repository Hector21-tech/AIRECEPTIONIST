import { db } from './lib/db/drizzle';
import { users, teams, teamMembers } from './lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

async function cleanupOldTeams() {
  console.log('Starting cleanup of old personal teams...');

  // Find bruscbatak04@gmail.com user
  const user = await db
    .select()
    .from(users)
    .where(and(
      eq(users.email, 'bruscbatak04@gmail.com'),
      isNull(users.deletedAt)
    ))
    .limit(1);

  if (user.length === 0) {
    console.log('User not found');
    return;
  }

  const userId = user[0].id;
  console.log(`Found user: ${user[0].email} (ID: ${userId})`);

  // Get all team memberships
  const memberships = await db
    .select({
      id: teamMembers.id,
      teamId: teamMembers.teamId,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt
    })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));

  console.log(`User has ${memberships.length} team memberships:`);
  memberships.forEach(m => console.log(`  Team ${m.teamId}: ${m.role} (joined: ${m.joinedAt})`));

  // Get team details for each membership
  const teamDetails = [];
  for (const membership of memberships) {
    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, membership.teamId))
      .limit(1);

    if (team.length > 0) {
      // Count members in this team
      const memberCount = await db
        .select({ count: teamMembers.id })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, membership.teamId));

      teamDetails.push({
        ...membership,
        teamName: team[0].name,
        memberCount: memberCount.length
      });
    }
  }

  console.log('\nTeam details:');
  teamDetails.forEach(t => console.log(`  Team ${t.teamId}: "${t.teamName}" (${t.role}, ${t.memberCount} members)`));

  // Find personal teams (teams that look like "email's Team")
  const personalTeams = teamDetails.filter(t =>
    t.teamName.includes("bruscbatak04@gmail.com's Team") ||
    (t.role === 'owner' && t.memberCount === 1)
  );

  // Find shared teams (teams where user is member or has multiple members)
  const sharedTeams = teamDetails.filter(t =>
    t.role === 'member' || t.memberCount > 1
  );

  console.log(`\nFound ${personalTeams.length} personal teams and ${sharedTeams.length} shared teams`);

  // If user has both personal and shared teams, remove them from personal teams
  if (personalTeams.length > 0 && sharedTeams.length > 0) {
    console.log('\nUser has both personal and shared teams. Cleaning up personal teams...');

    for (const personalTeam of personalTeams) {
      console.log(`Removing user from personal team ${personalTeam.teamId}: "${personalTeam.teamName}"`);

      // Remove user from team
      await db
        .delete(teamMembers)
        .where(eq(teamMembers.id, personalTeam.id));

      // Since it's a personal team with 1 member, delete the team entirely
      if (personalTeam.memberCount === 1) {
        console.log(`Deleting empty team ${personalTeam.teamId}`);
        await db
          .delete(teams)
          .where(eq(teams.id, personalTeam.teamId));
      }

      console.log(`✅ Cleaned up personal team ${personalTeam.teamId}`);
    }

    // Update user role to member since they're no longer owner of personal team
    await db
      .update(users)
      .set({ role: 'member' })
      .where(eq(users.id, userId));

    console.log(`✅ Updated user role to 'member'`);
  }

  console.log('Cleanup completed!');
}

// Run if called directly
if (require.main === module) {
  cleanupOldTeams().catch(console.error);
}

export default cleanupOldTeams;