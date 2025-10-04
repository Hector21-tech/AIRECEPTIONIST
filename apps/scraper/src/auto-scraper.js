#!/usr/bin/env node

import { TorstensCrawler } from './crawler.js';
import { ContentExtractor } from './extractor.js';
import { RestaurantNormalizer } from './multi-restaurant/restaurant-normalizer.js';
import { Logger } from './utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * AutoScraper - Enkel URL-till-mapp scraper
 * Användning: node src/auto-scraper.js https://restaurangmavi.se
 */
export class AutoScraper {
  constructor(progressCallback = null) {
    this.logger = new Logger('AutoScraper');
    this.normalizer = new RestaurantNormalizer({
      outputDir: './restaurants'
    });
    this.progressCallback = progressCallback;
  }

  emitProgress(status, message, extra = {}) {
    if (this.progressCallback) {
      this.progressCallback({ status, message, ...extra });
    }
    console.log(`${status}: ${message}`);
  }

  /**
   * Extrahera restaurangnamn från URL (förbättrad version)
   */
  async extractRestaurantInfo(url, extractedData = null) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');

      // Extrahera namn från domän som fallback
      let name = domain.split('.')[0];
      name = name.replace(/^restaurang/, '').replace(/^restaurant/, '');
      name = name.charAt(0).toUpperCase() + name.slice(1);

      let city = 'Auto-detected';
      let actualName = `Restaurang ${name}`;
      let brand = name;

      // Om vi har extraherad data, använd den för att få bättre information
      if (extractedData && extractedData.content && extractedData.content.length > 0) {
        const mainContent = extractedData.content[0];

        // Försök hitta restaurangnamn från title eller h1
        if (mainContent.title) {
          const titleMatch = mainContent.title.match(/([A-ZÅÄÖ][a-zåäöé\s]+(?:restaurang|restaurant|café|bar|pub|bistro|krog))/i);
          if (titleMatch) {
            actualName = titleMatch[1].trim();
            brand = actualName.replace(/\s*(restaurang|restaurant|café|bar|pub|bistro|krog)\s*/i, '').trim();
          }
        }

        // Försök hitta stad från adress
        if (mainContent.contact && mainContent.contact.address) {
          const extractorModule = await import('./extractor.js');
          const extractor = new extractorModule.ContentExtractor();
          const addressInfo = extractor.extractAddress(mainContent.contact.address);
          if (addressInfo && addressInfo.city) {
            city = addressInfo.city;
          }
        }
      }

      // Skapa slug baserat på brand och stad
      const cleanBrand = brand.toLowerCase().replace(/[^a-zåäö]/g, '');
      const cleanCity = city.toLowerCase().replace(/[^a-zåäö]/g, '');
      const slug = `${cleanBrand}-${cleanCity === 'auto-detected' ? 'auto' : cleanCity}`;

      return {
        slug: slug,
        name: actualName,
        brand: brand,
        city: city,
        baseUrl: url,
        url: url
      };
    } catch (error) {
      throw new Error(`Ogiltig URL: ${url}`);
    }
  }

  /**
   * Scrapa en URL automatiskt
   * @param {string} url - URL to scrape
   * @param {string} [providedSlug] - Optional predefined slug to use instead of auto-detected
   */
  async scrapeUrl(url, providedSlug = null) {
    this.emitProgress('starting', `🍽️ Auto-scraping: ${url}`);

    try {
      // 1. Preliminär restauranginfo från URL
      const prelimRestaurantInfo = await this.extractRestaurantInfo(url);

      // Use provided slug if available, otherwise use auto-detected
      if (providedSlug) {
        prelimRestaurantInfo.slug = providedSlug;
        this.emitProgress('detected', `📋 Using provided slug: ${prelimRestaurantInfo.name} (${providedSlug})`);
      } else {
        this.emitProgress('detected', `📋 Initial detection: ${prelimRestaurantInfo.name} (${prelimRestaurantInfo.slug})`);
      }

      // 3. Crawla webbplatsen
      this.emitProgress('crawling', '🕷️ Crawling website...');
      const crawler = new TorstensCrawler();

      // Temporärt sätt baseUrl
      const originalConfig = { ...crawler.config };
      if (crawler.config) {
        crawler.config.baseUrl = prelimRestaurantInfo.baseUrl;
      }

      // Crawla bara huvudsidan för snabbhet
      const pages = [{
        url: url,
        html: await this.fetchPage(url),
        timestamp: new Date().toISOString()
      }];

      // Återställ config
      if (crawler.config) {
        Object.assign(crawler.config, originalConfig);
      }

      this.emitProgress('crawled', `✅ Crawled ${pages.length} page(s)`);

      // 4. Extrahera innehåll
      this.emitProgress('extracting', '🔍 Extracting content...');
      const extractor = new ContentExtractor();

      // Simulera extracted data
      const extractedData = {
        content: [],
        menus: [],
        hours: [],
        contact: []
      };

      for (const page of pages) {
        if (page.html) {
          const textData = extractor.extractTextFromHtml(page.html);
          const category = extractor.categorizeContent({ url: page.url, text: textData });

          const content = {
            url: page.url,
            category,
            title: textData.title,
            h1: textData.h1,
            headings: [...textData.h2s, ...textData.h3s],
            mainText: textData.mainText,
            menuItems: textData.menuItems,
            prices: textData.prices,
            hours: extractor.extractHours(textData.mainText),
            contact: extractor.extractContact(textData.mainText),
            allergens: extractor.extractAllergens(textData.mainText),
            links: textData.links,
            extractedAt: new Date().toISOString()
          };

          extractedData.content.push(content);

          // Kategorisera innehåll
          if (category === 'menu' && textData.menuItems.length > 0) {
            extractedData.menus.push({
              source: page.url,
              items: textData.menuItems,
              extractedAt: new Date().toISOString()
            });
          }

          if (content.hours) {
            extractedData.hours.push({
              source: page.url,
              hours: content.hours,
              extractedAt: new Date().toISOString()
            });
          }

          if (content.contact) {
            extractedData.contact.push({
              source: page.url,
              contact: content.contact,
              extractedAt: new Date().toISOString()
            });
          }
        }
      }

      this.emitProgress('extracted', `✅ Extracted content from ${extractedData.content.length} page(s)`);

      // 4. Detektera multipla lokaler
      this.emitProgress('analyzing', '🏢 Detecting multiple locations...');
      const locations = await this.detectMultipleLocations(extractedData);
      this.emitProgress('locations', `🏢 Detected ${locations.length} location(s)`);

      const results = [];

      // 5. Skapa en mapp för varje lokal
      for (const [index, locationData] of locations.entries()) {
        let restaurantInfo = await this.extractRestaurantInfo(url, locationData);

        // Use provided slug for first location if available
        if (index === 0 && prelimRestaurantInfo.slug) {
          restaurantInfo.slug = prelimRestaurantInfo.slug;
        }

        this.emitProgress('location', `📋 Location ${index + 1}: ${restaurantInfo.name} (${restaurantInfo.slug})`);

        // Skapa output-mapp
        this.emitProgress('creating', `📁 Creating directory for ${restaurantInfo.slug}...`);
        const outputDir = path.join('./restaurants', restaurantInfo.slug);
        await fs.mkdir(outputDir, { recursive: true });
        this.emitProgress('created', `📁 Created directory: ${outputDir}`);

        // Normalisera och generera output
        this.emitProgress('normalizing', `🔧 Normalizing data for ${restaurantInfo.slug}...`);
        const rawData = this.convertToNormalizerFormat(restaurantInfo, locationData);
        const result = await this.normalizer.normalizeRestaurant(rawData, restaurantInfo.slug);
        this.emitProgress('normalized', `✅ Normalized data for ${restaurantInfo.slug}`);

        results.push({
          ...result,
          slug: restaurantInfo.slug,
          outputDir: outputDir
        });
      }

      // Välj första resultatet som primärt return-värde (för kompatibilitet)
      const result = results[0];

      this.emitProgress('completed', `✅ Generated normalized data: ${result.knowledge.length} knowledge items, ${results.length} directories`);

      // 6. Visa resultat
      this.emitProgress('summary', '🎉 Auto-scraping completed!');
      for (const res of results) {
        console.log(`📁 Files created in: ./${path.relative('.', res.outputDir)}/`);
        console.log(`   - info.json`);
        console.log(`   - knowledge.jsonl`);
        console.log(`   - report.txt`);
      }

      return result;

    } catch (error) {
      console.error(`❌ Auto-scraping failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Hämta webbsida
   */
  async fetchPage(url) {
    try {
      const axios = (await import('axios')).default;
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'AutoScraper/1.0'
        }
      });
      return response.data;
    } catch (error) {
      console.warn(`⚠️ Could not fetch ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Detektera multipla restaurangplatser på samma webbsida
   */
  async detectMultipleLocations(extractedData) {
    if (!extractedData.content || extractedData.content.length === 0) {
      return [extractedData]; // Fallback till hela datasettet
    }

    const mainContent = extractedData.content[0];
    const allText = mainContent.mainText || '';

    // Leta efter flera adresser med olika städer
    const extractorModule = await import('./extractor.js');
    const extractor = new extractorModule.ContentExtractor();

    const addressMatches = [];
    const addressPatterns = [
      // "MAVI VIKEN\nBöösa Backe 6, 263 61 Viken\n+46 42-236212"
      /([A-Z\s]+)[\n\r]*([A-ZÅÄÖÜ][a-zåäöüé\s]+\s+\d+[a-zA-Z]?,?\s*\d{3}\s*\d{2}\s+[A-ZÅÄÖÜ][a-zåäöü]+)[\n\r]*([+]?[\d\s\-\(\)]{8,})/g,
      // "MAVI ÄNGELHOLM" följt av adress
      /([A-Z]+\s+[A-ZÅÄÖÜ]+)[\s\n]*([A-ZÅÄÖÜ][a-zåäöüé\s]+\s+\d+[a-zA-Z]?,?\s*\d{3}\s*\d{2}\s+[A-ZÅÄÖÜ][a-zåäöü]+)/g
    ];

    for (const pattern of addressPatterns) {
      const matches = allText.matchAll(pattern);
      for (const match of matches) {
        const locationName = match[1]?.trim();
        const address = match[2]?.trim();
        const phone = match[3]?.trim();

        if (locationName && address) {
          const addressInfo = extractor.extractAddress(address);
          if (addressInfo && addressInfo.city) {
            addressMatches.push({
              name: locationName,
              address: address,
              city: addressInfo.city,
              phone: phone
            });
          }
        }
      }
    }

    // Detektera kedjerestaruanger utan fullständiga adresser
    const chainMatches = this.detectChainLocations(allText);

    // Om vi hittar flera adresser, skapa separata dataset för varje
    if (addressMatches.length > 1) {
      const locations = [];

      for (const addressMatch of addressMatches) {
        // Skapa modifierad extractedData för denna specifika plats
        const locationData = {
          content: [{
            ...mainContent,
            contact: {
              address: addressMatch.address,
              phone: addressMatch.phone,
              email: mainContent.contact?.email
            }
          }],
          menus: extractedData.menus,
          hours: extractedData.hours,
          contact: [{
            source: mainContent.url,
            contact: {
              address: addressMatch.address,
              phone: addressMatch.phone,
              email: mainContent.contact?.email
            },
            extractedAt: new Date().toISOString()
          }]
        };

        // Lägg till namnet i title om det finns
        if (addressMatch.name) {
          locationData.content[0].title = `${addressMatch.name} - ${mainContent.title}`;
        }

        locations.push(locationData);
      }

      return locations;
    }

    // Om vi hittar kedjerestaruanger utan fullständiga adresser
    if (chainMatches.length > 1) {
      const locations = [];

      for (const chainMatch of chainMatches) {
        // Skapa modifierad extractedData för denna kedjelokation
        const locationData = {
          content: [{
            ...mainContent,
            title: `${chainMatch.brand} ${chainMatch.city}`,
            city: chainMatch.city,
            contact: {
              email: mainContent.contact?.email
            }
          }],
          menus: extractedData.menus,
          hours: extractedData.hours,
          contact: [{
            source: mainContent.url,
            contact: {
              email: mainContent.contact?.email
            },
            extractedAt: new Date().toISOString()
          }]
        };

        locations.push(locationData);
      }

      return locations;
    }

    // Fallback: returnera originaldata som en enda plats
    return [extractedData];
  }

  /**
   * Detektera kedjerestaruanger med endast ortnamn
   */
  detectChainLocations(text) {
    const swedishCities = [
      'stockholm', 'göteborg', 'malmö', 'uppsala', 'västerås', 'örebro',
      'linköping', 'helsingborg', 'jönköping', 'norrköping', 'lund', 'umeå',
      'gävle', 'borås', 'södertälje', 'eskilstuna', 'halmstad', 'växjö',
      'karlstad', 'sundsvall', 'ängelholm', 'båstad', 'viken', 'triangeln'
    ];

    const chainMatches = [];
    const lowerText = text.toLowerCase();

    // Leta efter mönster som "Torstens Ängelholm", "Torstens Båstad" etc.
    const brandMatch = text.match(/([A-ZÅÄÖ][a-zåäöé]+)\s*(?:restaurang|restaurant|café|bar|pub|bistro)?/i);
    const brand = brandMatch ? brandMatch[1] : 'Restaurant';

    // Leta efter städer som nämns i texten
    for (const city of swedishCities) {
      if (lowerText.includes(city)) {
        // Kontrollera att det inte bara är en referens utan faktiskt en lokation
        const cityPattern = new RegExp(`(${city})(?!.*(?:från|till|på väg|mellan))`, 'gi');
        if (cityPattern.test(text)) {
          chainMatches.push({
            brand: brand,
            city: city.charAt(0).toUpperCase() + city.slice(1)
          });
        }
      }
    }

    // Filtrera bort dubletter
    const unique = chainMatches.filter((match, index, self) =>
      index === self.findIndex(m => m.city === match.city)
    );

    return unique;
  }

  /**
   * Konvertera till normalizer-format
   */
  convertToNormalizerFormat(restaurantInfo, extractedData) {
    // Samla kontaktinfo
    const contact = extractedData.contact.length > 0 ? extractedData.contact[0].contact : {};

    // Samla öppettider
    const hours = extractedData.hours.length > 0 ? extractedData.hours[0].hours : null;

    // Samla menydata
    const menu = extractedData.menus.flatMap(m => m.items.map(item => ({
      title: item.title,
      description: item.description,
      price: item.price,
      category: 'allmän'
    })));

    return {
      name: restaurantInfo.name,
      brand: restaurantInfo.brand,
      city: restaurantInfo.city,
      address: contact.address,
      phone: contact.phone,
      email: contact.email,
      website: restaurantInfo.baseUrl,
      url: restaurantInfo.baseUrl,
      source_urls: [restaurantInfo.baseUrl],
      hours: hours,
      menu: menu,
      booking: {
        min_guests: 1,
        max_guests: 8,
        lead_time_minutes: 120,
        dining_duration_minutes: 120,
        group_overflow_rule: 'manual',
        cancellation_policy: 'Kontakta restaurangen för avbokning'
      },
      messages: []
    };
  }
}

// CLI användning
async function main() {
  const url = process.argv[2];

  if (!url) {
    console.log('Användning: node src/auto-scraper.js <URL>');
    console.log('Exempel: node src/auto-scraper.js https://restaurangmavi.se');
    process.exit(1);
  }

  const scraper = new AutoScraper();

  try {
    await scraper.scrapeUrl(url);
  } catch (error) {
    console.error('❌ Fel:', error.message);
    process.exit(1);
  }
}

// Kör om detta är huvudfilen
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}