import fs from 'fs/promises';
import path from 'path';

/**
 * Konverterar knowledge.jsonl till voice-ai.txt format
 * @param {string} restaurantPath - Sökväg till restaurangmappen
 */
export async function convertKnowledgeToVoiceAI(restaurantPath) {
  const knowledgePath = path.join(restaurantPath, 'knowledge.jsonl');
  const voiceAIPath = path.join(restaurantPath, 'voice-ai.txt');

  try {
    // Läs knowledge.jsonl
    const content = await fs.readFile(knowledgePath, 'utf-8');
    const lines = content.trim().split('\n');

    // Konvertera varje rad till Q&A format
    const qaBlocks = lines.map(line => {
      try {
        const item = JSON.parse(line);
        return `Q: ${item.q}\nA: ${item.a}`;
      } catch (err) {
        console.warn(`⚠️  Skipped invalid JSON line: ${line.substring(0, 50)}...`);
        return null;
      }
    }).filter(Boolean);

    // Skapa voice-ai.txt innehåll
    const voiceAIContent = qaBlocks.join('\n\n') + '\n';

    // Spara filen
    await fs.writeFile(voiceAIPath, voiceAIContent, 'utf-8');

    console.log(`✅ Converted ${lines.length} items to voice-ai.txt`);
    return voiceAIPath;

  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`knowledge.jsonl not found in ${restaurantPath}`);
    }
    throw error;
  }
}
