/**
 * Health check and monitoring utility
 */

import fs from 'fs/promises';
import { config } from '../config.js';
import { Logger } from './logger.js';
import axios from 'axios';

export class HealthChecker {
  constructor() {
    this.logger = new Logger('HealthChecker');
    this.metrics = {
      lastCrawl: null,
      crawlSuccess: 0,
      crawlErrors: 0,
      knowledgeBaseEntries: 0,
      systemStatus: 'unknown'
    };
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    this.logger.info('Starting health check');

    const results = {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      checks: {}
    };

    try {
      // Check file system
      results.checks.filesystem = await this.checkFileSystem();

      // Check network connectivity
      results.checks.network = await this.checkNetworkConnectivity();

      // Check data quality
      results.checks.dataQuality = await this.checkDataQuality();

      // Check last crawl
      results.checks.lastCrawl = await this.checkLastCrawl();

      // Determine overall health
      const hasErrors = Object.values(results.checks).some(check => check.status === 'error');
      const hasWarnings = Object.values(results.checks).some(check => check.status === 'warning');

      if (hasErrors) {
        results.overall = 'unhealthy';
      } else if (hasWarnings) {
        results.overall = 'degraded';
      }

      this.logger.info('Health check completed', {
        overall: results.overall,
        checks: Object.keys(results.checks).length
      });

    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });
      results.overall = 'unhealthy';
      results.error = error.message;
    }

    return results;
  }

  /**
   * Check file system health
   */
  async checkFileSystem() {
    try {
      // Check if directories exist
      await fs.access(config.dataDir);
      await fs.access(config.outputDir);

      // Check write permissions
      const testFile = `${config.dataDir}/health_test_${Date.now()}.tmp`;
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);

      return {
        status: 'healthy',
        message: 'File system is accessible',
        details: {
          dataDir: config.dataDir,
          outputDir: config.outputDir
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'File system check failed',
        error: error.message
      };
    }
  }

  /**
   * Check network connectivity
   */
  async checkNetworkConnectivity() {
    try {
      const response = await axios.head(config.baseUrl, {
        timeout: 10000
      });

      const responseTime = response.config.metadata?.endTime - response.config.metadata?.startTime;

      return {
        status: 'healthy',
        message: 'Network connectivity is good',
        details: {
          targetUrl: config.baseUrl,
          statusCode: response.status,
          responseTime: responseTime || 'unknown'
        }
      };
    } catch (error) {
      const isTemporary = error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT';

      return {
        status: isTemporary ? 'warning' : 'error',
        message: 'Network connectivity issues',
        error: error.message,
        details: {
          targetUrl: config.baseUrl,
          errorCode: error.code
        }
      };
    }
  }

  /**
   * Check data quality
   */
  async checkDataQuality() {
    try {
      // Check knowledge base
      const knowledgeStats = await this.checkKnowledgeBase();

      // Check raw data
      const rawDataStats = await this.checkRawData();

      const issues = [];

      if (knowledgeStats.entries < 10) {
        issues.push('Knowledge base has very few entries');
      }

      if (rawDataStats.pages < 2) {
        issues.push('Raw data contains very few pages');
      }

      return {
        status: issues.length > 0 ? 'warning' : 'healthy',
        message: issues.length > 0 ? `Data quality issues: ${issues.join(', ')}` : 'Data quality is good',
        details: {
          knowledgeBase: knowledgeStats,
          rawData: rawDataStats
        }
      };
    } catch (error) {
      return {
        status: 'warning',
        message: 'Could not check data quality',
        error: error.message
      };
    }
  }

  /**
   * Check last crawl status
   */
  async checkLastCrawl() {
    try {
      const rawDataPath = config.rawPagesFile;
      const stats = await fs.stat(rawDataPath);
      const lastModified = stats.mtime;
      const hoursOld = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60);

      let status = 'healthy';
      let message = 'Recent crawl data available';

      if (hoursOld > 48) {
        status = 'warning';
        message = 'Crawl data is getting old';
      } else if (hoursOld > 72) {
        status = 'error';
        message = 'Crawl data is very old';
      }

      return {
        status,
        message,
        details: {
          lastCrawl: lastModified.toISOString(),
          hoursOld: Math.round(hoursOld * 10) / 10
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'No crawl data found',
        error: error.message
      };
    }
  }

  /**
   * Check knowledge base statistics
   */
  async checkKnowledgeBase() {
    try {
      const data = await fs.readFile(config.knowledgeBasePath, 'utf-8');
      const lines = data.split('\n').filter(line => line.trim());

      const entries = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);

      const types = entries.reduce((acc, entry) => {
        acc[entry.type] = (acc[entry.type] || 0) + 1;
        return acc;
      }, {});

      return {
        entries: entries.length,
        types,
        qaCount: types.qa || 0,
        factCount: types.fact || 0
      };
    } catch (error) {
      return {
        entries: 0,
        error: error.message
      };
    }
  }

  /**
   * Check raw data statistics
   */
  async checkRawData() {
    try {
      const data = await fs.readFile(config.rawPagesFile, 'utf-8');
      const pages = JSON.parse(data);

      const successPages = pages.filter(page => !page.failed);
      const errorPages = pages.filter(page => page.failed);

      return {
        pages: pages.length,
        successPages: successPages.length,
        errorPages: errorPages.length,
        successRate: pages.length > 0 ? Math.round((successPages.length / pages.length) * 100) : 0
      };
    } catch (error) {
      return {
        pages: 0,
        error: error.message
      };
    }
  }

  /**
   * Get system metrics
   */
  async getMetrics() {
    try {
      const healthCheck = await this.performHealthCheck();

      return {
        timestamp: new Date().toISOString(),
        system: {
          status: healthCheck.overall,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version
        },
        data: {
          knowledgeBase: healthCheck.checks.dataQuality?.details?.knowledgeBase || {},
          rawData: healthCheck.checks.dataQuality?.details?.rawData || {},
          lastCrawl: healthCheck.checks.lastCrawl?.details || {}
        },
        network: healthCheck.checks.network?.details || {},
        config: {
          baseUrl: config.baseUrl,
          maxRetries: config.maxRetries,
          concurrency: config.maxConcurrentRequests
        }
      };
    } catch (error) {
      this.logger.error('Failed to get metrics', { error: error.message });
      return {
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Save health check results
   */
  async saveHealthCheck(results) {
    try {
      const healthCheckFile = `${config.outputDir}/health_check.json`;
      await fs.writeFile(healthCheckFile, JSON.stringify(results, null, 2));

      this.logger.debug('Health check results saved', {
        file: healthCheckFile,
        status: results.overall
      });
    } catch (error) {
      this.logger.warn('Could not save health check results', {
        error: error.message
      });
    }
  }
}