import { NextResponse } from 'next/server';

export async function GET() {
  // Test data that matches your specification
  const testData = {
    "inp_namn": "Anna Karlsson",
    "inp_tfn": "0707216637",
    "inp_epost": "anna@example.com",
    "kalender_datum": "2025-09-27",
    "inp_bokning_datum": "2025-09-27",
    "inp_sittningsserie_id": "4973",
    "inp_antal_personer": 4,
    "inp_varav_barn": 0,
    "inp_from_tid": "2025-09-27 19:30",
    "inp_tom_tid": "2025-09-27 21:30",
    "inp_valt_alt_sittning": "false",
    "inp_meddelande": "vi firar födelsedag"
  };

  try {
    console.log('🧪 Testing booking proxy with data:', testData);

    // Call our booking proxy
    const response = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/booking-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();

    console.log('🧪 Booking proxy response:', result);

    return NextResponse.json({
      test_result: result,
      test_data_sent: testData,
      proxy_status: response.status,
      message: response.ok ? 'Test completed successfully' : 'Test failed'
    });

  } catch (error) {
    console.error('🧪 Test booking error:', error);

    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      test_data_sent: testData
    }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({
    message: 'Use GET method to run test',
    test_endpoint: '/api/test-booking',
    actual_endpoint: '/api/booking-proxy'
  });
}