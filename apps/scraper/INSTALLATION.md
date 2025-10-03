# Installation och Användning

## Snabbstart

### 1. Installation

```bash
cd torstens-voice-ai-scraper
npm install
```

Om du vill använda Playwright för JS-renderering:
```bash
npx playwright install chromium
```

### 2. Konfiguration

```bash
cp .env.example .env
```

Redigera `.env` efter dina behov:
```bash
BASE_URL=https://torstens.se
CRAWL_DELAY_MS=500
CRON_SCHEDULE=0 6 * * *
VOICE_AI_WEBHOOK_URL=https://your-voice-ai-system.com/webhook
VOICE_AI_API_KEY=your-api-key
```

### 3. Första körningen

```bash
# Testa med en komplett uppdatering
npm run full-update

# Eller kör steg för steg
npm run crawl
npm run extract
npm run knowledge
```

### 4. Starta automatisk scheduler

```bash
npm start
```

## Kommandon

```bash
npm start              # Starta scheduler (kör enligt cron-schema)
npm run full-update    # Kör en komplett uppdatering nu
npm run crawl          # Endast crawla webbsidor
npm run extract        # Endast extrahera innehåll
npm run knowledge      # Endast bygg knowledge base
```

## Resultatfiler

Efter lyckad körning hittar du:

- `data/raw_pages.json` - Rådata från crawling
- `data/extracted_content.json` - Strukturerat innehåll
- `output/knowledge.jsonl` - Knowledge base för Voice AI
- `output/restaurant_data.json` - Komplett restaurangdata

## Voice AI Integration

Se `config/voice-ai-integration.md` för detaljerad integreringsguide.

### Exempel: Ladda Knowledge Base

```javascript
import fs from 'fs';
import readline from 'readline';

async function loadKnowledge() {
  const knowledge = [];
  const fileStream = fs.createReadStream('./output/knowledge.jsonl');
  const rl = readline.createInterface({ input: fileStream });

  for await (const line of rl) {
    if (line.trim()) knowledge.push(JSON.parse(line));
  }

  return knowledge;
}

// Använd i ditt Voice AI-system
const knowledge = await loadKnowledge();
const match = knowledge.find(item =>
  item.type === 'qa' &&
  item.q.toLowerCase().includes('glutenfritt')
);

console.log(match?.a); // "Vi märker vår meny så gott det går..."
```

## Felsökning

### Problem: Crawling misslyckas

- Kontrollera att torstens.se är tillgänglig
- Öka `CRAWL_DELAY_MS` om du får rate-limiting
- Använd Playwright för JS-renderade sidor

### Problem: Tom knowledge base

- Kontrollera att extraction lyckades
- Verifiera att HTML-parsing fungerar
- Testa med enskilda kommandon (`npm run extract`)

### Problem: Webhook fungerar inte

- Kontrollera `VOICE_AI_WEBHOOK_URL` i .env
- Testa manuellt med curl:

```bash
curl -X POST https://your-webhook-url \
  -H "Content-Type: application/json" \
  -d '{"event": "test", "timestamp": "2025-01-15T12:00:00Z"}'
```

## Utveckling

För utveckling med automatisk restart:
```bash
npm install -g nodemon
npm run dev
```

## Support

Vid frågor eller problem, kontrollera:
1. Loggar i konsolen
2. `data/` och `output/` mappar skapas korrekt
3. Nätverksanslutning till torstens.se