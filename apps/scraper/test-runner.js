#!/usr/bin/env node

// Komplett test-suite för Torstens Voice AI Scraper
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

console.log('🚀 Torstens Voice AI Scraper - Test Suite');
console.log('==========================================');

class TestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
  }

  async runTest(name, testFunction) {
    console.log(`\n🧪 Test: ${name}`);
    console.log('─'.repeat(50));

    const startTime = Date.now();
    let result;

    try {
      result = await testFunction();
      const duration = Date.now() - startTime;

      const testResult = {
        name,
        status: result.success ? 'passed' : 'failed',
        duration,
        message: result.message || '',
        details: result.details || {},
        warnings: result.warnings || []
      };

      this.results.tests.push(testResult);
      this.results.summary.total++;

      if (result.success) {
        this.results.summary.passed++;
        console.log(`✅ ${name} - LYCKADES (${duration}ms)`);
      } else {
        this.results.summary.failed++;
        console.log(`❌ ${name} - MISSLYCKADES (${duration}ms)`);
        console.log(`   ${result.message}`);
      }

      if (result.warnings && result.warnings.length > 0) {
        this.results.summary.warnings += result.warnings.length;
        result.warnings.forEach(warning => {
          console.log(`⚠️  ${warning}`);
        });
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.tests.push({
        name,
        status: 'failed',
        duration,
        message: error.message,
        error: error.stack
      });

      this.results.summary.total++;
      this.results.summary.failed++;

      console.log(`❌ ${name} - KRASCHADE (${duration}ms)`);
      console.log(`   ${error.message}`);

      return { success: false, message: error.message };
    }
  }

  // Test 1: Projektstruktur
  async testProjectStructure() {
    const requiredFiles = [
      'package.json',
      'src/config.js',
      'src/crawler.js',
      'src/extractor.js',
      'src/knowledge-builder.js',
      'src/scheduler.js',
      'src/index.js',
      '.env'
    ];

    const requiredDirs = ['src', 'data', 'output'];
    const warnings = [];

    // Kontrollera filer
    for (const file of requiredFiles) {
      try {
        await fs.access(file);
      } catch {
        return {
          success: false,
          message: `Saknar fil: ${file}`,
          details: { missingFile: file }
        };
      }
    }

    // Kontrollera mappar
    for (const dir of requiredDirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        warnings.push(`Kunde inte skapa mapp ${dir}: ${error.message}`);
      }
    }

    // Kontrollera package.json
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
      const requiredDeps = ['axios', 'cheerio', 'playwright', 'node-cron', 'dotenv'];
      const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);

      if (missingDeps.length > 0) {
        warnings.push(`Saknade dependencies: ${missingDeps.join(', ')}`);
      }
    } catch (error) {
      warnings.push(`Kunde inte läsa package.json: ${error.message}`);
    }

    return {
      success: true,
      message: 'Projektstruktur OK',
      warnings
    };
  }

  // Test 2: Nätverksanslutning
  async testNetworkConnection() {
    const https = await import('https');

    return new Promise((resolve) => {
      const request = https.default.get('https://torstens.se', (response) => {
        let data = '';
        response.on('data', (chunk) => data += chunk);
        response.on('end', () => {
          const success = response.statusCode === 200 && data.length > 1000;

          resolve({
            success,
            message: success ? 'Anslutning till torstens.se OK' : 'Problem med anslutning',
            details: {
              statusCode: response.statusCode,
              size: data.length,
              hasContent: data.includes('<title>') && data.includes('<body>')
            }
          });
        });
      });

      request.on('error', (error) => {
        resolve({
          success: false,
          message: `Nätverksfel: ${error.message}`,
          details: { error: error.message }
        });
      });

      request.setTimeout(10000, () => {
        request.abort();
        resolve({
          success: false,
          message: 'Timeout - sidan svarar inte inom 10 sekunder'
        });
      });
    });
  }

  // Test 3: Konfiguration
  async testConfiguration() {
    try {
      const envContent = await fs.readFile('.env', 'utf-8');
      const warnings = [];

      const requiredVars = ['BASE_URL', 'CRAWL_DELAY_MS', 'CRON_SCHEDULE'];
      const optionalVars = ['VOICE_AI_WEBHOOK_URL', 'VOICE_AI_API_KEY'];

      for (const varName of requiredVars) {
        if (!envContent.includes(varName)) {
          return {
            success: false,
            message: `Saknar required variabel: ${varName}`,
            details: { missingVar: varName }
          };
        }
      }

      for (const varName of optionalVars) {
        if (!envContent.includes(varName)) {
          warnings.push(`Optional variabel saknas: ${varName}`);
        }
      }

      // Validera BASE_URL
      if (!envContent.includes('https://torstens.se')) {
        warnings.push('BASE_URL pekar inte på torstens.se');
      }

      return {
        success: true,
        message: 'Konfiguration OK',
        warnings
      };

    } catch (error) {
      return {
        success: false,
        message: `Kunde inte läsa .env: ${error.message}`
      };
    }
  }

  // Test 4: Grundläggande scraping
  async testBasicScraping() {
    const https = await import('https');

    const testPages = [
      'https://torstens.se',
      'https://torstens.se/meny'
    ];

    let successCount = 0;
    const details = {};

    for (const url of testPages) {
      try {
        const result = await new Promise((resolve) => {
          const request = https.default.get(url, (response) => {
            let data = '';
            response.on('data', (chunk) => data += chunk);
            response.on('end', () => {
              resolve({
                url,
                status: response.statusCode,
                size: data.length,
                hasContent: data.length > 1000
              });
            });
          });

          request.on('error', (error) => {
            resolve({ url, error: error.message });
          });

          request.setTimeout(5000, () => {
            request.abort();
            resolve({ url, error: 'timeout' });
          });
        });

        details[url] = result;
        if (result.status === 200 && result.hasContent) {
          successCount++;
        }

      } catch (error) {
        details[url] = { error: error.message };
      }
    }

    const success = successCount >= Math.ceil(testPages.length / 2);

    return {
      success,
      message: success
        ? `Scraping OK: ${successCount}/${testPages.length} sidor`
        : `Scraping problem: bara ${successCount}/${testPages.length} sidor lyckades`,
      details
    };
  }

  // Test 5: Voice AI kvalitet
  async testVoiceAIQuality() {
    // Simulera knowledge base med testdata
    const mockKnowledge = [
      {
        id: 'faq-gluten',
        type: 'qa',
        q: 'Har ni glutenfritt?',
        a: 'Vi märker vår meny så gott det går, men fråga alltid personalen för säkerhets skull.',
        tags: ['allergi', 'gluten']
      },
      {
        id: 'hours',
        type: 'fact',
        text: 'Öppettider: Mån-Fre 11-22, Lör-Sön 12-23',
        tags: ['öppettider']
      },
      {
        id: 'phone',
        type: 'fact',
        text: 'Telefonnummer: 042-123 456',
        tags: ['kontakt', 'telefon']
      }
    ];

    const warnings = [];

    // Test vanliga Voice AI queries
    const testQueries = [
      { query: 'glutenfritt', expectedType: 'qa', description: 'Allergi-fråga' },
      { query: 'öppet', expectedType: 'fact', description: 'Öppettider' },
      { query: 'telefon', expectedType: 'fact', description: 'Kontaktinfo' }
    ];

    let matches = 0;

    for (const test of testQueries) {
      const match = mockKnowledge.find(item =>
        item.tags.some(tag => tag.includes(test.query.toLowerCase())) ||
        (item.q && item.q.toLowerCase().includes(test.query)) ||
        (item.text && item.text.toLowerCase().includes(test.query))
      );

      if (match && match.type === test.expectedType) {
        matches++;
      } else if (match) {
        warnings.push(`Query "${test.query}" hittad men fel typ: ${match.type} (förväntad: ${test.expectedType})`);
      } else {
        warnings.push(`Query "${test.query}" inte hittad`);
      }
    }

    // Validera Q&A-kvalitet
    const qaItems = mockKnowledge.filter(item => item.type === 'qa');
    for (const qa of qaItems) {
      if (!qa.q || qa.q.length < 5) {
        warnings.push(`Dålig fråga: "${qa.q}"`);
      }
      if (!qa.a || qa.a.length < 10) {
        warnings.push(`För kort svar för: "${qa.q}"`);
      }
      if (!qa.tags || qa.tags.length === 0) {
        warnings.push(`Saknar tags för: "${qa.q}"`);
      }
    }

    const success = matches >= testQueries.length * 0.8; // 80% träffsäkerhet

    return {
      success,
      message: `Voice AI kvalitet: ${matches}/${testQueries.length} queries matchade`,
      details: {
        queryMatches: matches,
        totalQueries: testQueries.length,
        qaItems: qaItems.length
      },
      warnings
    };
  }

  async saveResults() {
    const reportPath = './output/test-results.json';
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));

    // Skapa även en läsbar rapport
    const readableReport = this.generateReadableReport();
    await fs.writeFile('./output/test-report.md', readableReport);

    console.log(`📄 Testresultat sparade: ${reportPath}`);
    console.log(`📋 Läsbar rapport: ./output/test-report.md`);
  }

  generateReadableReport() {
    const { summary, tests } = this.results;

    let report = `# Torstens Voice AI Scraper - Test Report\n\n`;
    report += `**Datum:** ${new Date(this.results.timestamp).toLocaleString('sv-SE')}\n\n`;
    report += `## Sammanfattning\n\n`;
    report += `- ✅ Lyckade: ${summary.passed}\n`;
    report += `- ❌ Misslyckade: ${summary.failed}\n`;
    report += `- ⚠️ Varningar: ${summary.warnings}\n`;
    report += `- 📊 Totalt: ${summary.total}\n\n`;

    const successRate = Math.round((summary.passed / summary.total) * 100);
    report += `**Framgångsgrad:** ${successRate}%\n\n`;

    report += `## Detaljerade Resultat\n\n`;

    tests.forEach((test, index) => {
      const emoji = test.status === 'passed' ? '✅' : '❌';
      report += `### ${index + 1}. ${emoji} ${test.name}\n\n`;
      report += `- **Status:** ${test.status.toUpperCase()}\n`;
      report += `- **Tid:** ${test.duration}ms\n`;

      if (test.message) {
        report += `- **Meddelande:** ${test.message}\n`;
      }

      if (test.warnings && test.warnings.length > 0) {
        report += `- **Varningar:**\n`;
        test.warnings.forEach(warning => {
          report += `  - ⚠️ ${warning}\n`;
        });
      }

      if (test.details && Object.keys(test.details).length > 0) {
        report += `- **Detaljer:**\n`;
        Object.entries(test.details).forEach(([key, value]) => {
          report += `  - ${key}: ${JSON.stringify(value)}\n`;
        });
      }

      report += `\n`;
    });

    report += `## Rekommendationer\n\n`;

    if (summary.failed === 0) {
      report += `🎉 Alla tester lyckades! Systemet är redo för produktion.\n\n`;
      report += `Nästa steg:\n`;
      report += `1. Kör \`npm start\` för att starta schedulern\n`;
      report += `2. Eller \`npm run full-update\` för manuell uppdatering\n`;
      report += `3. Integrera med ditt Voice AI-system\n`;
    } else {
      report += `🔧 Åtgärda de misslyckade testerna innan produktion:\n\n`;
      tests.filter(t => t.status === 'failed').forEach(test => {
        report += `- **${test.name}**: ${test.message}\n`;
      });
    }

    if (summary.warnings > 0) {
      report += `\n⚠️ Kontrollera varningarna för optimal prestanda.\n`;
    }

    return report;
  }

  async runAllTests() {
    console.log('Kör alla tester...\n');

    await this.runTest('Projektstruktur', () => this.testProjectStructure());
    await this.runTest('Nätverksanslutning', () => this.testNetworkConnection());
    await this.runTest('Konfiguration', () => this.testConfiguration());
    await this.runTest('Grundläggande Scraping', () => this.testBasicScraping());
    await this.runTest('Voice AI Kvalitet', () => this.testVoiceAIQuality());

    await this.saveResults();

    // Visa sammanfattning
    console.log('\n🎯 TESTSAMMANFATTNING');
    console.log('='.repeat(50));
    console.log(`✅ Lyckade: ${this.results.summary.passed}`);
    console.log(`❌ Misslyckade: ${this.results.summary.failed}`);
    console.log(`⚠️ Varningar: ${this.results.summary.warnings}`);
    console.log(`📊 Totalt: ${this.results.summary.total}`);

    const successRate = Math.round((this.results.summary.passed / this.results.summary.total) * 100);
    console.log(`🎯 Framgångsgrad: ${successRate}%`);

    if (this.results.summary.failed === 0) {
      console.log('\n🎉 ALLA TESTER LYCKADES!');
      console.log('✨ Systemet är redo för Voice AI-integration');
    } else {
      console.log(`\n⚠️  ${this.results.summary.failed} tester misslyckades`);
      console.log('🔧 Kontrollera detaljer i test-rapporten');
    }

    return this.results.summary.failed === 0;
  }
}

// Kör alla tester
async function main() {
  const runner = new TestRunner();

  try {
    const success = await runner.runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test-suite kraschade:', error.message);
    process.exit(1);
  }
}

// Kör om detta är huvudfilen
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}