import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

/**
 * GET /api/restaurant/:slug/dagens
 *
 * Hämta dagens special content för en restaurang
 */
router.get('/:slug/dagens', async (req, res) => {
  try {
    const { slug } = req.params;

    console.log(`📋 Fetching dagens content for: ${slug}`);

    // Sökväg till restaurang-data
    const restaurantPath = path.join(process.cwd(), 'restaurants', slug);
    const voiceAiPath = path.join(restaurantPath, 'voice-ai.txt');

    // Läs voice-ai.txt
    const content = await fs.readFile(voiceAiPath, 'utf-8');

    // Extrahera dagens section (detta kan förbättras baserat på faktisk struktur)
    // För nu returnerar vi hela innehållet, men i produktion bör vi parsa och extrahera dagens
    const dagensContent = extractDagensSection(content);

    console.log(`✅ Dagens content found (${dagensContent.length} chars)`);

    res.json({
      success: true,
      slug,
      content: dagensContent,
      fullContent: content, // För debugging
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Failed to get dagens for ${req.params.slug}:`, error.message);

    if (error.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        error: `Restaurant '${req.params.slug}' not found or not scraped yet`
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Extrahera dagens section från voice-ai content
 * TODO: Förbättra detta baserat på faktisk content-struktur
 */
function extractDagensSection(content) {
  // Försök hitta "dagens" section
  const dagensRegex = /##\s*dagens.*?\n([\s\S]*?)(?=##|$)/i;
  const match = content.match(dagensRegex);

  if (match && match[1]) {
    return `## Dagens Special\n${match[1].trim()}`;
  }

  // Om ingen special section hittades, returnera hela innehållet
  // (första gången kan hela menyn behöva läggas till)
  return content;
}

export default router;
