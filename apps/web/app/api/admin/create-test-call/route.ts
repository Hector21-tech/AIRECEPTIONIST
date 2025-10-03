import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { callLogs } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Creating test call record...');

    const testCall = await db.insert(callLogs).values({
      customerId: 7, // Torstens ängelholm
      callSid: 'test_' + Date.now(),
      fromNumber: '+46701234567',
      toNumber: '+1234567890',
      outcome: 'completed',
      duration: '45',
      datetime: new Date(),
      transcript: JSON.stringify([
        {
          speaker: 'user',
          message: 'Hej, jag skulle vilja boka en tid.',
          start_timestamp: 0,
          end_timestamp: 3
        },
        {
          speaker: 'agent',
          message: 'Hej! Självklart, vilken dag passar dig bäst?',
          start_timestamp: 3,
          end_timestamp: 8
        },
        {
          speaker: 'user',
          message: 'Kan jag få en tid på fredag?',
          start_timestamp: 8,
          end_timestamp: 12
        },
        {
          speaker: 'agent',
          message: 'Ja det går bra! Jag bokar in dig på fredag klockan 10. Tack så mycket!',
          start_timestamp: 12,
          end_timestamp: 18
        }
      ]),
      elevenlabsCost: '2.50',
    }).returning();

    console.log('✅ Test call created');

    return NextResponse.json({
      success: true,
      message: 'Test call created',
      call: testCall[0]
    });

  } catch (error) {
    console.error('Create test call error:', error);
    return NextResponse.json({
      error: 'Failed to create test call',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}