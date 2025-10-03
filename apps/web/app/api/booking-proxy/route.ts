import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Parse JSON from ElevenLabs
    const jsonData = await request.json();

    console.log('🎯 Booking Proxy: Received data from ElevenLabs:', jsonData);

    // Convert JSON to form-urlencoded format
    const formData = new URLSearchParams();

    // Add all the required fields
    const requiredFields = [
      'inp_namn',
      'inp_tfn',
      'inp_epost',
      'kalender_datum',
      'inp_bokning_datum',
      'inp_sittningsserie_id',
      'inp_antal_personer',
      'inp_varav_barn',
      'inp_from_tid',
      'inp_tom_tid',
      'inp_valt_alt_sittning'
    ];

    // Add required fields
    requiredFields.forEach(field => {
      if (jsonData[field] !== undefined) {
        formData.append(field, String(jsonData[field]));
      }
    });

    // Add optional fields
    if (jsonData.inp_meddelande) {
      formData.append('inp_meddelande', jsonData.inp_meddelande);
    }

    console.log('🔄 Converting to form-urlencoded:', formData.toString());

    // Send request to Bordsbokaren API
    const bordsbokarenResponse = await fetch(
      'https://bordsbokaren.se/boka-actions.php?i=1043&k=vXQ1bg2R&l=se-SE&action=boka',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (compatible; TorstensBot/1.0)',
        },
        body: formData,
        redirect: 'manual' // Don't follow redirects automatically
      }
    );

    console.log('📡 Bordsbokaren response status:', bordsbokarenResponse.status);
    console.log('📡 Bordsbokaren response headers:', Object.fromEntries(bordsbokarenResponse.headers.entries()));

    // Check if we got a 302 redirect (success)
    if (bordsbokarenResponse.status === 302) {
      const locationHeader = bordsbokarenResponse.headers.get('location');
      console.log('✅ Booking successful! Redirect location:', locationHeader);

      // Try to extract booking ID from redirect URL
      let bookingId = null;
      if (locationHeader) {
        const urlParams = new URL(locationHeader, 'https://bordsbokaren.se').searchParams;
        bookingId = urlParams.get('b') || urlParams.get('booking_id') || urlParams.get('id') || 'unknown';
      }

      // Return success response to ElevenLabs
      return NextResponse.json({
        success: true,
        message: `Bokning bekräftad för ${jsonData.inp_namn} den ${jsonData.inp_bokning_datum} kl ${jsonData.inp_from_tid?.split(' ')[1] || 'okänd tid'}`,
        booking_id: bookingId,
        redirect_url: locationHeader
      });
    }

    // If not 302, try to read the response body for error details
    const responseText = await bordsbokarenResponse.text();
    console.log('❌ Booking failed. Response body:', responseText.substring(0, 500));

    return NextResponse.json({
      success: false,
      message: `Bokningen kunde inte genomföras. Status: ${bordsbokarenResponse.status}`,
      error_details: responseText.substring(0, 200),
      status: bordsbokarenResponse.status
    }, { status: 400 });

  } catch (error) {
    console.error('💥 Booking proxy error:', error);

    return NextResponse.json({
      success: false,
      message: 'Ett tekniskt fel uppstod vid bokning',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Optional: Add GET method for testing
export async function GET() {
  return NextResponse.json({
    message: 'Booking Proxy is running',
    endpoint: '/api/booking-proxy',
    method: 'POST',
    description: 'Converts ElevenLabs JSON to Bordsbokaren form-urlencoded'
  });
}