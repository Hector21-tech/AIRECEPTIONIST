#!/usr/bin/env node

// One-Click Web Scraper för Torstens Voice AI
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import https from 'https';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Förkonfigurerade URLs
const presetUrls = {
  'angelholm': {
    name: 'Torstens Ängelholm',
    urls: [
      'https://torstens.se/angelholm/',
      'https://torstens.se/angelholm/boka-bord/'
    ]
  },
  'vala': {
    name: 'Torstens Väla',
    urls: [
      'https://torstens.se/vala/',
      'https://torstens.se/vala/boka-bord/'
    ]
  },
  'bastad': {
    name: 'Torstens Båstad',
    urls: [
      'https://torstens.se/bastad/',
      'https://torstens.se/bastad/boka-bord/'
    ]
  },
  'custom': {
    name: 'Anpassad URL',
    urls: []
  }
};

class WebScraper {
  constructor(socketId) {
    this.socketId = socketId;
    this.results = {
      crawled: [],
      extracted: [],
      knowledge: []
    };
  }

  emit(event, data) {
    io.to(this.socketId).emit(event, data);
  }

  async crawlPage(url) {
    this.emit('progress', { message: `📄 Crawlar: ${url}`, status: 'crawling' });

    return new Promise((resolve) => {
      const request = https.get(url, {
        headers: { 'User-Agent': 'TorstensScraper-Web/1.0' },
        timeout: 15000
      }, (response) => {

        if (response.statusCode === 301 || response.statusCode === 302) {
          this.emit('progress', { message: `↪️ Redirect: ${response.headers.location}` });
          return this.crawlPage(response.headers.location).then(resolve);
        }

        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          resolve({
            url,
            status: response.statusCode,
            html: response.statusCode === 200 ? data : null,
            size: data.length,
            crawledAt: new Date().toISOString(),
            error: response.statusCode !== 200 ? `HTTP ${response.statusCode}` : null
          });
        });
      });

      request.on('error', (error) => {
        this.emit('progress', { message: `❌ Network error: ${error.message}`, status: 'error' });
        resolve({
          url,
          error: error.message,
          crawledAt: new Date().toISOString()
        });
      });

      request.on('timeout', () => {
        this.emit('progress', { message: `⏰ Timeout för ${url}`, status: 'warning' });
        request.abort();
        resolve({
          url,
          error: 'timeout',
          crawledAt: new Date().toISOString()
        });
      });
    });
  }

  async extractContent(html, url) {
    const $ = cheerio.load(html);

    const extracted = {
      url,
      title: $('title').text().trim(),
      h1: $('h1').first().text().trim(),
      mainText: $('main').text() || $('body').text() || '',

      // Kontaktinfo
      contact: this.extractContact(html, $),

      // Öppettider
      hours: this.extractHours(html),

      // Menyobjekt
      menu: this.extractMenu($),

      // Metadata
      wordCount: ($('main').text() || $('body').text() || '').split(/\s+/).length,
      extractedAt: new Date().toISOString()
    };

    return extracted;
  }

  extractContact(html, $) {
    const contact = {};

    // Telefonnummer
    const phoneMatches = html.match(/(?:tel|telefon|phone)[:\s]*([0-9\s\-\+\(\)]{8,})/gi);
    if (phoneMatches) {
      contact.phones = phoneMatches.map(m =>
        m.replace(/.*?([0-9\s\-\+\(\)]{8,})/, '$1').trim()
      ).filter((p, i, arr) => arr.indexOf(p) === i).slice(0, 2);
    }

    // Email
    const emailMatches = html.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
    if (emailMatches) {
      contact.emails = [...new Set(emailMatches)].slice(0, 2);
    }

    // Adress
    const addressMatches = html.match(/([A-ZÅÄÖ][a-zåäö\s]+\s+\d+[a-zA-Z]?,?\s*\d{3}\s*\d{2}\s+[A-ZÅÄÖ][a-zåäö]+)/g);
    if (addressMatches) {
      contact.addresses = [...new Set(addressMatches)].slice(0, 2);
    }

    return contact;
  }

  extractHours(html) {
    const hourPatterns = [
      /måndag[:\s]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi,
      /tisdag[:\s]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi,
      /onsdag[:\s]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi,
      /torsdag[:\s]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi,
      /fredag[:\s]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi,
      /lördag[:\s]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi,
      /söndag[:\s]*(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/gi
    ];

    const hours = {};
    const englishDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    hourPatterns.forEach((pattern, index) => {
      const matches = html.match(pattern);
      if (matches && matches[0]) {
        const timeMatch = matches[0].match(/(\d{1,2}[\.:]\d{2}[\s\-]+\d{1,2}[\.:]\d{2})/);
        if (timeMatch) {
          hours[englishDays[index]] = timeMatch[1].replace(/[\s\-]+/, '-').replace(/\./g, ':');
        }
      }
    });

    return hours;
  }

  extractMenu($) {
    const menu = [];

    $('[class*="menu"], [class*="meny"], .dish, .food-item, .menu-item').each((i, el) => {
      const $el = $(el);

      const title = $el.find('h3, h4, .title, .name, strong').first().text().trim() ||
                   $el.find('p').first().text().trim().split('\n')[0];

      const description = $el.find('p, .description, .desc').not(':first').first().text().trim();
      const priceMatch = $el.text().match(/(\d+)\s*(?:kr|:-|SEK)/i);
      const price = priceMatch ? parseInt(priceMatch[1]) : null;

      if (title && title.length > 2 && title.length < 100) {
        menu.push({
          title: title,
          description: description || '',
          price: price
        });
      }
    });

    // Ta bort dubbletter
    return menu.filter((item, index, arr) =>
      arr.findIndex(other => other.title === item.title) === index
    );
  }

  generateKnowledgeBase(extractedData, location = 'Okänd') {
    const knowledge = [];

    // Standard FAQ:s
    const standardFaqs = [
      {
        id: 'faq-gluten',
        type: 'qa',
        q: 'Har ni glutenfritt?',
        a: 'Vi märker vår meny så gott det går, men fråga alltid personalen för säkerhets skull. Flera rätter kan anpassas till glutenfritt.',
        tags: ['allergi', 'gluten', 'mat']
      },
      {
        id: 'faq-vegetarian',
        type: 'qa',
        q: 'Har ni vegetariska alternativ?',
        a: 'Ja, vi har alltid vegetariska och ofta även veganska alternativ på menyn. Fråga gärna personalen för dagens utbud.',
        tags: ['vegetariskt', 'veganskt', 'mat']
      },
      {
        id: 'faq-payment',
        type: 'qa',
        q: 'Vilka betalningsmetoder tar ni emot?',
        a: 'Vi tar emot kontanter, kort och Swish. Alla vanliga betalmetoder fungerar bra.',
        tags: ['betalning', 'swish', 'kort']
      }
    ];

    knowledge.push(...standardFaqs);

    // Lägg till grundinfo
    if (extractedData.length > 0) {
      const mainPage = extractedData[0];
      knowledge.push({
        id: 'basic-info',
        type: 'fact',
        text: `Torstens ${location} - ${mainPage.title}`,
        tags: ['grundinfo', 'restaurang']
      });

      // Kontaktinfo
      if (mainPage.contact.phones && mainPage.contact.phones.length > 0) {
        knowledge.push({
          id: 'phone',
          type: 'fact',
          text: `Telefonnummer: ${mainPage.contact.phones[0]}`,
          tags: ['kontakt', 'telefon']
        });
      }

      if (mainPage.contact.addresses && mainPage.contact.addresses.length > 0) {
        knowledge.push({
          id: 'address',
          type: 'fact',
          text: `Adress: ${mainPage.contact.addresses[0]}`,
          tags: ['kontakt', 'adress', 'plats']
        });
      }

      // Öppettider
      if (Object.keys(mainPage.hours).length > 0) {
        const hoursText = Object.entries(mainPage.hours)
          .map(([day, hours]) => {
            const dayNames = {
              mon: 'Måndag', tue: 'Tisdag', wed: 'Onsdag',
              thu: 'Torsdag', fri: 'Fredag', sat: 'Lördag', sun: 'Söndag'
            };
            return `${dayNames[day]}: ${hours}`;
          })
          .join(', ');

        knowledge.push({
          id: 'hours',
          type: 'fact',
          text: `Öppettider: ${hoursText}`,
          tags: ['öppettider', 'tider']
        });
      }

      // Menyinfo
      if (mainPage.menu && mainPage.menu.length > 0) {
        const menuText = mainPage.menu.slice(0, 5).map(item => {
          let desc = item.title;
          if (item.price) desc += ` (${item.price} kr)`;
          return desc;
        }).join(', ');

        knowledge.push({
          id: 'menu',
          type: 'menu',
          text: `Från vår meny: ${menuText}`,
          tags: ['meny', 'mat', 'rätter']
        });
      }
    }

    return knowledge;
  }

  async scrapeUrl(urls, location = 'Okänd') {
    this.emit('progress', { message: '🚀 Startar scraping...', status: 'starting' });

    // Crawl URLs
    for (const url of urls) {
      const result = await this.crawlPage(url);
      this.results.crawled.push(result);

      if (urls.indexOf(url) < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successful = this.results.crawled.filter(r => r.html);
    this.emit('progress', {
      message: `✅ Crawling klar: ${successful.length}/${urls.length} sidor`,
      status: 'crawled',
      stats: { total: urls.length, successful: successful.length }
    });

    // Extract content
    this.emit('progress', { message: '🔍 Extraherar innehåll...', status: 'extracting' });

    for (const page of successful) {
      const extracted = await this.extractContent(page.html, page.url);
      this.results.extracted.push(extracted);
    }

    // Generate knowledge base
    this.emit('progress', { message: '🧠 Skapar knowledge base...', status: 'generating' });

    this.results.knowledge = this.generateKnowledgeBase(this.results.extracted, location);

    this.emit('progress', {
      message: `🎉 Scraping slutfört! ${this.results.knowledge.length} kunskapsposter skapade`,
      status: 'completed',
      stats: {
        pages: this.results.extracted.length,
        knowledge: this.results.knowledge.length,
        contacts: this.results.extracted.filter(p => p.contact.phones?.length > 0).length,
        menus: this.results.extracted.filter(p => p.menu?.length > 0).length
      }
    });

    return this.results;
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.get('/api/presets', (req, res) => {
  res.json(presetUrls);
});

app.post('/api/scrape', async (req, res) => {
  const { urls, location } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs are required' });
  }

  // Validera URLs
  const validUrls = urls.filter(url => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });

  if (validUrls.length === 0) {
    return res.status(400).json({ error: 'No valid URLs provided' });
  }

  const sessionId = Date.now().toString();
  res.json({ sessionId, message: 'Scraping started' });

  // Kör scraping i bakgrunden
  const scraper = new WebScraper(sessionId);

  try {
    const results = await scraper.scrapeUrl(validUrls, location || 'Okänd');

    // Spara resultaten för nedladdning
    await fs.mkdir('./temp', { recursive: true });
    await fs.writeFile(`./temp/${sessionId}_knowledge.jsonl`,
      results.knowledge.map(item => JSON.stringify(item)).join('\n')
    );
    await fs.writeFile(`./temp/${sessionId}_data.json`,
      JSON.stringify(results, null, 2)
    );

  } catch (error) {
    io.to(sessionId).emit('progress', {
      message: `❌ Fel: ${error.message}`,
      status: 'error'
    });
  }
});

app.get('/api/download/:sessionId/:type', async (req, res) => {
  const { sessionId, type } = req.params;

  try {
    if (type === 'knowledge') {
      const filePath = `./temp/${sessionId}_knowledge.jsonl`;
      res.download(filePath, 'knowledge.jsonl');
    } else if (type === 'data') {
      const filePath = `./temp/${sessionId}_data.json`;
      res.download(filePath, 'scraped_data.json');
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Download failed' });
  }
});

// Socket.IO för real-time updates
io.on('connection', (socket) => {
  console.log('📱 Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('📱 Client disconnected:', socket.id);
  });
});

// Starta server
server.listen(PORT, () => {
  console.log('🍽️ Torstens One-Click Web Scraper');
  console.log('================================');
  console.log(`🌐 Server körs på: http://localhost:${PORT}`);
  console.log('🚀 Öppna webbläsaren och börja scrapa!');
  console.log('');
  console.log('📋 Funktioner:');
  console.log('  • One-click scraping');
  console.log('  • Real-time progress');
  console.log('  • Förkonfigurerade Torstens-URLs');
  console.log('  • Knowledge base download');
  console.log('');
});