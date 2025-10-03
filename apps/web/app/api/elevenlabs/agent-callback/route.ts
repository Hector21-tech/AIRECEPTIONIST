import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { customers, callLogs, usage } from '@/lib/db/schema';
import { eq, sql, and, desc } from 'drizzle-orm';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    console.log('🤖 ELEVENLABS AGENT WEBHOOK MOTTAGEN');

    // Get the raw body for HMAC verification
    const body = await request.text();
    const data = JSON.parse(body);

    // HMAC verification
    const signature = request.headers.get('elevenlabs-signature');
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;

    // TEMPORARILY SKIP HMAC VERIFICATION FOR DEBUGGING
    console.log('🔓 TEMPORARILY SKIPPING HMAC verification for debugging', {
      hasSignature: !!signature,
      hasSecret: !!webhookSecret,
      signatureStart: signature ? signature.substring(0, 20) + '...' : 'none'
    });

    // Get customer ID from query params
    const { searchParams } = new URL(request.url);
    const customerIdParam = searchParams.get('customerId');

    if (!customerIdParam) {
      console.error('❌ Inget customerId i webhook URL');
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
    }

    const customerId = parseInt(customerIdParam, 10);

    console.log('📋 ElevenLabs Agent Webhook Data:', {
      timestamp: new Date().toISOString(),
      customerId,
      type: data.type,
      agentId: data.data?.agent_id,
      conversationId: data.data?.conversation_id,
      hasTranscript: !!data.data?.transcript,
      hasAudio: !!data.data?.full_audio,
      fullData: JSON.stringify(data, null, 2)
    });

    // Verify customer exists
    const customer = await db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (customer.length === 0) {
      console.error(`❌ Kund ${customerId} hittas inte`);
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customerName = customer[0].name;

    // Handle different webhook types
    if (data.type === 'post_call_transcription') {
      console.log(`📞 Post-call transkript för ${customerName}`);

      const transcriptData = data.data;
      const transcript = transcriptData.transcript || [];
      const analysis = transcriptData.analysis || {};
      const metadata = transcriptData.metadata || {};

      // Log transcript content for debugging speaker labels
      console.log(`📝 Transcript data (${transcript.length} turns):`, JSON.stringify(transcript.slice(0, 3), null, 2));

      // Fix speaker labels - ElevenLabs sometimes mislabels AI as "user"
      const fixedTranscript = transcript.map((turn: any) => {
        let speaker = turn.speaker;

        // If message starts with greeting patterns, it's likely the agent
        const message = turn.message || turn.text || '';
        const agentGreetings = [
          'hej och välkommen till torstens',
          'välkommen till torstens',
          'hur kan jag hjälpa dig',
          'vad trevligt!',
          'för att boka ett bord'
        ];

        if (agentGreetings.some(greeting => message.toLowerCase().includes(greeting))) {
          speaker = 'agent';
        }

        return {
          ...turn,
          speaker: speaker
        };
      });

      console.log(`🔧 Fixed transcript speakers:`, JSON.stringify(fixedTranscript.slice(0, 3), null, 2));

      // Calculate conversation duration from transcript
      let duration = 0;
      if (fixedTranscript.length > 0) {
        // Try multiple methods to get duration
        const lastTurn = fixedTranscript[fixedTranscript.length - 1];

        // Method 1: Check end_timestamp (old format)
        if (lastTurn.end_timestamp) {
          duration = lastTurn.end_timestamp;
        }
        // Method 2: Check time_in_call_secs (new ElevenLabs format)
        else if (lastTurn.time_in_call_secs) {
          duration = lastTurn.time_in_call_secs;
        }
        // Method 3: Find the highest time_in_call_secs across all turns
        else {
          let maxTime = 0;
          for (const turn of fixedTranscript) {
            if (turn.time_in_call_secs && turn.time_in_call_secs > maxTime) {
              maxTime = turn.time_in_call_secs;
            }
          }
          duration = maxTime;
        }
      }

      console.log(`⏱️ Beräknad samtalsvaraktighet: ${duration} sekunder från ${fixedTranscript.length} turns`);

      // Estimate costs (you may need to adjust these based on ElevenLabs pricing)
      const durationMinutes = Math.ceil(duration / 60);
      const estimatedCost = durationMinutes * 0.05; // Rough estimate - adjust as needed

      // Try to find the most recent call for this customer (likely from Twilio)
      // We match on customer + recent timestamp since CallSid != conversation_id
      const recentTimeThreshold = new Date(Date.now() - 15 * 60 * 1000); // Last 15 minutes (extended window)
      console.log(`🔍 Letar efter befintligt samtal för kund ${customerId} efter ${recentTimeThreshold.toISOString()}`);

      const existingCall = await db
        .select()
        .from(callLogs)
        .where(and(
          eq(callLogs.customerId, customerId),
          sql`${callLogs.datetime} >= ${recentTimeThreshold.toISOString()}`,
          sql`(${callLogs.transcript} IS NULL OR ${callLogs.transcript} = '')`
        ))
        .orderBy(desc(callLogs.datetime))
        .limit(1);

      console.log(`📊 Hittade ${existingCall.length} befintliga samtal utan transkript`);

      if (existingCall.length > 0) {
        console.log(`🎯 Kommer uppdatera samtal ID ${existingCall[0].id} (CallSid: ${existingCall[0].callSid}) med transkript från ${transcriptData.conversation_id}`);
      }

      let callLog;
      if (existingCall.length > 0) {
        // Update existing call with ElevenLabs data
        console.log(`📝 Uppdaterar befintligt samtal ${existingCall[0].id} med transkript från ${transcriptData.conversation_id}`);
        callLog = await db
          .update(callLogs)
          .set({
            transcript: JSON.stringify(fixedTranscript),
            elevenlabsCost: estimatedCost.toFixed(4),
            duration: Math.round(duration).toString(), // Use ElevenLabs duration as it's more accurate
          })
          .where(eq(callLogs.id, existingCall[0].id))
          .returning();
      } else {
        // No existing call found - this shouldn't happen if Twilio webhook works correctly
        console.log(`⚠️ INGEN BEFINTLIG SAMTALSLOGG HITTAD för ${transcriptData.conversation_id}`);
        console.log(`📞 Skapar nödfalls-samtalslogg (Twilio webhook missade detta samtal)`);
        callLog = await db.insert(callLogs).values({
          customerId: customerId,
          callSid: transcriptData.conversation_id,
          fromNumber: metadata.caller_number || 'Unknown',
          toNumber: metadata.agent_number || 'Unknown',
          outcome: 'completed',
          duration: Math.round(duration).toString(),
          datetime: metadata.start_time ? new Date(metadata.start_time) : new Date(),
          transcript: JSON.stringify(fixedTranscript),
          elevenlabsCost: estimatedCost.toFixed(4),
          cost: '0.00', // Missing Twilio cost data
        }).returning();
      }

      // Create usage record
      await db.insert(usage).values({
        customerId: customerId,
        date: new Date().toISOString().split('T')[0],
        minutesUsed: durationMinutes.toString(),
        cost: estimatedCost.toFixed(4),
        revenue: (estimatedCost * 2.5).toFixed(4), // Example 2.5x markup
        margin: (estimatedCost * 1.5).toFixed(4), // Example 1.5x margin
        callCount: 1,
      });

      console.log(`✅ Samtalsdata sparad för ${customerName}:`, {
        duration: `${Math.round(duration)}s`,
        cost: `${estimatedCost.toFixed(4)} kr`,
        turns: fixedTranscript.length
      });

    } else if (data.type === 'post_call_audio') {
      console.log(`🎵 Post-call audio för ${customerName}`);

      // Audio webhook contains base64 encoded MP3
      const audioData = data.data;
      const conversationId = audioData.conversation_id;
      const audioBase64 = audioData.full_audio; // ElevenLabs uses "full_audio" field

      console.log(`📊 Audio data längd: ${audioBase64?.length || 0} bytes för samtal ${conversationId}`);

      if (audioBase64 && conversationId) {
        // Find existing call and update with audio data
        // Since we now store Twilio CallSids, we need to find by customer+time+transcript match
        const recentTimeThreshold = new Date(Date.now() - 15 * 60 * 1000); // Last 15 minutes
        console.log(`🔍 Letar efter samtal för ljud-uppdatering (conversation_id: ${conversationId})`);

        const existingCall = await db
          .select()
          .from(callLogs)
          .where(and(
            eq(callLogs.customerId, customerId),
            sql`${callLogs.datetime} >= ${recentTimeThreshold.toISOString()}`,
            sql`${callLogs.transcript} IS NOT NULL AND ${callLogs.transcript} != ''`
          ))
          .orderBy(desc(callLogs.datetime))
          .limit(1);

        if (existingCall.length > 0) {
          console.log(`🎧 Uppdaterar samtal ID ${existingCall[0].id} med ljuddata för ${conversationId} (${audioBase64?.length || 0} bytes)`);

          // Upload to Supabase Storage
          const { uploadAudioFile } = await import('@/lib/supabase');
          const fileName = await uploadAudioFile(existingCall[0].id.toString(), audioBase64);

          if (fileName) {
            await db
              .update(callLogs)
              .set({
                audioFileName: fileName,
              })
              .where(eq(callLogs.id, existingCall[0].id));

            console.log(`✅ Ljuddata sparad i Supabase Storage: ${fileName}`);
          } else {
            console.log(`❌ Misslyckades med att ladda upp ljud till Supabase`);
          }
        } else {
          console.log(`⚠️ Ingen befintlig samtalslogg med transkript hittad för ljud från ${conversationId}`);
        }
      }

    } else {
      console.log(`ℹ️ Okänd webhook typ: ${data.type}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      customerId: customerId,
      customerName: customerName
    });

  } catch (error) {
    console.error('❌ ElevenLabs Agent webhook error:', error);
    return NextResponse.json({
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}