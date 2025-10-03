import { NextRequest, NextResponse } from 'next/server';
import { updateCallLogWithTranscript } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { callLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// ElevenLabs webhook data types
interface ElevenLabsTranscriptWebhook {
  call_id: string; // This should match the Twilio CallSid
  transcript: string;
  cost_usd?: number; // Cost in USD
  cost_sek?: number; // Cost in SEK if converted
  duration_seconds?: number;
  tokens_used?: number;
  character_count?: number;
  voice_id?: string;
  model?: string;
}

function calculateElevenLabsCost(characterCount: number, isSwedish = true): number {
  // ElevenLabs pricing (approximate): $0.30 per 1000 characters for professional voices
  const pricePerCharacter = 0.30 / 1000;
  const costUSD = characterCount * pricePerCharacter;

  // Convert to SEK (approximate rate: 1 USD = 10.5 SEK)
  const exchangeRate = isSwedish ? 10.5 : 1;
  return Math.round(costUSD * exchangeRate * 100) / 100; // Round to 2 decimals
}

export async function POST(request: NextRequest) {
  try {
    const data: ElevenLabsTranscriptWebhook = await request.json();

    console.log('🎤 ELEVENLABS WEBHOOK MOTTAGEN:', {
      timestamp: new Date().toISOString(),
      call_id: data.call_id,
      transcriptLength: data.transcript?.length || 0,
      cost: data.cost_usd || data.cost_sek,
      characterCount: data.character_count,
    });

    if (!data.call_id || !data.transcript) {
      return NextResponse.json({
        error: 'Missing required fields: call_id or transcript'
      }, { status: 400 });
    }

    // Calculate ElevenLabs cost if not provided
    let elevenlabsCost = data.cost_sek || 0;
    if (!elevenlabsCost && data.character_count) {
      elevenlabsCost = calculateElevenLabsCost(data.character_count);
      console.log('💸 BERÄKNAD ELEVENLABS-KOSTNAD från tecken:', {
        characterCount: data.character_count,
        costSEK: `${elevenlabsCost} kr`
      });
    } else if (!elevenlabsCost && data.cost_usd) {
      elevenlabsCost = data.cost_usd * 10.5; // Convert USD to SEK
      console.log('💸 KONVERTERAD ELEVENLABS-KOSTNAD från USD:', {
        costUSD: `$${data.cost_usd}`,
        costSEK: `${elevenlabsCost} kr`
      });
    }

    console.log('🔍 SÖKER SAMTAL I DATABAS:', {
      callSid: data.call_id,
      transcriptLength: data.transcript.length,
      elevenlabsCost: `${elevenlabsCost} kr`
    });

    // Update call log with transcript and ElevenLabs cost, and update usage record
    const callLog = await updateCallLogWithTranscript(data.call_id, data.transcript, elevenlabsCost);

    if (!callLog) {
      console.error('❌ SAMTAL EJ HITTAT i databas:', data.call_id);
      return NextResponse.json({
        error: 'Call log not found for this CallSid',
        callSid: data.call_id,
        suggestion: 'Make sure the Twilio webhook was processed first'
      }, { status: 404 });
    }

    console.log('✅ TRANSKRIPT OCH KOSTNAD UPPDATERAD:', {
      timestamp: new Date().toISOString(),
      callLogId: callLog.id,
      callSid: data.call_id,
      transcriptLength: `${data.transcript.length} tecken`,
      elevenlabsCost: `${elevenlabsCost} kr`,
      totalProcessed: 'Samtal helt bearbetat'
    });
    console.log(`   ElevenLabs cost: ${elevenlabsCost} SEK`);
    console.log(`   CallSid: ${data.call_id}`);

    return NextResponse.json({
      success: true,
      message: 'Transcript logged successfully',
      data: {
        callLogId: callLog.id,
        customerId: callLog.customerId,
        transcriptLength: data.transcript.length,
        elevenlabsCost: elevenlabsCost,
        callSid: data.call_id
      }
    });

  } catch (error) {
    console.error('ElevenLabs webhook error:', error);
    return NextResponse.json({
      error: 'Failed to process webhook',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Handle ElevenLabs webhook verification
export async function GET() {
  return NextResponse.json({
    status: 'ElevenLabs Transcript Webhook Endpoint',
    endpoint: '/api/elevenlabs/transcript',
    note: 'This endpoint expects call_id to match Twilio CallSid'
  });
}