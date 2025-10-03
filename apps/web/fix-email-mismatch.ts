import { db } from './lib/db/drizzle';
import { users, teams, teamMembers, invitations } from './lib/db/schema';
import { and, eq, isNull, like } from 'drizzle-orm';

async function fixEmailMismatch() {
  console.log('Starting email mismatch fix...');

  // Find bruscbatak04@ user (without gmail.com)
  const bruscUser = await db
    .select()
    .from(users)
    .where(and(
      like(users.email, 'bruscbatak04@%'),
      isNull(users.deletedAt)
    ));

  console.log('Found users with bruscbatak04@:', bruscUser.map(u => ({
    id: u.id,
    email: u.email,
    role: u.role
  })));

  // Find their team memberships
  for (const user of bruscUser) {
    const memberships = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, user.id));

    console.log(`User ${user.email} (ID: ${user.id}) memberships:`, memberships.map(m => ({
      teamId: m.teamId,
      role: m.role
    })));

    // Find invitations for this user
    const userInvitations = await db
      .select()
      .from(invitations)
      .where(eq(invitations.email, user.email));

    console.log(`Invitations for ${user.email}:`, userInvitations.map(i => ({
      teamId: i.teamId,
      role: i.role,
      status: i.status
    })));

    // If user has no team membership but has pending invitation, fix it
    if (memberships.length === 0 && userInvitations.length > 0) {
      const invitation = userInvitations.find(i => i.status === 'pending');
      if (invitation) {
        console.log(`Adding ${user.email} to team ${invitation.teamId} as ${invitation.role}`);

        // Add user to invited team
        await db
          .insert(teamMembers)
          .values({
            userId: user.id,
            teamId: invitation.teamId,
            role: invitation.role
          });

        // Update user role if needed
        if (invitation.role === 'owner' && user.role !== 'owner') {
          await db
            .update(users)
            .set({ role: 'owner' })
            .where(eq(users.id, user.id));
        } else if (invitation.role === 'member' && user.role === 'owner') {
          await db
            .update(users)
            .set({ role: 'member' })
            .where(eq(users.id, user.id));
        }

        // Accept invitation
        await db
          .update(invitations)
          .set({ status: 'accepted' })
          .where(eq(invitations.id, invitation.id));

        console.log(`✅ Fixed ${user.email} - added to team ${invitation.teamId}`);
      }
    }
  }

  // Also check for any team membership conflicts where user owns team but should be member of another
  for (const user of bruscUser) {
    const memberships = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, user.id));

    const pendingInvitations = await db
      .select()
      .from(invitations)
      .where(and(
        eq(invitations.email, user.email),
        eq(invitations.status, 'pending')
      ));

    if (memberships.length > 0 && pendingInvitations.length > 0) {
      console.log(`User ${user.email} has both team membership and pending invitations - checking conflicts`);

      for (const invitation of pendingInvitations) {
        const currentMembership = memberships.find(m => m.teamId !== invitation.teamId);

        if (currentMembership) {
          console.log(`Moving ${user.email} from team ${currentMembership.teamId} to team ${invitation.teamId}`);

          // Remove from current team
          await db
            .delete(teamMembers)
            .where(eq(teamMembers.userId, user.id));

          // Add to invited team
          await db
            .insert(teamMembers)
            .values({
              userId: user.id,
              teamId: invitation.teamId,
              role: invitation.role
            });

          // Update user role if needed
          if (invitation.role === 'owner' && user.role !== 'owner') {
            await db
              .update(users)
              .set({ role: 'owner' })
              .where(eq(users.id, user.id));
          } else if (invitation.role === 'member' && user.role === 'owner') {
            await db
              .update(users)
              .set({ role: 'member' })
              .where(eq(users.id, user.id));
          }

          // Accept invitation
          await db
            .update(invitations)
            .set({ status: 'accepted' })
            .where(eq(invitations.id, invitation.id));

          console.log(`✅ Moved ${user.email} to correct team ${invitation.teamId}`);
        }
      }
    }
  }

  console.log('Email mismatch fix completed!');
}

// Run if called directly
if (require.main === module) {
  fixEmailMismatch().catch(console.error);
}

export default fixEmailMismatch;