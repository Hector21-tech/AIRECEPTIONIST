import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

export async function POST() {
  try {
    console.log('🔧 Adding audio_data column to call_logs table...');

    await db.execute(sql`
      ALTER TABLE call_logs
      ADD COLUMN IF NOT EXISTS audio_data text
    `);

    console.log('✅ audio_data column added successfully');

    return NextResponse.json({
      success: true,
      message: 'audio_data column added successfully'
    });

  } catch (error) {
    console.error('Add audio column error:', error);
    return NextResponse.json({
      error: 'Failed to add audio column',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}