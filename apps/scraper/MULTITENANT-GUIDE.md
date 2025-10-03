# Multitenant Restaurant Scraper System

## 🎯 Overview

This is a complete multitenant restaurant scraping and Voice AI knowledge base system with:

- **🔐 Tenant Management** - Isolate data and access per customer
- **🔑 API Key Authentication** - Secure API access with per-tenant keys
- **⚡ Rate Limiting** - Prevent abuse with plan-based limits
- **🪝 Webhook Integration** - Event-driven architecture with n8n support
- **☁️ ElevenLabs Sync** - Automatic Voice AI knowledge base updates
- **📊 Multi-Restaurant** - Scrape and manage multiple restaurants per tenant

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Initialize Database

```bash
npm run db:init
```

This creates `server/database/tenants.db` with all required tables.

### 3. Create Your First Tenant

```bash
npm run tenant -- tenant create "Acme Inc" "info@acme.com" --plan=pro --webhook=https://n8n.acme.com/webhook/scraper
```

Output:
```json
{
  "id": "tenant_abc123def456",
  "name": "Acme Inc",
  "email": "info@acme.com",
  "plan": "pro",
  "webhook_url": "https://n8n.acme.com/webhook/scraper",
  "active": 1,
  "created_at": "2024-01-15T10:00:00.000Z"
}

🔑 API Key: rsk_xyz789abc123...
⚠️ Save this key securely - it cannot be retrieved later!
```

### 4. Link Restaurant to Tenant

```bash
npm run tenant -- restaurant link tenant_abc123def456 torstens-angelholm
```

### 5. Start API Server

```bash
npm run server
```

Server runs on http://localhost:3000

### 6. Test API with Authentication

```bash
curl -X POST http://localhost:3000/api/restaurants/torstens-angelholm/scrape \
  -H "X-API-Key: rsk_xyz789abc123..." \
  -H "Content-Type: application/json" \
  -d '{"syncToElevenLabs": true}'
```

### 7. Start Webhook Queue (Optional)

```bash
npm run webhook:queue
```

This runs a background service that retries failed webhooks.

## 📁 Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                  Multitenant Platform                    │
│                                                           │
│  ┌──────────────┐         ┌──────────────┐              │
│  │   Tenant A   │         │   Tenant B   │              │
│  │ API Key: rsk_│         │ API Key: rsk_│              │
│  └──────────────┘         └──────────────┘              │
└────────────┬─────────────────────┬────────────────────┘
             │                     │
             │ X-API-Key Header    │
             ▼                     ▼
┌──────────────────────────────────────────────────────────┐
│                  API Server (Express)                     │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │        Authentication Middleware                    │  │
│  │  - Validate API Key                                 │  │
│  │  - Check Restaurant Access                          │  │
│  │  - Rate Limiting                                    │  │
│  │  - Usage Logging                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  REST API Endpoints:                                      │
│  - GET  /api/restaurants                                  │
│  - POST /api/restaurants/:slug/scrape                     │
│  - POST /api/restaurants/:slug/sync-elevenlabs            │
│  - GET  /api/restaurants/:slug/knowledge                  │
└────────────┬─────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────┐
│              Multi-Restaurant Scraper                     │
│                                                           │
│  Workflow:                                                │
│  1. Crawl website (sitemap/Playwright)                    │
│  2. Extract content (menus, hours, contact)               │
│  3. Normalize data (smart fallbacks)                      │
│  4. Generate knowledge.jsonl + voice-ai.txt               │
│  5. Sync to ElevenLabs                                    │
│  6. Send webhooks                                         │
└────────────┬─────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────┐
│                  Webhook System                           │
│                                                           │
│  ┌────────────────┐       ┌──────────────────────────┐   │
│  │ Webhook Manager│  →    │  Webhook Queue Worker    │   │
│  │ - Send webhooks│       │  - Retry failed (5min)   │   │
│  │ - Log delivery │       │  - Max 3 retries         │   │
│  └────────────────┘       │  - Cleanup old logs      │   │
│                           └──────────────────────────┘   │
└────────────┬─────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────┐
│                     n8n Workflows                         │
│                                                           │
│  - Receive webhook events                                 │
│  - Store in database                                      │
│  - Send notifications (Slack/Email)                       │
│  - Trigger custom automation                              │
│  - Schedule scraping                                      │
└───────────────────────────────────────────────────────────┘
```

### Database Schema (SQLite)

```sql
tenants
├── id (TEXT PRIMARY KEY)
├── name (TEXT)
├── email (TEXT UNIQUE)
├── plan (TEXT: free|pro|enterprise)
├── webhook_url (TEXT)
└── active (INTEGER)

api_keys
├── key (TEXT PRIMARY KEY)
├── tenant_id (TEXT → tenants.id)
├── name (TEXT)
├── active (INTEGER)
└── last_used_at (DATETIME)

tenant_restaurants
├── tenant_id (TEXT → tenants.id)
├── restaurant_slug (TEXT)
└── custom_config (TEXT JSON)

webhook_logs
├── id (INTEGER PRIMARY KEY)
├── tenant_id (TEXT → tenants.id)
├── event_type (TEXT)
├── restaurant_slug (TEXT)
├── payload (TEXT JSON)
├── status (TEXT: pending|success|failed)
├── retry_count (INTEGER)
└── next_retry_at (DATETIME)

api_usage_logs
├── id (INTEGER PRIMARY KEY)
├── tenant_id (TEXT → tenants.id)
├── api_key (TEXT)
├── endpoint (TEXT)
├── method (TEXT)
└── status_code (INTEGER)
```

## 🔐 Tenant Management

### CLI Commands

#### Create Tenant
```bash
npm run tenant -- tenant create <name> <email> [options]

# Options:
# --company=<company>
# --plan=<free|pro|enterprise>
# --webhook=<url>

# Example:
npm run tenant -- tenant create "Restaurant Group AB" "admin@group.se" \
  --company="Group AB" \
  --plan=enterprise \
  --webhook=https://n8n.group.se/webhook/scraper
```

#### List Tenants
```bash
npm run tenant -- tenant list
```

#### Show Tenant Details
```bash
npm run tenant -- tenant show <tenant-id>
```

#### Update Tenant
```bash
npm run tenant -- tenant update <tenant-id> [options]

# Options:
# --name=<name>
# --email=<email>
# --plan=<plan>
# --webhook=<url>
# --active=<true|false>

# Example:
npm run tenant -- tenant update tenant_abc123 --plan=pro --webhook=https://new-webhook.com
```

#### Delete Tenant
```bash
# Soft delete (deactivate)
npm run tenant -- tenant delete <tenant-id>

# Hard delete (permanent)
npm run tenant -- tenant delete <tenant-id> --hard=true
```

### Tenant Plans & Rate Limits

| Plan | Requests/Hour | Max Restaurants | Features |
|------|--------------|-----------------|----------|
| **Free** | 100 | 1 | Basic scraping, API access |
| **Pro** | 1,000 | 10 | Webhooks, ElevenLabs sync, Priority support |
| **Enterprise** | 10,000 | Unlimited | Custom config, Dedicated support |

## 🔑 API Key Management

### CLI Commands

#### Create API Key
```bash
npm run tenant -- apikey create <tenant-id> [name]

# Example:
npm run tenant -- apikey create tenant_abc123 "Production Key"
```

#### List API Keys
```bash
npm run tenant -- apikey list <tenant-id>
```

#### Validate API Key
```bash
npm run tenant -- apikey validate <api-key>
```

#### Deactivate API Key
```bash
npm run tenant -- apikey deactivate <api-key>
```

#### Reactivate API Key
```bash
npm run tenant -- apikey reactivate <api-key>
```

#### Rotate API Key
```bash
npm run tenant -- apikey rotate <old-api-key> [name]
```

#### Delete API Key
```bash
npm run tenant -- apikey delete <api-key>
```

### API Key Format
```
rsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
- Prefix: `rsk_` (Restaurant Scraper Key)
- Length: 48 characters (3 prefix + 48 random hex)

## 🍽️ Restaurant Management

### CLI Commands

#### Link Restaurant to Tenant
```bash
npm run tenant -- restaurant link <tenant-id> <restaurant-slug>

# Example:
npm run tenant -- restaurant link tenant_abc123 torstens-angelholm
```

#### Unlink Restaurant from Tenant
```bash
npm run tenant -- restaurant unlink <tenant-id> <restaurant-slug>
```

#### List Tenant's Restaurants
```bash
npm run tenant -- restaurant list <tenant-id>
```

### Access Control

Tenants can only:
- Scrape **their linked restaurants**
- Access **their restaurant data**
- Receive **webhooks for their restaurants**

## 🌐 API Endpoints

### Authentication

All endpoints (except public ones) require authentication via API key:

```bash
-H "X-API-Key: rsk_your_api_key"
# OR
-H "Authorization: Bearer rsk_your_api_key"
```

### Endpoints

#### List Restaurants
```http
GET /api/restaurants
X-API-Key: rsk_your_api_key
```

Returns only the tenant's linked restaurants.

#### Get Restaurant Info
```http
GET /api/restaurants/:slug
X-API-Key: rsk_your_api_key
```

#### Get Knowledge Base
```http
GET /api/restaurants/:slug/knowledge
X-API-Key: rsk_your_api_key
```

#### Get Voice AI Text
```http
GET /api/restaurants/:slug/voice-ai
X-API-Key: rsk_your_api_key
```

#### Get Scrape Report
```http
GET /api/restaurants/:slug/report
X-API-Key: rsk_your_api_key
```

#### Trigger Scrape
```http
POST /api/restaurants/:slug/scrape
X-API-Key: rsk_your_api_key
Content-Type: application/json

{
  "syncToElevenLabs": true
}
```

#### Scrape All (Tenant's Restaurants)
```http
POST /api/scrape-all
X-API-Key: rsk_your_api_key
Content-Type: application/json

{
  "syncToElevenLabs": true
}
```

#### Sync to ElevenLabs
```http
POST /api/restaurants/:slug/sync-elevenlabs
X-API-Key: rsk_your_api_key
```

#### Sync All to ElevenLabs
```http
POST /api/sync-elevenlabs-all
X-API-Key: rsk_your_api_key
```

#### Health Check
```http
GET /health
```

No authentication required.

### Response Format

Success:
```json
{
  "success": true,
  "data": { ... },
  "message": "..."
}
```

Error:
```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

### Rate Limiting Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Window: 1 hour
```

## 🪝 Webhooks

### Setup

Set webhook URL when creating/updating tenant:
```bash
npm run tenant -- tenant update tenant_abc123 --webhook=https://your-n8n.com/webhook/scraper
```

### Event Types

| Event | Trigger | Payload |
|-------|---------|---------|
| `scrape_started` | Scraping begins | `restaurant_name`, `restaurant_city`, `base_url` |
| `scrape_completed` | Scraping successful | `pages_scraped`, `knowledge_items`, `synced_to_elevenlabs`, `elevenlabs_document_id` |
| `scrape_failed` | Scraping failed | `error` |
| `sync_started` | ElevenLabs sync begins | `restaurant_name`, `restaurant_city` |
| `sync_completed` | ElevenLabs sync successful | `document_id`, `action` |
| `sync_failed` | ElevenLabs sync failed | `error` |
| `webhook_test` | Test webhook | `message` |

### Payload Format

```json
{
  "event": "scrape_completed",
  "tenant_id": "tenant_abc123",
  "tenant_name": "Acme Inc",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "restaurant_slug": "torstens-angelholm",
    "restaurant_name": "Torstens",
    "restaurant_city": "Ängelholm",
    "pages_scraped": 15,
    "knowledge_items": 47,
    "synced_to_elevenlabs": true,
    "elevenlabs_document_id": "doc_xyz789"
  }
}
```

### Retry Logic

- Failed webhooks are automatically retried
- Retry intervals: 5 minutes
- Max retries: 3
- After max retries, webhook is marked as permanently failed

### Webhook Queue Service

Start background worker:
```bash
npm run webhook:queue
```

This service:
- Runs every 5 minutes
- Retries failed webhooks
- Cleans up old logs daily at 3 AM
- Keeps logs for 30 days

## 🔗 n8n Integration

### Import Workflows

1. Open n8n
2. Go to **Workflows** → **Import from File**
3. Select a workflow from `n8n-workflows/`
4. Configure credentials
5. Activate workflow

### Available Workflows

- **scrape-to-slack.json** - Webhook events → Slack notifications
- **scheduled-scrape.json** - Cron schedule → Trigger scraping
- **webhook-to-database.json** - Complete automation pipeline

See [n8n-workflows/README.md](n8n-workflows/README.md) for details.

## 📊 Usage Statistics

### View API Usage
```bash
npm run tenant -- tenant show <tenant-id>
```

Shows:
- Total API requests (last 30 days)
- Webhook deliveries (last 7 days)
- Restaurant count
- Active API keys

### Database Queries

**Top API users:**
```sql
SELECT tenant_id, COUNT(*) as requests
FROM api_usage_logs
WHERE created_at >= datetime('now', '-7 days')
GROUP BY tenant_id
ORDER BY requests DESC
LIMIT 10;
```

**Failed webhooks:**
```sql
SELECT tenant_id, event_type, COUNT(*) as failures
FROM webhook_logs
WHERE status = 'failed'
  AND created_at >= datetime('now', '-7 days')
GROUP BY tenant_id, event_type;
```

## 🛠️ Troubleshooting

### Authentication Errors

**Problem:** `401 Unauthorized - API key is required`

**Solution:**
1. Ensure API key is provided in header:
   ```bash
   -H "X-API-Key: rsk_your_key"
   ```
2. Validate key:
   ```bash
   npm run tenant -- apikey validate rsk_your_key
   ```

### Access Denied

**Problem:** `403 Forbidden - You do not have access to restaurant`

**Solution:**
1. Check tenant-restaurant link:
   ```bash
   npm run tenant -- restaurant list <tenant-id>
   ```
2. Link restaurant if missing:
   ```bash
   npm run tenant -- restaurant link <tenant-id> <restaurant-slug>
   ```

### Rate Limit Exceeded

**Problem:** `429 Too Many Requests`

**Solution:**
1. Check current plan:
   ```bash
   npm run tenant -- tenant show <tenant-id>
   ```
2. Upgrade plan:
   ```bash
   npm run tenant -- tenant update <tenant-id> --plan=pro
   ```

### Webhook Not Received

**Problem:** Webhooks not arriving at n8n

**Solution:**
1. Test webhook URL manually:
   ```bash
   curl -X POST https://your-n8n.com/webhook/test \
     -H "Content-Type: application/json" \
     -d '{"event": "test"}'
   ```
2. Check webhook logs:
   ```sql
   SELECT * FROM webhook_logs
   WHERE tenant_id = 'tenant_abc123'
   ORDER BY created_at DESC
   LIMIT 10;
   ```
3. Start webhook queue worker:
   ```bash
   npm run webhook:queue
   ```

### Database Issues

**Problem:** Database errors

**Solution:**
1. Reset database:
   ```bash
   npm run db:reset
   ```
2. Re-initialize:
   ```bash
   npm run db:init
   ```
3. Restore tenants from backup

## 🔒 Security Best Practices

1. **API Keys**
   - Rotate keys regularly
   - Use different keys for dev/prod
   - Never commit keys to git
   - Store keys in environment variables

2. **Webhook URLs**
   - Use HTTPS only
   - Validate webhook signatures (if implemented)
   - Restrict webhook endpoints to expected IPs

3. **Database**
   - Regular backups of `tenants.db`
   - Encrypt sensitive data at rest
   - Use proper file permissions (600 for db file)

4. **Server**
   - Use reverse proxy (nginx)
   - Enable HTTPS with Let's Encrypt
   - Implement CORS properly
   - Use helmet.js for security headers

## 📚 Additional Resources

- [Complete System Guide](COMPLETE-SYSTEM-GUIDE.md)
- [n8n Workflow Examples](n8n-workflows/README.md)
- [ElevenLabs API Docs](https://elevenlabs.io/docs)
- [n8n Documentation](https://docs.n8n.io/)

## 🤝 Support

For issues or questions:
1. Check troubleshooting section
2. Review logs in console
3. Check webhook logs in database
4. Contact system administrator

## 📄 License

MIT
