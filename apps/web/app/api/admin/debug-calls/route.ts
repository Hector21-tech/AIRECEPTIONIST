import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { callLogs, customers } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('🔍 Debug: Fetching calls data...');

    const calls = await db
      .select({
        id: callLogs.id,
        callSid: callLogs.callSid,
        customerId: callLogs.customerId,
        customerName: customers.name,
        datetime: callLogs.datetime,
        transcript: callLogs.transcript,
        elevenlabsCost: callLogs.elevenlabsCost,
        duration: callLogs.duration,
        outcome: callLogs.outcome,
        audioData: callLogs.audioData,
      })
      .from(callLogs)
      .innerJoin(customers, eq(callLogs.customerId, customers.id))
      .orderBy(desc(callLogs.datetime))
      .limit(10);

    console.log('📋 Calls found:', calls.length);

    const callsWithTranscriptInfo = calls.map(call => ({
      ...call,
      hasTranscript: !!call.transcript,
      transcriptLength: call.transcript?.length || 0,
      transcriptPreview: call.transcript ? call.transcript.substring(0, 100) + '...' : null,
      hasAudio: !!call.audioData,
      audioDataLength: call.audioData?.length || 0
    }));

    return NextResponse.json({
      success: true,
      totalCalls: calls.length,
      calls: callsWithTranscriptInfo
    });

  } catch (error) {
    console.error('Debug calls error:', error);
    return NextResponse.json({
      error: 'Failed to fetch debug calls',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}