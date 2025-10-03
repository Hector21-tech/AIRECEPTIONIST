# Voice AI Integration Guide

## Översikt

Detta system producerar strukturerad data som är optimerad för Voice AI-system som hanterar kundtjänst via telefon för Torstens restauranger.

## Dataformat

### Knowledge Base (knowledge.jsonl)

Varje rad innehåller ett JSON-objekt med strukturen:

```json
{
  "id": "faq-glutenfritt",
  "type": "qa",
  "q": "Har ni glutenfritt?",
  "a": "Vi märker vår meny så gött det går, men fråga alltid personalen för säkerhets skull.",
  "tags": ["allergi", "gluten", "mat"],
  "priority": "high"
}
```

### Datatyper

- **`qa`** - Fråga och svar för direkta kundinteraktioner
- **`fact`** - Faktainformation (öppettider, kontaktinfo)
- **`menu`** - Menyinformation och rätter
- **`content`** - Allmän webbsidescontent för fallback

## Voice AI Implementation

### 1. Ladda Knowledge Base

```javascript
import fs from 'fs';
import readline from 'readline';

async function loadKnowledgeBase(filePath) {
  const knowledge = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      knowledge.push(JSON.parse(line));
    }
  }
  return knowledge;
}
```

### 2. Sök och Matcha Kundfrågor

```javascript
function findBestMatch(userQuery, knowledgeBase) {
  const lowerQuery = userQuery.toLowerCase();

  // Prioritera Q&A
  const qaMatches = knowledgeBase
    .filter(item => item.type === 'qa')
    .filter(item =>
      item.q.toLowerCase().includes(lowerQuery) ||
      item.tags.some(tag => lowerQuery.includes(tag.toLowerCase()))
    );

  if (qaMatches.length > 0) {
    return qaMatches[0];
  }

  // Fallback till facts
  return knowledgeBase
    .filter(item => item.type === 'fact')
    .find(item =>
      item.text.toLowerCase().includes(lowerQuery) ||
      item.tags.some(tag => lowerQuery.includes(tag.toLowerCase()))
    );
}
```

### 3. Generera Voice AI-svar

```javascript
function generateResponse(match, context = {}) {
  if (!match) {
    return "Tyvärr kunde jag inte hitta information om det. Kan jag hjälpa dig med något annat?";
  }

  let response = '';

  switch (match.type) {
    case 'qa':
      response = match.a;
      break;

    case 'fact':
      response = match.text;
      break;

    case 'menu':
      response = `Här är information om vår meny: ${match.text}`;
      break;

    default:
      response = match.text.substring(0, 200) + '...';
  }

  // Lägg till säkerhetsrader för känsliga ämnen
  if (match.tags.includes('allergi')) {
    response += " För säkerhets skull, vill du att jag dubbelkollar med köket?";
  }

  return response;
}
```

## Automatisk Uppdatering

### Webhook Integration

När systemet uppdaterar knowledge base skickas en POST-request till din Voice AI webhook:

```json
{
  "event": "knowledge_base_updated",
  "timestamp": "2025-01-15T06:00:00Z",
  "data": {
    "success": true,
    "knowledgeEntries": 47,
    "crawledPages": 15
  },
  "knowledgeBasePath": "./output/knowledge.jsonl",
  "restaurantDataPath": "./output/restaurant_data.json"
}
```

### Rekommenderad Workflow

1. **Ta emot webhook** → Ladda om knowledge base
2. **Validera data** → Kontrollera att nya data är rimlig
3. **Uppdatera AI-modell** → Indexera nya kunskapsposter
4. **Testa system** → Kör basic sanity checks

## Vanliga Användningsfall

### Bokning av Bord

```javascript
function handleBookingRequest(userInput, knowledge) {
  const bookingInfo = knowledge.find(item =>
    item.tags.includes('bokning') && item.type === 'qa'
  );

  if (bookingInfo) {
    return bookingInfo.a + " För hur många gäster och vilken tid tänkte du dig?";
  }
}
```

### Allergier och Specialkost

```javascript
function handleAllergyQuestion(allergen, knowledge) {
  const allergyInfo = knowledge.filter(item =>
    item.tags.includes('allergi') ||
    item.tags.includes(allergen.toLowerCase())
  );

  let response = allergyInfo[0]?.a || "Vi tar allergier på största allvar.";
  response += " Vill du att jag kopplar dig till köket för detaljerad information?";

  return response;
}
```

### Öppettider

```javascript
function getOpeningHours(day, knowledge) {
  const hoursInfo = knowledge.find(item =>
    item.type === 'fact' &&
    item.tags.includes('öppettider')
  );

  if (hoursInfo && hoursInfo.structured) {
    const dayMapping = {
      'måndag': 'mon', 'tisdag': 'tue', 'onsdag': 'wed',
      'torsdag': 'thu', 'fredag': 'fri', 'lördag': 'sat', 'söndag': 'sun'
    };

    const englishDay = dayMapping[day.toLowerCase()];
    const hours = hoursInfo.structured[englishDay];

    return hours ? `Vi har öppet ${hours} på ${day}` : hoursInfo.text;
  }
}
```

## Kvalitetssäkring

### Valideringsregler

1. **Alltid dubbelkolla allergier** - Hänvisa till personal
2. **Priser kan ändras** - Nämn att priserna är vägledande
3. **Bokningar** - Samla in nödvändig info (gäster, tid, kontakt)
4. **Okänd information** - Erkänn begränsningar och erbjud att koppla vidare

### Exempel Säkerhetsfraser

```javascript
const safetyPhrases = {
  allergies: "För säkerhets skull, vill du att jag dubbelkollar med köket?",
  prices: "Priserna kan variera, jag bekräftar gärna aktuella priser.",
  booking: "Perfekt! Jag hjälper dig med bokningen.",
  unknown: "Det var en bra fråga som jag inte kan svara på just nu. Ska jag koppla dig till restaurangen?"
};
```