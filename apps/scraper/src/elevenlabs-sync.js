#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';

/**
 * ElevenLabs Knowledge Base Sync
 *
 * Synkar voice-ai.txt till ElevenLabs knowledge base via API
 *
 * Workflow:
 * 1. Hitta befintligt dokument (GET /v1/convai/knowledge-base?search=...)
 * 2. Radera om det finns (DELETE /v1/convai/knowledge-base/:id)
 * 3. Skapa nytt (POST /v1/convai/knowledge-base/text)
 */
export class ElevenLabsSync {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.ELEVENLABS_API_KEY;
    this.baseUrl = options.baseUrl || 'https://api.elevenlabs.io/v1';

    if (!this.apiKey) {
      throw new Error('ELEVENLABS_API_KEY is required. Set it in .env or pass as option.');
    }
  }

  /**
   * Lista alla knowledge base dokument
   */
  async listDocuments(searchQuery = null) {
    const params = new URLSearchParams();
    if (searchQuery) {
      params.append('search', searchQuery);
    }

    const url = `${this.baseUrl}/convai/knowledge-base?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'xi-api-key': this.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list documents: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.documents || data || [];
  }

  /**
   * Hitta dokument efter namn
   */
  async findDocument(restaurantName, location) {
    const searchQuery = `${restaurantName} ${location}`;
    const documents = await this.listDocuments(searchQuery);

    // Exakt matchning
    const exactMatch = documents.find(doc =>
      doc.name && doc.name.toLowerCase() === searchQuery.toLowerCase()
    );

    if (exactMatch) {
      return exactMatch;
    }

    // Partiell matchning
    const partialMatch = documents.find(doc =>
      doc.name && doc.name.toLowerCase().includes(restaurantName.toLowerCase())
    );

    return partialMatch || null;
  }

  /**
   * Radera dokument
   */
  async deleteDocument(documentId, force = false) {
    const url = `${this.baseUrl}/convai/knowledge-base/${documentId}`;
    const params = new URLSearchParams();

    if (force) {
      params.append('force', 'true');
    }

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'DELETE',
      headers: {
        'xi-api-key': this.apiKey
      }
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete document: ${response.status} ${response.statusText}`);
    }

    return true;
  }

  /**
   * Skapa dokument från text
   */
  async createFromText(text, name) {
    const url = `${this.baseUrl}/convai/knowledge-base/text`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        name: name
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create document: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Skapa dokument från fil (multipart upload)
   */
  async createFromFile(filePath, name) {
    const url = `${this.baseUrl}/convai/knowledge-base/file`;

    const fileContent = await fs.readFile(filePath);
    const formData = new FormData();

    const blob = new Blob([fileContent], { type: 'text/plain' });
    formData.append('file', blob, path.basename(filePath));

    if (name) {
      formData.append('name', name);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload file: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Synka restaurang till ElevenLabs
   *
   * Workflow:
   * 1. Hitta befintligt dokument
   * 2. Radera om det finns
   * 3. Skapa nytt från voice-ai.txt
   */
  async syncRestaurant(restaurantPath, restaurantName, location) {
    console.log(`🔄 Syncing ${restaurantName} - ${location} to ElevenLabs...`);

    try {
      // Läs voice-ai.txt
      const txtPath = path.join(restaurantPath, 'voice-ai.txt');
      const txtContent = await fs.readFile(txtPath, 'utf-8');

      const documentName = `${restaurantName} - ${location}`;

      // 1. Hitta befintligt dokument
      console.log(`🔍 Searching for existing document: ${documentName}`);
      const existing = await this.findDocument(restaurantName, location);

      // 2. Radera om det finns
      if (existing) {
        console.log(`🗑️  Found existing document (ID: ${existing.id}), deleting...`);
        await this.deleteDocument(existing.id, true);
        console.log(`✅ Deleted existing document`);
      } else {
        console.log(`ℹ️  No existing document found`);
      }

      // 3. Skapa nytt dokument
      console.log(`📤 Creating new document: ${documentName}`);
      const result = await this.createFromText(txtContent, documentName);

      console.log(`✅ Successfully synced to ElevenLabs`);
      console.log(`   Document ID: ${result.id}`);
      console.log(`   Document Name: ${result.name}`);

      return {
        success: true,
        documentId: result.id,
        documentName: result.name,
        action: existing ? 'updated' : 'created'
      };

    } catch (error) {
      console.error(`❌ Failed to sync ${restaurantName} - ${location}:`, error.message);
      throw error;
    }
  }

  /**
   * Synka alla restauranger från output-mapp
   */
  async syncAll(outputDir = './restaurants') {
    console.log(`🚀 Starting sync of all restaurants from ${outputDir}...`);

    const results = {
      successful: [],
      failed: [],
      total: 0,
      startTime: new Date().toISOString()
    };

    try {
      // Läs alla restaurangmappar
      const entries = await fs.readdir(outputDir, { withFileTypes: true });
      const restaurantDirs = entries.filter(entry => entry.isDirectory());

      results.total = restaurantDirs.length;

      for (const dir of restaurantDirs) {
        const restaurantPath = path.join(outputDir, dir.name);

        try {
          // Läs info.json för restaurangnamn
          const infoPath = path.join(restaurantPath, 'info.json');
          const infoContent = await fs.readFile(infoPath, 'utf-8');
          const info = JSON.parse(infoContent);

          // Synka
          const result = await this.syncRestaurant(
            restaurantPath,
            info.name || dir.name,
            info.city || 'Unknown'
          );

          results.successful.push({
            slug: dir.name,
            name: info.name,
            city: info.city,
            documentId: result.documentId,
            action: result.action
          });

        } catch (error) {
          results.failed.push({
            slug: dir.name,
            error: error.message
          });
        }
      }

      results.endTime = new Date().toISOString();
      results.duration = new Date(results.endTime) - new Date(results.startTime);

      console.log('\n' + '='.repeat(70));
      console.log('📊 SYNC RESULTS');
      console.log('='.repeat(70));
      console.log(`✅ Successful: ${results.successful.length}/${results.total}`);
      console.log(`❌ Failed: ${results.failed.length}/${results.total}`);
      console.log(`⏱️  Duration: ${Math.round(results.duration / 1000)}s`);

      if (results.successful.length > 0) {
        console.log('\n✅ Successfully synced:');
        results.successful.forEach(r => {
          console.log(`   - ${r.name} (${r.city}) → ${r.documentId} [${r.action}]`);
        });
      }

      if (results.failed.length > 0) {
        console.log('\n❌ Failed to sync:');
        results.failed.forEach(r => {
          console.log(`   - ${r.slug}: ${r.error}`);
        });
      }

      return results;

    } catch (error) {
      console.error('❌ Sync all failed:', error.message);
      throw error;
    }
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('❌ ELEVENLABS_API_KEY environment variable is required');
    console.log('\nSet it in your .env file:');
    console.log('ELEVENLABS_API_KEY=xi-your-api-key-here');
    process.exit(1);
  }

  const sync = new ElevenLabsSync();

  try {
    switch (command) {
      case 'sync-all':
        const outputDir = args[1] || './restaurants';
        await sync.syncAll(outputDir);
        break;

      case 'sync':
        const restaurantPath = args[1];
        const restaurantName = args[2];
        const location = args[3];

        if (!restaurantPath || !restaurantName || !location) {
          console.error('Usage: node elevenlabs-sync.js sync <path> <name> <location>');
          process.exit(1);
        }

        await sync.syncRestaurant(restaurantPath, restaurantName, location);
        break;

      case 'list':
        const searchQuery = args[1];
        const documents = await sync.listDocuments(searchQuery);
        console.log(`📋 Found ${documents.length} documents:`);
        documents.forEach(doc => {
          console.log(`   - ${doc.name} (ID: ${doc.id})`);
        });
        break;

      case 'delete':
        const docId = args[1];
        if (!docId) {
          console.error('Usage: node elevenlabs-sync.js delete <document-id>');
          process.exit(1);
        }
        await sync.deleteDocument(docId, true);
        console.log(`✅ Deleted document: ${docId}`);
        break;

      case 'help':
      case '--help':
      case '-h':
      default:
        console.log(`
ElevenLabs Knowledge Base Sync

Usage:
  node elevenlabs-sync.js <command> [options]

Commands:
  sync-all [dir]           Sync all restaurants from directory (default: ./restaurants)
  sync <path> <name> <loc> Sync single restaurant
  list [search]            List all documents (optional search query)
  delete <id>              Delete document by ID
  help                     Show this help

Examples:
  node elevenlabs-sync.js sync-all
  node elevenlabs-sync.js sync ./restaurants/torstens-angelholm "Torstens" "Ängelholm"
  node elevenlabs-sync.js list "Torstens"
  node elevenlabs-sync.js delete doc-123456

Environment:
  ELEVENLABS_API_KEY=xi-your-api-key  (required)
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
