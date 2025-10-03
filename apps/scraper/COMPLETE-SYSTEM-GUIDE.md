# Complete Multi-Restaurant Scraping & ElevenLabs System

## 🎯 Systemöversikt

Ett komplett system för att scrapa restaurangwebbplatser, generera strukturerad data och automatiskt synka till ElevenLabs Voice AI.

### Workflow

```
1. SCRAPE      → Crawla hemsida (sitemap/Playwright)
2. EXTRACT     → Extrahera meny, öppettider, kontakt
3. NORMALIZE   → Smart normalisering + fallbacks
4. GENERATE    → Skapa knowledge.jsonl + voice-ai.txt
5. SYNC        → Automatisk push till ElevenLabs API
```

## 📁 Projektstruktur

```
torstens-voice-ai-scraper/
├── src/
│   ├── crawler.js              # Original crawler
│   ├── extractor.js            # Content extraktion
│   ├── knowledge-builder.js    # Original KB builder
│   ├── jsonl-to-txt.js         # JSONL → TXT konverterare
│   ├── elevenlabs-sync.js      # ElevenLabs API sync ⭐ NY
│   └── multi-restaurant/       # Multi-restaurant system ⭐ NY
│       ├── config.js           # Multi-restaurant config
│       ├── multi-scraper.js    # Orchestrator
│       ├── restaurant-normalizer.js # Smart normalisering
│       ├── info-generator.js   # info.json generator
│       └── knowledge-generator.js # Q&A generator
├── server/                     # API Server ⭐ NY
│   ├── index.js                # Express server
│   └── public/
│       └── index.html          # Admin dashboard
├── restaurants/                # Output (auto-genererad)
│   ├── index.json              # Global översikt
│   ├── torstens-angelholm/
│   │   ├── info.json           # Restaurang faktabas
│   │   ├── knowledge.jsonl     # Q&A (Single source of truth)
│   │   ├── voice-ai.txt        # För ElevenLabs
│   │   ├── report.txt          # Errors/fixes/assumptions
│   │   ├── raw_data.json       # Rådata från crawl
│   │   └── extracted_data.json # Extraherat innehåll
│   └── restaurant-x/
│       └── ...
└── config/
    └── restaurants.json        # Restaurang-konfiguration
```

## 🚀 Snabbstart

### 1. Installation

```bash
cd torstens-voice-ai-scraper
npm install
```

### 2. Konfiguration

```bash
# Skapa .env
cp .env.example .env
```

Redigera `.env`:
```env
# ElevenLabs API
ELEVENLABS_API_KEY=xi-your-api-key-here

# Server
PORT=3000

# Optional
CRAWL_DELAY_MS=500
MAX_CONCURRENT_REQUESTS=3
```

### 3. Initiera med exempel-restauranger

```bash
npm run multi:init
```

Detta skapar `config/restaurants.json` med Torstens exempel.

### 4. Kör komplett scrape (alla restauranger)

```bash
npm run multi:scrape-all
```

Detta kommer:
1. ✅ Crawla varje restaurang
2. ✅ Extrahera innehåll
3. ✅ Normalisera data
4. ✅ Generera knowledge.jsonl + voice-ai.txt
5. ✅ Synka automatiskt till ElevenLabs (om API-nyckel finns)

### 5. Starta Admin Server

```bash
npm run server
```

Öppna: `http://localhost:3000`

## 📝 Restaurang-konfiguration

### Lägga till en ny restaurang

Redigera `config/restaurants.json`:

```json
[
  {
    "slug": "restaurant-namn-stad",
    "name": "Restaurant Namn",
    "brand": "Varumärke",
    "city": "Stockholm",
    "baseUrl": "https://restaurang.se",
    "sitemapPaths": ["/sitemap.xml"],
    "specialConfig": {
      "menuKeywords": ["meny", "menu", "rätter"],
      "validation": {
        "requireMenu": true,
        "minMenuItems": 5
      }
    },
    "elevenlabs": {
      "apiKey": "xi-specific-api-key",  // Optional: per-restaurang
      "agentId": "agent-123"             // Optional
    }
  }
]
```

### Konfigurations-fält

| Fält | Beskrivning | Obligatorisk |
|------|-------------|--------------|
| `slug` | Unikt ID (lowercase, bindestreck) | ✅ |
| `name` | Restaurangnamn | ✅ |
| `brand` | Varumärke (för kedjor) | ❌ |
| `city` | Stad | ✅ |
| `baseUrl` | Hemsida URL | ✅ |
| `sitemapPaths` | Sitemap-sökvägar | ❌ (default: ['/sitemap.xml']) |
| `specialConfig` | Specialinställningar | ❌ |
| `elevenlabs` | ElevenLabs config | ❌ |

## 🔧 NPM Scripts

### Original (single-restaurant)
```bash
npm start              # Starta scheduler
npm run full-update    # Crawl + Extract + Knowledge
npm run crawl          # Endast crawl
npm run extract        # Endast extract
npm run knowledge      # Endast knowledge
```

### Multi-Restaurant
```bash
npm run multi:init          # Initiera med exempel
npm run multi:scrape-all    # Scrapa alla
npm run multi:list          # Lista restauranger
npm run multi:status        # Visa status
npm run multi:health        # Health check
npm run multi:clean         # Rensa all data
```

### Server
```bash
npm run server              # Starta API server
npm run server:dev          # Dev-läge med auto-reload
```

### ElevenLabs
```bash
npm run elevenlabs:sync     # Synka alla till ElevenLabs
npm run elevenlabs:list     # Lista dokument i ElevenLabs
```

## 🌐 API Endpoints

Server körs på `http://localhost:3000`

### Restauranger

**GET** `/api/restaurants`
- Lista alla restauranger

**GET** `/api/restaurants/:slug`
- Hämta restaurang info

**GET** `/api/restaurants/:slug/knowledge`
- Hämta knowledge base (JSONL)

**GET** `/api/restaurants/:slug/voice-ai`
- Hämta Voice AI text

**GET** `/api/restaurants/:slug/report`
- Hämta scrape-rapport

### Scraping

**POST** `/api/restaurants/:slug/scrape`
```json
{
  "syncToElevenLabs": true
}
```

**POST** `/api/scrape-all`
```json
{
  "syncToElevenLabs": true
}
```

### ElevenLabs Sync

**POST** `/api/restaurants/:slug/sync-elevenlabs`
- Synka en restaurang

**POST** `/api/sync-elevenlabs-all`
- Synka alla restauranger

### System

**GET** `/health`
- Health check

## 🤖 ElevenLabs Integration

### Automatisk Synkning

Efter scraping synkas automatiskt om:
1. `ELEVENLABS_API_KEY` finns i .env
2. `config.elevenlabs.apiKey` finns i restaurang-config
3. `syncToElevenLabs: true` i scrape-request

### Manuell Synkning

```bash
# Synka alla
npm run elevenlabs:sync

# Synka en specifik
node src/elevenlabs-sync.js sync ./restaurants/torstens-angelholm "Torstens" "Ängelholm"

# Lista dokument
npm run elevenlabs:list

# Radera dokument
node src/elevenlabs-sync.js delete <document-id>
```

### Workflow

1. **Sök** efter befintligt dokument (GET med search)
2. **Radera** om det finns (DELETE)
3. **Skapa** nytt från `voice-ai.txt` (POST text)

### API Authentication

ElevenLabs kräver `xi-api-key` header:

```javascript
headers: {
  'xi-api-key': 'xi-your-api-key'
}
```

## 📊 Data Format

### knowledge.jsonl (Single Source of Truth)

```jsonl
{"id":"faq-gluten","type":"qa","q":"Har ni glutenfritt?","a":"Ja, flera rätter kan göras glutenfria","tags":["allergi","gluten"],"priority":"high"}
{"id":"hours-weekday","type":"qa","q":"Vilka öppettider har ni?","a":"Vi har öppet måndag-fredag 11:00-22:00","tags":["öppettider"],"priority":"high"}
```

### voice-ai.txt (För ElevenLabs)

```
╔════════════════════════════════════════════╗
║        TORSTENS - ÄNGELHOLM                ║
║         VOICE AI KUNSKAPSBAS               ║
╚════════════════════════════════════════════╝

=== VANLIGA FRÅGOR OCH SVAR ===

FRÅGA: Har ni glutenfritt?
SVAR: Ja, flera rätter kan göras glutenfria...
Nyckelord: allergi, gluten, mat

=== INSTRUKTIONER FÖR VOICE AI ===
1. Var vänlig och professionell
2. Använd informationen ovan som källa
...
```

### info.json (Faktabas)

```json
{
  "slug": "torstens-angelholm",
  "name": "Torstens",
  "brand": "Torstens",
  "city": "Ängelholm",
  "address": "Storgatan 9, 262 32 Ängelholm",
  "phone": "+46431123456",
  "email": "info@torstens.se",
  "website": "https://torstens.se",
  "hours": {
    "monday": "11:30–22:00",
    "tuesday": "11:30–22:00",
    ...
  },
  "menu": [
    {
      "title": "Köttbullar med potatismos",
      "description": "Klassiska svenska köttbullar",
      "price": 165,
      "currency": "SEK",
      "category": "allmän",
      "allergens": ["gluten", "mjölk"]
    }
  ],
  "booking": {
    "min_guests": 1,
    "max_guests": 8,
    "cancellation_policy": "Avbokning senast 2 timmar före"
  }
}
```

## 🔍 Smart Normalisering

### Funktioner

- **Telefonnormalisering**: → E.164 format (+46...)
- **Tidsnormalisering**: → HH:MM format
- **Smart gissning**: Extraherar saknade fält från text
- **Kedjorestaruang-detektion**: Fallbacks för kedjor
- **Allergen-mappning**: Standardiserade allergener
- **Validering**: Errors/fixes/assumptions tracking

### Exempel

**Input (rå data):**
```javascript
{
  name: "Restaurang Mavi",
  phone: "042-123456",  // Lokalt format
  hours: { "mån": "11.00-22.00" }  // Svensk kort form
}
```

**Output (normaliserat):**
```javascript
{
  name: "Restaurang Mavi",
  brand: "Mavi",  // ← Extraherat från name
  phone: "+46421123456",  // ← E.164
  hours: { "monday": "11:00–22:00" }  // ← Standardiserat
}
```

### Fallbacks för Kedjorestaruanger

Om grundläggande data saknas:
```javascript
// Genererad fallback-adress
address: "Storgatan 12, 262 32 Ängelholm"

// Genererad fallback-telefon
phone: "+46 431-xxxxx"

// Standard öppettider
hours: {
  monday: "11:30–22:00",
  tuesday: "11:30–22:00",
  ...
}
```

## 🎨 Admin Dashboard

### Features

- 📊 Lista alla restauranger
- 🕷️ Trigga scrape per restaurang eller alla
- ☁️ Synka till ElevenLabs
- 📚 Visa knowledge base
- 📄 Visa reports
- 🔄 Auto-refresh var 30:e sekund

### URL

```
http://localhost:3000
```

### Screenshot funktionalitet

- **Scrape** - Starta scraping
- **Sync** - Synka till ElevenLabs
- **Knowledge** - Visa knowledge base i modal
- **Report** - Visa errors/fixes/assumptions

## 🔒 Environment Variables

```env
# Required för ElevenLabs sync
ELEVENLABS_API_KEY=xi-your-api-key

# Server
PORT=3000

# Crawler
CRAWL_DELAY_MS=500
MAX_CONCURRENT_REQUESTS=3
USER_AGENT=MultiRestaurantScraper/2.0

# Timeouts
REQUEST_TIMEOUT_MS=30000
SITEMAP_TIMEOUT_MS=15000

# Retry
MAX_RETRIES=3
RETRY_DELAY_MS=1000

# Output
RESTAURANTS_OUTPUT_DIR=./restaurants

# Normalisering
DEFAULT_TIMEZONE=Europe/Stockholm
DEFAULT_CURRENCY=SEK
DEFAULT_COUNTRY_CODE=+46

# Validation
MIN_KNOWLEDGE_ITEMS=15
REQUIRE_OPENING_HOURS=true
REQUIRE_CONTACT_INFO=true
```

## 🧪 Testing

### Test single restaurant scrape

```bash
node src/index.js multi-scrape torstens-angelholm
```

### Test ElevenLabs sync

```bash
# Lista dokument
node src/elevenlabs-sync.js list

# Synka en
node src/elevenlabs-sync.js sync ./restaurants/torstens-angelholm "Torstens" "Ängelholm"

# Synka alla
node src/elevenlabs-sync.js sync-all
```

### Test API

```bash
# Start server
npm run server

# Test endpoints
curl http://localhost:3000/api/restaurants
curl http://localhost:3000/api/restaurants/torstens-angelholm
curl http://localhost:3000/health
```

## 📈 Monitoring

### Logs

Systemet loggar till console med Logger-klassen:

```
🕷️ Torstens Crawler - Fristående körning
✅ Crawling slutförd: 15 sidor crawlade
📊 Resultat: 15 lyckades, 0 misslyckades
🔍 Extraherar innehåll från crawlad data...
✅ Extraktion klar! Data sparad
🧠 Genererar knowledge base...
✅ Knowledge base skapad! 47 kunskapsposter
📄 Genererar voice-ai.txt...
✅ voice-ai.txt skapad
☁️ Synkar till ElevenLabs...
✅ Successfully synced to ElevenLabs (ID: doc-xxx)
```

### Health Check

```bash
# CLI
curl http://localhost:3000/health

# NPM
npm run multi:health
```

### Reports

Varje restaurang får en `report.txt`:

```
FEL:
- Saknar rekommenderade fält: email

FIXAR:
- Extraherade stad från adress: Ängelholm
- Hittade telefonnummer från kontaktdata: 0431-12345

ANTAGANDEN:
- Antog stängt för sunday - ingen data tillgänglig
- Genererade standardöppettider för restaurangkedja
```

## 🛠️ Troubleshooting

### Problem: ElevenLabs sync misslyckas

**Lösning:**
1. Kontrollera `ELEVENLABS_API_KEY` i .env
2. Testa API-nyckel: `npm run elevenlabs:list`
3. Kontrollera att `voice-ai.txt` finns

### Problem: Tom knowledge base

**Lösning:**
1. Kör `npm run multi:scrape-all` igen
2. Kontrollera `report.txt` för fel
3. Verifiera HTML-struktur på webbplatsen

### Problem: Crawler hittar inga sidor

**Lösning:**
1. Kontrollera `sitemapPaths` i config
2. Testa sitemap manuellt: `curl https://restaurang.se/sitemap.xml`
3. Använd Playwright för JS-renderade sidor

### Problem: Server startar inte

**Lösning:**
1. Kontrollera port är ledig: `lsof -i :3000`
2. Ändra PORT i .env
3. Installera dependencies: `npm install`

## 📚 Advanced Usage

### Custom Crawler per Restaurang

```javascript
// I config.js
{
  slug: "special-restaurant",
  specialConfig: {
    crawlerType: "playwright",  // Använd Playwright istället för axios
    menuKeywords: ["custom", "keywords"],
    waitForSelector: ".menu-loaded"  // Vänta på specifik selector
  }
}
```

### Scheduled Scraping

```javascript
// Lägg till i scheduler.js
import cron from 'node-cron';

// Scrapa alla restauranger varje dag kl 06:00
cron.schedule('0 6 * * *', async () => {
  await multiScraper.scrapeAllRestaurants();
});
```

### Webhook Notifications

```javascript
// Efter lyckad scrape
await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'scrape_completed',
    restaurant: restaurantSlug,
    timestamp: new Date().toISOString()
  })
});
```

## 🤝 Contributing

För att lägga till ny funktionalitet:

1. Kör `npm run multi:init` för test-data
2. Testa ändringar med `npm run multi:scrape-all`
3. Verifiera output i `restaurants/*/`
4. Uppdatera dokumentation

## 📄 License

MIT

## 🆘 Support

Vid problem:
1. Kolla logs i console
2. Läs `report.txt` för varje restaurang
3. Testa med `npm run multi:health`
4. Kontrollera `.env` konfiguration
