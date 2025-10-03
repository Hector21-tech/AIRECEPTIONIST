import { db } from './lib/db/drizzle';

async function updateVoiceToAgent() {
  console.log('🔄 Uppdaterar voice_id kolumn till agent_id...');

  try {
    // Rename voice_id column to agent_id
    await db.execute(`
      ALTER TABLE customers
      RENAME COLUMN voice_id TO agent_id
    `);

    console.log('✅ Kolumn uppdaterad från voice_id till agent_id!');
  } catch (error) {
    console.error('❌ Fel vid uppdatering av kolumn:', error);
    throw error;
  }
}

updateVoiceToAgent()
  .then(() => {
    console.log('🎉 Migration klar!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration misslyckades:', error);
    process.exit(1);
  });