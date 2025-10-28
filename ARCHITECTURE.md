# Deckworthy Architecture

## Technology Stack

### Frontend
- **Framework**: Vanilla JavaScript with modern ES6+ features
- **Styling**: Tailwind CSS (via CDN for simplicity)
- **Table Component**: AG-Grid Community (free, powerful data grid)
- **Charts**: Chart.js for price history visualization
- **Build**: No build step initially (can add Vite later if needed)

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js (lightweight, well-documented)
- **Database**: SQLite (production-ready, zero-config, easy migration path to PostgreSQL)
- **ORM**: Better-SQLite3 (faster than async, simpler API)
- **Validation**: Zod (type-safe schema validation)
- **Job Scheduling**: node-cron (for periodic data updates)

### Hosting Recommendations
1. **Recommended: Railway** ($5/month)
   - Full-stack support (frontend + backend + database)
   - Built-in SQLite/PostgreSQL support
   - Automatic deployments from Git
   - Environment variable management

2. **Alternative: Render** (Free tier available)
   - Free tier for web services (spins down after inactivity)
   - Managed PostgreSQL (free tier: 90 days, then $7/month)

3. **Alternative: Fly.io** (Free tier available)
   - $0-5/month depending on usage
   - Good for Docker deployments
   - Global distribution

## Database Schema

### Tables

#### `games`
Stores core game information from Steam.

```sql
CREATE TABLE games (
  steam_app_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  short_description TEXT,
  header_image_url TEXT,
  steam_url TEXT,
  release_date TEXT,
  developers TEXT, -- JSON array
  publishers TEXT, -- JSON array
  genres TEXT, -- JSON array
  tags TEXT, -- JSON array
  is_free BOOLEAN DEFAULT FALSE,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `protondb_ratings`
Stores ProtonDB compatibility ratings for games.

```sql
CREATE TABLE protondb_ratings (
  steam_app_id INTEGER PRIMARY KEY,
  tier TEXT NOT NULL, -- 'platinum', 'gold', 'silver', 'bronze', 'borked', 'pending'
  confidence TEXT, -- 'high', 'medium', 'low'
  score REAL, -- 0-100
  total_reports INTEGER,
  trending_tier TEXT,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (steam_app_id) REFERENCES games(steam_app_id) ON DELETE CASCADE
);
```

#### `price_history`
Stores historical price data from various stores.

```sql
CREATE TABLE price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  steam_app_id INTEGER NOT NULL,
  store TEXT NOT NULL, -- 'steam', 'humble', 'gog', etc.
  price_usd REAL NOT NULL,
  discount_percent INTEGER DEFAULT 0,
  is_on_sale BOOLEAN DEFAULT FALSE,
  sale_end_date TIMESTAMP,
  url TEXT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (steam_app_id) REFERENCES games(steam_app_id) ON DELETE CASCADE
);

CREATE INDEX idx_price_history_game ON price_history(steam_app_id);
CREATE INDEX idx_price_history_recorded ON price_history(recorded_at);
CREATE INDEX idx_price_history_store ON price_history(store);
```

#### `current_prices`
Stores the current best prices for each game (denormalized for performance).

```sql
CREATE TABLE current_prices (
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

CREATE INDEX idx_current_prices_sale ON current_prices(is_on_sale);
```

#### `humble_bundles`
Stores current Humble Bundle deals (requires manual updates or scraping).

```sql
CREATE TABLE humble_bundles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bundle_name TEXT NOT NULL,
  bundle_url TEXT NOT NULL,
  bundle_type TEXT, -- 'bundle', 'choice', 'store'
  end_date TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `humble_bundle_games`
Links games to Humble Bundles.

```sql
CREATE TABLE humble_bundle_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bundle_id INTEGER NOT NULL,
  steam_app_id INTEGER NOT NULL,
  tier TEXT, -- '$1', '$10', '$15', etc.
  FOREIGN KEY (bundle_id) REFERENCES humble_bundles(id) ON DELETE CASCADE,
  FOREIGN KEY (steam_app_id) REFERENCES games(steam_app_id) ON DELETE CASCADE
);

CREATE INDEX idx_humble_bundle_games_bundle ON humble_bundle_games(bundle_id);
CREATE INDEX idx_humble_bundle_games_game ON humble_bundle_games(steam_app_id);
```

#### `data_sync_log`
Tracks when different data sources were last synced.

```sql
CREATE TABLE data_sync_log (
  source TEXT PRIMARY KEY, -- 'protondb', 'steam', 'itad', 'humble'
  last_sync_at TIMESTAMP NOT NULL,
  status TEXT, -- 'success', 'failed'
  error_message TEXT,
  records_updated INTEGER DEFAULT 0
);
```

## API Integration Strategy

### ProtonDB API
- **Endpoint**: `https://www.protondb.com/api/v1/reports/summaries/{appId}.json`
- **Rate Limit**: Unknown (be conservative)
- **Update Frequency**: Daily for popular games, weekly for others
- **Data Cached**: Tier, confidence, score, total reports

### IsThereAnyDeal API
- **Documentation**: https://docs.isthereanydeal.com/
- **Requires**: Free API key registration
- **Rate Limit**: Generous (1000 requests/minute)
- **Update Frequency**: Every 6-12 hours for price data
- **Endpoints**:
  - `/v01/game/prices/` - Current prices across stores
  - `/v01/game/info/` - Game metadata
  - `/v01/game/history/` - Price history

### Steam Web API
- **Requires**: Free API key from https://steamcommunity.com/dev/apikey
- **Rate Limit**: 100,000 requests/day
- **Endpoints**:
  - `ISteamApps/GetAppList/v2/` - Full game list
  - `IStoreService/GetAppDetails/v1/` - Game details
  - `ISteamApps/GetAppDetails/v1/` - App details (store page data)
- **Update Frequency**: Weekly for game metadata

### Humble Bundle
- **No Public API**: Requires web scraping or manual data entry
- **Strategy**: Manual admin interface to add current bundles
- **Scraping Option**: Puppeteer/Cheerio to parse bundle pages (fragile)

## Backend API Endpoints

### GET `/api/games`
Returns paginated, filtered, and sorted game list with current prices and ratings.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 50, max: 100)
- `sort_by` (name, price, discount, proton_tier, release_date)
- `sort_order` (asc, desc)
- `proton_tier` (comma-separated: platinum,gold,silver)
- `min_price`, `max_price`
- `min_discount` (percentage)
- `on_sale` (boolean)
- `search` (game name search)

**Response:**
```json
{
  "games": [...],
  "total": 1234,
  "page": 1,
  "limit": 50
}
```

### GET `/api/games/:steamAppId`
Returns detailed information for a single game.

**Response:**
```json
{
  "game": {...},
  "protondb": {...},
  "current_prices": [...],
  "humble_bundles": [...]
}
```

### GET `/api/games/:steamAppId/price-history`
Returns price history for a game.

**Query Parameters:**
- `days` (default: 90)
- `store` (optional filter)

### GET `/api/bundles/active`
Returns currently active Humble Bundles with their games.

### POST `/api/admin/sync/:source`
Triggers a manual sync for a data source (admin only).

## Frontend Architecture

### Pages
1. **Main Dashboard** (`/` or `/index.html`)
   - Game table with all filters
   - Sidebar with filter controls
   - Quick stats (total games, avg discount, etc.)

2. **Game Detail** (`/game.html?id=:steamAppId`)
   - Full game information
   - Price history chart
   - ProtonDB reports summary
   - Available deals across stores

### Components
- `GameTable` - Main data grid with AG-Grid
- `FilterPanel` - Filter controls
- `PriceChart` - Chart.js price history
- `ProtonBadge` - Visual tier indicator
- `DealAlert` - Highlight exceptional deals

## Development Workflow

### Initial Setup
```bash
npm init -y
npm install express better-sqlite3 zod node-cron dotenv cors
npm install -D nodemon

# Create directory structure
mkdir -p src/{api,db,services,jobs,utils} public/{css,js,images}
```

### Environment Variables
```env
PORT=3000
DATABASE_PATH=./data/deckworthy.db
STEAM_API_KEY=your_key_here
ITAD_API_KEY=your_key_here
NODE_ENV=development
```

### Running Locally
```bash
npm run dev    # Start with nodemon
npm start      # Production start
```

## Future Enhancements

1. **User Accounts**: Save wishlists, set price alerts
2. **Email Notifications**: Alert users when wishlist games go on sale
3. **Steam Deck Verified**: Include official Valve compatibility ratings
4. **Community Reviews**: User-submitted deck performance notes
5. **Mobile App**: React Native or PWA
6. **GraphQL API**: More flexible querying
7. **PostgreSQL Migration**: When SQLite limits are reached
