import { chromium } from 'playwright';
import { config } from './config.js';
import fs from 'fs/promises';

export class PlaywrightCrawler {
  constructor() {
    this.crawledData = [];
  }

  async ensureDirectories() {
    await fs.mkdir(config.dataDir, { recursive: true });
    await fs.mkdir(config.outputDir, { recursive: true });
  }

  async crawlWithJS(urls) {
    console.log('🎭 Startar Playwright crawling för JS-renderade sidor...');

    await this.ensureDirectories();

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      userAgent: config.userAgent,
      viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    for (const url of urls) {
      try {
        console.log(`🎭 Crawlar med JS: ${url}`);

        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: 45000
        });

        // Vänta på att eventuell lazy-loading ska ladda
        await page.waitForTimeout(2000);

        const pageData = await page.evaluate(() => {
          // Extrahera strukturerad data från sidan
          const getTextContent = (selector) => {
            const element = document.querySelector(selector);
            return element ? element.textContent.trim() : '';
          };

          const getAllTextContent = (selector) => {
            const elements = document.querySelectorAll(selector);
            return Array.from(elements).map(el => el.textContent.trim());
          };

          return {
            title: document.title,
            h1: getTextContent('h1'),
            h2s: getAllTextContent('h2'),
            h3s: getAllTextContent('h3'),
            mainContent: getTextContent('main') || getTextContent('body'),
            menuItems: getAllTextContent('.menu-item, .dish, .food-item'),
            prices: getAllTextContent('.price, .pris'),
            hours: getAllTextContent('.hours, .öppettider, .opening-hours'),
            contact: getAllTextContent('.contact, .kontakt'),
            links: Array.from(document.querySelectorAll('a[href]')).map(a => ({
              text: a.textContent.trim(),
              href: a.href
            })).filter(link => link.text && link.href)
          };
        });

        const html = await page.content();

        this.crawledData.push({
          url,
          html,
          structuredData: pageData,
          crawledAt: new Date().toISOString(),
          method: 'playwright'
        });

        // Delay mellan requests
        if (config.crawlDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, config.crawlDelayMs));
        }

      } catch (error) {
        console.log(`❌ Playwright-fel för ${url}:`, error.message);
        this.crawledData.push({
          url,
          error: error.message,
          crawledAt: new Date().toISOString(),
          method: 'playwright'
        });
      }
    }

    await browser.close();

    // Spara data
    const filename = config.rawPagesFile.replace('.json', '_playwright.json');
    await fs.writeFile(
      filename,
      JSON.stringify(this.crawledData, null, 2),
      'utf-8'
    );

    console.log(`✅ Playwright crawling klar! ${this.crawledData.length} sidor sparade i ${filename}`);
    return this.crawledData;
  }
}