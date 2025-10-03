import { NextRequest, NextResponse } from 'next/server';
import { createUsageRecord } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const usage = await createUsageRecord(body);
    return NextResponse.json(usage);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create usage record' }, { status: 500 });
  }
}