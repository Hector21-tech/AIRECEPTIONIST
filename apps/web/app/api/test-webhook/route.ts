import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 TESTAR WEBHOOK SIMULERING');

    // Ensure test customer exists first
    const testPhoneNumber = '+46707654321';

    // Import needed modules
    const { getUser, getTeamForUser, createCustomer } = await import('@/lib/db/queries');
    const { db } = await import('@/lib/db/drizzle');
    const { customers } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamData = await getTeamForUser();
    if (!teamData) {
      return NextResponse.json({ error: 'User not part of any team' }, { status: 400 });
    }

    // Check if test customer exists
    let testCustomer = await db
      .select()
      .from(customers)
      .where(eq(customers.twilioNumber, testPhoneNumber))
      .limit(1);

    if (testCustomer.length === 0) {
      console.log('🏢 Skapar test-kund...');
      const newCustomer = await createCustomer({
        name: 'Test Företag AB',
        contactName: 'Anna Testsson',
        contactPhone: '+46701234567',
        contactEmail: 'test@testforetag.se',
        twilioNumber: testPhoneNumber,
        elevenlabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
        planType: 'Standard',
        description: 'Automatiskt skapad test-kund för webhook-testning'
      });
      console.log('✅ Test-kund skapad:', newCustomer.name);
    } else {
      console.log('✅ Test-kund finns redan');
    }

    // Simulera Twilio webhook data
    const testTwilioData = new URLSearchParams({
      CallSid: `CA${Math.random().toString(36).substr(2, 32)}`,
      CallStatus: 'completed',
      From: '+46701234567',
      To: testPhoneNumber,
      CallDuration: '120', // 2 minuter
      Price: '-0.05', // $0.05
      PriceUnit: 'USD'
    });

    console.log('📞 Skickar test Twilio webhook...');

    // Anropa Twilio webhook
    const twilioResponse = await fetch(`${request.nextUrl.origin}/api/twilio/call-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: testTwilioData
    });

    const twilioResult = await twilioResponse.json();
    console.log('📞 Twilio webhook result:', twilioResult);

    // Vänta lite, sedan simulera ElevenLabs webhook
    await new Promise(resolve => setTimeout(resolve, 1000));

    const testElevenLabsData = {
      call_id: testTwilioData.get('CallSid'),
      transcript: "Hej! Tack för att du ringer till oss. Hur kan jag hjälpa dig idag? Jag förstår att du vill boka ett bord för imorgon kväll. Låt mig kolla våra lediga tider...",
      character_count: 150,
      cost_usd: 0.045,
      voice_id: "21m00Tcm4TlvDq8ikWAM"
    };

    console.log('🎤 Skickar test ElevenLabs webhook...');

    // Anropa ElevenLabs webhook
    const elevenLabsResponse = await fetch(`${request.nextUrl.origin}/api/elevenlabs/transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testElevenLabsData)
    });

    const elevenLabsResult = await elevenLabsResponse.json();
    console.log('🎤 ElevenLabs webhook result:', elevenLabsResult);

    return NextResponse.json({
      success: true,
      message: 'Test webhooks completed',
      results: {
        twilio: twilioResult,
        elevenLabs: elevenLabsResult
      }
    });

  } catch (error) {
    console.error('❌ Test webhook error:', error);
    return NextResponse.json({
      error: 'Test webhook failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}