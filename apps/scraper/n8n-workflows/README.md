# n8n Workflow Examples

This directory contains example n8n workflows for integrating with the Restaurant Scraper multitenant system.

## 📋 Available Workflows

### 1. **scrape-to-slack.json**
Receive webhook events from the scraper and send notifications to Slack.

**Features:**
- ✅ Success notifications for completed scrapes
- ❌ Alert notifications for failed scrapes
- 📊 Detailed scrape statistics

**Setup:**
1. Import workflow to n8n
2. Configure Slack credentials
3. Copy webhook URL and set as `webhook_url` for tenant

### 2. **scheduled-scrape.json**
Automatically trigger scraping on a schedule (daily at 6 AM).

**Features:**
- ⏰ Cron-based scheduling
- 🔄 Automatic scrape-all trigger
- 📬 Slack notifications for results

**Setup:**
1. Import workflow to n8n
2. Configure HTTP Request node with your API URL
3. Add API key credential
4. Adjust schedule as needed

### 3. **webhook-to-database.json**
Complete workflow: receive webhooks, store in database, and notify.

**Features:**
- 💾 Store all events in PostgreSQL
- 🔄 Update restaurant status on completion
- 🔗 Fetch ElevenLabs document info
- 📧 Email alerts on failures
- 💬 Tenant-specific Slack notifications

**Setup:**
1. Import workflow to n8n
2. Configure PostgreSQL credentials
3. Configure Slack and Email credentials
4. Set ElevenLabs API key
5. Copy webhook URL to tenant config

## 🚀 Getting Started

### Prerequisites
- n8n instance (self-hosted or cloud)
- Restaurant Scraper API running
- Slack workspace (optional)
- PostgreSQL database (optional)

### Quick Setup

1. **Create Tenant in Scraper System:**
```bash
node src/tenant/cli.js tenant create "My Company" "contact@company.com" --webhook=https://your-n8n.com/webhook/scraper-events
```

2. **Import Workflow to n8n:**
- Open n8n
- Go to Workflows → Import from File
- Select one of the JSON files
- Configure credentials

3. **Link Restaurant to Tenant:**
```bash
node src/tenant/cli.js restaurant link <tenant-id> <restaurant-slug>
```

4. **Test the Integration:**
```bash
# Trigger a scrape
curl -X POST https://your-api.com/api/restaurants/torstens-angelholm/scrape \\
  -H "X-API-Key: rsk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"syncToElevenLabs": true}'
```

## 📊 Webhook Event Types

The scraper system sends these webhook events:

| Event | Description | Payload |
|-------|-------------|---------|
| `scrape_started` | Scraping begins | `restaurant_name`, `restaurant_city`, `base_url` |
| `scrape_completed` | Scraping successful | `pages_scraped`, `knowledge_items`, `synced_to_elevenlabs` |
| `scrape_failed` | Scraping failed | `error` |
| `sync_started` | ElevenLabs sync begins | `restaurant_name`, `restaurant_city` |
| `sync_completed` | ElevenLabs sync successful | `document_id`, `action` |
| `sync_failed` | ElevenLabs sync failed | `error` |
| `webhook_test` | Test webhook | `message` |

## 🔐 Webhook Payload Format

All webhooks follow this structure:

```json
{
  "event": "scrape_completed",
  "tenant_id": "tenant_abc123",
  "tenant_name": "My Company",
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

## 🛠️ Customization

### Modify Slack Channels
Edit the `channel` parameter in Slack nodes:
```javascript
"channel": "#your-custom-channel"
```

### Change Schedule
Edit cron expression in Schedule Trigger:
```javascript
"expression": "0 6 * * *"  // Daily at 6 AM
"expression": "0 */4 * * *"  // Every 4 hours
"expression": "0 0 * * 0"  // Weekly on Sunday
```

### Add Custom Logic
You can add nodes for:
- **Discord notifications** - Use HTTP Request or Discord node
- **Google Sheets logging** - Use Google Sheets node
- **Custom API calls** - Use HTTP Request node
- **Data transformation** - Use Function or Code nodes

## 📝 Database Schema (for webhook-to-database.json)

```sql
-- Events table
CREATE TABLE scraper_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  tenant_id VARCHAR(100) NOT NULL,
  restaurant_slug VARCHAR(100),
  data JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restaurants table
CREATE TABLE restaurants (
  slug VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  city VARCHAR(100),
  last_scraped_at TIMESTAMP,
  knowledge_items INTEGER,
  elevenlabs_document_id VARCHAR(100),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_events_tenant ON scraper_events(tenant_id);
CREATE INDEX idx_events_type ON scraper_events(event_type);
CREATE INDEX idx_events_timestamp ON scraper_events(timestamp);
```

## 🔍 Troubleshooting

### Webhook Not Received
1. Check webhook URL is correctly set in tenant config
2. Verify n8n webhook node is active
3. Test webhook manually:
```bash
curl -X POST https://your-n8n.com/webhook/scraper-events \\
  -H "Content-Type: application/json" \\
  -d '{"event": "webhook_test", "message": "test"}'
```

### Authentication Errors
1. Verify API key is active: `node src/tenant/cli.js apikey validate <key>`
2. Check API key has correct permissions
3. Ensure X-API-Key header is set correctly

### Database Connection Issues
1. Verify PostgreSQL credentials in n8n
2. Check database server is accessible
3. Confirm tables exist (run schema SQL)

## 📚 Resources

- [n8n Documentation](https://docs.n8n.io/)
- [Restaurant Scraper API Docs](../COMPLETE-SYSTEM-GUIDE.md)
- [Webhook Manager](../src/tenant/webhook-manager.js)

## 💡 Example Use Cases

### 1. Multi-Tenant SaaS Platform
```
Platform → n8n → Trigger Scrape → Store Results → Notify Customer
```

### 2. Restaurant Chain Management
```
Cron Schedule → Scrape All Locations → Sync to ElevenLabs → Update Dashboard
```

### 3. Quality Assurance
```
Scrape Completed → Validate Data → Run Tests → Alert if Issues
```

### 4. Analytics Pipeline
```
Webhook → Store in DB → Run Analytics → Generate Reports → Email Summary
```

## 🤝 Contributing

To add new workflow examples:
1. Create workflow in n8n
2. Export as JSON
3. Add to this directory
4. Update this README with description

## 📄 License

MIT
