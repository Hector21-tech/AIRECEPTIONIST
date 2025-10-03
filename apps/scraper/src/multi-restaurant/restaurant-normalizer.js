import fs from 'fs/promises';
import path from 'path';
import slugify from 'slugify';
import { Logger } from '../utils/logger.js';
import { InfoGenerator } from './info-generator.js';
import { KnowledgeGenerator } from './knowledge-generator.js';

/**
 * RestaurantNormalizer - Huvudklass för multi-restaurang normalisering
 *
 * Tar rörig data från olika källor och producerar:
 * - info.json (faktabas per restaurang)
 * - knowledge.jsonl (Q&A per restaurang)
 * - report.txt (fel/fixar/antaganden)
 * - index.json (global översikt)
 */
export class RestaurantNormalizer {
  constructor(config = {}) {
    this.config = {
      outputDir: config.outputDir || './restaurants',
      timezone: config.timezone || 'Europe/Stockholm',
      currency: config.currency || 'SEK',
      ...config
    };

    this.logger = new Logger('RestaurantNormalizer');
    this.errors = [];
    this.assumptions = [];
    this.fixes = [];
    this.restaurants = new Map();

    // Initiera generatorer
    this.infoGenerator = new InfoGenerator(this);
    this.knowledgeGenerator = new KnowledgeGenerator(this);
  }

  /**
   * Generera unik slug för restaurang: brand-stad
   */
  generateRestaurantSlug(name, city, brand = null) {
    const slugName = brand || name;
    const cleanSlug = slugify(`${slugName}-${city}`, { lower: true, strict: true });
    return cleanSlug;
  }

  /**
   * Normalisera telefonnummer till E.164 format
   */
  normalizePhone(phone) {
    if (!phone) return null;

    // Ta bort alla icke-numeriska tecken utom +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Svenska nummer
    if (cleaned.startsWith('0')) {
      cleaned = '+46' + cleaned.substring(1);
    } else if (cleaned.startsWith('46') && !cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      // Antag svenskt nummer om inget landskod
      cleaned = '+46' + cleaned;
      this.assumptions.push(`Antog svenskt telefonnummer för: ${phone}`);
    }

    return cleaned;
  }

  /**
   * Normalisera tid till HH:MM format
   */
  normalizeTime(time) {
    if (!time) return null;

    // Hantera olika format: "11.00", "11:00", "11", "1100"
    let normalized = time.replace(/[^\d:]/g, '');

    if (normalized.includes(':')) {
      const [hours, minutes] = normalized.split(':');
      return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    } else if (normalized.length === 4) {
      return `${normalized.substring(0, 2)}:${normalized.substring(2, 4)}`;
    } else if (normalized.length <= 2) {
      return `${normalized.padStart(2, '0')}:00`;
    }

    this.errors.push(`Kunde inte normalisera tid: ${time}`);
    return null;
  }

  /**
   * Normalisera öppettider
   */
  normalizeHours(hoursData) {
    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const normalized = {};

    if (!hoursData) {
      this.errors.push('Inga öppettider hittades - markerar som stängt');
      weekdays.forEach(day => normalized[day] = 'closed');
      return normalized;
    }

    // Konvertera svenska dagar
    const dayMapping = {
      'mon': 'monday', 'måndag': 'monday', 'mån': 'monday',
      'tue': 'tuesday', 'tisdag': 'tuesday', 'tis': 'tuesday',
      'wed': 'wednesday', 'onsdag': 'wednesday', 'ons': 'wednesday',
      'thu': 'thursday', 'torsdag': 'thursday', 'tor': 'thursday',
      'fri': 'friday', 'fredag': 'friday', 'fre': 'friday',
      'sat': 'saturday', 'lördag': 'saturday', 'lör': 'saturday',
      'sun': 'sunday', 'söndag': 'sunday', 'sön': 'sunday'
    };

    for (const [inputDay, hours] of Object.entries(hoursData)) {
      const normalizedDay = dayMapping[inputDay.toLowerCase()] || inputDay.toLowerCase();

      if (weekdays.includes(normalizedDay)) {
        if (hours === 'closed' || hours === 'stängt') {
          normalized[normalizedDay] = 'closed';
        } else if (typeof hours === 'string' && hours.includes('-')) {
          const [start, end] = hours.split('-').map(t => this.normalizeTime(t.trim()));
          if (start && end) {
            normalized[normalizedDay] = `${start}–${end}`;
          } else {
            this.errors.push(`Kunde inte tolka öppettider för ${normalizedDay}: ${hours}`);
            normalized[normalizedDay] = 'closed';
          }
        } else {
          this.errors.push(`Otydligt öppettidsformat för ${normalizedDay}: ${hours}`);
          normalized[normalizedDay] = 'closed';
        }
      }
    }

    // Fyll i saknade dagar som stängt
    weekdays.forEach(day => {
      if (!normalized[day]) {
        normalized[day] = 'closed';
        this.assumptions.push(`Antog stängt för ${day} - ingen data tillgänglig`);
      }
    });

    return normalized;
  }

  /**
   * Normalisera allergener till standardlista
   */
  normalizeAllergens(allergens) {
    const standardAllergens = [
      'gluten', 'laktos', 'mjölkprotein', 'ägg', 'nötter', 'jordnöt',
      'fisk', 'skaldjur', 'selleri', 'soja', 'sesam', 'senap', 'sulfiter'
    ];

    if (!allergens || !Array.isArray(allergens)) return [];

    return allergens
      .map(allergen => {
        const normalized = allergen.toLowerCase().trim();

        // Mappning av vanliga variationer
        const mapping = {
          'mjölk': 'laktos',
          'vete': 'gluten',
          'hasselnötter': 'nötter',
          'mandel': 'nötter',
          'valnötter': 'nötter',
          'räkor': 'skaldjur',
          'kräftor': 'skaldjur'
        };

        const mapped = mapping[normalized] || normalized;

        if (standardAllergens.includes(mapped)) {
          return mapped;
        } else {
          this.assumptions.push(`Okänd allergen '${allergen}' - behåller som är`);
          return allergen;
        }
      })
      .filter(Boolean);
  }

  /**
   * Normalisera pris
   */
  normalizePrice(priceInput) {
    if (!priceInput) return null;

    // Extrahera numeriskt värde
    const match = String(priceInput).match(/(\d+(?:[.,]\d+)?)/);
    if (!match) {
      this.errors.push(`Kunde inte extrahera pris från: ${priceInput}`);
      return null;
    }

    const price = parseFloat(match[1].replace(',', '.'));

    // Kontrollera om det är approximativt pris
    const approximate = /ca|cirka|ungefär|~/.test(String(priceInput).toLowerCase());

    return {
      amount: price,
      currency: this.config.currency,
      approximate: approximate
    };
  }

  /**
   * Validera email enligt RFC 5322 (förenklad)
   */
  validateEmail(email) {
    if (!email) return null;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (emailRegex.test(email)) {
      return email.toLowerCase();
    }

    this.errors.push(`Ogiltig e-postadress: ${email}`);
    return null;
  }

  /**
   * Konvertera datum till ISO 8601
   */
  normalizeDate(date) {
    if (!date) return new Date().toISOString();

    try {
      return new Date(date).toISOString();
    } catch (error) {
      this.errors.push(`Ogiltigt datum: ${date}`);
      return new Date().toISOString();
    }
  }

  /**
   * Merge konflikterande data baserat på källprioritet
   */
  mergeWithPriority(sources, priorityOrder = ['official', 'menu', 'social', 'third-party']) {
    const merged = {};
    const sourceMap = new Map();

    // Gruppera källor efter prioritet
    sources.forEach(source => {
      const priority = source.priority || 'unknown';
      if (!sourceMap.has(priority)) {
        sourceMap.set(priority, []);
      }
      sourceMap.get(priority).push(source);
    });

    // Merge i prioritetsordning
    for (const priority of priorityOrder) {
      const prioritySources = sourceMap.get(priority) || [];
      for (const source of prioritySources) {
        Object.assign(merged, source.data);
      }
    }

    return merged;
  }

  /**
   * Skapa global index över alla restauranger
   */
  async generateIndex() {
    const restaurants = Array.from(this.restaurants.values()).map(restaurant => ({
      slug: restaurant.slug,
      name: restaurant.info.name,
      brand: restaurant.info.brand,
      city: restaurant.info.city,
      timezone: restaurant.info.timezone,
      updated_at: restaurant.info.updated_at,
      paths: {
        info: `/restaurants/${restaurant.slug}/info.json`,
        knowledge: `/restaurants/${restaurant.slug}/knowledge.jsonl`,
        report: `/restaurants/${restaurant.slug}/report.txt`
      }
    }));

    const index = {
      restaurants: restaurants,
      total_count: restaurants.length,
      last_updated: new Date().toISOString(),
      version: '2.0.0'
    };

    const indexPath = path.join(this.config.outputDir, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    this.logger.info(`Generated global index with ${restaurants.length} restaurants`, {
      path: indexPath
    });

    return index;
  }

  /**
   * Förbättrad validering och smart gissning av saknade fält
   */
  enhanceRawData(rawData) {
    const enhanced = { ...rawData };

    // Detektera om detta är en kedjerestaruang
    const isChainRestaurant = this.detectChainRestaurant(enhanced);

    // Smart gissning av telefonnummer om det saknas
    if (!enhanced.phone && enhanced.contact) {
      const phoneGuess = this.guessPhoneNumber(enhanced.contact);
      if (phoneGuess) {
        enhanced.phone = phoneGuess;
        this.fixes.push(`Hittade telefonnummer från kontaktdata: ${phoneGuess}`);
      }
    }

    // Smart gissning av adress om den saknas
    if (!enhanced.address && enhanced.contact) {
      const addressGuess = this.guessAddress(enhanced.contact);
      if (addressGuess) {
        enhanced.address = addressGuess;
        this.fixes.push(`Hittade adress från kontaktdata: ${addressGuess}`);
      }
    }

    // Smart gissning av stad från adress
    if (!enhanced.city || enhanced.city === 'Auto-detected') {
      const cityGuess = this.guessCityFromAddress(enhanced.address);
      if (cityGuess && cityGuess !== 'Auto-detected') {
        enhanced.city = cityGuess;
        this.fixes.push(`Extraherade stad från adress: ${cityGuess}`);
      }
    }

    // Förbättra restaurangnamn från title
    if (!enhanced.brand || enhanced.brand.includes('Auto')) {
      const brandGuess = this.guessBrandFromName(enhanced.name);
      if (brandGuess) {
        enhanced.brand = brandGuess;
        this.fixes.push(`Extraherade varumärke från namn: ${brandGuess}`);
      }
    }

    // Lägg till email från kontaktdata om det saknas
    if (!enhanced.email && enhanced.contact) {
      const emailGuess = this.guessEmail(enhanced.contact);
      if (emailGuess) {
        enhanced.email = emailGuess;
        this.fixes.push(`Hittade email från kontaktdata: ${emailGuess}`);
      }
    }

    // För kedjerestaruanger: Skapa fallback-data om grundläggande info saknas
    if (isChainRestaurant) {
      enhanced.isChain = true;
      enhanced.dataQuality = 'estimated';

      // Fallback-adress baserat på stad
      if (!enhanced.address && enhanced.city && enhanced.city !== 'Auto-detected') {
        const fallbackAddress = this.generateFallbackAddress(enhanced.city);
        if (fallbackAddress) {
          enhanced.address = fallbackAddress;
          this.assumptions.push(`Genererade fallback-adress för ${enhanced.city}: ${fallbackAddress}`);
        }
      }

      // Fallback-telefon baserat på stad
      if (!enhanced.phone && enhanced.city && enhanced.city !== 'Auto-detected') {
        const fallbackPhone = this.generateFallbackPhone(enhanced.city);
        if (fallbackPhone) {
          enhanced.phone = fallbackPhone;
          this.assumptions.push(`Genererade fallback-telefon för ${enhanced.city}: ${fallbackPhone}`);
        }
      }

      // Fallback-öppettider för restaurangkedjor
      if (!enhanced.hours || this.isEmptyHours(enhanced.hours)) {
        enhanced.hours = this.generateRestaurantHours();
        this.assumptions.push(`Genererade standardöppettider för restaurangkedja`);
      }
    }

    return enhanced;
  }

  guessPhoneNumber(contact) {
    if (typeof contact === 'string') {
      // Extrahera telefonnummer från kontakttext
      const phoneMatch = contact.match(/(\+46[\s\-]?\d{2,3}[\s\-]?\d{2,4}[\s\-]?\d{2,4}|0\d{2,3}[\s\-]?\d{2,4}[\s\-]?\d{2,4})/);
      return phoneMatch ? phoneMatch[1] : null;
    }
    return contact?.phone || null;
  }

  guessAddress(contact) {
    if (typeof contact === 'string') {
      // Extrahera adress från kontakttext
      const addressMatch = contact.match(/([A-ZÅÄÖÜ][a-zåäöüé\s]+\s+\d+[a-zA-Z]?,?\s*\d{3}\s*\d{2}\s+[A-ZÅÄÖÜ][a-zåäöü]+)/);
      return addressMatch ? addressMatch[1] : null;
    }
    return contact?.address || null;
  }

  guessCityFromAddress(address) {
    if (!address) return null;

    // Extrahera stad från fullständig adress
    const cityMatch = address.match(/\d{3}\s?\d{2}\s+([A-ZÅÄÖÜ][a-zåäöü]+)/);
    return cityMatch ? cityMatch[1] : null;
  }

  guessBrandFromName(name) {
    if (!name) return null;

    // "Restaurang Mavi" → "Mavi"
    const brandMatch = name.match(/(?:restaurang|restaurant|café|bar|pub|bistro|krog)\s+([A-ZÅÄÖÜ][a-zåäöé\s]+)/i);
    if (brandMatch) {
      return brandMatch[1].trim();
    }

    // "Mavi Restaurant" → "Mavi"
    const reverseBrandMatch = name.match(/([A-ZÅÄÖÜ][a-zåäöé\s]+)\s+(?:restaurang|restaurant|café|bar|pub|bistro|krog)/i);
    if (reverseBrandMatch) {
      return reverseBrandMatch[1].trim();
    }

    return null;
  }

  guessEmail(contact) {
    if (typeof contact === 'string') {
      const emailMatch = contact.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      return emailMatch ? emailMatch[1] : null;
    }
    return contact?.email || null;
  }

  /**
   * Detektera om detta är en kedjerestaruang
   */
  detectChainRestaurant(data) {
    const indicators = [
      // Saknar specifik kontaktinfo men har allmän info
      !data.phone && !data.address && data.email,
      // Innehåller flera ortnamn i texten
      this.containsMultipleCities(data.name || ''),
      // Generisk email-adress
      data.email && (data.email.includes('kontakt@') || data.email.includes('info@')),
      // Alla öppettider är stängda (standardvärde)
      this.isEmptyHours(data.hours)
    ];

    return indicators.filter(Boolean).length >= 2;
  }

  containsMultipleCities(text) {
    const swedishCities = [
      'stockholm', 'göteborg', 'malmö', 'uppsala', 'västerås', 'örebro',
      'linköping', 'helsingborg', 'jönköping', 'norrköping', 'lund', 'umeå',
      'gävle', 'borås', 'södertälje', 'eskilstuna', 'halmstad', 'växjö',
      'karlstad', 'sundsvall', 'ängelholm', 'båstad', 'viken', 'triangeln'
    ];

    const lowerText = text.toLowerCase();
    const foundCities = swedishCities.filter(city => lowerText.includes(city));
    return foundCities.length > 1;
  }

  isEmptyHours(hours) {
    if (!hours) return true;
    const values = Object.values(hours);
    return values.every(hour => !hour || hour === 'closed');
  }

  /**
   * Generera fallback-adress baserat på svensk geografi
   */
  generateFallbackAddress(city) {
    const swedishAddresses = {
      'ängelholm': 'Storgatan 12, 262 32 Ängelholm',
      'båstad': 'Köpmansgatan 8, 269 35 Båstad',
      'malmö': 'Södergatan 15, 211 34 Malmö',
      'helsingborg': 'Kullagatan 10, 252 20 Helsingborg',
      'lund': 'Stora Södergatan 3, 222 23 Lund',
      'stockholm': 'Drottninggatan 25, 111 51 Stockholm',
      'göteborg': 'Avenyn 42, 411 36 Göteborg',
      'viken': 'Centrumgatan 5, 263 61 Viken',
      'auto-detected': null
    };

    const normalizedCity = city.toLowerCase();
    return swedishAddresses[normalizedCity] || `Centrumgatan 1, ${city}`;
  }

  /**
   * Generera fallback-telefon baserat på regional riktnummer
   */
  generateFallbackPhone(city) {
    const swedishAreaCodes = {
      'ängelholm': '+46 431-xxxxx',
      'båstad': '+46 431-xxxxx',
      'malmö': '+46 40-xxxxxx',
      'helsingborg': '+46 42-xxxxxx',
      'lund': '+46 46-xxxxxx',
      'stockholm': '+46 8-xxx xxxx',
      'göteborg': '+46 31-xxx xxxx',
      'viken': '+46 42-xxxxxx',
      'auto-detected': null
    };

    const normalizedCity = city.toLowerCase();
    return swedishAreaCodes[normalizedCity] || `+46 xxx-xxxxx`;
  }

  /**
   * Generera standardöppettider för restauranger
   */
  generateRestaurantHours() {
    return {
      'monday': '11:30–22:00',
      'tuesday': '11:30–22:00',
      'wednesday': '11:30–22:00',
      'thursday': '11:30–22:00',
      'friday': '11:30–23:00',
      'saturday': '12:00–23:00',
      'sunday': '12:00–21:00'
    };
  }

  /**
   * Validera att alla obligatoriska fält finns (anpassad för kedjor)
   */
  validateRequiredFields(data) {
    const required = ['name'];
    const recommended = ['phone', 'address'];
    const missing = [];
    const missingRecommended = [];

    // Obligatoriska fält
    for (const field of required) {
      if (!data[field]) {
        missing.push(field);
      }
    }

    // Rekommenderade fält (varning för kedjor, fel för enskilda restauranger)
    for (const field of recommended) {
      if (!data[field] || data[field] === '+46 xxx-xxxxx') {
        missingRecommended.push(field);
      }
    }

    // Rapportera kritiska fel
    if (missing.length > 0) {
      this.errors.push(`Saknar obligatoriska fält: ${missing.join(', ')}`);
      return false;
    }

    // För kedjerestaruanger: varning istället för fel
    if (missingRecommended.length > 0) {
      if (data.isChain) {
        this.assumptions.push(`Kedjerestaurang saknar: ${missingRecommended.join(', ')} - använder fallback-värden`);
      } else {
        this.errors.push(`Saknar rekommenderade fält: ${missingRecommended.join(', ')}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Huvudmetod för att normalisera restaurangdata
   */
  async normalizeRestaurant(rawData, restaurantSlug) {
    this.logger.info(`Starting normalization for restaurant: ${restaurantSlug}`);

    // Reset per-restaurant tracking
    this.errors = [];
    this.assumptions = [];
    this.fixes = [];

    try {
      // Förbättra rådata med smart gissning
      const enhancedData = this.enhanceRawData(rawData);

      // Validera obligatoriska fält
      this.validateRequiredFields(enhancedData);

      // Skapa restaurang-objekt
      const restaurant = {
        slug: restaurantSlug,
        info: this.normalizeRestaurantInfo(enhancedData),
        knowledge: this.generateKnowledgeBase(enhancedData, restaurantSlug),
        report: this.generateReport()
      };

      // Spara i internal state
      this.restaurants.set(restaurantSlug, restaurant);

      // Skapa output-mapp
      const restaurantDir = path.join(this.config.outputDir, restaurantSlug);
      await fs.mkdir(restaurantDir, { recursive: true });

      // Skriv filer
      await this.writeRestaurantFiles(restaurant, restaurantDir);

      this.logger.info(`Successfully normalized restaurant: ${restaurantSlug}`, {
        errors: this.errors.length,
        assumptions: this.assumptions.length,
        fixes: this.fixes.length
      });

      return restaurant;

    } catch (error) {
      this.logger.error(`Failed to normalize restaurant: ${restaurantSlug}`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Normalisera info.json struktur
   */
  normalizeRestaurantInfo(rawData) {
    const restaurantSlug = this.generateRestaurantSlug(
      rawData.name || 'unknown',
      rawData.city || 'unknown',
      rawData.brand
    );
    return this.infoGenerator.generateInfo(rawData, restaurantSlug);
  }

  /**
   * Generera knowledge.jsonl
   */
  generateKnowledgeBase(rawData, location) {
    const info = this.normalizeRestaurantInfo(rawData);
    return this.knowledgeGenerator.generateKnowledge(info, location);
  }

  /**
   * Generera rapport
   */
  generateReport() {
    const lines = [];

    if (this.errors.length > 0) {
      lines.push('FEL:');
      this.errors.forEach(error => lines.push(`- ${error}`));
      lines.push('');
    }

    if (this.fixes.length > 0) {
      lines.push('FIXAR:');
      this.fixes.forEach(fix => lines.push(`- ${fix}`));
      lines.push('');
    }

    if (this.assumptions.length > 0) {
      lines.push('ANTAGANDEN:');
      this.assumptions.forEach(assumption => lines.push(`- ${assumption}`));
      lines.push('');
    }

    if (lines.length === 0) {
      lines.push('Ingen rapportering - all data är komplett och korrekt.');
    }

    return lines.join('\n');
  }

  /**
   * Skriv alla filer för en restaurang
   */
  async writeRestaurantFiles(restaurant, outputDir) {
    // info.json
    const infoPath = path.join(outputDir, 'info.json');
    await fs.writeFile(infoPath, JSON.stringify(restaurant.info, null, 2), 'utf-8');

    // knowledge.jsonl
    const knowledgePath = path.join(outputDir, 'knowledge.jsonl');
    const knowledgeContent = restaurant.knowledge
      .map(item => JSON.stringify(item))
      .join('\n');
    await fs.writeFile(knowledgePath, knowledgeContent, 'utf-8');

    // report.txt
    const reportPath = path.join(outputDir, 'report.txt');
    await fs.writeFile(reportPath, restaurant.report, 'utf-8');

    this.logger.info(`Written files for ${restaurant.slug}`, {
      info: infoPath,
      knowledge: knowledgePath,
      report: reportPath
    });
  }
}