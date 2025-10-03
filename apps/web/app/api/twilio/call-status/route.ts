import { NextRequest, NextResponse } from 'next/server';
import { createCallLog, updateOrCreateUsageRecord, getCustomer } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { customers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Twilio webhook data types
interface TwilioCallStatusWebhook {
  CallSid: string;
  From: string;
  To: string;
  CallStatus: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer' | 'canceled';
  CallDuration?: string;
  RecordingUrl?: string;
  RecordingSid?: string;
  Timestamp?: string;
  // Pricing fields (available for completed calls)
  Price?: string;
  PriceUnit?: string;
}

function calculateRevenue(durationSeconds: number, pricePerMinute: number): number {
  const minutes = durationSeconds / 60;
  return Math.round(minutes * pricePerMinute * 100) / 100; // Round to 2 decimals
}

function calculateMargin(revenue: number, cost: number): number {
  return Math.round((revenue - cost) * 100) / 100; // Round to 2 decimals
}

export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio webhook
    const formData = await request.formData();
    const data: Partial<TwilioCallStatusWebhook> = {};

    // Convert FormData to object with proper type handling
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        (data as any)[key] = value;
      }
    }

    console.log('🔔 TWILIO WEBHOOK MOTTAGEN:', {
      timestamp: new Date().toISOString(),
      callSid: data.CallSid,
      status: data.CallStatus,
      from: data.From,
      to: data.To,
      duration: data.CallDuration,
      price: data.Price,
      priceUnit: data.PriceUnit,
      allData: data
    });

    // Only process completed calls for billing
    if (data.CallStatus !== 'completed' || !data.CallDuration) {
      console.log('⏸️ SAMTAL EJ KLART - Hoppar över fakturering:', {
        status: data.CallStatus,
        duration: data.CallDuration,
        callSid: data.CallSid
      });
      return NextResponse.json({ received: true, message: 'Call not billable yet' });
    }

    const callSid = data.CallSid!;
    const fromNumber = data.From!;
    const toNumber = data.To!;
    const durationSeconds = parseInt(data.CallDuration!);
    const twilioPrice = data.Price ? parseFloat(data.Price) : 0;
    const priceUnit = data.PriceUnit || 'USD';

    // Find customer by Twilio number (the "To" number should match customer's twilioNumber)
    const customer = await db
      .select()
      .from(customers)
      .where(eq(customers.twilioNumber, toNumber))
      .limit(1);

    if (customer.length === 0) {
      console.error('❌ KUND EJ HITTAD för Twilio-nummer:', toNumber);
      return NextResponse.json({
        error: 'Customer not found for this Twilio number',
        twilioNumber: toNumber
      }, { status: 404 });
    }

    const customerData = customer[0];
    const durationMinutes = durationSeconds / 60;

    console.log('📋 KUND HITTAD:', {
      customerName: customerData.name,
      customerId: customerData.id,
      planType: customerData.planType,
      durationMinutes: durationMinutes.toFixed(2)
    });

    // Extract price per minute from planType or use default
    let pricePerMinute = 5.00; // Default price
    if (customerData.planType && customerData.planType.includes('Premium')) {
      pricePerMinute = 8.00;
    }

    console.log('💰 PRISBERÄKNING:', {
      pricePerMinute: `${pricePerMinute} kr/min`,
      planType: customerData.planType,
      duration: `${durationMinutes.toFixed(2)} min`,
      twilioPrice: `${twilioPrice} ${priceUnit}`
    });

    // Calculate revenue, cost, and margin
    const revenue = calculateRevenue(durationSeconds, pricePerMinute);
    const cost = Math.abs(twilioPrice); // Twilio price is usually negative
    const margin = calculateMargin(revenue, cost);

    console.log('🧮 KOSTNADSBERÄKNING KLAR:', {
      revenue: `${revenue} kr`,
      cost: `${cost} ${priceUnit}`,
      margin: `${margin} kr`,
      marginPercent: revenue > 0 ? `${((margin / revenue) * 100).toFixed(1)}%` : '0%'
    });

    // Create basic call log with Twilio data - ElevenLabs will update with transcript
    await createCallLog({
      customerId: customerData.id,
      transcript: '', // Will be filled by ElevenLabs webhook
      outcome: 'completed',
      duration: data.CallDuration!,
      cost: cost.toString(),
      callSid: callSid,
      fromNumber: fromNumber,
      toNumber: toNumber,
    });

    console.log('📞 TWILIO SKAPAR GRUNDLÄGGANDE SAMTALSLOGG - ElevenLabs kommer fylla i transkript');

    // Create or update daily usage record
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    await updateOrCreateUsageRecord({
      customerId: customerData.id,
      date: today,
      minutesUsed: durationMinutes,
      cost: cost,
      revenue: revenue,
      margin: margin,
      callCount: 1,
    });

    console.log('✅ SAMTAL BEARBETAT OCH SPARAT:', {
      timestamp: new Date().toISOString(),
      customer: customerData.name,
      callSid: callSid,
      duration: `${durationMinutes.toFixed(2)} min`,
      revenue: `${revenue} kr`,
      cost: `${cost} ${priceUnit}`,
      margin: `${margin} kr`,
      marginPercent: revenue > 0 ? `${((margin / revenue) * 100).toFixed(1)}%` : '0%',
      usageRecordUpdated: 'Skapad'
    });

    return NextResponse.json({
      success: true,
      message: 'Call logged successfully',
      data: {
        customer: customerData.name,
        duration: durationMinutes,
        revenue,
        cost,
        margin,
        callSid
      }
    });

  } catch (error) {
    console.error('Twilio webhook error:', error);
    return NextResponse.json({
      error: 'Failed to process webhook',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Handle Twilio webhook verification (optional but recommended)
export async function GET() {
  return NextResponse.json({
    status: 'Twilio Call Status Webhook Endpoint',
    endpoint: '/api/twilio/call-status'
  });
}