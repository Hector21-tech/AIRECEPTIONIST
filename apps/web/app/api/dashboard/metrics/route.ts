import { NextResponse } from 'next/server';
import { getDashboardMetrics } from '@/lib/db/queries';

export async function GET() {
  try {
    const metrics = await getDashboardMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}