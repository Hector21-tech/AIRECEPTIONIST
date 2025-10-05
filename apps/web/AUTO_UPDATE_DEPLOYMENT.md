# Automatiska KB-Uppdateringar - Deployment Guide

Detta är deployment-guiden för det automatiska systemet som uppdaterar restaurangernas Knowledge Bases i ElevenLabs.

## 📋 Översikt

Systemet uppdaterar automatiskt restaurangernas Knowledge Bases baserat på:
- **Daglig uppdatering**: För restauranger med dagens husman
- **Veckovis uppdatering**: För restauranger med veckomeny (körs på måndagar)

Systemet använder hash-baserad förändringsdetektion - KB uppdateras endast om innehållet har ändrats.

## 🔧 Steg 1: Environment Variables

Lägg till följande i din `.env.local` (lokalt) och deployment miljö (Vercel/Railway):

```bash
# Cron Jobs (för automatiska KB-uppdateringar)
CRON_SECRET=din_slumpmässiga_secret_här

# Scraper Service URL (Railway)
SCRAPER_SERVICE_URL=https://your-scraper-service.railway.app
```

### Generera CRON_SECRET

```bash
# I terminal, kör:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Kopiera resultatet och sätt som `CRON_SECRET`.

## 🚀 Deployment: Vercel (Rekommenderat)

### 1. Vercel Cron är redan konfigurerat

Filen `vercel.json` innehåller cron-scheman för varje timme (6:00-23:00):

```json
{
  "crons": [
    {
      "path": "/api/cron/update-restaurants?hour=6",
      "schedule": "0 6 * * *"
    },
    ...
  ]
}
```

### 2. Lägg till Environment Variables i Vercel

1. Gå till Vercel Dashboard → Settings → Environment Variables
2. Lägg till:
   - `CRON_SECRET` - din genererade secret
   - `SCRAPER_SERVICE_URL` - URL till Railway scraper service

### 3. Deploy till Vercel

```bash
cd apps/web
vercel --prod
```

Vercel kommer automatiskt:
- Läsa `vercel.json`
- Skapa cron jobs för varje timme
- Köra dem enligt schema

### 4. Verifiera Cron Jobs

Efter deployment:
1. Gå till Vercel Dashboard → Deployments → [din deployment] → Functions
2. Du bör se "Cron Jobs" sektionen med alla timmar listade

## 🚂 Alternativ: Railway Deployment

Om du använder Railway istället för Vercel:

### 1. Skapa Cron Jobs manuellt i Railway

Railway Dashboard → Settings → Cron Jobs

Lägg till för varje timme (6-23):

```bash
# Klockan 6:00
0 6 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://your-nextjs-app.railway.app/api/cron/update-restaurants?hour=6

# Klockan 7:00
0 7 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://your-nextjs-app.railway.app/api/cron/update-restaurants?hour=7

# ... fortsätt för varje timme
```

### 2. Environment Variables i Railway

Railway Dashboard → Variables:
- `CRON_SECRET` - din genererade secret
- `SCRAPER_SERVICE_URL` - URL till scraper service

## 🧪 Testing

### Test Manuellt (via API)

```bash
# Testa utan authentication (lokalt)
curl http://localhost:3000/api/cron/update-restaurants?hour=6

# Testa med authentication (production)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron/update-restaurants?hour=6
```

### Test via UI (Manuell Trigger)

1. Gå till Customer Detail Page
2. Scrolla till "Automatiska Uppdateringar"
3. Klicka "Uppdatera KB Nu"
4. Kontrollera console logs och status

## 📊 Monitoring

### Vercel Logs

```bash
vercel logs --follow
```

### Railway Logs

Railway Dashboard → Deployments → [din deployment] → Logs

### Cron Endpoint Response

Endpoint returnerar detaljerad sammanfattning:

```json
{
  "success": true,
  "message": "Processed 5 customers",
  "results": {
    "total": 5,
    "success": [
      {
        "id": 1,
        "name": "Torstens",
        "documentId": "doc_123",
        "documentName": "Torstens - Dagens 2025-01-15",
        "oldHash": "abc123de",
        "newHash": "xyz789ab"
      }
    ],
    "failed": [],
    "skipped": [
      {
        "id": 2,
        "name": "Restaurant 2",
        "reason": "Content unchanged"
      }
    ],
    "startTime": "2025-01-15T06:00:00.000Z",
    "endTime": "2025-01-15T06:00:15.234Z",
    "duration": "15234ms"
  }
}
```

## 🔐 Säkerhet

- **CRON_SECRET**: Används för att verifiera att request kommer från Vercel/Railway cron
- **Authorization Header**: `Bearer <CRON_SECRET>` krävs för alla cron requests
- **Ingen CRON_SECRET = utvecklingsläge**: Om CRON_SECRET inte är satt, körs endpoint utan auth (endast lokalt!)

## 📝 Workflow

1. **Cron trigger** → Endpoint körs enligt schema
2. **Query database** → Hitta alla kunder med matchande `dailyUpdateTime`
3. **Filter by frequency**:
   - Daily: Körs varje dag
   - Weekly: Körs endast på måndagar
4. **För varje kund**:
   - Hämta dagens content från scraper
   - Beräkna hash
   - Jämför med `lastDailyHash`
   - Om ändrat: Lägg till dokument i KB
   - Uppdatera `lastDailyHash` och `lastUpdateDate`

## 🛠️ Troubleshooting

### Cron körs inte

**Vercel**:
- Kontrollera att `vercel.json` finns i root av `/apps/web`
- Kontrollera Vercel Dashboard → Functions → Cron Jobs
- Verifiera att `CRON_SECRET` är satt i Environment Variables

**Railway**:
- Kontrollera Railway Dashboard → Cron Jobs
- Verifiera cron syntax: `0 6 * * *` (minuter timmar dag månad veckodag)

### Unauthorized Error

- Kontrollera att `CRON_SECRET` matchar i:
  - Environment variables
  - Cron job curl command (Bearer token)

### Scraper Service Not Reachable

- Kontrollera att `SCRAPER_SERVICE_URL` är korrekt
- Verifiera att scraper service är deployed och running
- Test scraper endpoint:
  ```bash
  curl https://your-scraper-service.railway.app/health
  ```

### No Customers Updated

- Kontrollera att kunder har:
  - `updateFrequency` = 'daily' eller 'weekly'
  - `dailyUpdateTime` satt (t.ex. "06:00")
  - `knowledgeBaseId` finns
  - `restaurantSlug` finns
  - `websiteUrl` finns

## ✅ Deployment Checklist

- [ ] `CRON_SECRET` genererad och satt i environment variables
- [ ] `SCRAPER_SERVICE_URL` korrekt i environment variables
- [ ] Scraper service deployed och running på Railway
- [ ] Vercel deployment klar (eller Railway cron jobs skapade)
- [ ] Test cron endpoint manuellt
- [ ] Verifiera cron jobs i dashboard
- [ ] Test med minst 1 restaurang:
  - [ ] Sätt `updateFrequency` = 'daily'
  - [ ] Sätt `dailyUpdateTime` = '06:00'
  - [ ] Vänta till 06:00 eller test manuellt
  - [ ] Kontrollera logs
  - [ ] Verifiera att dokument skapades i ElevenLabs

## 🎯 Nästa Steg

Efter deployment:
1. Konfigurera varje restaurang via Customer Detail UI
2. Sätt `updateFrequency` och `dailyUpdateTime`
3. Test manuell trigger för varje restaurang
4. Övervaka första automatiska körningen
5. Justera tider baserat på behov
