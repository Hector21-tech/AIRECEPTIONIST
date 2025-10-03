# 🍽️ Multi-Restaurant Scraper Guide

Det utökade systemet stödjer nu **flera restauranger samtidigt** och producerar normaliserade Voice AI-data enligt systemprompten.

## 🎯 Vad systemet producerar

För **varje restaurang** skapas:
- `info.json` - Komplett, validerad faktabas
- `knowledge.jsonl` - Q&A-bas för Voice AI (rad-separerade objekt)
- `report.txt` - Fel/fixar/antaganden

**Globalt** skapas:
- `index.json` - Översikt över alla restauranger

## 📁 Filstruktur

```
restaurants/
├── index.json                          # Global index
├── torstens-angelholm/
│   ├── info.json                       # Faktabas för Ängelholm
│   ├── knowledge.jsonl                 # Q&A för Voice AI
│   ├── report.txt                      # Fel/antaganden
│   ├── raw_data.json                   # Rådata från crawling
│   └── extracted_data.json             # Extraherat innehåll
└── torstens-vala/
    ├── info.json
    ├── knowledge.jsonl
    ├── report.txt
    ├── raw_data.json
    └── extracted_data.json
```

## 🚀 Snabbstart

### 1. Initiera med exempel-restauranger
```bash
npm run multi:init
# eller
node src/index.js multi-init
```

### 2. Lista registrerade restauranger
```bash
npm run multi:list
# eller
node src/index.js multi-list
```

### 3. Scrapa alla restauranger
```bash
npm run multi:scrape-all
# eller
node src/index.js multi-scrape-all
```

### 4. Kontrollera status
```bash
npm run multi:status
# eller
node src/index.js multi-status
```

## 📋 Alla kommandon

### Multi-Restaurant kommandon
```bash
# Grundläggande
node src/index.js multi-init              # Initiera med Torstens exempel
node src/index.js multi-list              # Lista alla restauranger
node src/index.js multi-status            # Visa systemstatus

# Scraping
node src/index.js multi-scrape-all        # Scrapa alla restauranger
node src/index.js multi-scrape [slug]     # Scrapa en specifik restaurang

# Konfiguration
node src/index.js multi-load [fil]        # Ladda från JSON-fil
node src/index.js multi-save [fil]        # Spara till JSON-fil

# Underhåll
node src/index.js multi-health            # Health check
node src/index.js multi-clean             # Rensa all data
```

### NPM scripts (förkortat)
```bash
npm run multi:init                        # Initiera
npm run multi:scrape-all                  # Scrapa alla
npm run multi:status                      # Status
npm run multi:list                        # Lista restauranger
npm run multi:health                      # Health check
npm run multi:clean                       # Rensa
```

## 🔧 Konfiguration

### Registrera en ny restaurang

1. **Via JSON-fil** (rekommenderat):
```json
// config/restaurants.json
[
  {
    "slug": "marios-stockholm",
    "name": "Marios Ristorante",
    "brand": "Marios",
    "city": "Stockholm",
    "baseUrl": "https://mariosristorante.se",
    "sitemapPaths": ["/sitemap.xml"],
    "specialConfig": {
      "menuKeywords": ["meny", "pasta", "pizza"],
      "validation": {
        "requireMenu": true,
        "minMenuItems": 10
      }
    }
  }
]
```

2. **Ladda konfigurationen**:
```bash
node src/index.js multi-load config/restaurants.json
```

### Miljövariabler för multi-restaurant

```env
# Multi-restaurant inställningar
RESTAURANTS_OUTPUT_DIR=./restaurants
INDEX_FILE=./restaurants/index.json
DEFAULT_TIMEZONE=Europe/Stockholm
DEFAULT_CURRENCY=SEK
DEFAULT_COUNTRY_CODE=+46

# Kvalitetsgrind
MIN_KNOWLEDGE_ITEMS=15
REQUIRE_OPENING_HOURS=true
REQUIRE_CONTACT_INFO=true

# Source prioritering (högsta först)
SOURCE_PRIORITY=official,menu,social,third-party
```

## 📊 Dataformat

### info.json struktur
```json
{
  "slug": "torstens-angelholm",
  "name": "Torstens",
  "brand": "Torstens",
  "address": "Storgatan 15, 262 31 Ängelholm",
  "city": "Ängelholm",
  "phone": "+46431234567",
  "email": "info@torstens.se",
  "website": "https://torstens.se",
  "timezone": "Europe/Stockholm",
  "updated_at": "2025-09-27T16:45:00.000Z",
  "source_urls": ["https://torstens.se"],

  "hours": {
    "monday": "11:00–21:00",
    "tuesday": "11:00–21:00",
    "wednesday": "11:00–21:00",
    "thursday": "11:00–22:00",
    "friday": "11:00–22:00",
    "saturday": "12:00–22:00",
    "sunday": "closed"
  },

  "special_hours": [
    {
      "date": "2025-12-24",
      "hours": "closed",
      "reason": "Julafton"
    }
  ],

  "menu": [
    {
      "title": "Köttbullar med potatismos",
      "description": "Klassiska svenska köttbullar",
      "price": 165,
      "currency": "SEK",
      "category": "varmrätt",
      "allergens": ["gluten", "mjölk"],
      "labels": ["husmanskost"]
    }
  ],

  "booking": {
    "min_guests": 1,
    "max_guests": 8,
    "lead_time_minutes": 120,
    "dining_duration_minutes": 120,
    "group_overflow_rule": "manual",
    "cancellation_policy": "Avbokning senast 2 timmar före bokad tid"
  },

  "messages": [
    {
      "id": "weekly-special",
      "type": "special_offer",
      "title": "Veckans erbjudande",
      "content": "Torsdagar: 20% rabatt på alla pizzor",
      "validity": {
        "start": "2025-09-01T00:00:00.000Z",
        "end": "2025-09-30T23:59:59.999Z"
      },
      "priority": "high"
    }
  ]
}
```

### knowledge.jsonl format (en rad = ett objekt)
```json
{"id":"hours-weekdays","question":"Vilka öppettider har ni?","answer":"Vi har öppet måndag-onsdag 11-21, torsdag-fredag 11-22. Ring oss för helgers öppettider!","source":"hours_data","tags":["öppettider","tider","vardag"],"location":"torstens-angelholm"}
{"id":"gluten-allergi","question":"Har ni glutenfritt?","answer":"Vi arbetar med gluten i vårt kök men kan anpassa många rätter. Säg alltid till om glutenintolerans så hjälper vi dig!","source":"menu_analysis","tags":["allergi","gluten","anpassning"],"location":"torstens-angelholm"}
{"id":"boka-bord","question":"Kan jag boka bord?","answer":"Absolut! Ring oss på +46431234567 så hjälper vi dig hitta en ledig tid. För hur många gäster?","source":"booking_policy","tags":["bokning","reservation","telefon"],"location":"torstens-angelholm"}
```

### index.json format
```json
{
  "restaurants": [
    {
      "slug": "torstens-angelholm",
      "name": "Torstens",
      "brand": "Torstens",
      "city": "Ängelholm",
      "timezone": "Europe/Stockholm",
      "updated_at": "2025-09-27T16:45:00.000Z",
      "paths": {
        "info": "/restaurants/torstens-angelholm/info.json",
        "knowledge": "/restaurants/torstens-angelholm/knowledge.jsonl",
        "report": "/restaurants/torstens-angelholm/report.txt"
      }
    }
  ],
  "total_count": 1,
  "last_updated": "2025-09-27T16:45:00.000Z",
  "version": "2.0.0"
}
```

## 🔍 Normalisering & Kvalitet

### Automatisk normalisering
- **Telefon** → E.164 format (+46...)
- **Tid** → 24-timmars "HH:MM" format
- **Datum** → ISO 8601
- **Priser** → numeriska värden + valuta-fält
- **Allergener** → standardiserad lista

### Konflikthantering
- **Källprioritet**: officiell webb > meny/PDF > sociala medier > tredjepart
- **Dubbletter**: slås ihop automatiskt
- **Saknad data**: rapporteras i report.txt

### Kvalitetsvalidering
- Alla obligatoriska fält kontrolleras
- Öppettider måste vara logiska (slut > start)
- Menypriser måste vara numeriska
- E.164 telefonnummer
- Minst 15 kunskapsposter per restaurang

## 🚨 Felhantering

### report.txt exempel
```
FEL:
- Kunde inte normalisera tid: "ca 18"
- Ogiltig e-postadress: invalid@email

FIXAR:
- info.json struktur validerad och normaliserad
- Konverterade telefonnummer från 0431-12345 till +46431234567

ANTAGANDEN:
- Antog svenskt telefonnummer för: 0431-12345
- Antog stängt för sunday - ingen data tillgänglig
- Menypost 3: approximativt pris
```

## 🔄 Integration med befintligt system

Multi-restaurant systemet **kompletterar** det ursprungliga:

```bash
# Original single-restaurant (fungerar som förut)
npm start                    # Scheduler för Torstens
npm run full-update         # Single-restaurant uppdatering

# Nytt multi-restaurant system
npm run multi:scrape-all    # Alla restauranger
```

Båda systemen kan köras parallellt utan konflikter.

## 🎯 Voice AI Integration

### Sök i knowledge base
Varje restaurang har egen knowledge.jsonl med `location`-fält:

```javascript
// Exempel: filtrera på plats
const torstensAngelholm = knowledgeItems.filter(
  item => item.location === 'torstens-angelholm'
);

// Exempel: sök över alla platser
const glutenQuestions = knowledgeItems.filter(
  item => item.tags.includes('gluten')
);
```

### API endpoints (framtida expansion)
```
GET /restaurants                    # Lista alla restauranger
GET /restaurants/{slug}/info        # Få info.json
GET /restaurants/{slug}/knowledge   # Få knowledge.jsonl
GET /restaurants/search?q=gluten    # Sök över alla kunskapsbaser
```

## 📈 Prestandaoptimering

- **Parallell crawling** per restaurang
- **Intelligent retry-logik** med exponential backoff
- **Caching** av normaliserade data
- **Health checks** före och efter scraping

## 🎉 Resultat

**Multi-restaurant systemet ger:**
- ✅ **Skalbart** - lägg till obegränsat antal restauranger
- ✅ **Normaliserat** - konsistent data format för alla platser
- ✅ **Voice AI-redo** - JSONL format med location-support
- ✅ **Robust** - intelligent felhantering och rapportering
- ✅ **Flexibelt** - anpassningsbar per restaurang/kedja
- ✅ **Bakåtkompatibelt** - påverkar inte befintlig funktionalitet

**Perfekt för:**
- Restaurangkedjor med flera platser
- Voice AI-system som hanterar flera varumärken
- Automatiserad data-aggregering från olika källor
- Skalbar kundtjänst med plats-specifik information