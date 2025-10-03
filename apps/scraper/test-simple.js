#!/usr/bin/env node

// Enkel test utan externa dependencies
import https from 'https';
import http from 'http';
import fs from 'fs/promises';

console.log('🧪 Torstens Scraper - Enkel Test');
console.log('================================');

async function testBasicFetch() {
  console.log('📡 Testar grundläggande HTTP-anslutning...');

  const url = 'https://torstens.se';

  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      let data = '';

      console.log(`✅ HTTP Status: ${response.statusCode}`);
      console.log(`📄 Content-Type: ${response.headers['content-type']}`);

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        console.log(`📊 Sidomstorlek: ${Math.round(data.length / 1024)} KB`);

        // Enkel analys av innehåll
        const hasTitle = data.includes('<title>');
        const hasNavigation = data.includes('nav') || data.includes('menu');
        const hasContact = data.toLowerCase().includes('kontakt') || data.toLowerCase().includes('telefon');
        const hasMenu = data.toLowerCase().includes('meny') || data.toLowerCase().includes('lunch');

        console.log(`🔍 Innehållsanalys:`);
        console.log(`  - Titel: ${hasTitle ? '✅' : '❌'}`);
        console.log(`  - Navigation: ${hasNavigation ? '✅' : '❌'}`);
        console.log(`  - Kontaktinfo: ${hasContact ? '✅' : '❌'}`);
        console.log(`  - Menyinformation: ${hasMenu ? '✅' : '❌'}`);

        resolve({
          status: response.statusCode,
          size: data.length,
          html: data,
          analysis: {
            hasTitle,
            hasNavigation,
            hasContact,
            hasMenu
          }
        });
      });
    });

    request.on('error', (error) => {
      console.error('❌ HTTP-fel:', error.message);
      reject(error);
    });

    request.setTimeout(10000, () => {
      console.error('❌ Timeout - sidan svarar inte inom 10 sekunder');
      request.abort();
      reject(new Error('Request timeout'));
    });
  });
}

async function testDirectoriesExist() {
  console.log('📁 Testar att mappar kan skapas...');

  try {
    await fs.mkdir('./data', { recursive: true });
    await fs.mkdir('./output', { recursive: true });
    console.log('✅ Mappar skapade: data/ och output/');
    return true;
  } catch (error) {
    console.error('❌ Kunde inte skapa mappar:', error.message);
    return false;
  }
}

async function testBasicExtraction(html) {
  console.log('🔍 Testar grundläggande textextraktion...');

  // Enkla regex-baserade extraktioner (utan cheerio)
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Ingen titel hittad';

  // Hitta telefonnummer
  const phoneMatches = html.match(/(?:tel|telefon)[:\s]*([0-9\s\-\+\(\)]{8,})/gi);
  const phones = phoneMatches ? phoneMatches.map(match => match.replace(/.*?([0-9\s\-\+\(\)]{8,})/, '$1').trim()) : [];

  // Hitta priser
  const priceMatches = html.match(/(\d+)\s*(?:kr|:-|SEK|sek)/gi);
  const prices = priceMatches ? [...new Set(priceMatches)] : [];

  // Hitta öppettider
  const hoursMatches = html.match(/(?:måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag|mån|tis|ons|tor|fre|lör|sön)[\s\-:]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi);
  const hours = hoursMatches ? [...new Set(hoursMatches)] : [];

  const extraction = {
    title,
    phones: phones.slice(0, 3), // Max 3
    prices: prices.slice(0, 5),  // Max 5
    hours: hours.slice(0, 7),    // Max 7 (en per dag)
    wordCount: html.replace(/<[^>]*>/g, '').split(/\s+/).length
  };

  console.log(`📄 Titel: "${title}"`);
  console.log(`📞 Telefonnummer: ${phones.length} hittade`);
  console.log(`💰 Priser: ${prices.length} hittade`);
  console.log(`⏰ Öppettider: ${hours.length} hittade`);
  console.log(`📝 Ordantal: ${extraction.wordCount}`);

  return extraction;
}

async function saveTestResults(fetchResult, extraction) {
  console.log('💾 Sparar testresultat...');

  const testReport = {
    timestamp: new Date().toISOString(),
    url: 'https://torstens.se',
    fetch: {
      status: fetchResult.status,
      size: fetchResult.size,
      analysis: fetchResult.analysis
    },
    extraction,
    success: fetchResult.status === 200 && extraction.wordCount > 100
  };

  try {
    await fs.writeFile('./output/test-report.json', JSON.stringify(testReport, null, 2));
    console.log('✅ Testrapport sparad: ./output/test-report.json');

    // Spara även en förenklad knowledge base
    const simpleKnowledge = [
      {
        id: 'test-basic-info',
        type: 'fact',
        text: `Torstens restaurang - ${extraction.title}`,
        tags: ['grundinfo']
      }
    ];

    if (extraction.phones.length > 0) {
      simpleKnowledge.push({
        id: 'test-phone',
        type: 'fact',
        text: `Telefonnummer: ${extraction.phones[0]}`,
        tags: ['kontakt', 'telefon']
      });
    }

    if (extraction.hours.length > 0) {
      simpleKnowledge.push({
        id: 'test-hours',
        type: 'fact',
        text: `Öppettider: ${extraction.hours[0]}`,
        tags: ['öppettider']
      });
    }

    const knowledgeJsonl = simpleKnowledge.map(item => JSON.stringify(item)).join('\n');
    await fs.writeFile('./output/test-knowledge.jsonl', knowledgeJsonl);
    console.log('✅ Test knowledge base sparad: ./output/test-knowledge.jsonl');

    return testReport;

  } catch (error) {
    console.error('❌ Kunde inte spara testresultat:', error.message);
    return null;
  }
}

async function main() {
  try {
    console.log('🚀 Startar test av Torstens scraper...\n');

    // Test 1: Kontrollera mappar
    const dirsOk = await testDirectoriesExist();
    if (!dirsOk) return;

    console.log('');

    // Test 2: Hämta webbsidan
    const fetchResult = await testBasicFetch();

    console.log('');

    // Test 3: Extrahera grundläggande data
    const extraction = await testBasicExtraction(fetchResult.html);

    console.log('');

    // Test 4: Spara resultat
    const report = await saveTestResults(fetchResult, extraction);

    console.log('\n🎉 Test slutfört!');
    console.log('================================');

    if (report && report.success) {
      console.log('✅ Alla tester lyckades!');
      console.log('📊 Nästa steg: Kör "npm run full-update" för komplett scraping');
    } else {
      console.log('⚠️ Vissa tester misslyckades');
      console.log('🔧 Kontrollera internetanslutning och att torstens.se är tillgänglig');
    }

  } catch (error) {
    console.error('\n❌ Test misslyckades:', error.message);
    process.exit(1);
  }
}

// Kör test
main();