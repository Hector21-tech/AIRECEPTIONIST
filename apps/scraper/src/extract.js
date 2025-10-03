#!/usr/bin/env node

// Enkelt extractions-script som kan köras fristående
import { ContentExtractor } from './extractor.js';

async function main() {
  console.log('🔍 Torstens Content Extractor - Fristående körning');

  const extractor = new ContentExtractor();

  try {
    const result = await extractor.extractFromCrawledData();

    console.log(`✅ Extraktion slutförd!`);
    console.log(`📊 Statistik:`);
    console.log(`  - ${result.content.length} sidor analyserade`);
    console.log(`  - ${result.menus.length} menyer hittade`);
    console.log(`  - ${result.hours.length} öppettider hittade`);
    console.log(`  - ${result.contact.length} kontaktinformation hittade`);

    // Visa exempel på extraherad data
    if (result.menus.length > 0) {
      console.log('\n🍽️ Exempel menyobjekt:');
      result.menus[0].items.slice(0, 3).forEach(item => {
        console.log(`  - ${item.title}${item.price ? ` (${item.price} kr)` : ''}`);
      });
    }

    if (result.hours.length > 0) {
      console.log('\n⏰ Öppettider:');
      Object.entries(result.hours[0].hours).forEach(([day, hours]) => {
        console.log(`  - ${day}: ${hours}`);
      });
    }

  } catch (error) {
    console.error('❌ Extraktion misslyckades:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}