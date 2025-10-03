import { db } from './lib/db/drizzle';
import { users, teams, teamMembers } from './lib/db/schema';
import { and, eq, isNull, isNotNull } from 'drizzle-orm';

async function fixOrphanedTeams() {
  console.log('🔧 FIXING ORPHANED TEAMS...\n');

  // Find team members where the user is deleted but still in teamMembers table
  const orphanedMembers = await db
    .select({
      membershipId: teamMembers.id,
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      role: teamMembers.role,
      userEmail: users.email,
      userDeleted: users.deletedAt
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(isNotNull(users.deletedAt));

  console.log(`📋 Found ${orphanedMembers.length} memberships from deleted users:`);
  orphanedMembers.forEach(m =>
    console.log(`  - ${m.userEmail} (deleted) in team ${m.teamId} as ${m.role}`)
  );

  // Remove deleted users from teams
  if (orphanedMembers.length > 0) {
    console.log('\n🗑️ Removing deleted users from teams...');
    for (const member of orphanedMembers) {
      await db
        .delete(teamMembers)
        .where(eq(teamMembers.id, member.membershipId));

      console.log(`  ✅ Removed ${member.userEmail} from team ${member.teamId}`);
    }
  }

  // Now find teams with no owners (orphaned teams)
  console.log('\n🔍 Looking for teams without owners...');

  const allTeams = await db.select().from(teams);
  const orphanedTeams = [];

  for (const team of allTeams) {
    const owners = await db
      .select()
      .from(teamMembers)
      .innerJoin(users, and(
        eq(users.id, teamMembers.userId),
        isNull(users.deletedAt)
      ))
      .where(and(
        eq(teamMembers.teamId, team.id),
        eq(teamMembers.role, 'owner')
      ));

    const allMembers = await db
      .select()
      .from(teamMembers)
      .innerJoin(users, and(
        eq(users.id, teamMembers.userId),
        isNull(users.deletedAt)
      ))
      .where(eq(teamMembers.teamId, team.id));

    if (owners.length === 0 && allMembers.length > 0) {
      orphanedTeams.push({
        team,
        memberCount: allMembers.length,
        members: allMembers
      });
    }
  }

  console.log(`📋 Found ${orphanedTeams.length} orphaned teams (no owners but have members):`);

  for (const orphaned of orphanedTeams) {
    console.log(`\n📍 Team: "${orphaned.team.name}" (ID: ${orphaned.team.id})`);
    console.log(`   Members: ${orphaned.memberCount}`);

    // Auto-promote first member to owner
    if (orphaned.members.length > 0) {
      const firstMember = orphaned.members[0];

      console.log(`   👑 Auto-promoting ${firstMember.users.email} to owner`);

      // Update team member role to owner
      await db
        .update(teamMembers)
        .set({ role: 'owner' })
        .where(eq(teamMembers.id, firstMember.team_members.id));

      // Update user global role to owner
      await db
        .update(users)
        .set({ role: 'owner' })
        .where(eq(users.id, firstMember.users.id));

      console.log(`   ✅ ${firstMember.users.email} is now owner of "${orphaned.team.name}"`);
    }
  }

  // Clean up empty teams (no members at all)
  console.log('\n🧹 Cleaning up empty teams...');

  const emptyTeams = [];
  for (const team of allTeams) {
    const members = await db
      .select()
      .from(teamMembers)
      .innerJoin(users, and(
        eq(users.id, teamMembers.userId),
        isNull(users.deletedAt)
      ))
      .where(eq(teamMembers.teamId, team.id));

    if (members.length === 0) {
      emptyTeams.push(team);
    }
  }

  console.log(`📋 Found ${emptyTeams.length} completely empty teams`);

  for (const emptyTeam of emptyTeams) {
    console.log(`   🗑️ Deleting empty team: "${emptyTeam.name}" (ID: ${emptyTeam.id})`);

    // Delete any remaining team member records (from deleted users)
    await db
      .delete(teamMembers)
      .where(eq(teamMembers.teamId, emptyTeam.id));

    // Delete the team
    try {
      await db
        .delete(teams)
        .where(eq(teams.id, emptyTeam.id));

      console.log(`   ✅ Deleted team "${emptyTeam.name}"`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ Could not delete team "${emptyTeam.name}": ${errorMessage}`);
      console.log('     (Probably has activity logs - leaving it)');
    }
  }

  console.log('\n✅ Orphaned teams fix completed!');
}

// Run if called directly
if (require.main === module) {
  fixOrphanedTeams().catch(console.error);
}

export default fixOrphanedTeams;