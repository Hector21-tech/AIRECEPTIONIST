#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';

/**
 * Konverterar JSONL knowledge base till läsbar TXT för ElevenLabs Voice AI
 * JSONL = Single Source of Truth
 * TXT = Voice AI-vänligt format
 */
export class JsonlToTxtConverter {
  constructor(options = {}) {
    this.restaurantName = options.restaurantName || 'Torstens';
    this.location = options.location || 'Ängelholm';
    this.inputFile = options.inputFile || config.knowledgeBasePath;
    this.outputDir = options.outputDir || './output';
  }

  /**
   * Läs och parsa JSONL-fil
   */
  async readJsonl(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      return lines
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    } catch (error) {
      console.error(`❌ Kunde inte läsa JSONL-fil: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gruppera knowledge base efter typ
   */
  groupByType(knowledgeBase) {
    const grouped = {
      qa: [],
      fact: [],
      menu: [],
      content: [],
      other: []
    };

    knowledgeBase.forEach(item => {
      const type = item.type || 'other';
      if (grouped[type]) {
        grouped[type].push(item);
      } else {
        grouped.other.push(item);
      }
    });

    return grouped;
  }

  /**
   * Formatera Q&A-sektion
   */
  formatQA(qaItems) {
    if (qaItems.length === 0) return '';

    let output = '=== VANLIGA FRÅGOR OCH SVAR ===\n\n';

    // Sortera efter prioritet om det finns
    const sorted = qaItems.sort((a, b) => {
      const priorities = { high: 3, medium: 2, low: 1 };
      const aPriority = priorities[a.priority] || 0;
      const bPriority = priorities[b.priority] || 0;
      return bPriority - aPriority;
    });

    sorted.forEach(item => {
      output += `FRÅGA: ${item.q}\n`;
      output += `SVAR: ${item.a}\n`;
      if (item.tags && item.tags.length > 0) {
        output += `Nyckelord: ${item.tags.join(', ')}\n`;
      }
      output += '\n';
    });

    return output;
  }

  /**
   * Formatera fakta-sektion (öppettider, kontakt, etc)
   */
  formatFacts(factItems) {
    if (factItems.length === 0) return '';

    let output = '=== VIKTIG INFORMATION ===\n\n';

    // Gruppera facts efter tags
    const byCategory = {};
    factItems.forEach(item => {
      const category = item.tags?.[0] || 'övrigt';
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(item);
    });

    // Ordna kategorier i prioritetsordning
    const categoryOrder = ['öppettider', 'kontakt', 'telefon', 'adress', 'plats', 'övrigt'];

    categoryOrder.forEach(category => {
      if (byCategory[category]) {
        const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
        output += `--- ${categoryName} ---\n`;

        byCategory[category].forEach(item => {
          output += `${item.text}\n`;
        });
        output += '\n';
      }
    });

    // Lägg till övriga kategorier som inte fanns i listan
    Object.keys(byCategory).forEach(category => {
      if (!categoryOrder.includes(category)) {
        const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
        output += `--- ${categoryName} ---\n`;

        byCategory[category].forEach(item => {
          output += `${item.text}\n`;
        });
        output += '\n';
      }
    });

    return output;
  }

  /**
   * Formatera meny-sektion
   */
  formatMenu(menuItems) {
    if (menuItems.length === 0) return '';

    let output = '=== MENY OCH RÄTTER ===\n\n';

    menuItems.forEach(item => {
      if (item.text) {
        output += `${item.text}\n\n`;
      }
    });

    return output;
  }

  /**
   * Formatera övrigt innehåll
   */
  formatContent(contentItems) {
    if (contentItems.length === 0) return '';

    let output = '=== ÖVRIG INFORMATION ===\n\n';

    contentItems.forEach(item => {
      if (item.title) {
        output += `${item.title}\n`;
      }
      if (item.text) {
        output += `${item.text}\n\n`;
      }
    });

    return output;
  }

  /**
   * Skapa header för TXT-filen
   */
  createHeader() {
    const now = new Date();
    const timestamp = now.toLocaleString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║               ${this.restaurantName.toUpperCase()} - ${this.location.toUpperCase()}                    ║
║                    VOICE AI KUNSKAPSBAS                            ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝

Uppdaterad: ${timestamp}

Denna fil innehåller all information som Voice AI-systemet behöver för att
kunna svara på kundfrågor om restaurangen. Informationen är strukturerad
efter kategori för enkel sökning och referens.

────────────────────────────────────────────────────────────────────────

`;
  }

  /**
   * Skapa footer för TXT-filen
   */
  createFooter() {
    return `
────────────────────────────────────────────────────────────────────────

=== INSTRUKTIONER FÖR VOICE AI ===

När du svarar på kundfrågor:
1. Var vänlig och professionell
2. Använd informationen ovan som källa
3. Om du inte hittar svaret, erbjud att koppla till personal
4. Vid bokning, fråga alltid: datum, tid och antal gäster
5. Vid allergifrågor, rekommendera alltid att prata med personalen

Vid tekniska problem, kontakta systemadministratör.

────────────────────────────────────────────────────────────────────────
`;
  }

  /**
   * Konvertera JSONL till TXT
   */
  async convert() {
    console.log('📄 Konverterar JSONL → TXT för Voice AI...');
    console.log(`📥 Läser från: ${this.inputFile}`);

    try {
      // Läs JSONL
      const knowledgeBase = await this.readJsonl(this.inputFile);
      console.log(`✅ Läste ${knowledgeBase.length} kunskapsposter`);

      // Gruppera efter typ
      const grouped = this.groupByType(knowledgeBase);
      console.log(`📊 Grupperat: ${grouped.qa.length} Q&A, ${grouped.fact.length} fakta, ${grouped.menu.length} menyer`);

      // Bygg TXT-innehåll
      let txtContent = this.createHeader();

      txtContent += this.formatQA(grouped.qa);
      txtContent += this.formatFacts(grouped.fact);
      txtContent += this.formatMenu(grouped.menu);
      txtContent += this.formatContent(grouped.content);

      txtContent += this.createFooter();

      // Skapa output-mapp om den inte finns
      const locationSlug = this.location.toLowerCase().replace(/\s+/g, '-');
      const outputPath = path.join(this.outputDir, `${this.restaurantName.toLowerCase()}-${locationSlug}`);
      await fs.mkdir(outputPath, { recursive: true });

      // Spara TXT-fil
      const txtFilePath = path.join(outputPath, 'voice-ai.txt');
      await fs.writeFile(txtFilePath, txtContent, 'utf-8');

      // Kopiera även JSONL till samma mapp (single source of truth)
      const jsonlFilePath = path.join(outputPath, 'knowledge.jsonl');
      const jsonlContent = knowledgeBase.map(item => JSON.stringify(item)).join('\n');
      await fs.writeFile(jsonlFilePath, jsonlContent, 'utf-8');

      console.log(`✅ TXT skapad: ${txtFilePath}`);
      console.log(`✅ JSONL kopierad: ${jsonlFilePath}`);
      console.log(`📊 Totalt ${txtContent.length} tecken i TXT-fil`);

      // Skapa även en metadata-fil
      const metadata = {
        generatedAt: new Date().toISOString(),
        restaurantName: this.restaurantName,
        location: this.location,
        sourceFile: this.inputFile,
        stats: {
          totalEntries: knowledgeBase.length,
          qaCount: grouped.qa.length,
          factCount: grouped.fact.length,
          menuCount: grouped.menu.length,
          contentCount: grouped.content.length,
          txtSize: txtContent.length,
          jsonlSize: jsonlContent.length
        }
      };

      const metadataPath = path.join(outputPath, 'metadata.json');
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      console.log(`✅ Metadata skapad: ${metadataPath}`);

      return {
        txtPath: txtFilePath,
        jsonlPath: jsonlFilePath,
        metadataPath,
        stats: metadata.stats
      };

    } catch (error) {
      console.error('❌ Konvertering misslyckades:', error.message);
      throw error;
    }
  }

  /**
   * Konvertera flera restauranger
   */
  static async convertMultiple(restaurants) {
    console.log(`🏪 Konverterar ${restaurants.length} restauranger...\n`);

    const results = [];

    for (const restaurant of restaurants) {
      console.log(`\n🍽️  ${restaurant.name} - ${restaurant.location}`);
      console.log('─'.repeat(50));

      const converter = new JsonlToTxtConverter({
        restaurantName: restaurant.name,
        location: restaurant.location,
        inputFile: restaurant.knowledgeFile || config.knowledgeBasePath,
        outputDir: restaurant.outputDir || './output'
      });

      try {
        const result = await converter.convert();
        results.push({
          restaurant: `${restaurant.name} - ${restaurant.location}`,
          success: true,
          ...result
        });
      } catch (error) {
        results.push({
          restaurant: `${restaurant.name} - ${restaurant.location}`,
          success: false,
          error: error.message
        });
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 SAMMANFATTNING');
    console.log('='.repeat(70));

    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.restaurant}`);
      if (result.success) {
        console.log(`   Q&A: ${result.stats.qaCount}, Fakta: ${result.stats.factCount}, Meny: ${result.stats.menuCount}`);
      } else {
        console.log(`   Fel: ${result.error}`);
      }
    });

    return results;
  }
}

// Huvudfunktion för CLI-användning
async function main() {
  const args = process.argv.slice(2);

  // Om ingen argument, konvertera standard knowledge base
  if (args.length === 0) {
    const converter = new JsonlToTxtConverter();
    await converter.convert();
    return;
  }

  // Stöd för multi-restaurant konvertering
  if (args[0] === '--multi') {
    const restaurantsFile = args[1] || './config/restaurants.json';

    try {
      const restaurantsData = await fs.readFile(restaurantsFile, 'utf-8');
      const restaurants = JSON.parse(restaurantsData);
      await JsonlToTxtConverter.convertMultiple(restaurants);
    } catch (error) {
      console.error(`❌ Kunde inte läsa restaurangfil: ${error.message}`);
      console.log('\nSkapa en restaurants.json med format:');
      console.log('[');
      console.log('  {');
      console.log('    "name": "Torstens",');
      console.log('    "location": "Ängelholm",');
      console.log('    "knowledgeFile": "./output/knowledge.jsonl"');
      console.log('  }');
      console.log(']');
      process.exit(1);
    }
    return;
  }

  // Enskild restaurang med custom parametrar
  if (args[0] === '--restaurant') {
    const name = args[1] || 'Torstens';
    const location = args[2] || 'Ängelholm';
    const inputFile = args[3] || config.knowledgeBasePath;

    const converter = new JsonlToTxtConverter({
      restaurantName: name,
      location,
      inputFile
    });

    await converter.convert();
    return;
  }

  console.log('Användning:');
  console.log('  node jsonl-to-txt.js                              # Konvertera standard knowledge base');
  console.log('  node jsonl-to-txt.js --multi [restaurants.json]   # Konvertera flera restauranger');
  console.log('  node jsonl-to-txt.js --restaurant <namn> <plats> [fil]  # Konvertera specifik restaurang');
}

// Kör om filen körs direkt
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fel:', error.message);
    process.exit(1);
  });
}
