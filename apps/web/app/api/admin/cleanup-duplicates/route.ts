import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { callLogs } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    // Skip auth for admin cleanup
    console.log('🔧 Admin cleanup requested');

    console.log('🧹 Rensar dubletter i call_logs...');

    // Find and delete duplicates - keep the one with transcript (ElevenLabs data)
    const duplicateQuery = sql`
      WITH duplicate_calls AS (
        SELECT
          id,
          call_sid,
          transcript,
          ROW_NUMBER() OVER (
            PARTITION BY call_sid
            ORDER BY
              CASE WHEN transcript IS NOT NULL AND transcript != '' THEN 0 ELSE 1 END,
              datetime DESC
          ) as rn
        FROM call_logs
        WHERE call_sid IS NOT NULL
        AND call_sid != ''
      )
      DELETE FROM call_logs
      WHERE id IN (
        SELECT id
        FROM duplicate_calls
        WHERE rn > 1
      )
    `;

    const result = await db.execute(duplicateQuery);

    console.log('✅ Dubletter rensade');

    return NextResponse.json({
      success: true,
      message: 'Dubletter rensade framgångsrikt',
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({
      error: 'Failed to cleanup duplicates',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}