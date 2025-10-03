# 🚀 Webhook Setup Guide

## 📋 Steg-för-steg setup för riktiga webhooks

### 1. **Installera Ngrok** (för utveckling)
```bash
# Installera ngrok
brew install ngrok

# Eller ladda ner från https://ngrok.com/download
# Skapa konto på ngrok.com för auth token
```

### 2. **Starta din lokala server**
```bash
# I en terminal
npm run dev
# Server kör på http://localhost:3000
```

### 3. **Starta Ngrok tunnel**
```bash
# I en annan terminal
ngrok http 3000
# Du får en URL som: https://abc123.ngrok.io
```

### 4. **Konfigurera Twilio Webhooks**

**Gå till Twilio Console → Phone Numbers → Manage → Active numbers**

För ditt Twilio-nummer, sätt:
- **Webhook URL**: `https://abc123.ngrok.io/api/twilio/call-status`
- **HTTP Method**: POST
- **Events**: Call Status Changes

### 5. **Konfigurera ElevenLabs Webhooks**

**Gå till ElevenLabs Dashboard → Settings → Webhooks**

Lägg till:
- **Webhook URL**: `https://abc123.ngrok.io/api/elevenlabs/transcript`
- **Events**: Speech Generated, Transcript Ready

### 6. **Lägg till ditt riktiga företag**

**Gå till**: http://localhost:3000/customers/new

Fyll i:
- **Namn**: Ditt företag
- **Twilio-nummer**: Ditt riktiga nummer (t.ex. +46707123456)
- **ElevenLabs Voice ID**: Din röst-ID
- **Plan**: Standard eller Premium

### 7. **Ta bort test-data**

**På dashboard**: Tryck "Ta Bort Test-data" knappen

### 8. **Testa med riktiga samtal**

1. Ring ditt Twilio-nummer
2. Kolla konsollen för webhook-loggar 🔔
3. Se aktiviteter dyka upp på dashboard 📊
4. Verifiera kostnader och marginaler 💰

## 🔧 Environment Variables

Lägg till i din `.env`:
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
ELEVENLABS_API_KEY=your_api_key
```

## 🐛 Troubleshooting

**Webhook når inte fram?**
- Kolla att ngrok tunnel är aktiv
- Verifiera webhook URLs i Twilio/ElevenLabs
- Kolla server-loggar för felmeddelanden

**Kund hittas inte?**
- Kontrollera att Twilio-nummer matchar exakt
- Inklusive landskod (t.ex. +46...)

**Kostnadsspårning fel?**
- Kolla att `call_sid` finns i call_logs tabellen
- Verifiera att både Twilio och ElevenLabs webhooks når fram

## 🚀 Production Setup

För production, ersätt ngrok med:
- Vercel deployment
- AWS Lambda
- Railway/Render
- Din egen server

Webhook URLs blir då:
- `https://yourdomain.com/api/twilio/call-status`
- `https://yourdomain.com/api/elevenlabs/transcript`