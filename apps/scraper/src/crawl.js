#!/usr/bin/env node

// Enkelt crawl-script som kan köras fristående
import { TorstensCrawler } from './crawler.js';

async function main() {
  console.log('🕷️ Torstens Crawler - Fristående körning');

  const crawler = new TorstensCrawler();

  try {
    const result = await crawler.crawlAll();
    console.log(`✅ Crawling slutförd: ${result.length} sidor crawlade`);

    const successful = result.filter(page => !page.error).length;
    const failed = result.filter(page => page.error).length;

    console.log(`📊 Resultat: ${successful} lyckades, ${failed} misslyckades`);

    if (failed > 0) {
      console.log('❌ Misslyckade URLs:');
      result.filter(page => page.error).forEach(page => {
        console.log(`  - ${page.url}: ${page.error}`);
      });
    }

  } catch (error) {
    console.error('❌ Crawling misslyckades:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}