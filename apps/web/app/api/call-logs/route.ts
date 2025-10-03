import { NextRequest, NextResponse } from 'next/server';
import { createCallLog } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const callLog = await createCallLog(body);
    return NextResponse.json(callLog);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create call log' }, { status: 500 });
  }
}