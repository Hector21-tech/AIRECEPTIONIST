import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { config } from './config.js';
import fs from 'fs/promises';
import path from 'path';
import { RetryUtility } from './utils/retry.js';
import { Logger } from './utils/logger.js';
import { WorkerPool } from './utils/worker-pool.js';

export class TorstensCrawler {
  constructor() {
    this.axios = axios.create({
      headers: {
        'User-Agent': config.userAgent
      },
      timeout: config.requestTimeoutMs
    });
    this.urls = new Set();
    this.crawledData = [];
    this.retry = new RetryUtility({
      maxRetries: config.maxRetries,
      baseDelay: config.retryDelayMs
    });
    this.logger = new Logger('Crawler');
    this.workerPool = new WorkerPool(config.maxConcurrentRequests);
  }

  async ensureDirectories() {
    await fs.mkdir(config.dataDir, { recursive: true });
    await fs.mkdir(config.outputDir, { recursive: true });
  }

  async fetchSitemapUrls() {
    this.logger.info('Fetching URLs from sitemap');

    for (const sitemapPath of config.sitemapPaths) {
      try {
        const url = new URL(sitemapPath, config.baseUrl).toString();

        const response = await this.retry.execute(async () => {
          return await this.axios.get(url, {
            timeout: config.sitemapTimeoutMs
          });
        }, `Sitemap fetch: ${sitemapPath}`);

        const parser = new XMLParser();
        const result = parser.parse(response.data);

        // Hantera sitemap index
        if (result.sitemapindex && result.sitemapindex.sitemap) {
          const sitemaps = Array.isArray(result.sitemapindex.sitemap)
            ? result.sitemapindex.sitemap
            : [result.sitemapindex.sitemap];

          for (const sitemap of sitemaps) {
            if (sitemap.loc) {
              await this.fetchSitemapUrls([sitemap.loc]);
            }
          }
        }

        // Hantera vanlig sitemap
        if (result.urlset && result.urlset.url) {
          const urls = Array.isArray(result.urlset.url)
            ? result.urlset.url
            : [result.urlset.url];

          urls.forEach(urlEntry => {
            if (urlEntry.loc && urlEntry.loc.startsWith(config.baseUrl)) {
              this.urls.add(urlEntry.loc);
            }
          });
        }

        this.logger.info(`Found ${this.urls.size} URLs from sitemap`, {
          sitemapPath,
          totalUrls: this.urls.size
        });

      } catch (error) {
        this.logger.warn(`Could not fetch sitemap`, {
          sitemapPath,
          error: error.message
        });
      }
    }

    // Fallback - lägg till grundläggande sidor om sitemap inte fungerar
    if (this.urls.size === 0) {
      this.logger.warn('No URLs found in sitemaps, using fallback URLs');
      const fallbackUrls = [
        config.baseUrl,
        `${config.baseUrl}/meny`,
        `${config.baseUrl}/kontakt`,
        `${config.baseUrl}/om-oss`,
        `${config.baseUrl}/boka-bord`,
        `${config.baseUrl}/angelholm`,
        `${config.baseUrl}/vala`
      ];

      fallbackUrls.forEach(url => this.urls.add(url));
      this.logger.info(`Added ${fallbackUrls.length} fallback URLs`);
    }

    return Array.from(this.urls);
  }

  async crawlPage(url) {
    const startTime = Date.now();
    this.logger.crawlStart(url);

    try {
      const response = await this.retry.execute(async (attempt) => {
        if (attempt > 1) {
          this.logger.crawlRetry(url, attempt - 1, config.maxRetries, new Error('Retrying'));
        }
        return await this.axios.get(url);
      }, `Page crawl: ${url}`);

      const duration = Date.now() - startTime;
      const size = response.data.length;

      this.logger.crawlSuccess(url, size, duration);

      return {
        url,
        status: response.status,
        html: response.data,
        crawledAt: new Date().toISOString(),
        contentType: response.headers['content-type'] || '',
        size,
        duration
      };

    } catch (error) {
      this.logger.crawlFailed(url, error);
      return {
        url,
        error: error.message,
        crawledAt: new Date().toISOString(),
        failed: true
      };
    }
  }

  async crawlAll(useConcurrency = true) {
    await this.ensureDirectories();

    const urls = await this.fetchSitemapUrls();
    this.logger.info(`Starting crawl of ${urls.length} pages`, {
      concurrent: useConcurrency,
      concurrency: useConcurrency ? config.maxConcurrentRequests : 1
    });

    const startTime = Date.now();
    this.crawledData = [];

    if (useConcurrency && config.maxConcurrentRequests > 1) {
      await this.crawlConcurrently(urls);
    } else {
      await this.crawlSequentially(urls);
    }

    const totalTime = Date.now() - startTime;
    const successCount = this.crawledData.filter(p => !p.failed).length;
    const errorCount = this.crawledData.filter(p => p.failed).length;

    // Spara rådata
    await fs.writeFile(
      config.rawPagesFile,
      JSON.stringify(this.crawledData, null, 2),
      'utf-8'
    );

    this.logger.info('Crawling completed', {
      totalPages: this.crawledData.length,
      successCount,
      errorCount,
      duration: `${Math.round(totalTime / 1000)}s`,
      outputFile: config.rawPagesFile
    });

    return this.crawledData;
  }

  async crawlConcurrently(urls) {
    let completedCount = 0;

    const tasks = urls.map(url => async () => {
      // Add delay between concurrent requests to avoid overwhelming server
      if (config.crawlDelayMs > 0 && completedCount > 0) {
        await new Promise(resolve => setTimeout(resolve, config.crawlDelayMs));
      }

      return await this.crawlPage(url);
    });

    const result = await this.workerPool.executeAll(tasks, (completed, total, error) => {
      completedCount = completed;
      if (completed % 5 === 0 || completed === total) {
        this.logger.info(`Crawling progress: ${completed}/${total} pages`, {
          progress: `${Math.round((completed / total) * 100)}%`,
          errors: error ? 1 : 0
        });
      }
    });

    this.crawledData = result.results;

    this.logger.info(`Concurrent crawling stats`, {
      successCount: result.successCount,
      errorCount: result.errorCount,
      totalTasks: result.totalTasks
    });
  }

  async crawlSequentially(urls) {
    let successCount = 0;
    let errorCount = 0;

    for (const url of urls) {
      const pageData = await this.crawlPage(url);
      this.crawledData.push(pageData);

      if (pageData.failed) {
        errorCount++;
      } else {
        successCount++;
      }

      // Progress logging
      if ((successCount + errorCount) % 5 === 0) {
        this.logger.info(`Sequential crawling progress: ${successCount + errorCount}/${urls.length} pages`);
      }

      // Delay mellan requests
      if (config.crawlDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, config.crawlDelayMs));
      }
    }
  }

  async getCrawledData() {
    try {
      const data = await fs.readFile(config.rawPagesFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      this.logger.warn('No crawled data found, run crawl first', {
        expectedFile: config.rawPagesFile
      });
      return [];
    }
  }
}