import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('🔧 Adding audio_file_name column to call_logs table...');

    await db.execute(sql`
      ALTER TABLE call_logs
      ADD COLUMN IF NOT EXISTS audio_file_name VARCHAR(255)
    `);

    console.log('✅ audio_file_name column added successfully');

    return NextResponse.json({
      success: true,
      message: 'audio_file_name column added successfully'
    });

  } catch (error) {
    console.error('Add audio filename column error:', error);
    return NextResponse.json({
      error: 'Failed to add audio filename column',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}