# 🧪 Testguide - Torstens Voice AI Scraper

## Snabbtester (utan dependencies)

### 1. Grundläggande test
```bash
node test-simple.js
```
**Vad testas:**
- HTTP-anslutning till torstens.se
- Grundläggande HTML-parsing
- Mappskapning (data/, output/)
- Textextraktion

**Förväntad output:**
```
🧪 Torstens Scraper - Enkel Test
✅ Alla tester lyckades!
📊 Nästa steg: Kör "npm run full-update" för komplett scraping
```

### 2. Avancerat test (med fallback)
```bash
node test-advanced.js
```
**Vad testas:**
- Modulimportering (med fallback)
- Crawling-funktionalitet
- Content extraction
- Knowledge base skapning

## Komplett testsvit

### 3. Fullständig testkörning
```bash
node test-runner.js
```
**Vad testas:**
1. **Projektstruktur** - Alla filer och mappar finns
2. **Nätverksanslutning** - Kan nå torstens.se
3. **Konfiguration** - .env-filen är korrekt
4. **Grundläggande scraping** - Kan hämta webbsidor
5. **Voice AI kvalitet** - Knowledge base är användbar

**Exempel output:**
```
🎯 TESTSAMMANFATTNING
✅ Lyckade: 5
❌ Misslyckade: 0
⚠️ Varningar: 2
🎯 Framgångsgrad: 100%

🎉 ALLA TESTER LYCKADES!
✨ Systemet är redo för Voice AI-integration
```

## Produktionstester (med dependencies)

Efter `npm install`, testa med riktiga moduler:

### 4. Crawling-test
```bash
npm run crawl
```
**Förväntat resultat:**
- Skapar `data/raw_pages.json`
- Crawlar 5-15 sidor från torstens.se
- Visar framgångsstatistik

### 5. Extraktion-test
```bash
npm run extract
```
**Förväntat resultat:**
- Skapar `data/extracted_content.json`
- Hittar menyer, öppettider, kontaktinfo
- Visar antal extraherade element

### 6. Knowledge base-test
```bash
npm run knowledge
```
**Förväntat resultat:**
- Skapar `output/knowledge.jsonl`
- Skapar `output/restaurant_data.json`
- Genererar Q&A för Voice AI

### 7. Komplett pipeline-test
```bash
npm run full-update
```
**Förväntat resultat:**
- Kör alla steg i sekvens
- Skapar alla output-filer
- Tar 30-60 sekunder

## Voice AI Quality Tests

### Kontrollera knowledge base kvalitet

```bash
# Kontrollera att knowledge base skapats
ls -la output/knowledge.jsonl

# Se innehåll (första 5 rader)
head -5 output/knowledge.jsonl

# Räkna antal kunskapsposter
wc -l output/knowledge.jsonl
```

### Testa med exempel-queries

```javascript
// Ladda knowledge base
import fs from 'fs';
import readline from 'readline';

const knowledge = [];
const fileStream = fs.createReadStream('./output/knowledge.jsonl');
const rl = readline.createInterface({ input: fileStream });

for await (const line of rl) {
  if (line.trim()) knowledge.push(JSON.parse(line));
}

// Test vanliga frågor
const queries = ['gluten', 'öppet', 'telefon', 'boka', 'lunch'];

queries.forEach(query => {
  const matches = knowledge.filter(item =>
    item.q?.toLowerCase().includes(query) ||
    item.text?.toLowerCase().includes(query) ||
    item.tags?.some(tag => tag.includes(query))
  );
  console.log(`"${query}": ${matches.length} träffar`);
});
```

### Validera Q&A-kvalitet

Kontrollera att FAQ:s är Voice AI-vänliga:

```bash
# Visa endast Q&A-poster
grep '"type":"qa"' output/knowledge.jsonl | head -3
```

**Bra Q&A ska ha:**
- Naturligt språk i frågan
- Kortfattat, användbart svar
- Relevanta tags för sök
- Säkerhetsfraser för allergier

## Felsökning

### Problem: "Cannot find package"
```bash
npm install  # Installera dependencies
```

### Problem: "ENOENT: no such file"
```bash
# Kontrollera att du är i rätt mapp
pwd
ls package.json  # Ska finnas

# Skapa saknade mappar
mkdir -p data output
```

### Problem: "Connection refused"
```bash
# Testa internetanslutning
ping torstens.se
curl -I https://torstens.se
```

### Problem: Tom knowledge base
```bash
# Kontrollera raw data först
ls -la data/raw_pages.json
head data/raw_pages.json

# Kör extraktion separat
npm run extract
```

## Prestandatester

### Mät crawling-tid
```bash
time npm run crawl
```

### Kontrollera minnesanvändning
```bash
# Kör med minnesövervakning
node --max-old-space-size=512 src/index.js full-update
```

### Testa rate limiting
```bash
# Ändra i .env
CRAWL_DELAY_MS=2000  # 2 sekunder mellan requests
```

## Automatisering-tester

### Testa scheduler lokalt
```bash
# Sätt kort intervall för test
echo "CRON_SCHEDULE=*/2 * * * *" >> .env  # Varje 2:a minut

# Starta scheduler
npm start

# Stoppa med Ctrl+C efter några minuter
```

### Testa webhook (om konfigurerat)
```bash
# Simulera webhook-anrop
curl -X POST https://your-voice-ai-webhook.com/test \
  -H "Content-Type: application/json" \
  -d '{"event": "test", "timestamp": "2025-01-15T12:00:00Z"}'
```

## Success Criteria

### ✅ Grundläggande framgång
- Alla enkla tester (test-simple.js) lyckades
- Kan ansluta till torstens.se
- Skapar output-filer

### ✅ Produktionsredo
- npm run full-update fungerar
- Knowledge base > 20 poster
- Q&A kvalitet validerad
- Inga kritiska varningar

### ✅ Voice AI-redo
- JSONL-format korrekt
- Sökfunktion fungerar
- Vanliga queries hittar svar
- FAQ:s är naturliga och korta

## Nästa steg efter framgångsrika tester

1. **Produktionsscheduler:** `npm start`
2. **Voice AI-integration:** Se `config/voice-ai-integration.md`
3. **Övervakning:** Kontrollera loggar regelbundet
4. **Uppdateringar:** Kör `npm run full-update` vid behov