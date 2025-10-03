# Voice AI Setup Guide

Guide för att generera och använda TXT-filer för ElevenLabs Voice AI.

## Koncept

**Single Source of Truth**: `knowledge.jsonl` - Strukturerad data i JSONL-format
**Voice AI Format**: `voice-ai.txt` - Lättläst textfil för ElevenLabs

## Snabbstart

### 1. Kör komplett uppdatering med TXT-generering

```bash
npm run full-update-txt
```

Detta kör hela processen:
- Crawlar hemsidan
- Extraherar innehåll
- Skapar knowledge base (JSONL)
- Konverterar till TXT för Voice AI

### 2. Endast konvertera befintlig JSONL till TXT

```bash
npm run convert-txt
```

### 3. Multi-restaurang konvertering

```bash
# Skapa restaurants.json från exempel
cp config/restaurants.example.json config/restaurants.json

# Redigera med dina restauranger
# Kör multi-konvertering
npm run multi:convert-txt
```

## Filstruktur efter konvertering

```
output/
├── torstens-angelholm/
│   ├── knowledge.jsonl       # Single source of truth (strukturerad)
│   ├── voice-ai.txt          # För ElevenLabs (läsbar text)
│   └── metadata.json         # Statistik och info
├── torstens-helsingborg/
│   ├── knowledge.jsonl
│   ├── voice-ai.txt
│   └── metadata.json
└── torstens-vala/
    ├── knowledge.jsonl
    ├── voice-ai.txt
    └── metadata.json
```

## TXT-filens format

```
╔════════════════════════════════════════════════════════════════════╗
║                     TORSTENS - ÄNGELHOLM                           ║
║                    VOICE AI KUNSKAPSBAS                            ║
╚════════════════════════════════════════════════════════════════════╝

Uppdaterad: 2025-10-03 14:30

=== VANLIGA FRÅGOR OCH SVAR ===

FRÅGA: Har ni glutenfritt?
SVAR: Ja, flera rätter kan göras glutenfria...
Nyckelord: allergi, gluten, mat

FRÅGA: Kan jag boka bord?
SVAR: Absolut! Ring oss så hjälper vi dig...
Nyckelord: bokning, telefon, service

=== VIKTIG INFORMATION ===

--- Öppettider ---
Öppettider: Måndag 11:00-21:00, Tisdag 11:00-21:00...

--- Kontakt ---
Telefonnummer: 0431-12345
Adress: Storgatan 1, Ängelholm

=== MENY OCH RÄTTER ===

Lunchrätt (125 kr): Dagens husmanskost...
Köttbullar med potatismos (165 kr): Klassiska köttbullar...

=== INSTRUKTIONER FÖR VOICE AI ===

När du svarar på kundfrågor:
1. Var vänlig och professionell
2. Använd informationen ovan som källa
...
```

## Ladda upp till ElevenLabs

### Manuell uppladdning

1. Gå till ElevenLabs dashboard
2. Navigera till Knowledge Base
3. Ladda upp `voice-ai.txt` från din restaurangmapp
4. Koppla knowledge base till din Voice AI-agent

### Automatisk uppladdning via API (framtida funktion)

```bash
# Kommer snart
npm run elevenlabs:sync
```

## CLI-användning (avancerat)

### Enskild restaurang

```bash
node src/jsonl-to-txt.js --restaurant "Torstens" "Ängelholm" "./output/knowledge.jsonl"
```

### Multi-restauranger

```bash
node src/jsonl-to-txt.js --multi ./config/restaurants.json
```

### Standard konvertering

```bash
node src/jsonl-to-txt.js
```

## Tips för Voice AI

### Optimera för tal

TXT-filen är designad för Voice AI:
- Tydliga frågor och svar
- Naturligt språk
- Kortfattade meningar
- Instruktioner för AI i footer

### Uppdatering

Kör `npm run full-update-txt` dagligen eller enligt schema för att hålla data aktuell.

### Testning

Ladda upp TXT-filen till ElevenLabs och testa med vanliga kundfrågor:
- "Vad har ni för öppettider?"
- "Har ni glutenfria alternativ?"
- "Kan jag boka bord?"

## Integration i workflow

### Daglig automatisk uppdatering

```bash
# Lägg till i cron (Linux/Mac)
0 6 * * * cd /path/to/project && npm run full-update-txt

# Eller använd scheduler.js
npm start
```

### Webhook-notifiering vid uppdatering

Lägg till webhook i `.env`:
```
VOICE_AI_WEBHOOK_URL=https://your-elevenlabs-webhook.com
VOICE_AI_API_KEY=your-api-key
```

## Felsökning

### Tom TXT-fil
- Kontrollera att `knowledge.jsonl` finns och har innehåll
- Kör `npm run knowledge` för att återskapa JSONL

### Felaktig formatering
- Verifiera att JSONL är valid JSON per rad
- Kör `node src/jsonl-to-txt.js` och läs felmeddelanden

### Multi-restaurang fungerar inte
- Kontrollera att `config/restaurants.json` existerar
- Verifiera JSON-syntax
- Kontrollera att alla `knowledgeFile`-sökvägar är korrekta

## Nästa steg

1. ✅ Generera TXT-filer
2. ⬜ Ladda upp till ElevenLabs manuellt
3. ⬜ Testa Voice AI med filer
4. ⬜ Implementera automatisk API-sync (framtida)
5. ⬜ Schemalägg dagliga uppdateringar

## Support

Vid problem, kontrollera:
- Loggar i konsolen
- `output/*/metadata.json` för statistik
- JSONL-filen är valid med `cat output/*/knowledge.jsonl | jq`
