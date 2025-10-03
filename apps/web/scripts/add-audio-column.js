// Quick script to add audio_data column to call_logs table
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function addAudioColumn() {
  try {
    console.log('Adding audio_data column to call_logs table...');
    await sql`
      ALTER TABLE call_logs
      ADD COLUMN IF NOT EXISTS audio_data text
    `;
    console.log('✅ Column added successfully');
  } catch (error) {
    if (error.code === '42701') {
      console.log('✅ Column already exists');
    } else {
      console.error('❌ Error:', error);
    }
  } finally {
    await sql.end();
  }
}

addAudioColumn();