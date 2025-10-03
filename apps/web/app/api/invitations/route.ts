import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { invitations, teams } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  try {
    const userInvitations = await db
      .select({
        id: invitations.id,
        teamId: invitations.teamId,
        teamName: teams.name,
        role: invitations.role,
        invitedAt: invitations.invitedAt,
        status: invitations.status
      })
      .from(invitations)
      .leftJoin(teams, eq(invitations.teamId, teams.id))
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.status, 'pending')
        )
      )
      .orderBy(invitations.invitedAt);

    return NextResponse.json({ invitations: userInvitations });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}