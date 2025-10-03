import { NextRequest, NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { callLogs, customers, usage } from '@/lib/db/schema';
import { desc, eq, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamData = await getTeamForUser();
    if (!teamData) {
      return NextResponse.json({ error: 'User not part of any team' }, { status: 400 });
    }

    // Get recent call logs with customer info for the team
    const recentActivity = await db
      .select({
        id: callLogs.id,
        timestamp: callLogs.datetime,
        customer: customers.name,
        callSid: callLogs.callSid,
        fromNumber: callLogs.fromNumber,
        toNumber: callLogs.toNumber,
        duration: callLogs.duration,
        cost: callLogs.cost,
        elevenlabsCost: callLogs.elevenlabsCost,
        outcome: callLogs.outcome
      })
      .from(callLogs)
      .innerJoin(customers, eq(callLogs.customerId, customers.id))
      .where(eq(customers.teamId, teamData.id))
      .orderBy(desc(callLogs.datetime))
      .limit(5);

    // Format the data for the frontend
    const formattedActivity = recentActivity.map(activity => ({
      ...activity,
      type: 'call',
      description: `Samtal med ${activity.customer} - ${activity.duration} sek`,
      metadata: {
        customer: activity.customer,
        duration: activity.duration,
        cost: activity.cost,
        elevenlabsCost: activity.elevenlabsCost,
        callSid: activity.callSid
      }
    }));

    return NextResponse.json({
      activities: formattedActivity,
      totalCount: formattedActivity.length
    });

  } catch (error) {
    console.error('Get activity logs error:', error);
    return NextResponse.json({
      error: 'Failed to fetch activity logs',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}