const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000';

export interface WebhookConfig {
  customerId: number;
  twilioNumber?: string;
  elevenlabsAgentId?: string;
}

export async function configureTwilioWebhook(config: WebhookConfig) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !config.twilioNumber) {
    throw new Error('Twilio credentials eller nummer saknas');
  }

  const webhookUrl = `${BASE_URL}/api/twilio/call-status?customerId=${config.customerId}`;

  try {
    console.log(`🔗 Konfigurerar Twilio webhook för kund ${config.customerId}...`);

    // Twilio API för att uppdatera nummer-webhook
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(config.twilioNumber)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Twilio API fel: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const phoneNumbers = data.incoming_phone_numbers;

    if (phoneNumbers.length === 0) {
      throw new Error(`Twilio nummer ${config.twilioNumber} hittas inte i ditt konto`);
    }

    const phoneNumberSid = phoneNumbers[0].sid;

    // Uppdatera webhook URL
    const updateResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${phoneNumberSid}.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          StatusCallback: webhookUrl,
          StatusCallbackEvent: 'initiated,ringing,answered,completed',
          StatusCallbackMethod: 'POST',
        }),
      }
    );

    if (!updateResponse.ok) {
      throw new Error(`Twilio webhook update fel: ${updateResponse.status} ${updateResponse.statusText}`);
    }

    console.log(`✅ Twilio webhook konfigurerad: ${webhookUrl}`);
    return {
      status: 'active' as const,
      url: webhookUrl,
      message: 'Twilio webhook framgångsrikt konfigurerad'
    };

  } catch (error) {
    console.error('❌ Twilio webhook fel:', error);
    return {
      status: 'error' as const,
      url: null,
      message: error instanceof Error ? error.message : 'Okänt fel'
    };
  }
}

export async function createElevenlabsWebhook(config: WebhookConfig & { elevenlabsApiKey?: string }) {
  const apiKey = config.elevenlabsApiKey || ELEVENLABS_API_KEY;
  if (!apiKey || !config.elevenlabsAgentId) {
    throw new Error('ElevenLabs API nyckel eller Agent ID saknas');
  }

  const webhookUrl = `${BASE_URL}/api/elevenlabs/agent-callback?customerId=${config.customerId}`;

  try {
    console.log(`🤖 Skapar ElevenLabs webhook för kund ${config.customerId}...`);

    // Step 1: Create webhook first
    const webhookResponse = await fetch('https://api.elevenlabs.io/v1/webhooks', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Customer ${config.customerId} Webhook`,
        url: webhookUrl,
        webhook_type: 'agent_webhook',
        authentication_method: 'hmac_sha256',
        webhook_secret: process.env.ELEVENLABS_WEBHOOK_SECRET?.replace('wsec_', '') || '',
      }),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      throw new Error(`ElevenLabs webhook skapande fel: ${webhookResponse.status} ${errorText}`);
    }

    const webhookData = await webhookResponse.json();
    console.log('✅ ElevenLabs webhook skapad:', webhookData.webhook_id);

    // Step 2: Configure agent to use this webhook
    const agentResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${config.elevenlabsAgentId}`,
      {
        method: 'PATCH',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook_settings: {
            webhook_id: webhookData.webhook_id, // Use webhook ID
            events: ['post_call_transcription', 'post_call_audio']
          }
        }),
      }
    );

    if (!agentResponse.ok) {
      // Fallback: Set webhook at workspace level if agent-level fails
      console.log('🔄 Agent-level webhook misslyckades, försöker workspace-level...');

      const workspaceResponse = await fetch(
        'https://api.elevenlabs.io/v1/convai/agents/webhook-settings',
        {
          method: 'PUT',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: webhookUrl,
            events: ['post_call_transcription', 'post_call_audio']
          }),
        }
      );

      if (!workspaceResponse.ok) {
        throw new Error(`ElevenLabs Agent webhook fel: ${workspaceResponse.status} ${workspaceResponse.statusText}`);
      }
    }

    console.log(`✅ ElevenLabs Agent webhook konfigurerad: ${webhookUrl}`);

    return {
      status: 'active' as const,
      url: webhookUrl,
      message: 'ElevenLabs Agent webhook framgångsrikt konfigurerad'
    };

  } catch (error) {
    console.error('❌ ElevenLabs Agent webhook fel:', error);
    return {
      status: 'error' as const,
      url: null,
      message: error instanceof Error ? error.message : 'Okänt fel'
    };
  }
}

export async function testWebhookConnection(webhookUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`🧪 Testar webhook: ${webhookUrl}`);

    const testPayload = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Webhook test från BATAK SOLUTIONS'
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BATAK-SOLUTIONS-Webhook-Test/1.0'
      },
      body: JSON.stringify(testPayload),
    });

    if (response.ok) {
      console.log('✅ Webhook test framgångsrik');
      return {
        success: true,
        message: 'Webhook svarar korrekt'
      };
    } else {
      return {
        success: false,
        message: `Webhook returnerade status: ${response.status}`
      };
    }
  } catch (error) {
    console.error('❌ Webhook test misslyckades:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Nätverksfel'
    };
  }
}

export function generateWebhookUrls(customerId: number) {
  return {
    twilio: `${BASE_URL}/api/twilio/call-status?customerId=${customerId}`,
    elevenlabs: `${BASE_URL}/api/elevenlabs/agent-callback?customerId=${customerId}`
  };
}