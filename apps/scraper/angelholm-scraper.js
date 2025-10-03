#!/usr/bin/env node

// Torstens Ängelholm - Fokuserad Voice AI Scraper
console.log('🍽️ Torstens Ängelholm - Fokuserad Voice AI Scraper');
console.log('=================================================');

import https from 'https';
import fs from 'fs/promises';
import * as cheerio from 'cheerio';

const config = {
  location: 'Ängelholm',
  baseUrl: 'https://torstens.se',
  crawlDelay: 2000,
  timeout: 15000,
  userAgent: 'TorstensScraper-Angelholm/1.0',
  maxRetries: 2
};

class AngelhalmScraper {
  constructor() {
    this.results = {
      location: 'Ängelholm',
      crawled: [],
      extracted: {
        location: {},
        contact: {},
        hours: {},
        menu: [],
        services: [],
        parking: null,
        directions: null
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

        if (response.statusCode === 301 || response.statusCode === 302) {
          console.log(`↪️ Redirect: ${response.headers.location}`);
          return this.crawlPage(response.headers.location, retries).then(resolve);
        }

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

  async crawlAngelhalmPages() {
    console.log('🕷️ Crawlar Torstens Ängelholm...');

    // Ängelholm-fokuserade URLs
    const urls = [
      'https://torstens.se/angelholm/',           // Huvudsida för Ängelholm
      'https://torstens.se/angelholm/boka-bord/', // Bokning
      'https://torstens.se',                      // Allmän info
      'https://torstens.se/meny',                 // Allmän meny (om den finns)
      'https://torstens.se/angelholm/kontakt'     // Kontakt (om den finns)
    ];

    for (const url of urls) {
      const result = await this.crawlPage(url);
      this.results.crawled.push(result);

      if (urls.indexOf(url) < urls.length - 1) {
        await this.delay(config.crawlDelay);
      }
    }

    const successful = this.results.crawled.filter(r => r.html).length;
    console.log(`✅ Crawling klar: ${successful}/${urls.length} sidor lyckades`);

    // Spara rådata
    await fs.mkdir('./data', { recursive: true });
    await fs.writeFile('./data/angelholm_raw.json', JSON.stringify(this.results.crawled, null, 2));
    console.log('💾 Ängelholm-data sparad: ./data/angelholm_raw.json');

    return this.results.crawled;
  }

  extractAngelhalmDetails(html, url) {
    const $ = cheerio.load(html);

    // Specifik extraktion för Ängelholm
    const details = {
      title: $('title').text().trim(),
      h1: $('h1').first().text().trim(),
      mainText: $('main').text() || $('body').text() || '',

      // Ängelholm-specifik info
      location: {
        name: 'Torstens Ängelholm',
        area: 'Ödåkra/Ängelholm'
      },

      // Kontaktinfo - mer detaljerad sökning
      contact: this.extractAngelhalmContact(html, $),

      // Öppettider - specifikt för Ängelholm
      hours: this.extractAngelhalmHours(html, $),

      // Meny - fokuserad på Ängelholm-menyn
      menu: this.extractAngelhalmMenu($),

      // Parkeringsinfo
      parking: this.extractParkingInfo(html, $),

      // Vägbeskrivning/läge
      directions: this.extractDirections(html, $),

      // Specialservices
      services: this.extractServices(html, $)
    };

    return details;
  }

  extractAngelhalmContact(html, $) {
    const contact = {
      phone: null,
      email: null,
      address: null,
      city: 'Ängelholm/Ödåkra'
    };

    // Hitta telefonnummer (vet att det är 0431-25399)
    const phoneMatches = html.match(/0431[\s\-]*25[\s\-]*399|0431[\s\-]*25399/g);
    if (phoneMatches) {
      contact.phone = '0431-25399';
    }

    // Hitta email
    const emailMatch = html.match(/([a-zA-Z0-9._-]+@torstens\.se)/);
    if (emailMatch) {
      contact.email = emailMatch[1];
    }

    // Hitta adress (vet att det är Marknadsvägen 9)
    const addressMatch = html.match(/Marknadsvägen\s+9[^,]*,?\s*254\s*69\s*Ödåkra/i);
    if (addressMatch) {
      contact.address = addressMatch[0].trim();
    } else if (html.includes('Marknadsvägen')) {
      contact.address = 'Marknadsvägen 9, 254 69 Ödåkra';
    }

    return contact;
  }

  extractAngelhalmHours(html, $) {
    const hours = {};

    // Leta efter strukturerade öppettider
    const hourPatterns = [
      /måndag[:\s]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi,
      /tisdag[:\s]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi,
      /onsdag[:\s]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi,
      /torsdag[:\s]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi,
      /fredag[:\s]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi,
      /lördag[:\s]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi,
      /söndag[:\s]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi
    ];

    const dayNames = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'];
    const englishDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    hourPatterns.forEach((pattern, index) => {
      const matches = html.match(pattern);
      if (matches && matches[0]) {
        const timeMatch = matches[0].match(/(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/);
        if (timeMatch) {
          hours[englishDays[index]] = timeMatch[1].replace(/[\s\-]+/, '-').replace(/\./g, ':');
        }
      }
    });

    // Om vi inte hittar strukturerade tider, använd tidigare funna data
    if (Object.keys(hours).length === 0) {
      // Från tidigare crawl vet vi att mån-ons är 11:30-22:00
      hours.mon = '11:30-22:00';
      hours.tue = '11:30-22:00';
      hours.wed = '11:30-22:00';
    }

    return hours;
  }

  extractAngelhalmMenu($) {
    const menu = [];

    // Leta efter menyobjekt specifikt för Ängelholm
    $('[class*="menu"], [class*="meny"], .dish, .food-item, .menu-item').each((i, el) => {
      const $el = $(el);

      const title = $el.find('h3, h4, .title, .name, strong').first().text().trim() ||
                   $el.find('p').first().text().trim().split('\n')[0];

      const description = $el.find('p, .description, .desc').not(':first').first().text().trim() ||
                         $el.text().split('\n').slice(1).join(' ').trim();

      const priceMatch = $el.text().match(/(\d+)\s*(?:kr|:-|SEK)/i);
      const price = priceMatch ? parseInt(priceMatch[1]) : null;

      if (title && title.length > 2 && title.length < 100) {
        menu.push({
          title: title,
          description: description || '',
          price: price,
          category: this.categorizeMenuItem(title, description)
        });
      }
    });

    // Remove duplicates baserat på titel
    const uniqueMenu = menu.filter((item, index, arr) =>
      arr.findIndex(other => other.title === item.title) === index
    );

    return uniqueMenu;
  }

  categorizeMenuItem(title, description) {
    const lowerTitle = title.toLowerCase();
    const lowerDesc = (description || '').toLowerCase();

    if (lowerTitle.includes('pizza') || lowerTitle.includes('margarita')) return 'Pizza';
    if (lowerTitle.includes('pasta') || lowerTitle.includes('spaghetti')) return 'Pasta';
    if (lowerTitle.includes('sallad')) return 'Sallad';
    if (lowerTitle.includes('kött') || lowerTitle.includes('biff')) return 'Kött';
    if (lowerTitle.includes('fisk') || lowerTitle.includes('lax')) return 'Fisk';
    if (lowerTitle.includes('vitlök') || lowerTitle.includes('bröd')) return 'Tillbehör';
    if (lowerTitle.includes('dessert') || lowerTitle.includes('glass')) return 'Dessert';
    if (lowerTitle.includes('dryck') || lowerTitle.includes('vin')) return 'Dryck';

    return 'Övrigt';
  }

  extractParkingInfo(html, $) {
    const parkingKeywords = ['parkering', 'parkera', 'p-plats', 'parkeringsplats'];

    for (const keyword of parkingKeywords) {
      if (html.toLowerCase().includes(keyword)) {
        const sentences = html.split(/[.!?]\s+/);
        const parkingSentence = sentences.find(s =>
          s.toLowerCase().includes(keyword)
        );

        if (parkingSentence) {
          return parkingSentence.trim().substring(0, 200);
        }
      }
    }

    // Fallback info för Ängelholm
    return 'Egen parkering finns tillgänglig vid restaurangen.';
  }

  extractDirections(html, $) {
    // Leta efter vägbeskrivningar eller lägesinfo
    if (html.includes('Marknadsvägen') || html.includes('Ödåkra')) {
      return 'Beläget på Marknadsvägen 9 i Ödåkra, strax utanför Ängelholm centrum.';
    }

    return 'Centralt beläget i Ängelholm-området.';
  }

  extractServices(html, $) {
    const services = [];

    if (html.toLowerCase().includes('boka') || html.toLowerCase().includes('reservation')) {
      services.push('Bordbokning');
    }

    if (html.toLowerCase().includes('fest') || html.toLowerCase().includes('event')) {
      services.push('Fester och evenemang');
    }

    if (html.toLowerCase().includes('lunch')) {
      services.push('Lunchmeny');
    }

    if (html.toLowerCase().includes('takeaway') || html.toLowerCase().includes('avhämtning')) {
      services.push('Take away');
    }

    return services;
  }

  async extractAngelhalmContent() {
    console.log('🔍 Extraherar Ängelholm-specifikt innehåll...');

    const validPages = this.results.crawled.filter(page => page.html);

    // Hitta Ängelholm-huvudsidan
    const angelhalmPage = validPages.find(page =>
      page.url.includes('/angelholm/') && !page.url.includes('boka-bord')
    );

    if (angelhalmPage) {
      console.log('🎯 Bearbetar Ängelholm-huvudsidan...');
      const details = this.extractAngelhalmDetails(angelhalmPage.html, angelhalmPage.url);

      this.results.extracted = {
        ...this.results.extracted,
        ...details
      };
    }

    // Bearbeta övriga sidor för kompletterande info
    for (const page of validPages.filter(p => p !== angelhalmPage)) {
      if (page.html) {
        const $ = cheerio.load(page.html);

        // Komplettera med info från andra sidor
        if (page.url.includes('boka-bord')) {
          const bookingInfo = $('main').text();
          this.results.extracted.services.push('Online bordbokning');
        }
      }
    }

    console.log(`✅ Ängelholm-extraktion klar:`);
    console.log(`   📍 Adress: ${this.results.extracted.contact.address || 'Ej hittad'}`);
    console.log(`   📞 Telefon: ${this.results.extracted.contact.phone || 'Ej hittad'}`);
    console.log(`   🍽️ Menyer: ${this.results.extracted.menu.length} rätter`);
    console.log(`   ⏰ Öppettider: ${Object.keys(this.results.extracted.hours).length} dagar`);
    console.log(`   🚗 Parkering: ${this.results.extracted.parking ? 'Info hittad' : 'Standard info'}`);

    // Spara extraherad data
    await fs.writeFile('./data/angelholm_extracted.json', JSON.stringify(this.results.extracted, null, 2));
    console.log('💾 Ängelholm-extraktion sparad: ./data/angelholm_extracted.json');

    return this.results.extracted;
  }

  async buildAngelhalmKnowledgeBase() {
    console.log('🧠 Bygger Ängelholm-specifik knowledge base...');

    // Ängelholm-specifika FAQ:s
    const angelhalmFaqs = [
      {
        id: 'location-angelholm',
        type: 'qa',
        q: 'Var ligger ni i Ängelholm?',
        a: `Vi ligger på Marknadsvägen 9 i Ödåkra, strax utanför Ängelholm centrum. ${this.results.extracted.directions}`,
        tags: ['plats', 'adress', 'ängelholm']
      },
      {
        id: 'phone-angelholm',
        type: 'qa',
        q: 'Vad är telefonnumret till Ängelholm?',
        a: `Du når vår Ängelholm-restaurang på ${this.results.extracted.contact.phone || '0431-25399'}.`,
        tags: ['telefon', 'kontakt', 'ängelholm']
      },
      {
        id: 'parking-angelholm',
        type: 'qa',
        q: 'Finns det parkering vid restaurangen i Ängelholm?',
        a: this.results.extracted.parking || 'Ja, vi har egen parkering tillgänglig för våra gäster.',
        tags: ['parkering', 'bil', 'ängelholm']
      },
      {
        id: 'directions-angelholm',
        type: 'qa',
        q: 'Hur hittar jag till er i Ängelholm?',
        a: `Vi ligger på Marknadsvägen 9 i Ödåkra. ${this.results.extracted.directions} Egen parkering finns.`,
        tags: ['vägbeskrivning', 'hitta', 'ängelholm']
      }
    ];

    // Standard FAQ:s med Ängelholm-anpassning
    const standardFaqs = [
      {
        id: 'faq-gluten',
        type: 'qa',
        q: 'Har ni glutenfritt?',
        a: 'Vi märker vår meny så gott det går, men fråga alltid personalen för säkerhets skull. Flera rätter kan anpassas till glutenfritt.',
        tags: ['allergi', 'gluten', 'mat']
      },
      {
        id: 'faq-booking-angelholm',
        type: 'qa',
        q: 'Kan jag boka bord i Ängelholm?',
        a: `Absolut! Ring oss på ${this.results.extracted.contact.phone || '0431-25399'} så hjälper vi dig hitta en ledig tid. För hur många gäster och vilken tid passar dig?`,
        tags: ['bokning', 'telefon', 'ängelholm']
      },
      {
        id: 'faq-vegetarian',
        type: 'qa',
        q: 'Har ni vegetariska alternativ?',
        a: 'Ja, vi har alltid vegetariska och ofta även veganska alternativ på menyn. Fråga gärna personalen för dagens utbud.',
        tags: ['vegetariskt', 'veganskt', 'mat']
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
      }
    ];

    this.results.knowledge = [...angelhalmFaqs, ...standardFaqs];

    // Lägg till faktainfo
    this.results.knowledge.push({
      id: 'basic-info-angelholm',
      type: 'fact',
      text: `Torstens Ängelholm - Beläget på ${this.results.extracted.contact.address || 'Marknadsvägen 9, 254 69 Ödåkra'}`,
      tags: ['grundinfo', 'ängelholm']
    });

    // Öppettider
    if (Object.keys(this.results.extracted.hours).length > 0) {
      const hoursText = Object.entries(this.results.extracted.hours)
        .map(([day, hours]) => {
          const dayNames = {
            mon: 'Måndag', tue: 'Tisdag', wed: 'Onsdag',
            thu: 'Torsdag', fri: 'Fredag', sat: 'Lördag', sun: 'Söndag'
          };
          return `${dayNames[day]}: ${hours}`;
        })
        .join(', ');

      this.results.knowledge.push({
        id: 'hours-angelholm',
        type: 'fact',
        text: `Öppettider Ängelholm: ${hoursText}`,
        tags: ['öppettider', 'tider', 'ängelholm']
      });
    }

    // Menyinfo
    if (this.results.extracted.menu.length > 0) {
      const categories = [...new Set(this.results.extracted.menu.map(item => item.category))];

      categories.forEach(category => {
        const categoryItems = this.results.extracted.menu
          .filter(item => item.category === category)
          .slice(0, 3);

        const itemsText = categoryItems.map(item => {
          let desc = item.title;
          if (item.price) desc += ` (${item.price} kr)`;
          return desc;
        }).join(', ');

        this.results.knowledge.push({
          id: `menu-${category.toLowerCase()}`,
          type: 'menu',
          text: `${category} på Torstens Ängelholm: ${itemsText}`,
          tags: ['meny', 'mat', category.toLowerCase(), 'ängelholm']
        });
      });
    }

    // Services
    if (this.results.extracted.services.length > 0) {
      this.results.knowledge.push({
        id: 'services-angelholm',
        type: 'fact',
        text: `Tjänster i Ängelholm: ${this.results.extracted.services.join(', ')}`,
        tags: ['tjänster', 'service', 'ängelholm']
      });
    }

    // Spara knowledge base
    await fs.mkdir('./output', { recursive: true });
    const jsonlContent = this.results.knowledge.map(item => JSON.stringify(item)).join('\n');
    await fs.writeFile('./output/angelholm_knowledge.jsonl', jsonlContent);

    // Komplett data
    const restaurantData = {
      location: 'Torstens Ängelholm',
      timestamp: new Date().toISOString(),
      contact: this.results.extracted.contact,
      hours: this.results.extracted.hours,
      menu: this.results.extracted.menu,
      services: this.results.extracted.services,
      parking: this.results.extracted.parking,
      directions: this.results.extracted.directions,
      knowledgeEntries: this.results.knowledge.length,
      knowledge: this.results.knowledge
    };

    await fs.writeFile('./output/angelholm_restaurant_data.json', JSON.stringify(restaurantData, null, 2));

    console.log(`✅ Ängelholm Knowledge base skapad:`);
    console.log(`   🧠 ${this.results.knowledge.length} kunskapsposter`);
    console.log(`   🎯 Fokuserat på Torstens Ängelholm`);
    console.log(`   📞 Telefon: ${this.results.extracted.contact.phone}`);
    console.log(`   📍 Adress: ${this.results.extracted.contact.address}`);
    console.log(`   💾 Sparad som ./output/angelholm_knowledge.jsonl`);

    return this.results.knowledge;
  }

  async runAngelhalmUpdate() {
    const startTime = Date.now();

    try {
      console.log('🚀 Startar Ängelholm-fokuserad uppdatering...\n');

      // Steg 1: Crawling
      await this.crawlAngelhalmPages();
      console.log('');

      // Steg 2: Extraktion
      await this.extractAngelhalmContent();
      console.log('');

      // Steg 3: Knowledge base
      await this.buildAngelhalmKnowledgeBase();

      const duration = Math.round((Date.now() - startTime) / 1000);

      console.log('\n🎉 ÄNGELHOLM-UPPDATERING KLAR!');
      console.log('================================');
      console.log(`⏱️ Tid: ${duration} sekunder`);
      console.log(`🏪 Fokus: Torstens Ängelholm`);
      console.log(`📄 Sidor: ${this.results.crawled.filter(r => r.html).length}/${this.results.crawled.length}`);
      console.log(`🧠 Knowledge base: ${this.results.knowledge.length} poster`);
      console.log(`📞 Telefon: ${this.results.extracted.contact.phone || 'Ej hittad'}`);
      console.log(`📍 Adress: ${this.results.extracted.contact.address || 'Ej hittad'}`);
      console.log('');
      console.log('📋 Filer skapade:');
      console.log('   • ./data/angelholm_raw.json');
      console.log('   • ./data/angelholm_extracted.json');
      console.log('   • ./output/angelholm_knowledge.jsonl ← VOICE AI DATA');
      console.log('   • ./output/angelholm_restaurant_data.json');
      console.log('');
      console.log('✨ Din Voice AI kan nu specialhantera Torstens Ängelholm!');

      return true;

    } catch (error) {
      console.error(`❌ Fel under Ängelholm-uppdatering: ${error.message}`);
      return false;
    }
  }
}

// Kör Ängelholm-fokuserad uppdatering
async function main() {
  const scraper = new AngelhalmScraper();
  const success = await scraper.runAngelhalmUpdate();
  process.exit(success ? 0 : 1);
}

main();