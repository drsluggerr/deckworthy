# Deploying Deckworthy to Vercel

This guide will walk you through deploying the Deckworthy application to Vercel using Turso as the database backend.

## Prerequisites

1. A [Vercel](https://vercel.com) account
2. A [Turso](https://turso.tech) account (free tier available)
3. API keys for:
   - [Steam Web API](https://steamcommunity.com/dev/apikey)
   - [IsThereAnyDeal](https://isthereanydeal.com/dev/app/)

## Step 1: Set up Turso Database

Turso is a hosted SQLite database that works perfectly with Vercel's serverless environment.

### Install Turso CLI

```bash
# macOS/Linux
curl -sSfL https://get.tur.so/install.sh | bash

# Windows (PowerShell)
irm https://tur.so/install.ps1 | iex
```

### Create a Database

```bash
# Sign up/login to Turso
turso auth signup  # or 'turso auth login'

# Create a new database
turso db create deckworthy

# Get your database URL
turso db show deckworthy --url

# Create an auth token
turso db tokens create deckworthy
```

**Important:** Save both the database URL and auth token - you'll need them for Vercel environment variables.

### Initialize the Database Schema

You have two options to initialize your Turso database:

#### Option A: Use Turso CLI (Recommended)

```bash
# Create a local schema file
cat > schema.sql << 'EOF'
-- Games table
CREATE TABLE IF NOT EXISTS games (
  steam_app_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  short_description TEXT,
  header_image_url TEXT,
  steam_url TEXT,
  release_date TEXT,
  developers TEXT,
  publishers TEXT,
  genres TEXT,
  tags TEXT,
  is_free BOOLEAN DEFAULT FALSE,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ProtonDB ratings table
CREATE TABLE IF NOT EXISTS protondb_ratings (
  steam_app_id INTEGER PRIMARY KEY,
  tier TEXT NOT NULL,
  confidence TEXT,
  score REAL,
  total_reports INTEGER,
  trending_tier TEXT,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (steam_app_id) REFERENCES games(steam_app_id) ON DELETE CASCADE
);

-- Price history table
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  steam_app_id INTEGER NOT NULL,
  store TEXT NOT NULL,
  price_usd REAL NOT NULL,
  discount_percent INTEGER DEFAULT 0,
  is_on_sale BOOLEAN DEFAULT FALSE,
  sale_end_date TIMESTAMP,
  url TEXT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (steam_app_id) REFERENCES games(steam_app_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_price_history_game ON price_history(steam_app_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded ON price_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_price_history_store ON price_history(store);

-- Current prices table
CREATE TABLE IF NOT EXISTS current_prices (
  steam_app_id INTEGER NOT NULL,
  store TEXT NOT NULL,
  price_usd REAL NOT NULL,
  discount_percent INTEGER DEFAULT 0,
  is_on_sale BOOLEAN DEFAULT FALSE,
  sale_end_date TIMESTAMP,
  url TEXT,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (steam_app_id, store),
  FOREIGN KEY (steam_app_id) REFERENCES games(steam_app_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_current_prices_sale ON current_prices(is_on_sale);

-- Humble Bundles table
CREATE TABLE IF NOT EXISTS humble_bundles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bundle_name TEXT NOT NULL,
  bundle_url TEXT NOT NULL,
  bundle_type TEXT,
  end_date TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bundle items table
CREATE TABLE IF NOT EXISTS bundle_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bundle_id INTEGER NOT NULL,
  steam_app_id INTEGER,
  item_name TEXT NOT NULL,
  FOREIGN KEY (bundle_id) REFERENCES humble_bundles(id) ON DELETE CASCADE,
  FOREIGN KEY (steam_app_id) REFERENCES games(steam_app_id) ON DELETE SET NULL
);

-- Data sync log table
CREATE TABLE IF NOT EXISTS data_sync_log (
  source TEXT PRIMARY KEY,
  last_sync_at TIMESTAMP,
  status TEXT,
  records_updated INTEGER
);

-- Games full view (denormalized for performance)
CREATE VIEW IF NOT EXISTS games_full AS
SELECT
  g.*,
  p.tier as proton_tier,
  p.confidence as proton_confidence,
  p.score as proton_score,
  p.total_reports as proton_reports,
  p.trending_tier as proton_trending,
  GROUP_CONCAT(DISTINCT cp.store || ':' || cp.price_usd || ':' || cp.discount_percent || ':' || cp.is_on_sale) as current_prices_data
FROM games g
LEFT JOIN protondb_ratings p ON g.steam_app_id = p.steam_app_id
LEFT JOIN current_prices cp ON g.steam_app_id = cp.steam_app_id
GROUP BY g.steam_app_id;
EOF

# Apply schema to Turso database
turso db shell deckworthy < schema.sql
```

#### Option B: Run initialization script locally then sync

```bash
# Run the init-db script locally
npm run init-db

# Use Turso to replicate your local database
turso db replicate deckworthy --from-file ./data/deckworthy.db
```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Easiest)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New" → "Project"
3. Import your deckworthy GitHub repository
4. Configure the project:
   - **Framework Preset:** Other
   - **Build Command:** `npm run build`
   - **Output Directory:** Leave default
   - **Install Command:** `npm install`

5. Add Environment Variables (click "Environment Variables"):
   ```
   NODE_ENV=production
   TURSO_DATABASE_URL=libsql://your-database.turso.io
   TURSO_AUTH_TOKEN=your-turso-auth-token
   STEAM_API_KEY=your_steam_api_key
   ITAD_API_KEY=your_itad_api_key
   CORS_ORIGINS=https://your-app.vercel.app
   ```

6. Click "Deploy"

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow the prompts and add environment variables when asked
```

## Step 3: Populate Your Database

After deployment, you need to sync game data. You have two options:

### Option A: Run Sync Jobs Locally (Recommended for first setup)

```bash
# Set up your .env file with Turso credentials
cp .env.example .env

# Edit .env and add:
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
STEAM_API_KEY=your_key
ITAD_API_KEY=your_key

# Run sync jobs
npm run sync-games      # Takes 15-30 minutes for 1000 games
npm run sync-protondb   # Takes 10-20 minutes
npm run sync-prices     # Takes 5-10 minutes
```

### Option B: Use Vercel Cron Jobs (Automatic)

Vercel Pro plans support cron jobs. Add this to your `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-prices",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/sync-protondb",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/sync-games",
      "schedule": "0 3 * * 0"
    }
  ]
}
```

Then create the cron endpoint handlers in `api/cron/` directory.

### Option C: Manual API Triggers

Create manual trigger endpoints:

```bash
# Call these URLs to manually trigger syncs
curl https://your-app.vercel.app/api/admin/sync-games
curl https://your-app.vercel.app/api/admin/sync-protondb
curl https://your-app.vercel.app/api/admin/sync-prices
```

## Step 4: Verify Deployment

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Check the health endpoint: `https://your-app.vercel.app/api/health`
3. Test the API: `https://your-app.vercel.app/api/games?limit=10`

## Configuration

### Environment Variables

Required environment variables for Vercel:

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `TURSO_DATABASE_URL` | Turso database URL | `turso db show deckworthy --url` |
| `TURSO_AUTH_TOKEN` | Turso authentication token | `turso db tokens create deckworthy` |
| `STEAM_API_KEY` | Steam Web API key | https://steamcommunity.com/dev/apikey |
| `ITAD_API_KEY` | IsThereAnyDeal API key | https://isthereanydeal.com/dev/app/ |
| `NODE_ENV` | Environment (set to `production`) | Manual |
| `CORS_ORIGINS` | Allowed CORS origins | Your Vercel domain |

### Custom Domain

1. Go to your Vercel project settings
2. Click "Domains"
3. Add your custom domain
4. Update `CORS_ORIGINS` environment variable with your custom domain

## Troubleshooting

### Database Connection Issues

```bash
# Test Turso connection locally
turso db shell deckworthy

# Check database logs
turso db inspect deckworthy
```

### Deployment Fails

- Check Vercel build logs for errors
- Ensure all environment variables are set correctly
- Verify TypeScript builds locally: `npm run build`

### API Returns 500 Errors

- Check Vercel function logs in the dashboard
- Verify Turso database is accessible
- Check that schema is initialized properly

### Empty Game List

- Run sync jobs to populate data
- Check `data_sync_log` table: `SELECT * FROM data_sync_log;`
- Verify API keys are correct

## Costs

- **Vercel:** Free hobby plan includes:
  - 100GB bandwidth/month
  - 100GB-hrs serverless function execution
  - Automatic HTTPS

- **Turso:** Free plan includes:
  - 9 GB total storage
  - 1B row reads/month
  - 25M row writes/month

## Performance Optimization

### Enable Caching

Add caching headers to API responses:

```typescript
res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
```

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_games_name ON games(name);
CREATE INDEX idx_protondb_tier ON protondb_ratings(tier);
```

### Use Edge Functions

For better global performance, configure edge runtime in your API functions:

```typescript
export const config = {
  runtime: 'edge',
};
```

## Monitoring

- **Vercel Analytics:** Enable in project settings for traffic insights
- **Turso Metrics:** View in Turso dashboard for database performance
- **Logs:** Check Vercel function logs for errors

## Next Steps

1. Set up automated backups for your Turso database
2. Implement cron jobs for automatic data synchronization
3. Add monitoring and alerting
4. Set up a custom domain
5. Enable Vercel Analytics

## Support

- Vercel Docs: https://vercel.com/docs
- Turso Docs: https://docs.turso.tech
- GitHub Issues: Create an issue in your repository

## Additional Resources

- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Turso Quickstart](https://docs.turso.tech/quickstart)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
