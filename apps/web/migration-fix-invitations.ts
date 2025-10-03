import { db } from './lib/db/drizzle';
import { users, teams, teamMembers, invitations } from './lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

async function fixOrphanedInvitations() {
  console.log('Starting comprehensive invitation fix migration...');

  // Find ALL users with potential team problems
  console.log('1. Finding users with pending invitations...');
  const usersWithPendingInvitations = await db
    .select({
      userId: users.id,
      userEmail: users.email,
      userRole: users.role,
      invitationId: invitations.id,
      invitationTeamId: invitations.teamId,
      invitationRole: invitations.role,
      currentTeamId: teamMembers.teamId,
      currentTeamRole: teamMembers.role
    })
    .from(users)
    .innerJoin(invitations, and(
      eq(invitations.email, users.email),
      eq(invitations.status, 'pending')
    ))
    .leftJoin(teamMembers, eq(teamMembers.userId, users.id))
    .where(isNull(users.deletedAt));

  console.log(`Found ${usersWithPendingInvitations.length} users with pending invitations`);

  // Find users who should be in teams but have no teamMembers entry
  console.log('2. Finding users missing teamMembers entries...');
  const allUsers = await db
    .select({
      userId: users.id,
      userEmail: users.email,
      userRole: users.role
    })
    .from(users)
    .where(isNull(users.deletedAt));

  console.log(`Total active users: ${allUsers.length}`);

  // Check each user for team membership
  const usersWithoutTeams = [];
  for (const user of allUsers) {
    const teamMembership = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, user.userId))
      .limit(1);

    if (teamMembership.length === 0) {
      console.log(`User ${user.userEmail} (ID: ${user.userId}) has no team membership`);
      usersWithoutTeams.push(user);
    }
  }

  console.log(`Found ${usersWithoutTeams.length} users without any team membership`);

  // Process users with pending invitations
  const problemUsers = usersWithPendingInvitations;

  console.log('3. Processing users with pending invitations...');
  for (const problem of problemUsers) {
    console.log(`Processing user: ${problem.userEmail}`);
    console.log(`  - Current team: ${problem.currentTeamId} (role: ${problem.currentTeamRole})`);
    console.log(`  - Invited to team: ${problem.invitationTeamId} (role: ${problem.invitationRole})`);

    if (problem.currentTeamId && problem.invitationTeamId &&
        problem.currentTeamId !== problem.invitationTeamId) {

      console.log(`  - User has own team but was invited to different team`);
      console.log(`  - Moving user to invited team: ${problem.invitationTeamId}`);

      // Remove from current team
      await db
        .delete(teamMembers)
        .where(eq(teamMembers.userId, problem.userId));

      // Add to invited team
      await db
        .insert(teamMembers)
        .values({
          userId: problem.userId,
          teamId: problem.invitationTeamId,
          role: problem.invitationRole
        });

      // Update user role if needed
      if (problem.invitationRole === 'owner' && problem.userRole !== 'owner') {
        await db
          .update(users)
          .set({ role: 'owner' })
          .where(eq(users.id, problem.userId));
      } else if (problem.invitationRole === 'member' && problem.userRole === 'owner') {
        await db
          .update(users)
          .set({ role: 'member' })
          .where(eq(users.id, problem.userId));
      }

      // Accept the invitation
      await db
        .update(invitations)
        .set({ status: 'accepted' })
        .where(eq(invitations.id, problem.invitationId));

      console.log(`  - ✅ Fixed user ${problem.userEmail}`);
    } else if (!problem.currentTeamId && problem.invitationTeamId) {
      console.log(`  - User has no team but has invitation - adding to invited team`);

      // Add to invited team
      await db
        .insert(teamMembers)
        .values({
          userId: problem.userId,
          teamId: problem.invitationTeamId,
          role: problem.invitationRole
        });

      // Update user role if needed
      if (problem.invitationRole === 'owner' && problem.userRole !== 'owner') {
        await db
          .update(users)
          .set({ role: 'owner' })
          .where(eq(users.id, problem.userId));
      }

      // Accept the invitation
      await db
        .update(invitations)
        .set({ status: 'accepted' })
        .where(eq(invitations.id, problem.invitationId));

      console.log(`  - ✅ Added user ${problem.userEmail} to team ${problem.invitationTeamId}`);
    }
  }

  // Handle users without any team membership (create default teams for them)
  console.log('4. Creating teams for users without any team membership...');
  for (const user of usersWithoutTeams) {
    // Skip users who have pending invitations (already handled above)
    const hasPendingInvitation = problemUsers.some(p => p.userId === user.userId);
    if (hasPendingInvitation) {
      continue;
    }

    console.log(`Creating team for user: ${user.userEmail}`);

    // Create new team
    const [newTeam] = await db
      .insert(teams)
      .values({
        name: `${user.userEmail}'s Team`
      })
      .returning();

    // Add user as owner of the team
    await db
      .insert(teamMembers)
      .values({
        userId: user.userId,
        teamId: newTeam.id,
        role: 'owner'
      });

    // Update user role to owner
    await db
      .update(users)
      .set({ role: 'owner' })
      .where(eq(users.id, user.userId));

    console.log(`  - ✅ Created team ${newTeam.id} for user ${user.userEmail}`);
  }

  console.log('Migration completed!');
}

// Run if called directly
if (require.main === module) {
  fixOrphanedInvitations().catch(console.error);
}

export default fixOrphanedInvitations;