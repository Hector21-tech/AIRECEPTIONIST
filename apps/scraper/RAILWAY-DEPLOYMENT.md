# Railway Deployment Guide

## Quick Deploy via Railway Web UI

### Step 1: Create Project
1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose: `Hector21-tech/AIRECEPTIONIST`

### Step 2: Configure Service
**Root Directory:** `apps/scraper`

Railway will automatically detect:
- `railway.toml` for configuration
- `package.json` for dependencies
- Start command: `node scrape-server.js`

### Step 3: Set Environment Variables
In Railway Dashboard → Variables, add:

```bash
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
NODE_ENV=production
```

### Step 4: Deploy
Click "Deploy" - Railway will:
- Install dependencies
- Build the project
- Start the server on port 4001
- Provide a public URL (e.g., `scraper-production-xxxx.up.railway.app`)

### Step 5: Update Vercel
Copy your Railway URL and add it to Vercel:

```bash
# In apps/web directory
vercel env add SCRAPER_SERVICE_URL production
# Paste Railway URL when prompted

# Redeploy
vercel --prod
```

---

## CLI Deployment (Alternative)

```bash
# Login to Railway
railway login

# Initialize project
cd apps/scraper
railway init

# Set environment variables
railway variables set ELEVENLABS_API_KEY=your_key_here

# Deploy
railway up
```

---

## Health Check
Your scraper API includes a health check endpoint:
- `GET /health` → Returns `{"status": "healthy", "timestamp": "..."}`

Railway will automatically monitor this endpoint.

---

## API Endpoints (Production)

```
POST   /api/scrape-url          - Trigger restaurant scraping
GET    /api/restaurant/:slug/info - Get restaurant info + knowledge base ID
GET    /health                  - Health check
```

---

## Logs & Monitoring

View logs in Railway Dashboard or via CLI:
```bash
railway logs
```

---

## Troubleshooting

**Build fails?**
- Check `package.json` dependencies are correct
- Verify Node.js version (≥18.0.0)

**Service crashes?**
- Check environment variables are set
- View logs for error messages
- Verify `/health` endpoint is accessible

**Can't connect from Vercel?**
- Ensure `SCRAPER_SERVICE_URL` is set in Vercel
- Check Railway service is public (not private)
- Verify CORS is enabled in `scrape-server.js`
