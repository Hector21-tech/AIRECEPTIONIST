import { NextRequest, NextResponse } from 'next/server';
import { getRealDashboardMetrics } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    let dateRange;
    if (fromParam && toParam) {
      dateRange = {
        from: new Date(fromParam),
        to: new Date(toParam)
      };
    }

    const metrics = await getRealDashboardMetrics(dateRange);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Real dashboard metrics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch real dashboard metrics' },
      { status: 500 }
    );
  }
}