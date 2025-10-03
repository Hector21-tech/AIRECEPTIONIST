import dotenv from 'dotenv';

dotenv.config();

export const config = {
  baseUrl: process.env.BASE_URL || 'https://torstens.se',
  crawlDelayMs: parseInt(process.env.CRAWL_DELAY_MS) || 500,
  maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 3,
  userAgent: process.env.USER_AGENT || 'TorstensScraper/1.0',
  voiceAiWebhookUrl: process.env.VOICE_AI_WEBHOOK_URL,
  voiceAiApiKey: process.env.VOICE_AI_API_KEY,
  cronSchedule: process.env.CRON_SCHEDULE || '0 6 * * *',
  exportFormat: process.env.EXPORT_FORMAT || 'json',
  knowledgeBasePath: process.env.KNOWLEDGE_BASE_PATH || './output/knowledge.jsonl',

  // Retry and timeout configuration
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
  retryDelayMs: parseInt(process.env.RETRY_DELAY_MS) || 1000,
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS) || 30000,
  sitemapTimeoutMs: parseInt(process.env.SITEMAP_TIMEOUT_MS) || 15000,

  // Paths
  dataDir: './data',
  outputDir: './output',
  rawPagesFile: './data/raw_pages.json',
  extractedContentFile: './data/extracted_content.json',
  restaurantDataFile: './output/restaurant_data.json',

  // Scraping targets
  sitemapPaths: ['/sitemap.xml', '/sitemap_index.xml'],

  // Content extraction patterns
  menuKeywords: ['meny', 'menu', 'rätter', 'dagens', 'kött', 'fisk', 'vegetariskt', 'dessert'],
  hoursKeywords: ['öppet', 'öppettider', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'],
  contactKeywords: ['telefon', 'adress', 'kontakt', 'boka', 'bokning', 'reservation'],
  allergenKeywords: ['gluten', 'laktos', 'nötter', 'jordnötter', 'ägg', 'soja', 'fisk', 'skaldjur', 'allergi']
};