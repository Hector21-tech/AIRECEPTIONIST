# ElevenLabs Webhook Konfiguration

## Problem
Twilio webhook skapar samtalsloggar utan transkript, ElevenLabs webhook anropas aldrig för riktiga samtal, vilket resulterar i samtal utan transkript i UI.

## Lösning
Har ändrat logiken så:
1. Twilio webhook skapar INTE längre samtalsloggar (inaktiverat temporärt)
2. ElevenLabs webhook skapar kompletta samtalsloggar med transkript

## Vad som behövs nu

### 1. Konfigurera Webhook URL i ElevenLabs Dashboard

För kund "Torstens ängelholm" (ID: 7):

**Webhook URL:**
```
https://ditt-produktions-domän.com/api/elevenlabs/agent-callback?customerId=7
```

**För lokal utveckling (med ngrok):**
```
https://abc123.ngrok.io/api/elevenlabs/agent-callback?customerId=7
```

### 2. Webhook Events som ska aktiveras
- `post_call_transcription` - För transkript efter samtal
- `post_call_audio` - För ljudfiler efter samtal

### 3. Steg för att aktivera
1. Gå till ElevenLabs Dashboard
2. Hitta agenten för Torstens ängelholm
3. Gå till Agent Settings > Webhooks
4. Lägg till webhook URL:en ovan
5. Välj events: `post_call_transcription` och `post_call_audio`
6. Spara inställningar

### 4. För lokal testning med ngrok
```bash
# Installera ngrok om det inte finns
brew install ngrok

# Starta ngrok för port 3000
ngrok http 3000

# Kopiera https URL (t.ex. https://abc123.ngrok.io)
# Använd denna URL i ElevenLabs webhook konfiguration
```

### 5. Testa webhook
När webhook är konfigurerad, ring Twilio-numret. Du borde se:
- Twilio webhook loggar: "⏸️ TWILIO SKAPAR INTE SAMTALSLOGG - Väntar på ElevenLabs webhook istället"
- ElevenLabs webhook loggar: "📞 Skapar nytt komplett samtalslogg för [conversation_id]"
- Ett komplett samtal med transkript i UI

## Återställa om det inte fungerar
Om ElevenLabs webhook inte kan konfigureras, kan vi återställa genom att:
1. Kommentera bort de inaktiverade raderna i Twilio webhook
2. Låta Twilio skapa basic samtalsloggar igen
3. Fixa ElevenLabs webhook senare