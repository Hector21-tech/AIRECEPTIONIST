import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { callLogs, customers } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return NextResponse.json({ error: 'User must be part of a team' }, { status: 400 });
    }

    // Fetch all calls for the user's team with customer information
    const calls = await db
      .select({
        id: callLogs.id,
        callSid: callLogs.callSid,
        fromNumber: callLogs.fromNumber,
        toNumber: callLogs.toNumber,
        outcome: callLogs.outcome,
        duration: callLogs.duration,
        datetime: callLogs.datetime,
        transcript: callLogs.transcript,
        elevenlabsCost: callLogs.elevenlabsCost,
        customerName: customers.name,
        customerId: callLogs.customerId,
        audioData: callLogs.audioData, // Legacy - keep for backward compatibility
        audioFileName: callLogs.audioFileName, // New Supabase Storage filename
      })
      .from(callLogs)
      .innerJoin(customers, eq(callLogs.customerId, customers.id))
      .where(eq(customers.teamId, userWithTeam.teamId))
      .orderBy(desc(callLogs.datetime))
      .limit(50); // Limit to latest 50 calls

    return NextResponse.json({
      success: true,
      calls: calls
    });

  } catch (error) {
    console.error('Get calls error:', error);
    return NextResponse.json({
      error: 'Failed to fetch calls',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}