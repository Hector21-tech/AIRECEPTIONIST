# AI-Receptionist Admin System

Ett komplett adminsystem för AI-receptionist SaaS byggt på Next.js SaaS Starter.

## 🚀 Funktioner

### 📊 Dashboard
- **Översikt**: Visa aktiva kunder, månatliga minuter, intäkter och marginal
- **Real-time metrics**: Automatisk uppdatering av statistik
- **Senaste samtal**: Transkription och status för de senaste samtalen

### 👥 Kundhantering
- **Kundlista**: Visa alla kunder med kontaktinfo och plans
- **Kunddetaljer**: Detaljerad vy med inställningar, usage och samtalshistorik
- **Agentinställningar**: Twilio nummer, ElevenLabs röst-ID, språk och LLM-modell

### 📞 Samtalsloggar
- **Transkription**: Fulltext av alla samtal
- **Status tracking**: Lyckade samtal vs fallback till personal
- **Kostnadsspårning**: Real-time kostnad per samtal

### 🔌 Integrationer
- **Bordsbokaren.se**: Puppeteer automation för bokningar
- **POS System**: TruePOS API eller SMS/email fallback
- **Fallback system**: Alltid fungerande via SMS/mail

## 🏗️ Teknisk stack

- **Frontend**: Next.js 15, React, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes, TypeScript
- **Databas**: PostgreSQL med Drizzle ORM
- **Auth**: JWT-baserad autentisering
- **Deployment**: Vercel + Supabase/Railway för databas

## 🛠️ Installation

### 1. Klona och installera
```bash
git clone <repository-url>
cd ai-saas
npm install
```

### 2. Konfigurera miljövariabler
Skapa en `.env` fil baserad på `.env.example`:
```bash
# Database
POSTGRES_URL=postgresql://username:password@localhost:5432/database

# Stripe (valfritt för utveckling)
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret

# App
BASE_URL=http://localhost:3000
AUTH_SECRET=your-secret-key
```

### 3. Sätt upp databasen
```bash
# Generera migration filer
npm run db:generate

# Kör migrationer (behöver en PostgreSQL databas)
npm run db:migrate

# Seeda med demo data (Torstens Ängelholm)
npm run db:seed
```

### 4. Starta utvecklingsservern
```bash
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000) i din webbläsare.

## 📝 Demo data

Systemet kommer med färdig demo-data för **Torstens Ängelholm**:

### Kund information:
- **Företag**: Torstens Ängelholm
- **Kontakt**: Torsten Andersson
- **Telefon**: +46123456789
- **Email**: torsten@torstens.se
- **Twilio nummer**: +46870123456
- **Plan**: Standard (5 kr/min + 5000 kr uppstart)

### Integrationer:
- **Bokningar**: Bordsbokaren.se via Puppeteer
- **Beställningar**: SMS fallback till personal

### Sample data:
- **15 dagars usage data** med realistiska siffror
- **5 samtalsloggar** med svenska transkriptioner
- **Blandning av lyckade samtal och fallbacks**

## 📱 Användning

### Logga in
Standard inloggning:
- **Email**: test@test.com
- **Lösenord**: admin123

### Navigation
- **Översikt**: Dashboard med metrics och senaste samtal
- **Kunder**: Lista och detaljvyer för alla kunder
- **Team inställningar**: Ursprungliga SaaS inställningar

## Going to Production

When you're ready to deploy your SaaS application to production, follow these steps:

### Set up a production Stripe webhook

1. Go to the Stripe Dashboard and create a new webhook for your production environment.
2. Set the endpoint URL to your production API route (e.g., `https://yourdomain.com/api/stripe/webhook`).
3. Select the events you want to listen for (e.g., `checkout.session.completed`, `customer.subscription.updated`).

### Deploy to Vercel

1. Push your code to a GitHub repository.
2. Connect your repository to [Vercel](https://vercel.com/) and deploy it.
3. Follow the Vercel deployment process, which will guide you through setting up your project.

### Add environment variables

In your Vercel project settings (or during deployment), add all the necessary environment variables. Make sure to update the values for the production environment, including:

1. `BASE_URL`: Set this to your production domain.
2. `STRIPE_SECRET_KEY`: Use your Stripe secret key for the production environment.
3. `STRIPE_WEBHOOK_SECRET`: Use the webhook secret from the production webhook you created in step 1.
4. `POSTGRES_URL`: Set this to your production database URL.
5. `AUTH_SECRET`: Set this to a random string. `openssl rand -base64 32` will generate one.

## Other Templates

While this template is intentionally minimal and to be used as a learning resource, there are other paid versions in the community which are more full-featured:

- https://achromatic.dev
- https://shipfa.st
- https://makerkit.dev
- https://zerotoshipped.com
- https://turbostarter.dev
# Deploy trigger Wed Sep 24 15:22:51 CEST 2025
