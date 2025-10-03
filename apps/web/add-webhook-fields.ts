import { db } from './lib/db/drizzle';

async function addWebhookFields() {
  console.log('🔧 Lägger till webhook-fält i customers tabellen...');

  try {
    // Add webhook status fields
    await db.execute(`
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS webhook_twilio_status VARCHAR(20) DEFAULT 'inactive',
      ADD COLUMN IF NOT EXISTS webhook_elevenlabs_status VARCHAR(20) DEFAULT 'inactive',
      ADD COLUMN IF NOT EXISTS webhook_twilio_url TEXT,
      ADD COLUMN IF NOT EXISTS webhook_elevenlabs_url TEXT
    `);

    console.log('✅ Webhook-fält tillagda framgångsrikt!');
  } catch (error) {
    console.error('❌ Fel vid tillägg av webhook-fält:', error);
    throw error;
  }
}

addWebhookFields()
  .then(() => {
    console.log('🎉 Migration klar!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration misslyckades:', error);
    process.exit(1);
  });