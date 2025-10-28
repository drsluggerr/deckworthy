import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_PATH = process.env.DATABASE_PATH || join(__dirname, '../../data/deckworthy.db');

// Ensure data directory exists
const dataDir = dirname(DATABASE_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Create database connection
const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL'); // Better performance for concurrent reads/writes
db.pragma('foreign_keys = ON');  // Enable foreign key constraints

console.log('Initializing database schema...');

// Create tables
db.exec(`
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

  -- Current prices table (denormalized for performance)
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

  -- Humble Bundle games junction table
  CREATE TABLE IF NOT EXISTS humble_bundle_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bundle_id INTEGER NOT NULL,
    steam_app_id INTEGER NOT NULL,
    tier TEXT,
    FOREIGN KEY (bundle_id) REFERENCES humble_bundles(id) ON DELETE CASCADE,
    FOREIGN KEY (steam_app_id) REFERENCES games(steam_app_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_humble_bundle_games_bundle ON humble_bundle_games(bundle_id);
  CREATE INDEX IF NOT EXISTS idx_humble_bundle_games_game ON humble_bundle_games(steam_app_id);

  -- Data sync log table
  CREATE TABLE IF NOT EXISTS data_sync_log (
    source TEXT PRIMARY KEY,
    last_sync_at TIMESTAMP NOT NULL,
    status TEXT,
    error_message TEXT,
    records_updated INTEGER DEFAULT 0
  );

  -- Create a view for easy querying of games with all their data
  CREATE VIEW IF NOT EXISTS games_full AS
  SELECT
    g.*,
    p.tier as proton_tier,
    p.confidence as proton_confidence,
    p.score as proton_score,
    p.total_reports as proton_reports,
    (SELECT MIN(price_usd) FROM current_prices WHERE steam_app_id = g.steam_app_id) as min_price,
    (SELECT MAX(discount_percent) FROM current_prices WHERE steam_app_id = g.steam_app_id) as max_discount,
    (SELECT COUNT(*) FROM current_prices WHERE steam_app_id = g.steam_app_id AND is_on_sale = TRUE) as active_sales
  FROM games g
  LEFT JOIN protondb_ratings p ON g.steam_app_id = p.steam_app_id;
`);

console.log('Database schema initialized successfully!');
console.log(`Database location: ${DATABASE_PATH}`);

// Close the connection
db.close();

export { DATABASE_PATH };
