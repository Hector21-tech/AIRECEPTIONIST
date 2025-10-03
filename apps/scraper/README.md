# Torstens Voice AI Scraper

Ett automatiserat scraping-system som samlar data från torstens.se och strukturerar den för Voice AI-integration i telefonsamtal med kunder.

## Funktioner

- 🕷️ **Intelligent Crawling**: Hämtar data från sitemap.xml eller använder Playwright för JS-renderade sidor
- 🔄 **Automatisk Uppdatering**: Kör schemalagt för att hålla data aktuell
- 📊 **Strukturerad Data**: Konverterar webbinnehåll till Voice AI-vänligt format
- 🗣️ **Knowledge Base**: Skapar Q&A-format för kundtjänst
- 📋 **Meny & Öppettider**: Extraherar restaurangspecifik information

## Installation

```bash
npm install
cp .env.example .env
# Redigera .env med dina inställningar
```

## Användning

```bash
# Kör komplett uppdatering
npm run full-update

# Endast crawling
npm run crawl

# Endast dataextraktion
npm run extract

# Bygg knowledge base
npm run knowledge

# Starta scheduler
npm start
```

## Datastruktur

Systemet producerar:
- `data/raw_pages.json` - Rådata från webbsidor
- `data/extracted_content.json` - Strukturerat innehåll
- `output/knowledge.jsonl` - Voice AI knowledge base
- `output/restaurant_data.json` - Komplett restaurangdata

## Voice AI Integration

Knowledge base exporteras som JSONL med format:
```json
{"id":"faq-gluten","type":"qa","q":"Har ni glutenfritt?","a":"Ja, flera rätter kan göras glutenfria"}
{"id":"hours-angelholm","type":"fact","tags":["öppettider"],"text":"Mån-Ons 11-21, Tors-Fre 11-22"}
```