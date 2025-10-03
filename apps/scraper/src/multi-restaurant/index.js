import { MultiScraper } from './multi-scraper.js';
import { multiConfig } from './config.js';
import { Logger } from '../utils/logger.js';

/**
 * Multi-Restaurant CLI Interface
 * Huvudingång för multi-restaurant funktionalitet
 */
export class MultiRestaurantCLI {
  constructor() {
    this.logger = new Logger('MultiRestaurantCLI');
    this.multiScraper = new MultiScraper();
    this.initialized = false;
  }

  /**
   * Säkerställ att systemet är initierat
   */
  async ensureInitialized() {
    if (!this.initialized) {
      try {
        await this.loadRestaurants('./config/restaurants.json');
      } catch (error) {
        // Ignorera fel om fil inte finns
      }
      this.initialized = true;
    }
  }

  /**
   * Initiera med exempel-restauranger
   */
  async initializeExample() {
    const sampleRestaurants = multiConfig.createTorstensSampleConfig();
    await this.multiScraper.registerRestaurants(sampleRestaurants);

    // Spara till fil för persistens
    try {
      await this.saveRestaurants('./config/restaurants.json');
    } catch (error) {
      // Ignorera fel om config-mapp inte finns
    }

    this.logger.info('Initialized with sample restaurants', {
      count: sampleRestaurants.length,
      restaurants: sampleRestaurants.map(r => r.slug)
    });

    return sampleRestaurants;
  }

  /**
   * Ladda restauranger från konfigurationsfil
   */
  async loadRestaurants(configFile = './config/restaurants.json') {
    try {
      const count = await multiConfig.loadRestaurantsFromFile(configFile);
      this.logger.info(`Loaded ${count} restaurants from ${configFile}`);
      return count;
    } catch (error) {
      this.logger.error(`Failed to load restaurants from ${configFile}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Spara restaurang-konfiguration
   */
  async saveRestaurants(configFile = './config/restaurants.json') {
    try {
      const count = await multiConfig.saveRestaurantsToFile(configFile);
      this.logger.info(`Saved ${count} restaurants to ${configFile}`);
      return count;
    } catch (error) {
      this.logger.error(`Failed to save restaurants to ${configFile}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Scrapa en specifik restaurang
   */
  async scrapeOne(restaurantSlug) {
    try {
      const result = await this.multiScraper.scrapeRestaurant(restaurantSlug);
      console.log(`✅ Successfully scraped: ${restaurantSlug}`);
      console.log(`📊 Knowledge items: ${result.normalizedData.knowledge.length}`);
      console.log(`📁 Output: ./restaurants/${restaurantSlug}/`);
      return result;
    } catch (error) {
      console.log(`❌ Failed to scrape: ${restaurantSlug}`);
      console.log(`Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Scrapa alla registrerade restauranger
   */
  async scrapeAll() {
    console.log('🚀 Starting multi-restaurant scrape...');

    try {
      const results = await this.multiScraper.scrapeAllRestaurants();

      console.log('\\n📊 Multi-Restaurant Scrape Results:');
      console.log(`✅ Successful: ${results.successful.length}`);
      console.log(`❌ Failed: ${results.failed.length}`);
      console.log(`⏱️ Duration: ${Math.round(results.duration / 1000)}s`);

      if (results.successful.length > 0) {
        console.log('\\n🎯 Successfully scraped:');
        results.successful.forEach(slug => console.log(`  - ${slug}`));
      }

      if (results.failed.length > 0) {
        console.log('\\n❌ Failed to scrape:');
        results.failed.forEach(({ slug, error }) => {
          console.log(`  - ${slug}: ${error}`);
        });
      }

      console.log(`\\n📁 Global index: ./restaurants/index.json`);

      return results;
    } catch (error) {
      console.log(`❌ Multi-restaurant scrape failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Visa status för multi-restaurant system
   */
  async showStatus() {
    await this.ensureInitialized();
    const health = await this.multiScraper.healthCheck();
    const restaurants = multiConfig.getAllRestaurants();

    console.log('📊 Multi-Restaurant System Status');
    console.log('==================================');
    console.log(`System Status: ${health.status === 'healthy' ? '✅' : '⚠️'} ${health.status}`);
    console.log(`Registered Restaurants: ${restaurants.length}`);
    console.log(`Output Directory: ${multiConfig.config.outputDir}`);
    console.log(`Global Index: ${health.outputs.indexExists ? '✅' : '❌'} ${health.outputs.indexExists ? 'exists' : 'missing'}`);
    console.log(`Restaurant Directories: ${health.outputs.restaurantDirs}`);

    if (health.restaurants.lastScrape) {
      const lastScrapeDate = new Date(health.restaurants.lastScrape);
      console.log(`Last Scrape: ${lastScrapeDate.toLocaleString()}`);
    } else {
      console.log('Last Scrape: Never');
    }

    if (restaurants.length > 0) {
      console.log('\\nRegistered Restaurants:');
      restaurants.forEach(restaurant => {
        console.log(`  - ${restaurant.slug} (${restaurant.name}, ${restaurant.city})`);
      });
    }

    return health;
  }

  /**
   * Lista alla registrerade restauranger
   */
  async listRestaurants() {
    await this.ensureInitialized();
    const restaurants = multiConfig.getAllRestaurants();

    if (restaurants.length === 0) {
      console.log('No restaurants registered. Use "init-example" or "load" to add restaurants.');
      return [];
    }

    console.log('📍 Registered Restaurants:');
    console.log('========================');

    restaurants.forEach((restaurant, index) => {
      console.log(`${index + 1}. ${restaurant.name}`);
      console.log(`   Slug: ${restaurant.slug}`);
      console.log(`   City: ${restaurant.city}`);
      console.log(`   URL: ${restaurant.baseUrl}`);
      if (restaurant.brand) {
        console.log(`   Brand: ${restaurant.brand}`);
      }
      console.log('');
    });

    return restaurants;
  }

  /**
   * Registrera en ny restaurang interaktivt
   */
  async registerRestaurant(config) {
    try {
      multiConfig.validateRestaurantConfig(config);
      const registeredConfig = multiConfig.registerRestaurant(config);

      console.log(`✅ Successfully registered: ${config.name} (${config.slug})`);
      console.log(`📍 Location: ${config.city}`);
      console.log(`🌐 URL: ${config.baseUrl}`);

      return registeredConfig;
    } catch (error) {
      console.log(`❌ Failed to register restaurant: ${error.message}`);
      throw error;
    }
  }

  /**
   * Health check kommando
   */
  async healthCheck() {
    const health = await this.multiScraper.healthCheck();

    console.log('🏥 Multi-Restaurant Health Check');
    console.log('===============================');
    console.log(JSON.stringify(health, null, 2));

    return health;
  }

  /**
   * Rensa all data
   */
  async clean() {
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      const outputDir = multiConfig.config.outputDir;

      // Ta bort output-mappen
      try {
        await fs.rm(outputDir, { recursive: true, force: true });
        console.log(`✅ Cleaned output directory: ${outputDir}`);
      } catch (error) {
        console.log(`⚠️ Could not clean ${outputDir}: ${error.message}`);
      }

      // Rensa registrerade restauranger
      multiConfig.restaurants.clear();
      console.log('✅ Cleared registered restaurants');

      return true;
    } catch (error) {
      console.log(`❌ Failed to clean: ${error.message}`);
      throw error;
    }
  }
}

// Export för CLI användning
export const multiCLI = new MultiRestaurantCLI();
export default multiCLI;

// CLI-kommandon för huvudapplikationen
export const multiRestaurantCommands = {
  'multi-init': () => multiCLI.initializeExample(),
  'multi-load': (file) => multiCLI.loadRestaurants(file),
  'multi-save': (file) => multiCLI.saveRestaurants(file),
  'multi-scrape-all': () => multiCLI.scrapeAll(),
  'multi-scrape': (slug) => multiCLI.scrapeOne(slug),
  'multi-status': () => multiCLI.showStatus(),
  'multi-list': () => multiCLI.listRestaurants(),
  'multi-health': () => multiCLI.healthCheck(),
  'multi-clean': () => multiCLI.clean()
};