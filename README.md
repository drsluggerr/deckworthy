# Deckworthy

A web application that aggregates game compatibility and pricing data for Steam Deck users. Track ProtonDB ratings, compare prices across stores, and find the best deals on Steam Deck compatible games.

## Features

- **Game Database**: Browse thousands of Steam games with detailed information
- **ProtonDB Integration**: See Steam Deck compatibility ratings for each game
- **Price Tracking**: Compare current prices from Steam, GOG, Epic, Humble, and more
- **Price History**: Track price changes over time
- **Advanced Filtering**: Filter by ProtonDB tier, price range, discount percentage, and more
- **Sortable Table**: Sort games by name, price, discount, or compatibility
- **Deal Alerts**: Easily spot the best deals with discount badges
- **Humble Bundle Tracking**: See which games are currently in Humble Bundles

## Tech Stack

- **Frontend**: HTML, CSS (Tailwind), JavaScript, AG-Grid
- **Backend**: Node.js, Express, TypeScript
- **Database**: SQLite (with easy migration to PostgreSQL)
- **APIs**:
  - ProtonDB API (compatibility data)
  - IsThereAnyDeal API (price tracking)
  - Steam Web API (game details)

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- API keys (free):
  - Steam Web API key: https://steamcommunity.com/dev/apikey
  - IsThereAnyDeal API key: https://isthereanydeal.com/dev/app/

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
STEAM_API_KEY=your_steam_api_key_here
ITAD_API_KEY=your_isthereanydeal_api_key_here
```

### 3. Initialize Database

```bash
npm run init-db
```

### 4. Sync Initial Data

This will take some time (15-30 minutes for 1000 games):

```bash
# Sync top 1000 Steam games
npm run sync-games

# Sync ProtonDB ratings
npm run sync-protondb

# Sync current prices
npm run sync-prices
```

You can also sync fewer games for testing:

```bash
# Sync just 100 games
node src/jobs/sync-games.js 100
```

### 5. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The app will be available at http://localhost:3000

## Project Structure

```
deckworthy/
├── src/
│   ├── api/              # Express route handlers
│   │   ├── games.js      # Game endpoints
│   │   ├── deals.js      # Deals & bundles endpoints
│   │   └── stats.js      # Statistics endpoints
│   ├── db/               # Database layer
│   │   ├── connection.js # Database connection
│   │   ├── init.js       # Schema initialization
│   │   └── repositories/ # Data access layer
│   ├── services/         # External API integrations
│   │   ├── steam.js      # Steam API service
│   │   ├── protondb.js   # ProtonDB API service
│   │   └── isthereanydeal.js # ITAD API service
│   ├── jobs/             # Scheduled sync jobs
│   │   ├── sync-games.js
│   │   ├── sync-protondb.js
│   │   ├── sync-prices.js
│   │   └── scheduler.js  # Cron scheduler
│   ├── utils/            # Utility functions
│   └── index.js          # Express server
├── public/               # Frontend files
│   ├── index.html        # Main page
│   ├── css/
│   │   └── style.css     # Custom styles
│   └── js/
│       └── app.js        # Frontend logic
├── data/                 # SQLite database (gitignored)
└── .env                  # Environment config (gitignored)
```

## API Endpoints

### Games

- `GET /api/games` - Get paginated, filtered, sorted game list
  - Query params: `page`, `limit`, `sort_by`, `sort_order`, `proton_tier`, `min_price`, `max_price`, `min_discount`, `on_sale`, `search`
- `GET /api/games/:steamAppId` - Get detailed game info
- `GET /api/games/:steamAppId/price-history` - Get price history

### Deals

- `GET /api/deals/best` - Get best current deals
- `GET /api/deals/active-sales` - Get all active sales
- `GET /api/deals/bundles` - Get active Humble Bundles
- `GET /api/deals/bundles/:bundleId` - Get specific bundle

### Stats

- `GET /api/stats` - Get overall statistics

### Health

- `GET /health` - Health check endpoint

## Data Synchronization

### Manual Sync

Run sync jobs manually:

```bash
npm run sync-games      # Sync Steam games
npm run sync-protondb   # Sync ProtonDB ratings
npm run sync-prices     # Sync prices from ITAD
```

### Automatic Sync (Scheduled)

The app includes a scheduler that runs sync jobs automatically:

- **Prices**: Every 6 hours (configurable)
- **ProtonDB**: Daily at 2am (configurable)
- **Games**: Weekly on Sunday at 3am (configurable)

Configure schedules in `.env`:

```env
SYNC_PRICES_SCHEDULE="0 */6 * * *"
SYNC_PROTONDB_SCHEDULE="0 2 * * *"
SYNC_GAMES_SCHEDULE="0 3 * * 0"
```

## Deployment

### Vercel (Recommended for Serverless)

This application is optimized for Vercel deployment with Turso (hosted SQLite) as the database.

**Quick Deploy:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/deckworthy)

**Manual Setup:**

See the comprehensive [Vercel Deployment Guide](./VERCEL_DEPLOYMENT.md) for detailed instructions including:
- Setting up Turso database
- Configuring environment variables
- Deploying to Vercel
- Populating game data

### Railway

1. Create a new project on [Railway](https://railway.app/)
2. Connect your GitHub repository
3. Add environment variables in the Railway dashboard
4. Deploy!

### Other Platforms

The app can be deployed to:
- **Render**: Use the Docker deployment option
- **Fly.io**: Create a `fly.toml` configuration
- **Any VPS**: Just run `npm start`
- **Kubernetes**: See `kubernetes-archive` branch for K8s manifests

### Environment Variables for Production

Required:
- `STEAM_API_KEY`
- `ITAD_API_KEY`
- `DATABASE_PATH` (if not using default)
- `NODE_ENV=production`

Optional:
- `PORT` (default: 3000)
- `CORS_ORIGINS` (comma-separated)

## Development

### Running Tests

```bash
# TODO: Add tests
npm test
```

### Database Management

Reset database:

```bash
rm data/deckworthy.db
npm run init-db
```

Backup database:

```bash
cp data/deckworthy.db data/deckworthy-backup.db
```

### Adding New Features

1. Backend changes: Add routes in `src/api/`, services in `src/services/`
2. Frontend changes: Edit `public/index.html`, `public/js/app.js`
3. Database changes: Update `src/db/init.js` schema

## Roadmap

- [ ] User accounts and wishlists
- [ ] Email price alerts
- [ ] Steam Deck Verified badge integration
- [ ] Historical price charts with Chart.js
- [ ] Game detail modal with reviews
- [ ] Export to CSV
- [ ] Mobile app (React Native)
- [ ] PostgreSQL support for scalability
- [ ] Humble Bundle scraping automation
- [ ] More store integrations (Fanatical, GamersGate, etc.)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Credits

- Game data from [Steam](https://store.steampowered.com/)
- Compatibility data from [ProtonDB](https://www.protondb.com/)
- Price data from [IsThereAnyDeal](https://isthereanydeal.com/)
- Built with [AG-Grid](https://www.ag-grid.com/)

## Support

For issues or questions, please open an issue on GitHub.
