import express from 'express';
import { ElevenLabsSync } from '../src/elevenlabs-sync.js';

const router = express.Router();

/**
 * POST /api/elevenlabs/add-document
 *
 * Add document to existing Knowledge Base without recreating KB
 *
 * Body: {
 *   kbId: string,
 *   text: string,
 *   name: string,
 *   apiKey?: string (optional, uses env var if not provided)
 * }
 */
router.post('/add-document', async (req, res) => {
  try {
    const { kbId, text, name, apiKey } = req.body;

    if (!kbId || !text || !name) {
      return res.status(400).json({
        success: false,
        error: 'kbId, text, and name are required'
      });
    }

    console.log(`📄 Adding document to KB: ${kbId}`);
    console.log(`   Name: ${name}`);
    console.log(`   Content length: ${text.length} chars`);

    // Initialize ElevenLabs sync with provided API key or env var
    const sync = new ElevenLabsSync({
      apiKey: apiKey || process.env.ELEVENLABS_API_KEY
    });

    // Add document to existing KB
    const result = await sync.addDocumentToKB(kbId, text, name);

    console.log(`✅ Document added successfully (ID: ${result.id})`);

    res.json({
      success: true,
      documentId: result.id,
      documentName: result.name || name,
      knowledgeBaseId: kbId,
      message: 'Document added to Knowledge Base successfully'
    });

  } catch (error) {
    console.error('❌ Failed to add document to KB:', error.message);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
