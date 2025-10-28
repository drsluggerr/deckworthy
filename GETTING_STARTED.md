# Getting Started with Deckworthy

This guide will walk you through setting up and running Deckworthy locally.

## Step-by-Step Setup

### 1. Get API Keys

Before you begin, you'll need to obtain free API keys:

#### Steam Web API Key

1. Go to https://steamcommunity.com/dev/apikey
2. Log in with your Steam account
3. Enter a domain name (can be anything for development, e.g., "localhost")
4. Copy your API key

#### IsThereAnyDeal API Key

1. Go to https://isthereanydeal.com/
2. Sign up for a free account
3. Go to https://isthereanydeal.com/dev/app/
4. Create a new application
5. Copy your API key

### 2. Clone and Install

```bash
# Navigate to project directory
cd deckworthy

# Install dependencies
npm install
```

This will install:
- express (web server)
- better-sqlite3 (database)
- node-cron (scheduled jobs)
- typescript (type safety)
- tsx (TypeScript execution)
- and other dependencies

### 3. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env
```

Open `.env` in your text editor and add your API keys:

```env
PORT=3000
NODE_ENV=development
DATABASE_PATH=./data/deckworthy.db

# Add your API keys here
STEAM_API_KEY=YOUR_STEAM_KEY_HERE
ITAD_API_KEY=YOUR_ITAD_KEY_HERE

# Leave these as default for now
SYNC_PRICES_SCHEDULE="0 */6 * * *"
SYNC_PROTONDB_SCHEDULE="0 2 * * *"
SYNC_GAMES_SCHEDULE="0 3 * * 0"
CORS_ORIGINS=http://localhost:3000
```

### 4. Initialize the Database

```bash
npm run init-db
```

You should see:
```
Initializing database schema...
Database schema initialized successfully!
Database location: ./data/deckworthy.db
```

### 5. Sync Game Data

Now we need to populate the database with games. This is the most time-consuming step.

#### Option A: Quick Start (100 games, ~5 minutes)

Perfect for testing:

```bash
node src/jobs/sync-games.js 100
```

#### Option B: Full Start (1000 games, ~20-30 minutes)

Recommended for actual use:

```bash
npm run sync-games
```

The script will:
- Fetch the list of all Steam games
- Get detailed info for the top 1000 games (by Steam App ID)
- Save them to the database
- Show progress every 10 games

**Note**: Steam rate limits may slow this down. Be patient!

### 6. Sync ProtonDB Ratings

Once you have games, sync their Steam Deck compatibility ratings:

```bash
# For all games in database
npm run sync-protondb

# Or for just 100 games
node src/jobs/sync-protondb.js 100
```

This is usually faster than the game sync (~5-10 minutes for 100 games).

### 7. Sync Prices

Finally, get current prices for all games:

```bash
# For all games
npm run sync-prices

# Or for just 100 games
node src/jobs/sync-prices.js 100
```

IsThereAnyDeal has generous rate limits, so this is quite fast (~2-3 minutes for 100 games).

### 8. Start the Server

```bash
# Development mode (TypeScript, auto-reloads on code changes)
npm run dev

# Or build and run production mode
npm run build
npm start
```

You should see:

```
╔═══════════════════════════════════════════╗
║         Deckworthy Server Started         ║
╚═══════════════════════════════════════════╝

🚀 Server running on: http://localhost:3000
📊 API endpoints:     http://localhost:3000/api
💚 Health check:      http://localhost:3000/health

Press Ctrl+C to stop the server

📦 Database connected: 100 games loaded
```

### 9. Open the App

Open your browser and go to http://localhost:3000

You should see:
- A stats bar showing total games, active sales, etc.
- A filter sidebar
- A table of games with ProtonDB ratings and prices

## Troubleshooting

### "Database connection error"

Run `npm run init-db` to create the database.

### "No games loaded"

Run the sync scripts in order:
1. `npm run sync-games`
2. `npm run sync-protondb`
3. `npm run sync-prices`

### "ITAD_API_KEY not configured"

Make sure you've added your IsThereAnyDeal API key to the `.env` file.

### "Rate limited by Steam"

The Steam API has rate limits. If you see this error, the script will automatically wait 60 seconds and retry. Be patient!

### Port 3000 already in use

Change the `PORT` in your `.env` file:

```env
PORT=3001
```

### Games showing but no prices

Make sure you ran `npm run sync-prices` after syncing games.

## Next Steps

### Keep Data Updated

Run sync jobs periodically to keep data fresh:

```bash
# Update prices (do this most often)
npm run sync-prices

# Update ProtonDB ratings (weekly)
npm run sync-protondb

# Add new games (monthly)
npm run sync-games
```

### Add More Games

To add more games beyond the initial 1000:

```bash
# Sync top 2000 games
node src/jobs/sync-games.js 2000
```

### Customize Appearance

Edit `public/css/style.css` to change colors, fonts, etc.

### Add Custom Features

- Backend: Add routes in `src/api/`
- Frontend: Edit `public/js/app.js`
- Database: Update `src/db/repositories/`

## Maintaining Your Instance

### Database Cleanup

Remove old price history (keeps last 365 days):

```javascript
// Run in Node REPL or create a script
import pricesRepo from './src/db/repositories/prices.js';
pricesRepo.cleanOldHistory(365);
```

### Backup

```bash
# Create a backup
cp data/deckworthy.db backups/deckworthy-$(date +%Y%m%d).db
```

### Reset Everything

```bash
# Delete database
rm data/deckworthy.db

# Re-initialize
npm run init-db

# Re-sync data
npm run sync-games
npm run sync-protondb
npm run sync-prices
```

## Need Help?

- Check the main [README.md](README.md) for more details
- Look at the [ARCHITECTURE.md](ARCHITECTURE.md) for technical details
- Open an issue on GitHub

Happy deal hunting! 🎮
