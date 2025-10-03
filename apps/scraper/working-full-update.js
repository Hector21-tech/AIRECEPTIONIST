#!/usr/bin/env node

// Robust full-update som hanterar rate limiting och timeouts
console.log('🚀 Torstens - Förbättrad Full Update');
console.log('====================================');

import https from 'https';
import fs from 'fs/promises';
import * as cheerio from 'cheerio';

const config = {
  baseUrl: 'https://torstens.se',
  crawlDelay: 2000, // 2 sekunder mellan requests för att undvika rate limiting
  timeout: 15000,   // 15 sekunder timeout
  userAgent: 'TorstensScraper/1.0',
  maxRetries: 2
};

class WorkingCrawler {
  constructor() {
    this.results = {
      crawled: [],
      extracted: {
        pages: [],
        menus: [],
        contacts: [],
        hours: [],
        faqs: []
      },
      knowledge: []
    };
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async crawlPage(url, retries = 0) {
    console.log(`📄 Crawlar: ${url} ${retries > 0 ? `(retry ${retries})` : ''}`);

    return new Promise((resolve) => {
      const request = https.get(url, {
        headers: { 'User-Agent': config.userAgent },
        timeout: config.timeout
      }, (response) => {

        // Hantera redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          console.log(`↪️ Redirect: ${response.headers.location}`);
          return this.crawlPage(response.headers.location, retries).then(resolve);
        }

        // Hantera rate limiting
        if (response.statusCode === 429) {
          console.log(`⏳ Rate limited, väntar ${(retries + 1) * 5} sekunder...`);

          if (retries < config.maxRetries) {
            setTimeout(() => {
              this.crawlPage(url, retries + 1).then(resolve);
            }, (retries + 1) * 5000);
            return;
          }
        }

        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          resolve({
            url,
            status: response.statusCode,
            html: response.statusCode === 200 ? data : null,
            size: data.length,
            crawledAt: new Date().toISOString(),
            error: response.statusCode !== 200 ? `HTTP ${response.statusCode}` : null
          });
        });
      });

      request.on('error', (error) => {
        console.log(`❌ Network error för ${url}: ${error.message}`);
        resolve({
          url,
          error: error.message,
          crawledAt: new Date().toISOString()
        });
      });

      request.on('timeout', () => {
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

  async crawlAllPages() {
    console.log('🕷️ Startar crawling...');

    // Viktiga URLs från Torstens (baserat på vad som fungerade tidigare)
    const urls = [
      'https://torstens.se',
      'https://torstens.se/boka-bord',
      'https://torstens.se/angelholm',
      'https://torstens.se/vala',
      'https://torstens.se/kontakt',
      'https://torstens.se/meny'
    ];

    for (const url of urls) {
      const result = await this.crawlPage(url);
      this.results.crawled.push(result);

      // Vänta mellan requests för att undvika rate limiting
      if (urls.indexOf(url) < urls.length - 1) {
        await this.delay(config.crawlDelay);
      }
    }

    const successful = this.results.crawled.filter(r => r.html).length;
    console.log(`✅ Crawling klar: ${successful}/${urls.length} sidor lyckades`);

    // Spara rådata
    await fs.mkdir('./data', { recursive: true });
    await fs.writeFile('./data/raw_pages.json', JSON.stringify(this.results.crawled, null, 2));
    console.log('💾 Rådata sparad: ./data/raw_pages.json');

    return this.results.crawled;
  }

  async extractContent() {
    console.log('🔍 Extraherar innehåll...');

    const validPages = this.results.crawled.filter(page => page.html);

    for (const page of validPages) {
      const $ = cheerio.load(page.html);

      // Grundläggande extraktion
      const title = $('title').text().trim();
      const h1 = $('h1').first().text().trim();
      const mainText = $('main').text() || $('body').text() || '';
      const wordCount = mainText.split(/\s+/).filter(w => w.length > 0).length;

      // Menyobjekt
      const menuItems = [];
      $('[class*="menu"], [class*="meny"], .dish, .food-item').each((i, el) => {
        const itemTitle = $(el).find('h3, h4, .title, .name, strong').first().text().trim();
        const itemDesc = $(el).find('p, .description, .desc').first().text().trim();
        const priceMatch = $(el).text().match(/(\d+)\s*(?:kr|:-|SEK)/i);
        const price = priceMatch ? parseInt(priceMatch[1]) : null;

        if (itemTitle && itemTitle.length > 2) {
          menuItems.push({ title: itemTitle, description: itemDesc, price });
        }
      });

      // Kontaktinfo
      const phoneMatches = page.html.match(/(?:tel|telefon|phone)[:\s]*([0-9\s\-\+\(\)]{8,})/gi) || [];
      const phones = phoneMatches.map(m => m.replace(/.*?([0-9\s\-\+\(\)]{8,})/, '$1').trim())
                                 .filter((p, i, arr) => arr.indexOf(p) === i)
                                 .slice(0, 2);

      const emailMatches = page.html.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g) || [];
      const emails = [...new Set(emailMatches)].slice(0, 2);

      const addressMatches = page.html.match(/([A-ZÅÄÖ][a-zåäö\s]+\s+\d+[a-zA-Z]?,?\s*\d{3}\s*\d{2}\s+[A-ZÅÄÖ][a-zåäö]+)/g) || [];
      const addresses = [...new Set(addressMatches)].slice(0, 2);

      // Öppettider
      const hoursMatches = page.html.match(/(?:måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag|mån|tis|ons|tor|fre|lör|sön)[\s\-:]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi) || [];
      const hours = [...new Set(hoursMatches)].slice(0, 7);

      const pageData = {
        url: page.url,
        title,
        h1,
        wordCount,
        menuItems,
        contacts: { phones, emails, addresses },
        hours,
        extractedAt: new Date().toISOString()
      };

      this.results.extracted.pages.push(pageData);

      if (menuItems.length > 0) {
        this.results.extracted.menus.push({
          source: page.url,
          items: menuItems
        });
      }

      if (phones.length > 0 || emails.length > 0 || addresses.length > 0) {
        this.results.extracted.contacts.push({
          source: page.url,
          phones, emails, addresses
        });
      }

      if (hours.length > 0) {
        this.results.extracted.hours.push({
          source: page.url,
          hours
        });
      }
    }

    console.log(`✅ Extraktion klar:`);
    console.log(`   📄 ${this.results.extracted.pages.length} sidor`);
    console.log(`   🍽️ ${this.results.extracted.menus.length} menyer`);
    console.log(`   📞 ${this.results.extracted.contacts.length} kontakter`);
    console.log(`   ⏰ ${this.results.extracted.hours.length} öppettider`);

    // Spara extraherad data
    await fs.writeFile('./data/extracted_content.json', JSON.stringify(this.results.extracted, null, 2));
    console.log('💾 Extraherad data sparad: ./data/extracted_content.json');

    return this.results.extracted;
  }

  async buildKnowledgeBase() {
    console.log('🧠 Bygger knowledge base...');

    // Standard FAQ:s
    const faqs = [
      {
        id: 'faq-gluten',
        type: 'qa',
        q: 'Har ni glutenfritt?',
        a: 'Vi märker vår meny så gott det går, men fråga alltid personalen för säkerhets skull. Flera rätter kan anpassas till glutenfritt.',
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
      },
      {
        id: 'faq-laktos',
        type: 'qa',
        q: 'Har ni laktosfritt?',
        a: 'Ja, vi har laktosfria alternativ. Säg till personalen vid beställning så hjälper vi dig välja rätt.',
        tags: ['allergi', 'laktos', 'mat']
      },
      {
        id: 'faq-children',
        type: 'qa',
        q: 'Har ni barnmeny?',
        a: 'Vi har barnvänliga alternativ och kan anpassa portioner för barn. Fråga gärna personalen!',
        tags: ['barn', 'barnmeny', 'familj']
      },
      {
        id: 'faq-payment',
        type: 'qa',
        q: 'Vilka betalningsmetoder tar ni emot?',
        a: 'Vi tar emot kontanter, kort och Swish. Alla vanliga betalmetoder fungerar bra.',
        tags: ['betalning', 'swish', 'kort']
      },
      {
        id: 'faq-group',
        type: 'qa',
        q: 'Kan ni ta emot större sällskap?',
        a: 'Ja, vi tar gärna emot större grupper. Ring oss i förväg så ordnar vi plats och eventuellt specialmeny.',
        tags: ['grupp', 'sällskap', 'event']
      }
    ];

    this.results.knowledge.push(...faqs);

    // Lägg till grundinfo
    if (this.results.extracted.pages.length > 0) {
      const mainPage = this.results.extracted.pages[0];
      this.results.knowledge.push({
        id: 'basic-info',
        type: 'fact',
        text: `Torstens restaurang - ${mainPage.title}`,
        tags: ['grundinfo', 'restaurang']
      });
    }

    // Lägg till kontaktinfo
    this.results.extracted.contacts.forEach((contact, index) => {
      contact.phones.forEach(phone => {
        this.results.knowledge.push({
          id: `phone-${index}`,
          type: 'fact',
          text: `Telefonnummer: ${phone}`,
          tags: ['kontakt', 'telefon']
        });
      });

      contact.addresses.forEach(address => {
        this.results.knowledge.push({
          id: `address-${index}`,
          type: 'fact',
          text: `Adress: ${address}`,
          tags: ['kontakt', 'adress', 'plats']
        });
      });
    });

    // Lägg till öppettider
    this.results.extracted.hours.forEach((hourInfo, index) => {
      if (hourInfo.hours.length > 0) {
        this.results.knowledge.push({
          id: `hours-${index}`,
          type: 'fact',
          text: `Öppettider: ${hourInfo.hours.slice(0, 3).join(', ')}`,
          tags: ['öppettider', 'tider']
        });
      }
    });

    // Lägg till menyinfo
    this.results.extracted.menus.forEach((menu, index) => {
      if (menu.items.length > 0) {
        const menuText = menu.items.slice(0, 3).map(item => {
          let desc = item.title;
          if (item.price) desc += ` (${item.price} kr)`;
          return desc;
        }).join(', ');

        this.results.knowledge.push({
          id: `menu-${index}`,
          type: 'menu',
          text: `Från vår meny: ${menuText}`,
          tags: ['meny', 'mat', 'rätter']
        });
      }
    });

    // Spara knowledge base
    await fs.mkdir('./output', { recursive: true });
    const jsonlContent = this.results.knowledge.map(item => JSON.stringify(item)).join('\n');
    await fs.writeFile('./output/knowledge.jsonl', jsonlContent);

    // Spara även som komplett data
    const restaurantData = {
      timestamp: new Date().toISOString(),
      crawledPages: this.results.crawled.length,
      successfulPages: this.results.crawled.filter(r => r.html).length,
      knowledgeEntries: this.results.knowledge.length,
      extracted: this.results.extracted,
      knowledge: this.results.knowledge
    };

    await fs.writeFile('./output/restaurant_data.json', JSON.stringify(restaurantData, null, 2));

    console.log(`✅ Knowledge base skapad:`);
    console.log(`   🧠 ${this.results.knowledge.length} kunskapsposter`);
    console.log(`   💾 Sparad som ./output/knowledge.jsonl`);

    return this.results.knowledge;
  }

  async runFullUpdate() {
    const startTime = Date.now();

    try {
      console.log('🚀 Startar fullständig uppdatering...\n');

      // Steg 1: Crawling
      await this.crawlAllPages();
      console.log('');

      // Steg 2: Extraktion
      await this.extractContent();
      console.log('');

      // Steg 3: Knowledge base
      await this.buildKnowledgeBase();

      const duration = Math.round((Date.now() - startTime) / 1000);

      console.log('\n🎉 FULLSTÄNDIG UPPDATERING KLAR!');
      console.log('================================');
      console.log(`⏱️ Tid: ${duration} sekunder`);
      console.log(`📄 Sidor: ${this.results.crawled.filter(r => r.html).length}/${this.results.crawled.length}`);
      console.log(`🧠 Knowledge base: ${this.results.knowledge.length} poster`);
      console.log('');
      console.log('📋 Filer skapade:');
      console.log('   • ./data/raw_pages.json');
      console.log('   • ./data/extracted_content.json');
      console.log('   • ./output/knowledge.jsonl ← VOICE AI DATA');
      console.log('   • ./output/restaurant_data.json');
      console.log('');
      console.log('✨ Din Voice AI kan nu hantera kundsamtal!');

      return true;

    } catch (error) {
      console.error(`❌ Fel under uppdatering: ${error.message}`);
      return false;
    }
  }
}

// Kör full uppdatering
async function main() {
  const crawler = new WorkingCrawler();
  const success = await crawler.runFullUpdate();
  process.exit(success ? 0 : 1);
}

main();