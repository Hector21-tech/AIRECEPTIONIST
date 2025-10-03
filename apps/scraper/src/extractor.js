import * as cheerio from 'cheerio';
import { config } from './config.js';
import fs from 'fs/promises';
import slugify from 'slugify';
import { Logger } from './utils/logger.js';

export class ContentExtractor {
  constructor() {
    this.extractedData = {
      locations: [],
      menus: [],
      hours: [],
      contact: [],
      faqs: [],
      content: []
    };
    this.logger = new Logger('Extractor');
  }

  extractTextFromHtml(html) {
    const $ = cheerio.load(html);

    // Ta bort script, style och andra element som inte innehåller användbar text
    $('script, style, nav, footer, header, .nav, .header, .footer').remove();

    return {
      title: $('title').text().trim(),
      h1: $('h1').first().text().trim(),
      h2s: $('h2').map((i, el) => $(el).text().trim()).get(),
      h3s: $('h3').map((i, el) => $(el).text().trim()).get(),
      mainText: $('main').text() || $('body').text() || $.text(),
      menuItems: this.extractMenuItems($),
      prices: this.extractAllPrices($),
      links: $('a[href]').map((i, el) => ({
        text: $(el).text().trim(),
        href: $(el).attr('href')
      })).get().filter(link => link.text && link.href)
    };
  }

  extractMenuItems($) {
    const menuItems = [];

    // Försök 1: Vanliga CSS-klasser för meny
    const basicSelectors = $('.menu-item, .dish, .food-item, .meny-item, .menu-entry, .plate, .course');
    if (basicSelectors.length > 0) {
      basicSelectors.each((i, el) => {
        const $el = $(el);
        const item = this.parseMenuItem($el);
        if (item && item.title) {
          menuItems.push(item);
        }
      });
    }

    // Försök 2: Leta efter text-mönster med priser
    if (menuItems.length === 0) {
      const allText = $('body').text();
      const menuPatterns = [
        // "Flygande Jakob 159 kr"
        /([A-ZÅÄÖ][a-zåäöé\s]+(?:[a-z]+))\s+(\d{2,4})\s*(?:kr|:-|SEK)/g,
        // "Köttbullar med potatismos - 125:-"
        /([A-ZÅÄÖ][a-zåäöé\s]+(?:med|på|i|av)\s+[a-zåäöé\s]+)\s*[-–—]\s*(\d{2,4})\s*(?:kr|:-|SEK)/g,
        // Text mellan h3/h4 och pris
        /([A-ZÅÄÖ][a-zåäöé\s,\.]{10,60})\s+(\d{2,4})\s*(?:kr|:-|SEK)/g
      ];

      for (const pattern of menuPatterns) {
        const matches = allText.matchAll(pattern);
        for (const match of matches) {
          const title = match[1].trim();
          const price = parseInt(match[2]);

          // Filtrera bort uppenbart ej-maträtter
          if (this.isLikelyFoodItem(title) && price >= 50 && price <= 800) {
            menuItems.push({
              title: title,
              description: '',
              price: price
            });
          }
        }
      }
    }

    // Försök 3: Hitta meny via strukturerad HTML (lista med h3+p+pris)
    if (menuItems.length === 0) {
      $('h3, h4, h5').each((i, el) => {
        const $el = $(el);
        const title = $el.text().trim();

        if (title.length > 3 && this.isLikelyFoodItem(title)) {
          const $next = $el.next();
          let description = '';
          let price = null;

          // Leta efter beskrivning i nästa element
          if ($next.is('p, div, span')) {
            const nextText = $next.text().trim();
            price = this.extractPrice(nextText);
            if (!price) {
              description = nextText;
              // Leta efter pris i nästa element efter beskrivning
              price = this.extractPrice($next.next().text());
            }
          } else {
            // Leta efter pris direkt efter titel
            price = this.extractPrice($el.text() + ' ' + $next.text());
          }

          if (title && (price || description)) {
            menuItems.push({
              title: title,
              description: description,
              price: price
            });
          }
        }
      });
    }

    return menuItems.slice(0, 20); // Max 20 items för att undvika spam
  }

  parseMenuItem($el) {
    return {
      title: $el.find('h3, h4, h5, .title, .name, .dish-name').first().text().trim() ||
             $el.contents().first().text().trim(),
      description: $el.find('p, .description, .desc, .dish-desc').first().text().trim(),
      price: this.extractPrice($el.text())
    };
  }

  isLikelyFoodItem(text) {
    if (!text || text.length < 3) return false;

    // Kända maträtter och ingredienser
    const foodKeywords = [
      'kött', 'kyckling', 'fisk', 'pasta', 'pizza', 'sallad', 'soppa', 'räkor', 'lax',
      'biff', 'fläsk', 'lamm', 'oxfilé', 'entrecôte', 'schnitzel', 'kotlett',
      'potatis', 'ris', 'sås', 'grädde', 'ost', 'tomat', 'lök', 'vitlök',
      'med', 'och', 'på', 'i', 'av', 'till', 'serveras', 'innehåller',
      'grillad', 'stekt', 'kokt', 'bakad', 'marinerad', 'rökt'
    ];

    // Vanliga svenska rätter
    const dishNames = [
      'köttbullar', 'kalops', 'pytt', 'schnitzel', 'wallenbergare', 'janssons',
      'flygande jakob', 'toast skagen', 'gravlax', 'köttfärssås', 'carbonara',
      'bolognese', 'margherita', 'hawaiian', 'caesarsallad', 'räksallad'
    ];

    const lowerText = text.toLowerCase();

    // Kolla om texten innehåller matrelaterade ord
    const hasFood = foodKeywords.some(keyword => lowerText.includes(keyword)) ||
                   dishNames.some(dish => lowerText.includes(dish));

    // Undvik icke-mat text
    const excludeKeywords = [
      'öppettider', 'telefon', 'adress', 'email', 'webbsida', 'följ oss',
      'kontakt', 'boka', 'reservation', 'om oss', 'hitta hit', 'parkering'
    ];

    const hasExcludes = excludeKeywords.some(keyword => lowerText.includes(keyword));

    return hasFood && !hasExcludes;
  }

  extractPrice(text) {
    // Matcha pris i svenska kronor: "125 kr", "125:-", "125 SEK"
    const priceMatch = text.match(/(\d+)\s*(?:kr|:-|SEK|sek)/i);
    return priceMatch ? parseInt(priceMatch[1]) : null;
  }

  extractAllPrices($) {
    const priceTexts = [];
    $('*').each((i, el) => {
      const text = $(el).text();
      const priceMatch = text.match(/(\d+)\s*(?:kr|:-|SEK|sek)/gi);
      if (priceMatch) {
        priceTexts.push(...priceMatch);
      }
    });
    return [...new Set(priceTexts)]; // Unique values
  }

  extractHours(text) {
    const hours = {};
    const dayMapping = {
      'måndag': 'monday', 'mån': 'monday', 'mon': 'monday',
      'tisdag': 'tuesday', 'tis': 'tuesday', 'tue': 'tuesday',
      'onsdag': 'wednesday', 'ons': 'wednesday', 'wed': 'wednesday',
      'torsdag': 'thursday', 'tor': 'thursday', 'thu': 'thursday',
      'fredag': 'friday', 'fre': 'friday', 'fri': 'friday',
      'lördag': 'saturday', 'lör': 'saturday', 'sat': 'saturday',
      'söndag': 'sunday', 'sön': 'sunday', 'sun': 'sunday'
    };

    // Förbättrade mönster för svenska öppettider
    const hoursPatterns = [
      // Måndag: 11:30-22:00, Måndag 11.30-22.00
      /(?:måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag|mån|tis|ons|tor|fre|lör|sön)[\s\-:]*(\d{1,2}[\.:]\d{2}[\s\-–—]+\d{1,2}[\.:]\d{2})/gi,
      // Måndag-fredag: 11:30-22:00
      /(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag|mån|tis|ons|tor|fre|lör|sön)[\s\-–—]+(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag|mån|tis|ons|tor|fre|lör|sön)[\s\-:]*(\d{1,2}[\.:]\d{2}[\s\-–—]+\d{1,2}[\.:]\d{2})/gi,
      // "Öppet: Måndag 11:30-22:00"
      /(?:öppet|öppettider|opening hours)[:\s]*.*?(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag|mån|tis|ons|tor|fre|lör|sön)[\s\-:]*(\d{1,2}[\.:]\d{2}[\s\-–—]+\d{1,2}[\.:]\d{2})/gi,
      // Stängt patterns
      /(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag|mån|tis|ons|tor|fre|lör|sön)[\s\-:]*(?:stängt|closed)/gi
    ];

    // Leta efter öppettider med alla mönster
    for (const pattern of hoursPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        // Hantera range (måndag-fredag)
        if (match[3]) {
          const startDay = match[1].toLowerCase();
          const endDay = match[2].toLowerCase();
          const timeString = match[3];

          const startDayEn = dayMapping[startDay];
          const endDayEn = dayMapping[endDay];

          if (startDayEn && endDayEn) {
            const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const startIndex = dayOrder.indexOf(startDayEn);
            const endIndex = dayOrder.indexOf(endDayEn);

            for (let i = startIndex; i <= endIndex; i++) {
              const normalizedTime = this.normalizeTime(timeString);
              if (normalizedTime) {
                hours[dayOrder[i]] = normalizedTime;
              }
            }
          }
        }
        // Hantera enskilda dagar
        else if (match[1] && match[2]) {
          const day = match[1].toLowerCase();
          const timeString = match[2];
          const dayEn = dayMapping[day];

          if (dayEn) {
            if (timeString.toLowerCase().includes('stängt') || timeString.toLowerCase().includes('closed')) {
              hours[dayEn] = 'closed';
            } else {
              const normalizedTime = this.normalizeTime(timeString);
              if (normalizedTime) {
                hours[dayEn] = normalizedTime;
              }
            }
          }
        }
        // Hantera stängt-mönster
        else if (match[1] && match[0].toLowerCase().includes('stängt')) {
          const day = match[1].toLowerCase();
          const dayEn = dayMapping[day];
          if (dayEn) {
            hours[dayEn] = 'closed';
          }
        }
      }
    }

    return Object.keys(hours).length > 0 ? hours : null;
  }

  // Hjälpmetod för att normalisera tidsformat
  normalizeTime(timeString) {
    if (!timeString) return null;

    // 11.30-22.00 → 11:30–22:00
    // 11:30 - 22:00 → 11:30–22:00
    let normalized = timeString
      .replace(/\./g, ':')
      .replace(/[\s\-–—]+/g, '–')
      .trim();

    // Validera tidsformat
    if (/^\d{1,2}:\d{2}–\d{1,2}:\d{2}$/.test(normalized)) {
      return normalized;
    }

    return null;
  }

  extractContact(text) {
    const contact = {};

    // Telefonnummer - förbättrade mönster för svenska nummer
    const phonePatterns = [
      // +46 42-236212, +46 42 236212
      /\+46[\s\-]?(?:\d{1,3}[\s\-]?)?\d{2,3}[\s\-]?\d{2,4}[\s\-]?\d{2,4}/g,
      // 042-236212, 042 236212
      /0\d{2,3}[\s\-]?\d{2,4}[\s\-]?\d{2,4}/g,
      // Med prefix tel/telefon: tel: 042-236212
      /(?:tel|telefon|phone)[:\s]*([+]?[\d\s\-\(\)]{8,})/gi,
      // Generella mönster
      /(?:^|\s)([+]?[\d\s\-\(\)]{8,15})(?:\s|$)/g
    ];

    for (const pattern of phonePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const phone = (match[1] || match[0]).trim();
        // Validera att det ser ut som ett telefonnummer
        if (phone && /[\d\+]/.test(phone) && phone.replace(/[^\d]/g, '').length >= 7) {
          contact.phone = phone;
          break;
        }
      }
      if (contact.phone) break;
    }

    // Email - förbättrat mönster
    const emailPatterns = [
      /([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      /(?:email|e-post|kontakt)[:\s]*([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi
    ];

    for (const pattern of emailPatterns) {
      const match = text.match(pattern);
      if (match) {
        contact.email = match[1] || match[0];
        break;
      }
    }

    // Adress - förbättrade mönster för svenska adresser
    const addressPatterns = [
      // Storgatan 9, 262 32 Ängelholm
      /([A-ZÅÄÖ][a-zåäö\s]+\s+\d+[a-zA-Z]?,?\s*\d{3}\s*\d{2}\s+[A-ZÅÄÖ][a-zåäö]+)/g,
      // Böösa Backe 6, 263 61 Viken
      /([A-ZÅÄÖÜ][a-zåäöü\s]+\s+\d+[a-zA-Z]?,?\s*\d{3}\s*\d{2}\s+[A-ZÅÄÖÜ][a-zåäöü]+)/g,
      // Gatunamn Nummer, Postnummer Stad
      /([A-ZÅÄÖÜ][a-zåäöüé\s]+\d+[a-zA-Z]?,?\s*\d{3}\s?\d{2}\s+[A-ZÅÄÖÜ][a-zåäöü]+)/g
    ];

    for (const pattern of addressPatterns) {
      const match = text.match(pattern);
      if (match) {
        contact.address = match[1].trim();
        break;
      }
    }

    return Object.keys(contact).length > 0 ? contact : null;
  }

  extractAddress(text) {
    const addressPatterns = [
      // Fullständig svensk adress: "Storgatan 9, 262 32 Ängelholm"
      /([A-ZÅÄÖÜ][a-zåäöü\s]+\s+\d+[a-zA-Z]?,?\s*\d{3}\s*\d{2}\s+[A-ZÅÄÖÜ][a-zåäöü]+)/g,
      // Med "Backe": "Böösa Backe 6, 263 61 Viken"
      /([A-ZÅÄÖÜ][a-zåäöüé\s]+\s+\d+[a-zA-Z]?,?\s*\d{3}\s*\d{2}\s+[A-ZÅÄÖÜ][a-zåäöü]+)/g,
      // Adress med prefix: "Adress: Storgatan 9, 262 32 Ängelholm"
      /(?:adress|address|besöksadress|postadress)[:\s]*([A-ZÅÄÖÜ][a-zåäöüé\s]+\d+[a-zA-Z]?,?\s*\d{3}\s?\d{2}\s+[A-ZÅÄÖÜ][a-zåäöü]+)/gi,
      // Gatuadress utan postnummer: "Storgatan 9, Ängelholm"
      /([A-ZÅÄÖÜ][a-zåäöü\s]+\s+\d+[a-zA-Z]?,?\s+[A-ZÅÄÖÜ][a-zåäöü]+)/g
    ];

    for (const pattern of addressPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const address = (match[1] || match[0]).trim();

        // Validera att det ser ut som en svensk adress
        if (this.isValidSwedishAddress(address)) {
          return {
            full: address,
            street: this.extractStreet(address),
            postalCode: this.extractPostalCode(address),
            city: this.extractCity(address)
          };
        }
      }
    }

    return null;
  }

  isValidSwedishAddress(address) {
    if (!address || address.length < 10) return false;

    // Måste innehålla siffror (gatunummer eller postnummer)
    if (!/\d/.test(address)) return false;

    // Undvik uppenbart ej-adresser
    const excludes = ['telefon', 'email', 'öppet', 'stängt', 'pris', 'kr', 'meny'];
    const lowerAddress = address.toLowerCase();

    return !excludes.some(exclude => lowerAddress.includes(exclude));
  }

  extractStreet(address) {
    const streetMatch = address.match(/^([A-ZÅÄÖÜ][a-zåäöüé\s]+\s+\d+[a-zA-Z]?)/);
    return streetMatch ? streetMatch[1].trim() : null;
  }

  extractPostalCode(address) {
    const postalMatch = address.match(/(\d{3}\s?\d{2})/);
    return postalMatch ? postalMatch[1].replace(/\s/, ' ') : null;
  }

  extractCity(address) {
    const cityMatch = address.match(/\d{3}\s?\d{2}\s+([A-ZÅÄÖÜ][a-zåäöü]+)/);
    return cityMatch ? cityMatch[1].trim() : null;
  }

  extractAllergens(text) {
    const allergens = [];
    const allergenMap = {
      'gluten': ['gluten', 'vete', 'råg', 'korn', 'havre'],
      'laktos': ['laktos', 'mjölk', 'grädde', 'ost', 'smör'],
      'ägg': ['ägg'],
      'nötter': ['nötter', 'mandel', 'valnöt', 'hasselnöt'],
      'jordnötter': ['jordnöt'],
      'soja': ['soja'],
      'fisk': ['fisk'],
      'skaldjur': ['skaldjur', 'kräfta', 'räka', 'hummer', 'krabba']
    };

    const lowerText = text.toLowerCase();

    Object.entries(allergenMap).forEach(([allergen, keywords]) => {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        allergens.push(allergen);
      }
    });

    return allergens;
  }

  categorizeContent(pageData) {
    const { url, text } = pageData;
    const lowerUrl = url.toLowerCase();
    const lowerText = text.mainText.toLowerCase();

    // Kategorisera baserat på URL och innehåll
    if (lowerUrl.includes('meny') || lowerUrl.includes('menu') ||
        config.menuKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'menu';
    }

    if (lowerUrl.includes('kontakt') || lowerUrl.includes('contact') ||
        config.contactKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'contact';
    }

    if (lowerUrl.includes('öppet') || lowerUrl.includes('hours') ||
        config.hoursKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'hours';
    }

    if (lowerUrl.includes('om') || lowerUrl.includes('about')) {
      return 'about';
    }

    if (lowerUrl.includes('boka') || lowerUrl.includes('book')) {
      return 'booking';
    }

    return 'general';
  }

  async extractFromCrawledData() {
    console.log('🔍 Extraherar innehåll från crawlad data...');

    try {
      const rawData = await fs.readFile(config.rawPagesFile, 'utf-8');
      const crawledPages = JSON.parse(rawData);

      for (const page of crawledPages) {
        if (page.error || !page.html) {
          console.log(`⚠️ Hoppar över ${page.url}: ${page.error || 'Ingen HTML'}`);
          continue;
        }

        console.log(`📄 Extraherar: ${page.url}`);

        const textData = this.extractTextFromHtml(page.html);
        const category = this.categorizeContent({ url: page.url, text: textData });

        const extractedContent = {
          url: page.url,
          category,
          title: textData.title,
          h1: textData.h1,
          headings: [...textData.h2s, ...textData.h3s],
          mainText: textData.mainText,
          menuItems: textData.menuItems,
          prices: textData.prices,
          hours: this.extractHours(textData.mainText),
          contact: this.extractContact(textData.mainText),
          allergens: this.extractAllergens(textData.mainText),
          links: textData.links,
          extractedAt: new Date().toISOString()
        };

        this.extractedData.content.push(extractedContent);

        // Kategorisera innehåll
        if (category === 'menu' && textData.menuItems.length > 0) {
          this.extractedData.menus.push({
            source: page.url,
            items: textData.menuItems,
            extractedAt: new Date().toISOString()
          });
        }

        if (extractedContent.hours) {
          this.extractedData.hours.push({
            source: page.url,
            hours: extractedContent.hours,
            extractedAt: new Date().toISOString()
          });
        }

        if (extractedContent.contact) {
          this.extractedData.contact.push({
            source: page.url,
            contact: extractedContent.contact,
            extractedAt: new Date().toISOString()
          });
        }
      }

      // Spara extraherat innehåll
      await fs.writeFile(
        config.extractedContentFile,
        JSON.stringify(this.extractedData, null, 2),
        'utf-8'
      );

      console.log(`✅ Extraktion klar! Data sparad i ${config.extractedContentFile}`);
      console.log(`📊 Statistik: ${this.extractedData.content.length} sidor, ${this.extractedData.menus.length} menyer, ${this.extractedData.hours.length} öppettider`);

      return this.extractedData;

    } catch (error) {
      console.error('❌ Fel vid extraktion:', error.message);
      throw error;
    }
  }

  async getExtractedData() {
    try {
      const data = await fs.readFile(config.extractedContentFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.log('⚠️ Ingen extraherad data hittades');
      return null;
    }
  }
}