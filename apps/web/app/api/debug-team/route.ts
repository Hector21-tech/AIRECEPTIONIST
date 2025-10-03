import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { users, teams, teamMembers, invitations } from '@/lib/db/schema';
import { eq, isNull } from 'drizzle-orm';

export async function GET() {
  const user = await getUser();

  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Get all user info
  const userInfo = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  // Get user's team memberships
  const memberships = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id));

  // Get user's invitations
  const userInvitations = await db
    .select()
    .from(invitations)
    .where(eq(invitations.email, user.email));

  // If user has team membership, get full team data
  let teamData = null;
  if (memberships.length > 0) {
    const teamId = memberships[0].teamId;

    // Get team info
    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    // Get all team members
    const allMembers = await db
      .select({
        id: teamMembers.id,
        userId: teamMembers.userId,
        teamId: teamMembers.teamId,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email
        }
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, teamId));

    teamData = {
      team: team[0],
      members: allMembers
    };
  }

  return Response.json({
    user: userInfo[0],
    memberships,
    invitations: userInvitations,
    teamData,
    debug: {
      userId: user.id,
      userEmail: user.email,
      membershipCount: memberships.length,
      invitationCount: userInvitations.length
    }
  });
}