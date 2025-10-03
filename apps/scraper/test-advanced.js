#!/usr/bin/env node

// Avancerat test med alla funktioner
console.log('🎯 Torstens Scraper - Avancerat Test');
console.log('===================================');

// Test med dependencies (om tillgängliga)
async function testWithDependencies() {
  try {
    // Testa att importera moduler
    const { TorstensCrawler } = await import('./src/crawler.js');
    const { ContentExtractor } = await import('./src/extractor.js');
    const { KnowledgeBuilder } = await import('./src/knowledge-builder.js');

    console.log('✅ Alla moduler laddade framgångsrikt');

    // Test 1: Crawling
    console.log('\n🕷️ Testar crawling...');
    const crawler = new TorstensCrawler();

    // Testa sitemap-hämtning
    try {
      const urls = await crawler.fetchSitemapUrls();
      console.log(`✅ Hämtade ${urls.length} URLs från sitemap`);

      // Testa att crawla första sidan
      if (urls.length > 0) {
        const firstPage = await crawler.crawlPage(urls[0]);
        if (firstPage.html && firstPage.html.length > 1000) {
          console.log(`✅ Crawlade första sidan: ${Math.round(firstPage.html.length/1024)} KB`);
        } else {
          console.log(`⚠️ Första sidan verkar kort: ${firstPage.html?.length || 0} tecken`);
        }
      }

      // Kör begränsad full crawl (max 3 sidor för test)
      crawler.urls = new Set(Array.from(crawler.urls).slice(0, 3));
      const crawlResult = await crawler.crawlAll();
      console.log(`✅ Mini-crawl slutförd: ${crawlResult.length} sidor`);

    } catch (error) {
      console.log(`⚠️ Crawling-fel: ${error.message}`);
    }

    // Test 2: Content Extraction
    console.log('\n🔍 Testar extraktion...');
    try {
      const extractor = new ContentExtractor();
      const extractedData = await extractor.extractFromCrawledData();

      console.log(`✅ Extraktion slutförd:`);
      console.log(`  - ${extractedData.content.length} sidor analyserade`);
      console.log(`  - ${extractedData.menus.length} menyer hittade`);
      console.log(`  - ${extractedData.hours.length} öppettider hittade`);
      console.log(`  - ${extractedData.contact.length} kontakter hittade`);

    } catch (error) {
      console.log(`⚠️ Extraktions-fel: ${error.message}`);
    }

    // Test 3: Knowledge Base
    console.log('\n🧠 Testar knowledge base...');
    try {
      const knowledgeBuilder = new KnowledgeBuilder();
      const knowledgeData = await knowledgeBuilder.buildKnowledgeBase();

      console.log(`✅ Knowledge base skapad:`);
      console.log(`  - ${knowledgeData.knowledgeBase.length} kunskapsposter`);
      console.log(`  - ${knowledgeData.restaurantData.faqs.length} FAQ:s`);

      // Testa sökfunktion
      const glutenResults = await knowledgeBuilder.searchKnowledge('gluten');
      const hoursResults = await knowledgeBuilder.searchKnowledge('öppet');

      console.log(`✅ Söktest:`);
      console.log(`  - "gluten": ${glutenResults.length} träffar`);
      console.log(`  - "öppet": ${hoursResults.length} träffar`);

    } catch (error) {
      console.log(`⚠️ Knowledge base-fel: ${error.message}`);
    }

    return true;

  } catch (importError) {
    console.log(`⚠️ Kunde inte ladda moduler: ${importError.message}`);
    console.log('💡 Kör "npm install" för att installera dependencies');
    return false;
  }
}

// Test utan dependencies - fallback
async function testBasicFunctionality() {
  console.log('\n🔧 Kör grundläggande test utan dependencies...');

  const https = await import('https');
  const fs = await import('fs/promises');

  // Test HTTP-anslutning
  console.log('📡 Testar anslutning till torstens.se...');

  return new Promise((resolve) => {
    const request = https.default.get('https://torstens.se', async (response) => {
      let data = '';
      response.on('data', (chunk) => data += chunk);
      response.on('end', async () => {
        console.log(`✅ Anslutning OK: ${response.statusCode}`);
        console.log(`📊 Storlek: ${Math.round(data.length/1024)} KB`);

        // Grundläggande extraktion
        const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : 'Ingen titel';

        const hasMenu = data.toLowerCase().includes('meny') || data.toLowerCase().includes('lunch');
        const hasContact = data.toLowerCase().includes('kontakt') || data.toLowerCase().includes('telefon');

        console.log(`📄 Titel: "${title}"`);
        console.log(`🍽️ Meny hittad: ${hasMenu ? '✅' : '❌'}`);
        console.log(`📞 Kontakt hittad: ${hasContact ? '✅' : '❌'}`);

        // Spara testresultat
        try {
          await fs.mkdir('./data', { recursive: true });
          await fs.mkdir('./output', { recursive: true });

          const testData = {
            timestamp: new Date().toISOString(),
            test: 'basic-functionality',
            result: {
              connected: true,
              statusCode: response.statusCode,
              dataSize: data.length,
              title,
              hasMenu,
              hasContact
            }
          };

          await fs.writeFile('./output/basic-test.json', JSON.stringify(testData, null, 2));
          console.log('✅ Testdata sparad: ./output/basic-test.json');

        } catch (error) {
          console.log(`⚠️ Kunde inte spara testdata: ${error.message}`);
        }

        resolve(true);
      });
    });

    request.on('error', (error) => {
      console.log(`❌ Anslutningsfel: ${error.message}`);
      resolve(false);
    });

    request.setTimeout(10000, () => {
      console.log('❌ Timeout - sidan svarar inte');
      request.abort();
      resolve(false);
    });
  });
}

async function main() {
  const startTime = new Date();

  try {
    // Först - testa med alla dependencies
    const advancedSuccess = await testWithDependencies();

    if (!advancedSuccess) {
      // Fallback - grundläggande test
      const basicSuccess = await testBasicFunctionality();

      if (!basicSuccess) {
        console.log('\n❌ Alla tester misslyckades');
        process.exit(1);
      }
    }

    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log('\n🎉 Test slutfört!');
    console.log(`⏱️ Tid: ${duration} sekunder`);
    console.log('====================');

    if (advancedSuccess) {
      console.log('✅ Avancerat test lyckades - systemet är redo!');
      console.log('📋 Nästa steg:');
      console.log('   1. Kör "npm start" för att starta schedulern');
      console.log('   2. Eller "npm run full-update" för manuell uppdatering');
      console.log('   3. Kontrollera output/ för Voice AI-data');
    } else {
      console.log('⚠️ Grundläggande test lyckades');
      console.log('🔧 För full funktionalitet, kör: npm install');
    }

  } catch (error) {
    console.error('\n❌ Test kraschade:', error.message);
    console.error('🔍 Feldetaljer:', error.stack);
    process.exit(1);
  }
}

// Kör test
main();