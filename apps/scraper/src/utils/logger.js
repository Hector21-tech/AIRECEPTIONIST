/**
 * Enhanced logging utility
 */

export class Logger {
  constructor(context = 'TorstensScraper') {
    this.context = context;
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const emoji = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      debug: '🔍'
    }[level];

    let formatted = `${timestamp} ${emoji} [${this.context}] ${message}`;

    if (Object.keys(meta).length > 0) {
      formatted += ` ${JSON.stringify(meta)}`;
    }

    return formatted;
  }

  error(message, meta = {}) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  warn(message, meta = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  info(message, meta = {}) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, meta));
    }
  }

  debug(message, meta = {}) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, meta));
    }
  }

  // Special methods for common crawling scenarios
  crawlStart(url) {
    this.info(`Starting crawl`, { url });
  }

  crawlSuccess(url, size, duration) {
    this.info(`Crawl completed`, { url, size, duration });
  }

  crawlRetry(url, attempt, maxAttempts, error) {
    this.warn(`Crawl retry`, { url, attempt, maxAttempts, error: error.message });
  }

  crawlFailed(url, error) {
    this.error(`Crawl failed`, { url, error: error.message, stack: error.stack });
  }

  extractionStart(pages) {
    this.info(`Starting content extraction`, { pages });
  }

  extractionComplete(results) {
    this.info(`Content extraction complete`, results);
  }

  knowledgeBuilding(entries) {
    this.info(`Building knowledge base`, { entries });
  }

  knowledgeComplete(stats) {
    this.info(`Knowledge base complete`, stats);
  }
}