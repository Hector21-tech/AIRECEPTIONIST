'use server';

import { z } from 'zod';
import { and, eq, sql, isNull, desc } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  User,
  users,
  teams,
  teamMembers,
  activityLogs,
  type NewUser,
  type NewTeam,
  type NewTeamMember,
  type NewActivityLog,
  ActivityType,
  invitations
} from '@/lib/db/schema';
import { comparePasswords, hashPassword, setSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import {
  validatedAction,
  validatedActionWithUser
} from '@/lib/auth/middleware';

async function logActivity(
  teamId: number | null | undefined,
  userId: number,
  type: ActivityType,
  ipAddress?: string
) {
  if (teamId === null || teamId === undefined) {
    return;
  }
  const newActivity: NewActivityLog = {
    teamId,
    userId,
    action: type,
    ipAddress: ipAddress || ''
  };
  await db.insert(activityLogs).values(newActivity);
}

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100)
});

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password } = data;

  const userWithTeam = await db
    .select({
      user: users,
      team: teams
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  if (userWithTeam.length === 0) {
    return {
      error: 'Invalid email or password. Please try again.',
      email,
      password
    };
  }

  const { user: foundUser, team: foundTeam } = userWithTeam[0];

  const isPasswordValid = await comparePasswords(
    password,
    foundUser.passwordHash
  );

  if (!isPasswordValid) {
    return {
      error: 'Invalid email or password. Please try again.',
      email,
      password
    };
  }

  await Promise.all([
    setSession(foundUser),
    logActivity(foundTeam?.id, foundUser.id, ActivityType.SIGN_IN)
  ]);

  redirect('/overview');
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteId: z.string().optional()
});

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { email, password, inviteId } = data;

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    return {
      error: 'Failed to create user. Please try again.',
      email,
      password
    };
  }

  const passwordHash = await hashPassword(password);

  const newUser: NewUser = {
    email,
    passwordHash,
    role: 'member' // Default role for new users
  };

  const [createdUser] = await db.insert(users).values(newUser).returning();

  if (!createdUser) {
    return {
      error: 'Failed to create user. Please try again.',
      email,
      password
    };
  }

  let teamId: number;
  let userRole: string;
  let createdTeam: typeof teams.$inferSelect | null = null;

  // Check for pending invitation (either by inviteId or email)
  let invitation = null;

  if (inviteId) {
    // Check if there's a valid invitation by ID
    const [invitationById] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, parseInt(inviteId)),
          eq(invitations.email, email),
          eq(invitations.status, 'pending')
        )
      )
      .limit(1);
    invitation = invitationById;
  } else {
    // Check if there's a pending invitation for this email
    const [invitationByEmail] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.status, 'pending')
        )
      )
      .orderBy(desc(invitations.invitedAt))
      .limit(1);
    invitation = invitationByEmail;
  }

  if (invitation) {
    // Accept the invitation
    teamId = invitation.teamId;
    userRole = invitation.role;

    await db
      .update(invitations)
      .set({ status: 'accepted' })
      .where(eq(invitations.id, invitation.id));

    await logActivity(teamId, createdUser.id, ActivityType.ACCEPT_INVITATION);

    [createdTeam] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
  } else if (inviteId) {
    return { error: 'Invalid or expired invitation.', email, password };
  } else {
    // Create a new team if there's no invitation
    const newTeam: NewTeam = {
      name: `${email}'s Team`
    };

    [createdTeam] = await db.insert(teams).values(newTeam).returning();

    if (!createdTeam) {
      return {
        error: 'Failed to create team. Please try again.',
        email,
        password
      };
    }

    teamId = createdTeam.id;
    userRole = 'owner';

    // Set user as owner when they create their own team
    await db.update(users).set({ role: 'owner' }).where(eq(users.id, createdUser.id));

    await logActivity(teamId, createdUser.id, ActivityType.CREATE_TEAM);
  }

  const newTeamMember: NewTeamMember = {
    userId: createdUser.id,
    teamId: teamId,
    role: userRole
  };

  await Promise.all([
    db.insert(teamMembers).values(newTeamMember),
    logActivity(teamId, createdUser.id, ActivityType.SIGN_UP),
    setSession(createdUser)
  ]);

  redirect('/overview');
});

export async function signOut() {
  const user = await getUser();
  if (user) {
    const userWithTeam = await getUserWithTeam(user.id);
    await logActivity(userWithTeam?.teamId, user.id, ActivityType.SIGN_OUT);
  }
  (await cookies()).delete('session');
  redirect('/sign-in');
}

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(100),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100)
});

export const updatePassword = validatedActionWithUser(
  updatePasswordSchema,
  async (data, _, user) => {
    const { currentPassword, newPassword, confirmPassword } = data;

    const isPasswordValid = await comparePasswords(
      currentPassword,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'Current password is incorrect.'
      };
    }

    if (currentPassword === newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'New password must be different from the current password.'
      };
    }

    if (confirmPassword !== newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'New password and confirmation password do not match.'
      };
    }

    const newPasswordHash = await hashPassword(newPassword);
    const userWithTeam = await getUserWithTeam(user.id);

    await Promise.all([
      db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, user.id)),
      logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_PASSWORD)
    ]);

    return {
      success: 'Password updated successfully.'
    };
  }
);

const deleteAccountSchema = z.object({
  password: z.string().min(8).max(100)
});

export const deleteAccount = validatedActionWithUser(
  deleteAccountSchema,
  async (data, _, user) => {
    const { password } = data;

    const isPasswordValid = await comparePasswords(password, user.passwordHash);
    if (!isPasswordValid) {
      return {
        password,
        error: 'Incorrect password. Account deletion failed.'
      };
    }

    const userWithTeam = await getUserWithTeam(user.id);

    // SAFETY CHECK: Handle team ownership before deletion
    if (userWithTeam?.teamId && user.role === 'owner') {
      // Count active owners and members
      const activeOwners = await db
        .select()
        .from(teamMembers)
        .innerJoin(users, and(
          eq(users.id, teamMembers.userId),
          isNull(users.deletedAt)
        ))
        .where(
          and(
            eq(teamMembers.teamId, userWithTeam.teamId),
            eq(teamMembers.role, 'owner')
          )
        );

      const allActiveMembers = await db
        .select()
        .from(teamMembers)
        .innerJoin(users, and(
          eq(users.id, teamMembers.userId),
          isNull(users.deletedAt)
        ))
        .where(eq(teamMembers.teamId, userWithTeam.teamId));

      // If this user is the only owner but there are other members, promote someone
      if (activeOwners.length === 1 && allActiveMembers.length > 1) {
        const otherMembers = allActiveMembers.filter(m =>
          m.team_members.userId !== user.id && m.team_members.role === 'member'
        );

        if (otherMembers.length > 0) {
          const newOwner = otherMembers[0];
          console.log(`Auto-promoting ${newOwner.users.email} to owner before ${user.email} deletes account`);

          // Promote first member to owner
          await db
            .update(teamMembers)
            .set({ role: 'owner' })
            .where(eq(teamMembers.id, newOwner.team_members.id));

          // Update user's global role
          await db
            .update(users)
            .set({ role: 'owner' })
            .where(eq(users.id, newOwner.users.id));
        }
      }
    }

    await logActivity(
      userWithTeam?.teamId,
      user.id,
      ActivityType.DELETE_ACCOUNT
    );

    // Soft delete
    const timestamp = Date.now();
    await db
      .update(users)
      .set({
        deletedAt: sql`CURRENT_TIMESTAMP`,
        email: `${user.email}-deleted-${timestamp}` // Ensure email uniqueness
      })
      .where(eq(users.id, user.id));

    if (userWithTeam?.teamId) {
      await db
        .delete(teamMembers)
        .where(
          and(
            eq(teamMembers.userId, user.id),
            eq(teamMembers.teamId, userWithTeam.teamId)
          )
        );
    }

    // Clean up pending invitations for this email to prevent role conflicts
    await db
      .delete(invitations)
      .where(
        and(
          eq(invitations.email, user.email),
          eq(invitations.status, 'pending')
        )
      );

    (await cookies()).delete('session');
    redirect('/sign-in');
  }
);

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address')
});

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
    const { name, email } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    await Promise.all([
      db.update(users).set({ name, email }).where(eq(users.id, user.id)),
      logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_ACCOUNT)
    ]);

    return { name, success: 'Account updated successfully.' };
  }
);

const updateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100)
});

export const updateTeam = validatedActionWithUser(
  updateTeamSchema,
  async (data, _, user) => {
    const { name } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    if (!userWithTeam?.teamId) {
      return { error: 'User is not part of a team' };
    }

    if (user.role !== 'owner') {
      return { error: 'Only team owners can update team settings' };
    }

    await db.update(teams).set({
      name,
      updatedAt: new Date()
    }).where(eq(teams.id, userWithTeam.teamId));

    return { success: 'Team name updated successfully.' };
  }
);

const removeTeamMemberSchema = z.object({
  memberId: z.string().transform((val) => parseInt(val, 10))
});

export const removeTeamMember = validatedActionWithUser(
  removeTeamMemberSchema,
  async (data, _, user) => {
    const { memberId } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    if (!userWithTeam?.teamId) {
      return { error: 'User is not part of a team' };
    }

    // Get the member being removed
    const memberToRemove = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.id, memberId),
          eq(teamMembers.teamId, userWithTeam.teamId)
        )
      )
      .limit(1);

    if (memberToRemove.length === 0) {
      return { error: 'Team member not found' };
    }

    // Prevent self-removal via this action (use leaveTeam instead)
    if (memberToRemove[0].userId === user.id) {
      return { error: 'Cannot remove yourself. Use "Leave Team" instead.' };
    }

    // Only owners can remove other members
    if (user.role !== 'owner') {
      return { error: 'Only team owners can remove members' };
    }

    await db
      .delete(teamMembers)
      .where(eq(teamMembers.id, memberId));

    await logActivity(
      userWithTeam.teamId,
      user.id,
      ActivityType.REMOVE_TEAM_MEMBER
    );

    return { success: 'Team member removed successfully' };
  }
);

export const leaveTeam = validatedActionWithUser(
  z.object({}),
  async (data, _, user) => {
    const userWithTeam = await getUserWithTeam(user.id);

    if (!userWithTeam?.teamId) {
      return { error: 'You are not part of a team' };
    }

    // Get current team info
    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, userWithTeam.teamId))
      .limit(1);

    if (team.length === 0) {
      return { error: 'Team not found' };
    }

    // Count ACTIVE owners in the team (exclude deleted users)
    const activeOwners = await db
      .select()
      .from(teamMembers)
      .innerJoin(users, and(
        eq(users.id, teamMembers.userId),
        isNull(users.deletedAt)
      ))
      .where(
        and(
          eq(teamMembers.teamId, userWithTeam.teamId),
          eq(teamMembers.role, 'owner')
        )
      );

    // Count all ACTIVE members
    const allActiveMembers = await db
      .select()
      .from(teamMembers)
      .innerJoin(users, and(
        eq(users.id, teamMembers.userId),
        isNull(users.deletedAt)
      ))
      .where(eq(teamMembers.teamId, userWithTeam.teamId));

    // If user is the only owner but there are other members, auto-promote first member
    if (user.role === 'owner' && activeOwners.length === 1 && allActiveMembers.length > 1) {
      const otherMembers = allActiveMembers.filter(m =>
        m.team_members.userId !== user.id && m.team_members.role === 'member'
      );

      if (otherMembers.length > 0) {
        const newOwner = otherMembers[0];
        console.log(`Auto-promoting ${newOwner.users.email} to owner before ${user.email} leaves`);

        // Promote first member to owner
        await db
          .update(teamMembers)
          .set({ role: 'owner' })
          .where(eq(teamMembers.id, newOwner.team_members.id));

        // Update user's global role
        await db
          .update(users)
          .set({ role: 'owner' })
          .where(eq(users.id, newOwner.users.id));
      }
    } else if (user.role === 'owner' && activeOwners.length === 1 && allActiveMembers.length === 1) {
      // User is only member - team will be deleted
      console.log(`User ${user.email} is leaving as only member, team will be deleted`);
    }

    // Remove user from team
    await db
      .delete(teamMembers)
      .where(eq(teamMembers.userId, user.id));

    // Update user role to member if they were owner
    if (user.role === 'owner') {
      await db
        .update(users)
        .set({ role: 'member' })
        .where(eq(users.id, user.id));
    }

    await logActivity(
      userWithTeam.teamId,
      user.id,
      ActivityType.REMOVE_TEAM_MEMBER
    );

    // Check if team is now empty and handle appropriately
    const remainingMembers = await db
      .select()
      .from(teamMembers)
      .innerJoin(users, and(
        eq(users.id, teamMembers.userId),
        isNull(users.deletedAt)
      ))
      .where(eq(teamMembers.teamId, userWithTeam.teamId));

    if (remainingMembers.length === 0) {
      // Team is now empty - delete it and create a new personal team for user
      console.log(`Team ${userWithTeam.teamId} is now empty, deleting and creating new team for ${user.email}`);

      try {
        await db
          .delete(teams)
          .where(eq(teams.id, userWithTeam.teamId));
      } catch (error) {
        console.log('Could not delete empty team (probably has activity logs)');
      }

      // Create new personal team for the user who left
      const [newTeam] = await db
        .insert(teams)
        .values({
          name: `${user.email}'s Team`
        })
        .returning();

      // Add user as owner of new team
      await db
        .insert(teamMembers)
        .values({
          userId: user.id,
          teamId: newTeam.id,
          role: 'owner'
        });

      // Update user role to owner
      await db
        .update(users)
        .set({ role: 'owner' })
        .where(eq(users.id, user.id));

      console.log(`✅ Created new team "${newTeam.name}" for ${user.email}`);

      return { success: 'Left team and created your own team', redirect: true };
    }

    return { success: 'Successfully left the team', redirect: true };
  }
);

const inviteTeamMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['member', 'owner'])
});

export const inviteTeamMember = validatedActionWithUser(
  inviteTeamMemberSchema,
  async (data, _, user) => {
    const { email, role } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    if (!userWithTeam?.teamId) {
      return { error: 'User is not part of a team' };
    }

    const existingMember = await db
      .select()
      .from(users)
      .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
      .where(
        and(eq(users.email, email), eq(teamMembers.teamId, userWithTeam.teamId))
      )
      .limit(1);

    if (existingMember.length > 0) {
      return { error: 'User is already a member of this team' };
    }

    // Check if there's an existing invitation
    const existingInvitation = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.teamId, userWithTeam.teamId),
          eq(invitations.status, 'pending')
        )
      )
      .limit(1);

    if (existingInvitation.length > 0) {
      return { error: 'An invitation has already been sent to this email' };
    }

    // Create a new invitation
    await db.insert(invitations).values({
      teamId: userWithTeam.teamId,
      email,
      role,
      invitedBy: user.id,
      status: 'pending'
    });

    await logActivity(
      userWithTeam.teamId,
      user.id,
      ActivityType.INVITE_TEAM_MEMBER
    );

    // TODO: Send invitation email and include ?inviteId={id} to sign-up URL
    // await sendInvitationEmail(email, userWithTeam.team.name, role)

    return { success: 'Invitation sent successfully' };
  }
);

const acceptInvitationSchema = z.object({
  invitationId: z.string().transform((val) => parseInt(val, 10))
});

export const acceptInvitation = validatedActionWithUser(
  acceptInvitationSchema,
  async (data, _, user) => {
    const { invitationId } = data;

    // Get the invitation
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.email, user.email),
          eq(invitations.status, 'pending')
        )
      )
      .limit(1);

    if (!invitation) {
      return { error: 'Invalid or expired invitation' };
    }

    // Check if user is already a member of this team
    const existingMember = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, user.id),
          eq(teamMembers.teamId, invitation.teamId)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      return { error: 'You are already a member of this team' };
    }

    // Accept the invitation
    await Promise.all([
      db
        .update(invitations)
        .set({ status: 'accepted' })
        .where(eq(invitations.id, invitationId)),
      db.insert(teamMembers).values({
        userId: user.id,
        teamId: invitation.teamId,
        role: invitation.role
      }),
      logActivity(invitation.teamId, user.id, ActivityType.ACCEPT_INVITATION)
    ]);

    return { success: 'Invitation accepted successfully!' };
  }
);

const declineInvitationSchema = z.object({
  invitationId: z.string().transform((val) => parseInt(val, 10))
});

export const declineInvitation = validatedActionWithUser(
  declineInvitationSchema,
  async (data, _, user) => {
    const { invitationId } = data;

    // Update invitation status to declined
    const result = await db
      .update(invitations)
      .set({ status: 'declined' })
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.email, user.email),
          eq(invitations.status, 'pending')
        )
      );

    return { success: 'Invitation declined' };
  }
);
