import { NextRequest, NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { callLogs, customers, usage, teams } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all data for debugging
    const allCustomers = await db.select().from(customers);
    const allCallLogs = await db.select().from(callLogs);
    const allUsage = await db.select().from(usage);
    const allTeams = await db.select().from(teams);
    const teamData = await getTeamForUser();

    console.log('🔍 DEBUG DATA:', {
      user: { id: user.id, email: user.email },
      teamData: teamData,
      allCustomers: allCustomers.length,
      allCallLogs: allCallLogs.length,
      allUsage: allUsage.length,
      allTeams: allTeams.length
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      teamData: teamData,
      counts: {
        customers: allCustomers.length,
        callLogs: allCallLogs.length,
        usage: allUsage.length,
        teams: allTeams.length
      },
      data: {
        customers: allCustomers,
        callLogs: allCallLogs.slice(0, 5), // Only first 5
        usage: allUsage.slice(0, 5), // Only first 5
        teams: allTeams
      }
    });

  } catch (error) {
    console.error('Debug data error:', error);
    return NextResponse.json({
      error: 'Failed to fetch debug data',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}