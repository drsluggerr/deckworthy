# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Deckworthy is a web application that aggregates game compatibility and pricing data for Steam Deck users. It combines ProtonDB ratings, Steam game data, and multi-store price tracking to help users find the best deals on compatible games.

**Tech Stack**: TypeScript, Node.js, Express, SQLite (better-sqlite3), Vanilla JavaScript frontend with AG-Grid

## Common Development Commands

### Building and Running
```bash
npm run dev              # Development mode with hot reload (uses tsx)
npm run build            # Compile TypeScript to dist/
npm start                # Production mode (run compiled code)
npm run type-check       # Type check without emitting files
npm run clean            # Remove dist/ directory
```

### Database Operations
```bash
npm run init-db          # Initialize database schema
```

### Data Synchronization
```bash
npm run sync-games       # Sync top 1000 Steam games
npm run sync-protondb    # Sync ProtonDB compatibility ratings
npm run sync-prices      # Sync current prices from IsThereAnyDeal
```

To sync a limited number of games (useful for testing):
```bash
tsx src/jobs/sync-games.ts 100
tsx src/jobs/sync-protondb.ts 100
tsx src/jobs/sync-prices.ts 100
```

## Architecture

### Backend Structure
- **`src/index.ts`**: Express server entry point with CORS, static file serving, and API routes
- **`src/api/`**: Route handlers for `/api/games`, `/api/deals`, and `/api/stats`
- **`src/db/`**: Database layer
  - `connection.ts`: Singleton database connection with SQLite WAL mode
  - `init.ts`: Schema initialization script
  - `repositories/`: Data access layer (protondb, bundles, etc.)
- **`src/services/`**: External API integrations (Steam, ProtonDB, IsThereAnyDeal)
- **`src/jobs/`**: Sync scripts and cron scheduler
- **`src/types/`**: TypeScript type definitions for models and API responses
- **`src/utils/`**: Shared utilities (HTTP client with rate limiting)

### Frontend Structure
- **`public/index.html`**: Main SPA with AG-Grid table
- **`public/js/app.js`**: Vanilla JavaScript for data fetching, filtering, and AG-Grid setup
- **`public/css/style.css`**: Custom styles (Tailwind loaded via CDN)

### Database Schema
SQLite database with the following key tables:
- **`games`**: Steam game metadata (name, description, developers, etc.)
- **`protondb_ratings`**: Steam Deck compatibility tiers (platinum/gold/silver/bronze/borked)
- **`current_prices`**: Latest prices from multiple stores
- **`price_history`**: Historical price data
- **`humble_bundles`** + **`humble_bundle_games`**: Bundle tracking
- **`data_sync_log`**: Tracks last sync timestamps for each data source
- **`games_full`** (view): Joins games with ratings and prices for efficient querying

### External API Integration
1. **Steam Web API**: Fetches game list and detailed metadata (requires `STEAM_API_KEY`)
2. **ProtonDB API**: Fetches Steam Deck compatibility ratings (public, rate-limited)
3. **IsThereAnyDeal API v3**: Fetches multi-store price data (requires `ITAD_API_KEY`)

All services use a custom rate limiter (`src/utils/http.ts`) to respect API limits.

## Key Implementation Details

### Boolean Handling in SQLite
SQLite doesn't have native boolean types. The codebase stores booleans as integers (0/1) but expects JavaScript booleans in TypeScript interfaces. When querying:
- **Reading**: SQLite returns 0/1, which JavaScript treats as truthy/falsy
- **Writing**: Use `? 1 : 0` or handle conversion explicitly

See recent commit "Migrate ITAD API to v3 and fix SQLite boolean handling" for reference.

### Rate Limiting
`RateLimiter` class in `src/utils/http.ts` implements a queue-based rate limiter for API calls:
- ProtonDB: 10 requests/minute (conservative, undocumented limits)
- IsThereAnyDeal: 1000 requests/minute (documented)
- Steam: 100,000 requests/day (handled at application level)

### Scheduled Jobs
`src/jobs/scheduler.ts` uses node-cron to run periodic syncs:
- Prices: Every 6 hours (configurable via `SYNC_PRICES_SCHEDULE`)
- ProtonDB: Daily at 2am (configurable via `SYNC_PROTONDB_SCHEDULE`)
- Games: Weekly on Sunday at 3am (configurable via `SYNC_GAMES_SCHEDULE`)

### TypeScript Configuration
- **Module system**: ES2022 with ESM (`.js` extensions required in imports)
- **Strict mode**: Enabled with additional strict flags (`noUnusedLocals`, `noImplicitReturns`, etc.)
- **Output**: Compiled to `dist/` directory
- Always use `.js` extensions when importing TypeScript files (e.g., `import foo from './foo.js'`)

## Environment Variables

Required in `.env`:
```env
STEAM_API_KEY=          # Get from steamcommunity.com/dev/apikey
ITAD_API_KEY=           # Get from isthereanydeal.com/dev/app/

# Optional
PORT=3000
NODE_ENV=development
DATABASE_PATH=./data/deckworthy.db
CORS_ORIGINS=http://localhost:3000
SYNC_PRICES_SCHEDULE="0 */6 * * *"
SYNC_PROTONDB_SCHEDULE="0 2 * * *"
SYNC_GAMES_SCHEDULE="0 3 * * 0"
```

## Development Workflow

### Initial Setup
1. `npm install`
2. Copy `.env.example` to `.env` and add API keys
3. `npm run init-db` to create database
4. Run sync jobs to populate data (see commands above)
5. `npm run dev` to start development server

### Making Changes

**Backend**:
- API routes go in `src/api/`
- Business logic in `src/services/`
- Database queries in `src/db/repositories/`
- Always update TypeScript types in `src/types/` when changing data structures

**Frontend**:
- Edit `public/js/app.js` for UI logic
- Edit `public/css/style.css` for styling
- No build step required (can add Vite later if needed)

**Database**:
- Schema changes go in `src/db/init.ts`
- Test with `rm data/deckworthy.db && npm run init-db`
- Repository classes handle all SQL queries

### Testing Data Syncs
Start with small datasets to avoid rate limits:
```bash
tsx src/jobs/sync-games.ts 10
tsx src/jobs/sync-protondb.ts 10
tsx src/jobs/sync-prices.ts 10
```

## Important Notes

- **Git branch**: Main branch is `main`
- **License**: GNU General Public License v3.0
- **Import extensions**: Always use `.js` extensions in imports, even for `.ts` files (TypeScript ESM requirement)
- **Database location**: `data/deckworthy.db` (gitignored)
- **API versioning**: IsThereAnyDeal recently migrated from v2 to v3 (see commit 29f26c7)
- **Deployment**: Configured for Railway (`railway.json`) and Render (`render.yaml`)
