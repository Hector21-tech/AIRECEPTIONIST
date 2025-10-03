import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

/**
 * Multi-restaurant konfiguration
 * Stödjer både enskilda restauranger och kedjor
 */
export class MultiRestaurantConfig {
  constructor() {
    this.config = this.loadBaseConfig();
    this.restaurants = new Map();
  }

  /**
   * Ladda grundkonfiguration
   */
  loadBaseConfig() {
    return {
      // Multi-restaurant inställningar
      outputDir: process.env.RESTAURANTS_OUTPUT_DIR || './restaurants',
      indexFile: process.env.INDEX_FILE || './restaurants/index.json',

      // Normalisering
      defaultTimezone: process.env.DEFAULT_TIMEZONE || 'Europe/Stockholm',
      defaultCurrency: process.env.DEFAULT_CURRENCY || 'SEK',
      defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || '+46',

      // Crawler inställningar
      crawlDelayMs: parseInt(process.env.CRAWL_DELAY_MS) || 500,
      maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 3,
      userAgent: process.env.USER_AGENT || 'MultiRestaurantScraper/2.0',

      // Retry och timeout
      maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
      retryDelayMs: parseInt(process.env.RETRY_DELAY_MS) || 1000,
      requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS) || 30000,

      // Schemaläggning
      cronSchedule: process.env.CRON_SCHEDULE || '0 6 * * *',

      // Voice AI
      voiceAiWebhookUrl: process.env.VOICE_AI_WEBHOOK_URL,
      voiceAiApiKey: process.env.VOICE_AI_API_KEY,

      // Logging
      logLevel: process.env.LOG_LEVEL || 'info',

      // Kvalitetsgrind
      minKnowledgeItems: parseInt(process.env.MIN_KNOWLEDGE_ITEMS) || 15,
      requireOpeningHours: process.env.REQUIRE_OPENING_HOURS !== 'false',
      requireContactInfo: process.env.REQUIRE_CONTACT_INFO !== 'false',

      // Source prioritering
      sourcePriority: (process.env.SOURCE_PRIORITY || 'official,menu,social,third-party').split(',')
    };
  }

  /**
   * Registrera en restaurang
   */
  registerRestaurant(config) {
    const {
      slug,
      name,
      brand,
      city,
      baseUrl,
      sitemapPaths = ['/sitemap.xml'],
      specialConfig = {}
    } = config;

    if (!slug || !name || !baseUrl) {
      throw new Error('Restaurant registration requires: slug, name, baseUrl');
    }

    const restaurantConfig = {
      slug,
      name,
      brand,
      city,
      baseUrl,
      sitemapPaths,

      // Merge special config with defaults
      ...this.config,
      ...specialConfig,

      // Restaurant-specific paths
      paths: {
        output: path.join(this.config.outputDir, slug),
        info: path.join(this.config.outputDir, slug, 'info.json'),
        knowledge: path.join(this.config.outputDir, slug, 'knowledge.jsonl'),
        report: path.join(this.config.outputDir, slug, 'report.txt'),
        rawData: path.join(this.config.outputDir, slug, 'raw_data.json'),
        extractedData: path.join(this.config.outputDir, slug, 'extracted_data.json')
      },

      // Content extraction patterns (kan vara restaurang-specifika)
      menuKeywords: specialConfig.menuKeywords || this.getDefaultMenuKeywords(),
      hoursKeywords: specialConfig.hoursKeywords || this.getDefaultHoursKeywords(),
      contactKeywords: specialConfig.contactKeywords || this.getDefaultContactKeywords(),
      allergenKeywords: specialConfig.allergenKeywords || this.getDefaultAllergenKeywords(),

      // Restaurant-specific validation rules
      validation: {
        requireMenu: specialConfig.requireMenu !== false,
        requireHours: specialConfig.requireHours !== false,
        requireContact: specialConfig.requireContact !== false,
        minMenuItems: specialConfig.minMenuItems || 5,
        ...specialConfig.validation
      }
    };

    this.restaurants.set(slug, restaurantConfig);
    return restaurantConfig;
  }

  /**
   * Hämta konfiguration för specifik restaurang
   */
  getRestaurantConfig(slug) {
    const config = this.restaurants.get(slug);
    if (!config) {
      throw new Error(`Restaurant not found: ${slug}`);
    }
    return config;
  }

  /**
   * Hämta alla registrerade restauranger
   */
  getAllRestaurants() {
    return Array.from(this.restaurants.values());
  }

  /**
   * Defaultnyckelord för meny-identifiering
   */
  getDefaultMenuKeywords() {
    return [
      'meny', 'menu', 'rätter', 'dishes', 'mat', 'food',
      'dagens', 'daily', 'lunch', 'dinner', 'middag',
      'kött', 'meat', 'fisk', 'fish', 'vegetariskt', 'vegetarian',
      'dessert', 'desserts', 'efterrätt', 'dryck', 'drinks',
      'specialiteter', 'specialties', 'husmansköst', 'traditionell'
    ];
  }

  /**
   * Defaultnyckelord för öppettider
   */
  getDefaultHoursKeywords() {
    return [
      'öppet', 'open', 'öppettider', 'opening hours', 'hours',
      'måndag', 'monday', 'tisdag', 'tuesday', 'onsdag', 'wednesday',
      'torsdag', 'thursday', 'fredag', 'friday', 'lördag', 'saturday',
      'söndag', 'sunday', 'vardagar', 'weekdays', 'helger', 'holidays',
      'stängt', 'closed', 'tider', 'times'
    ];
  }

  /**
   * Defaultnyckelord för kontaktinfo
   */
  getDefaultContactKeywords() {
    return [
      'telefon', 'phone', 'tel', 'kontakt', 'contact',
      'adress', 'address', 'plats', 'location', 'hitta', 'find',
      'boka', 'book', 'booking', 'reservation', 'bokning',
      'email', 'mail', 'e-post', 'epost'
    ];
  }

  /**
   * Defaultnyckelord för allergener
   */
  getDefaultAllergenKeywords() {
    return [
      'gluten', 'gluten-free', 'glutenfri', 'glutenfritt',
      'laktos', 'lactose', 'laktosfri', 'laktosfritt',
      'nötter', 'nuts', 'nöt', 'nut', 'jordnötter', 'peanuts',
      'ägg', 'egg', 'eggs', 'mjölk', 'milk', 'dairy',
      'soja', 'soy', 'fisk', 'fish', 'skaldjur', 'shellfish',
      'allergi', 'allergy', 'allergies', 'allergener', 'allergens',
      'vegetarisk', 'vegetarian', 'vegansk', 'vegan',
      'halal', 'kosher'
    ];
  }

  /**
   * Ladda restaurang-konfigurationer från fil
   */
  async loadRestaurantsFromFile(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const restaurants = JSON.parse(data);

      if (!Array.isArray(restaurants)) {
        throw new Error('Restaurants file must contain an array');
      }

      for (const restaurantConfig of restaurants) {
        this.registerRestaurant(restaurantConfig);
      }

      return restaurants.length;
    } catch (error) {
      throw new Error(`Failed to load restaurants from ${filePath}: ${error.message}`);
    }
  }

  /**
   * Spara restaurang-konfigurationer till fil
   */
  async saveRestaurantsToFile(filePath) {
    const restaurants = this.getAllRestaurants().map(config => ({
      slug: config.slug,
      name: config.name,
      brand: config.brand,
      city: config.city,
      baseUrl: config.baseUrl,
      sitemapPaths: config.sitemapPaths,
      specialConfig: {
        menuKeywords: config.menuKeywords,
        validation: config.validation
      }
    }));

    await fs.writeFile(filePath, JSON.stringify(restaurants, null, 2), 'utf-8');
    return restaurants.length;
  }

  /**
   * Validera restaurang-konfiguration
   */
  validateRestaurantConfig(config) {
    const errors = [];

    if (!config.slug) errors.push('slug är obligatoriskt');
    if (!config.name) errors.push('name är obligatoriskt');
    if (!config.baseUrl) errors.push('baseUrl är obligatoriskt');

    if (config.slug && !/^[a-z0-9-]+$/.test(config.slug)) {
      errors.push('slug får endast innehålla små bokstäver, siffror och bindestreck');
    }

    try {
      new URL(config.baseUrl);
    } catch {
      errors.push('baseUrl måste vara en giltig URL');
    }

    if (errors.length > 0) {
      throw new Error(`Ogiltig restaurang-konfiguration: ${errors.join(', ')}`);
    }

    return true;
  }

  /**
   * Skapa exempel-konfiguration för Torstens restauranger
   */
  createTorstensSampleConfig() {
    return [
      {
        slug: 'torstens-angelholm',
        name: 'Torstens',
        brand: 'Torstens',
        city: 'Ängelholm',
        baseUrl: 'https://torstens.se',
        sitemapPaths: ['/sitemap.xml', '/sitemap_index.xml'],
        specialConfig: {
          menuKeywords: ['meny', 'rätter', 'lunch', 'dagens'],
          validation: {
            requireMenu: true,
            requireHours: true,
            minMenuItems: 5
          }
        }
      },
      {
        slug: 'torstens-vala',
        name: 'Torstens Väla',
        brand: 'Torstens',
        city: 'Helsingborg',
        baseUrl: 'https://torstens.se/vala',
        sitemapPaths: ['/sitemap.xml'],
        specialConfig: {
          validation: {
            requireMenu: true,
            requireHours: true,
            minMenuItems: 3
          }
        }
      }
    ];
  }
}

// Globala konfigurationer för bakåtkompatibilitet
export const multiConfig = new MultiRestaurantConfig();

// Export som default för enkel användning
export default multiConfig;