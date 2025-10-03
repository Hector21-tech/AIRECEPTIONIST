#!/usr/bin/env node

// Snabb produktionstest med installerade dependencies
console.log('⚡ Torstens Scraper - Snabbtest med Dependencies');
console.log('================================================');

import https from 'https';
import fs from 'fs/promises';
import * as cheerio from 'cheerio';

async function quickCrawlAndProcess() {
  console.log('🚀 Startar snabb crawl och bearbetning...');

  // Crawla huvudsidan
  const mainPageData = await crawlPage('https://torstens.se');

  // Crawla menysida
  const menuPageData = await crawlPage('https://torstens.se/meny');

  const crawledData = [mainPageData, menuPageData].filter(page => page.html);

  console.log(`✅ Crawlade ${crawledData.length} sidor`);

  // Skapa mappar
  await fs.mkdir('./data', { recursive: true });
  await fs.mkdir('./output', { recursive: true });

  // Spara rådata
  await fs.writeFile('./data/raw_pages.json', JSON.stringify(crawledData, null, 2));
  console.log('✅ Rådata sparad: ./data/raw_pages.json');

  // Processbara med Cheerio
  const extractedData = {
    pages: [],
    menus: [],
    contacts: [],
    hours: [],
    summary: {
      totalPages: crawledData.length,
      totalWords: 0,
      menusFound: 0,
      contactsFound: 0
    }
  };

  for (const page of crawledData) {
    if (!page.html) continue;

    console.log(`🔍 Bearbetar: ${page.url}`);

    const $ = cheerio.load(page.html);

    // Grundläggande extraktion
    const title = $('title').text().trim();
    const h1 = $('h1').first().text().trim();
    const mainText = $('main').text() || $('body').text() || '';
    const wordCount = mainText.split(/\s+/).filter(word => word.length > 0).length;

    // Hitta menyobjekt
    const menuItems = [];
    $('.menu-item, .dish, [class*="menu"], [class*="meny"]').each((i, el) => {
      const itemTitle = $(el).find('h3, h4, .title, .name').first().text().trim();
      const itemDesc = $(el).find('p, .description').first().text().trim();
      const itemPrice = extractPrice($(el).text());

      if (itemTitle) {
        menuItems.push({
          title: itemTitle,
          description: itemDesc,
          price: itemPrice
        });
      }
    });

    // Hitta kontaktinfo
    const phoneNumbers = findPhoneNumbers(page.html);
    const emails = findEmails(page.html);
    const addresses = findAddresses(page.html);

    // Hitta öppettider
    const openingHours = findOpeningHours(page.html);

    const pageData = {
      url: page.url,
      title,
      h1,
      wordCount,
      menuItems,
      contacts: {
        phones: phoneNumbers,
        emails,
        addresses
      },
      openingHours,
      crawledAt: page.crawledAt
    };

    extractedData.pages.push(pageData);
    extractedData.summary.totalWords += wordCount;

    if (menuItems.length > 0) {
      extractedData.menus.push({
        source: page.url,
        items: menuItems
      });
      extractedData.summary.menusFound++;
    }

    if (phoneNumbers.length > 0 || emails.length > 0 || addresses.length > 0) {
      extractedData.contacts.push({
        source: page.url,
        phones: phoneNumbers,
        emails,
        addresses
      });
      extractedData.summary.contactsFound++;
    }

    if (openingHours.length > 0) {
      extractedData.hours.push({
        source: page.url,
        hours: openingHours
      });
    }
  }

  // Spara extraherad data
  await fs.writeFile('./data/extracted_content.json', JSON.stringify(extractedData, null, 2));
  console.log('✅ Extraherad data sparad: ./data/extracted_content.json');

  // Skapa enkel knowledge base
  const knowledgeBase = [];

  // Lägg till grundinfo
  if (extractedData.pages.length > 0) {
    const mainPage = extractedData.pages.find(p => p.url.endsWith('torstens.se') || p.url.includes('torstens.se/'));
    if (mainPage) {
      knowledgeBase.push({
        id: 'basic-info',
        type: 'fact',
        text: `Torstens restaurang - ${mainPage.title}`,
        tags: ['grundinfo', 'restaurang']
      });
    }
  }

  // FAQ:s
  const faqs = [
    {
      id: 'faq-gluten',
      type: 'qa',
      q: 'Har ni glutenfritt?',
      a: 'Vi märker vår meny så gott det går, men fråga alltid personalen för säkerhets skull. Flera rätter kan anpassas.',
      tags: ['allergi', 'gluten', 'mat']
    },
    {
      id: 'faq-booking',
      type: 'qa',
      q: 'Kan jag boka bord via telefon?',
      a: 'Absolut! Ring oss så hjälper vi dig hitta en ledig tid. För hur många gäster och vilken tid passar dig?',
      tags: ['bokning', 'telefon']
    },
    {
      id: 'faq-vegetarian',
      type: 'qa',
      q: 'Har ni vegetariska alternativ?',
      a: 'Ja, vi har alltid vegetariska och ofta även veganska alternativ på menyn. Fråga gärna personalen för dagens utbud.',
      tags: ['vegetariskt', 'veganskt', 'mat']
    }
  ];

  knowledgeBase.push(...faqs);

  // Lägg till kontaktinfo om vi hittade några
  extractedData.contacts.forEach(contact => {
    contact.phones.forEach(phone => {
      knowledgeBase.push({
        id: 'contact-phone',
        type: 'fact',
        text: `Telefonnummer: ${phone}`,
        tags: ['kontakt', 'telefon']
      });
    });

    contact.addresses.forEach(address => {
      knowledgeBase.push({
        id: 'contact-address',
        type: 'fact',
        text: `Adress: ${address}`,
        tags: ['kontakt', 'adress', 'plats']
      });
    });
  });

  // Lägg till menyinfo
  extractedData.menus.forEach((menu, index) => {
    const menuText = menu.items.slice(0, 3).map(item => {
      let desc = item.title;
      if (item.price) desc += ` (${item.price} kr)`;
      if (item.description) desc += `: ${item.description}`;
      return desc;
    }).join('. ');

    if (menuText) {
      knowledgeBase.push({
        id: `menu-${index}`,
        type: 'menu',
        text: `Från vår meny: ${menuText}`,
        tags: ['meny', 'mat', 'rätter'],
        source: menu.source
      });
    }
  });

  // Spara knowledge base som JSONL
  const jsonlContent = knowledgeBase.map(item => JSON.stringify(item)).join('\n');
  await fs.writeFile('./output/knowledge.jsonl', jsonlContent);
  console.log('✅ Knowledge base sparad: ./output/knowledge.jsonl');

  // Skapa sammanfattningsrapport
  const report = {
    timestamp: new Date().toISOString(),
    summary: extractedData.summary,
    knowledgeBaseEntries: knowledgeBase.length,
    files: {
      rawData: './data/raw_pages.json',
      extractedContent: './data/extracted_content.json',
      knowledgeBase: './output/knowledge.jsonl'
    },
    nextSteps: [
      'Integrera knowledge.jsonl med ditt Voice AI-system',
      'Kör "npm start" för automatisk schemaläggning',
      'Se TESTING-GUIDE.md för mer information'
    ]
  };

  await fs.writeFile('./output/quick-test-report.json', JSON.stringify(report, null, 2));
  console.log('✅ Rapport sparad: ./output/quick-test-report.json');

  return report;
}

async function crawlPage(url) {
  return new Promise((resolve) => {
    console.log(`📄 Crawlar: ${url}`);

    const request = https.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => data += chunk);
      response.on('end', () => {
        resolve({
          url,
          status: response.statusCode,
          html: data,
          crawledAt: new Date().toISOString(),
          size: data.length
        });
      });
    });

    request.on('error', (error) => {
      console.log(`❌ Fel vid ${url}: ${error.message}`);
      resolve({
        url,
        error: error.message,
        crawledAt: new Date().toISOString()
      });
    });

    request.setTimeout(10000, () => {
      console.log(`⏰ Timeout för ${url}`);
      request.abort();
      resolve({
        url,
        error: 'timeout',
        crawledAt: new Date().toISOString()
      });
    });
  });
}

function extractPrice(text) {
  const match = text.match(/(\d+)\s*(?:kr|:-|SEK)/i);
  return match ? parseInt(match[1]) : null;
}

function findPhoneNumbers(html) {
  const phoneRegex = /(?:tel|telefon|phone)[:\s]*([0-9\s\-\+\(\)]{8,})/gi;
  const matches = html.match(phoneRegex) || [];
  return matches.map(match => match.replace(/.*?([0-9\s\-\+\(\)]{8,})/, '$1').trim())
                .filter((phone, index, arr) => arr.indexOf(phone) === index) // unique
                .slice(0, 3); // max 3
}

function findEmails(html) {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const matches = html.match(emailRegex) || [];
  return [...new Set(matches)].slice(0, 2); // unique, max 2
}

function findAddresses(html) {
  const addressRegex = /([A-ZÅÄÖ][a-zåäö\s]+\s+\d+[a-zA-Z]?,?\s*\d{3}\s*\d{2}\s+[A-ZÅÄÖ][a-zåäö]+)/g;
  const matches = html.match(addressRegex) || [];
  return [...new Set(matches)].slice(0, 2); // unique, max 2
}

function findOpeningHours(html) {
  const hoursRegex = /(?:måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag|mån|tis|ons|tor|fre|lör|sön)[\s\-:]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi;
  const matches = html.match(hoursRegex) || [];
  return [...new Set(matches)].slice(0, 7); // unique, max 7 (days)
}

async function main() {
  const startTime = Date.now();

  try {
    const report = await quickCrawlAndProcess();
    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log('\n🎉 Snabbtest slutfört!');
    console.log('========================');
    console.log(`⏱️  Tid: ${duration} sekunder`);
    console.log(`📄 Sidor crawlade: ${report.summary.totalPages}`);
    console.log(`📝 Ord totalt: ${report.summary.totalWords}`);
    console.log(`🍽️  Menyer: ${report.summary.menusFound}`);
    console.log(`📞 Kontakter: ${report.summary.contactsFound}`);
    console.log(`🧠 Knowledge base: ${report.knowledgeBaseEntries} poster`);

    console.log('\n📋 Nästa steg:');
    report.nextSteps.forEach(step => console.log(`   • ${step}`));

    console.log('\n✨ Systemet är redo för Voice AI-integration!');

  } catch (error) {
    console.error('\n❌ Snabbtest misslyckades:', error.message);
    process.exit(1);
  }
}

main();