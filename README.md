# AI Receptionist + Restaurant Scraper

Complete SaaS platform for AI-powered restaurant phone receptionists with automatic knowledge base scraping.

## 🏗️ Architecture

```
Monorepo Structure:
├── apps/
│   ├── web/              # Next.js 15 Dashboard (Vercel)
│   └── scraper/          # Express Scraper Service (Railway)
└── packages/
    └── database/         # Shared Drizzle Schema (PostgreSQL)
```

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/Hector21-tech/AIRECEPTIONIST.git
cd AIRECEPTIONIST
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

**apps/web/.env:**
```env
POSTGRES_URL=postgresql://postgres.jdairntwlxgvxxynpnec:PASSWORD@aws-1-eu-north-1.pooler.supabase.com:6543/postgres
BASE_URL=http://localhost:3000
AUTH_SECRET=your-auth-secret
SCRAPER_SERVICE_URL=http://localhost:4000
SCRAPER_API_KEY=your-api-key
```

**apps/scraper/.env:**
```env
POSTGRES_URL=postgresql://postgres.jdairntwlxgvxxynpnec:PASSWORD@aws-1-eu-north-1.pooler.supabase.com:6543/postgres
API_SECRET_KEY=your-api-key
ELEVENLABS_API_KEY=sk_...
PORT=4000
```

### 4. Run Database Migrations

```bash
cd apps/web
npm run db:generate
npm run db:migrate
```

### 5. Start Development

```bash
# Terminal 1: Next.js App
npm run dev:web

# Terminal 2: Scraper Service
npm run dev:scraper
```

## 📦 Services

### Web App (apps/web/)

**Tech Stack:**
- Next.js 15 (App Router)
- Drizzle ORM + PostgreSQL
- Tailwind CSS
- Supabase Auth

**Features:**
- Team & Customer Management
- Twilio Integration
- ElevenLabs Voice AI
- Call Logs & Analytics
- Restaurant Knowledge Scraper UI

**Ports:**
- Dev: `http://localhost:3000`
- Prod: Vercel

### Scraper Service (apps/scraper/)

**Tech Stack:**
- Express.js
- PostgreSQL (Drizzle)
- Playwright for crawling
- Webhook queue worker

**Features:**
- Website crawling & extraction
- Knowledge base generation
- ElevenLabs auto-sync
- Webhook notifications
- Background retry queue

**Ports:**
- Dev: `http://localhost:4000`
- Prod: Railway

## 🗄️ Database Schema

### Existing Tables (AI Receptionist)
- `teams` - Tenant organizations
- `users` - Team members
- `customers` - Restaurant customers
- `call_logs` - Call transcripts
- `usage` - Usage tracking
- `integrations` - POS/Booking integrations

### New Tables (Scraper)
- `restaurants` - Scraped restaurant data
- `scrape_jobs` - Scraping job history
- `knowledge_items` - Parsed Q&A items
- `webhook_logs` - Webhook delivery logs

## 🔗 API Communication

```
Next.js UI → POST /api/scraper/trigger
           ↓
    Scraper Service
           ↓
    PostgreSQL (shared)
           ↓
    Webhook → Next.js
           ↓
    UI Updates
```

## 🚢 Deployment

### Vercel (Web App)

1. Connect GitHub repo to Vercel
2. Set root directory: `apps/web`
3. Add environment variables
4. Deploy

**Environment Variables:**
```
POSTGRES_URL=postgresql://...
BASE_URL=https://your-app.vercel.app
AUTH_SECRET=...
SCRAPER_SERVICE_URL=https://your-scraper.up.railway.app
SCRAPER_API_KEY=...
```

### Railway (Scraper)

1. Create new Railway project
2. Connect GitHub repo
3. Set root directory: `apps/scraper`
4. Add environment variables
5. Deploy

**Environment Variables:**
```
POSTGRES_URL=postgresql://... (same as web!)
API_SECRET_KEY=... (same as SCRAPER_API_KEY above)
ELEVENLABS_API_KEY=sk_...
PORT=4000
```

## 📊 Workflow

### 1. User Creates Customer
- Dashboard → Add Customer
- Input: Restaurant name, contact, phone number

### 2. Configure ElevenLabs Agent
- Customer page → ElevenLabs settings
- Input: Agent ID, API key

### 3. Scrape Website (NEW!)
- Customer page → Knowledge Base → "Scrape Website"
- Input: Restaurant website URL
- Scraper crawls, extracts, generates knowledge
- Auto-syncs to ElevenLabs agent

### 4. AI Receptionist Ready
- Knowledge base loaded
- Phone number configured
- Calls handled automatically

## 🔧 Development Scripts

```bash
# Development
npm run dev              # Start web app
npm run dev:web          # Start web app only
npm run dev:scraper      # Start scraper only

# Build
npm run build            # Build all
npm run build:web        # Build web app
npm run build:scraper    # Build scraper

# Database
npm run db:generate      # Generate migrations
npm run db:migrate       # Run migrations
npm run db:studio        # Drizzle Studio UI
```

## 🪝 Webhooks

### Scraper Events

**scrape_started:**
```json
{
  "event": "scrape_started",
  "customerId": 7,
  "restaurantSlug": "torstens-angelholm",
  "websiteUrl": "https://torstens.se"
}
```

**scrape_completed:**
```json
{
  "event": "scrape_completed",
  "customerId": 7,
  "restaurantSlug": "torstens-angelholm",
  "pagesCrawled": 15,
  "knowledgeItems": 47,
  "elevenlabsDocumentId": "doc_xyz"
}
```

**scrape_failed:**
```json
{
  "event": "scrape_failed",
  "customerId": 7,
  "error": "Website unreachable"
}
```

## 🔒 Security

- API key authentication between services
- Per-customer ElevenLabs API keys
- Row-level security via team isolation
- Secrets in environment variables only

## 📚 Documentation

- [Web App Docs](./apps/web/README.md)
- [Scraper Docs](./apps/scraper/README.md)
- [Database Schema](./packages/database/README.md)

## 🐛 Troubleshooting

### Web app can't reach scraper
- Check `SCRAPER_SERVICE_URL` is correct
- Check `SCRAPER_API_KEY` matches on both services

### Database connection errors
- Verify `POSTGRES_URL` is identical on both services
- Check Supabase connection pooler is active
- Ensure migrations are run

### Scraper timeout
- Increase `REQUEST_TIMEOUT_MS` in scraper .env
- Check website is accessible
- Review scraper logs

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test locally
4. Submit PR

## 📄 License

MIT

## 🆘 Support

For issues, contact: yaserbatak21@gmail.com
