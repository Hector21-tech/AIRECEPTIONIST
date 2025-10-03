#!/usr/bin/env node

// Enkelt knowledge builder-script som kan köras fristående
import { KnowledgeBuilder } from './knowledge-builder.js';

async function main() {
  console.log('🧠 Torstens Knowledge Builder - Fristående körning');

  const builder = new KnowledgeBuilder();

  try {
    const result = await builder.buildKnowledgeBase();

    console.log(`✅ Knowledge base skapad!`);
    console.log(`📚 ${result.knowledgeBase.length} kunskapsposter`);
    console.log(`🏪 ${result.restaurantData.faqs.length} FAQ:s`);

    // Visa kategorier
    const categories = [...new Set(result.knowledgeBase.map(item => item.type))];
    console.log(`📂 Kategorier: ${categories.join(', ')}`);

    // Visa exempel på kunskapsposter
    console.log('\n💡 Exempel kunskapsposter:');
    result.knowledgeBase.slice(0, 5).forEach(item => {
      if (item.type === 'qa') {
        console.log(`  Q: ${item.q}`);
        console.log(`  A: ${item.a}\n`);
      } else {
        console.log(`  ${item.type.toUpperCase()}: ${item.text?.substring(0, 100)}...\n`);
      }
    });

    // Testa sökfunktion
    console.log('🔍 Testar sökfunktion:');
    const glutenSearch = await builder.searchKnowledge('gluten');
    console.log(`  "gluten": ${glutenSearch.length} träffar`);

    const hourSearch = await builder.searchKnowledge('öppet');
    console.log(`  "öppet": ${hourSearch.length} träffar`);

  } catch (error) {
    console.error('❌ Knowledge building misslyckades:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}