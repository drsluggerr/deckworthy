/**
 * Test database utilities
 * Creates in-memory SQLite databases for testing
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * Create a fresh test database with schema
 */
export function createTestDatabase(): DatabaseType {
  const db = new Database(':memory:');

  // Enable WAL mode and foreign keys
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create schema
  initializeSchema(db);

  return db;
}

/**
 * Initialize database schema
 */
function initializeSchema(db: DatabaseType): void {
  // Games table
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      app_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      short_description TEXT,
      header_image TEXT,
      release_date TEXT,
      developers TEXT,
      publishers TEXT,
      genres TEXT,
      categories TEXT,
      is_free INTEGER DEFAULT 0,
      metacritic_score INTEGER,
      steam_rating_percent INTEGER,
      steam_rating_count INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ProtonDB ratings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS protondb_ratings (
      app_id INTEGER PRIMARY KEY,
      tier TEXT NOT NULL,
      confidence TEXT,
      score INTEGER,
      total_reports INTEGER DEFAULT 0,
      trending_tier TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (app_id) REFERENCES games(app_id) ON DELETE CASCADE
    )
  `);

  // Current prices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS current_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      store TEXT NOT NULL,
      price_new REAL,
      price_old REAL,
      price_cut INTEGER DEFAULT 0,
      url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(app_id, store),
      FOREIGN KEY (app_id) REFERENCES games(app_id) ON DELETE CASCADE
    )
  `);

  // Price history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      store TEXT NOT NULL,
      price REAL NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (app_id) REFERENCES games(app_id) ON DELETE CASCADE
    )
  `);

  // Humble bundles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS humble_bundles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bundle games junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS humble_bundle_games (
      bundle_id TEXT NOT NULL,
      app_id INTEGER NOT NULL,
      tier TEXT,
      PRIMARY KEY (bundle_id, app_id),
      FOREIGN KEY (bundle_id) REFERENCES humble_bundles(id) ON DELETE CASCADE,
      FOREIGN KEY (app_id) REFERENCES games(app_id) ON DELETE CASCADE
    )
  `);

  // Data sync log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS data_sync_log (
      sync_type TEXT PRIMARY KEY,
      last_sync_at TEXT NOT NULL,
      status TEXT NOT NULL,
      records_processed INTEGER DEFAULT 0,
      error_message TEXT
    )
  `);

  // Games full view
  db.exec(`
    CREATE VIEW IF NOT EXISTS games_full AS
    SELECT
      g.*,
      p.tier as protondb_tier,
      p.confidence as protondb_confidence,
      p.score as protondb_score,
      p.total_reports as protondb_reports,
      (
        SELECT MIN(price_new)
        FROM current_prices
        WHERE app_id = g.app_id AND price_new > 0
      ) as lowest_price,
      (
        SELECT store
        FROM current_prices
        WHERE app_id = g.app_id AND price_new > 0
        ORDER BY price_new ASC
        LIMIT 1
      ) as lowest_price_store,
      (
        SELECT MAX(price_cut)
        FROM current_prices
        WHERE app_id = g.app_id
      ) as highest_discount
    FROM games g
    LEFT JOIN protondb_ratings p ON g.app_id = p.app_id
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);
    CREATE INDEX IF NOT EXISTS idx_protondb_tier ON protondb_ratings(tier);
    CREATE INDEX IF NOT EXISTS idx_prices_app_id ON current_prices(app_id);
    CREATE INDEX IF NOT EXISTS idx_prices_store ON current_prices(store);
    CREATE INDEX IF NOT EXISTS idx_price_history_app_id ON price_history(app_id);
  `);
}

/**
 * Seed test data into database
 */
export function seedTestData(db: DatabaseType): void {
  // Insert test games
  const insertGame = db.prepare(`
    INSERT INTO games (
      app_id, name, short_description, header_image, release_date,
      developers, publishers, genres, categories, is_free,
      metacritic_score, steam_rating_percent, steam_rating_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertGame.run(
    570, 'Dota 2', 'Multiplayer MOBA', 'https://example.com/dota2.jpg', '2013-07-09',
    'Valve', 'Valve', 'Action,Strategy', 'Multiplayer,Free to Play', 1,
    null, 95, 1000000
  );

  insertGame.run(
    730, 'Counter-Strike 2', 'FPS Game', 'https://example.com/cs2.jpg', '2023-09-27',
    'Valve', 'Valve', 'Action,FPS', 'Multiplayer,Competitive', 1,
    null, 92, 500000
  );

  insertGame.run(
    1938090, 'Call of Duty: Black Ops 6', 'First-person shooter', 'https://example.com/cod.jpg', '2024-10-25',
    'Treyarch,Raven Software', 'Activision', 'Action,FPS', 'Multiplayer,Single-player', 0,
    86, 88, 50000
  );

  // Insert ProtonDB ratings
  const insertRating = db.prepare(`
    INSERT INTO protondb_ratings (app_id, tier, confidence, score, total_reports)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertRating.run(570, 'platinum', 'high', 95, 5000);
  insertRating.run(730, 'native', 'high', 100, 8000);
  insertRating.run(1938090, 'gold', 'medium', 85, 1500);

  // Insert current prices
  const insertPrice = db.prepare(`
    INSERT INTO current_prices (app_id, store, price_new, price_old, price_cut, url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertPrice.run(1938090, 'steam', 69.99, 69.99, 0, 'https://store.steampowered.com/app/1938090');
  insertPrice.run(1938090, 'gog', 59.99, 69.99, 14, 'https://gog.com/game/cod_bo6');
  insertPrice.run(1938090, 'epic', 64.99, 69.99, 7, 'https://store.epicgames.com/cod');

  // Insert sync log
  const insertSync = db.prepare(`
    INSERT INTO data_sync_log (sync_type, last_sync_at, status, records_processed)
    VALUES (?, ?, ?, ?)
  `);

  insertSync.run('games', new Date().toISOString(), 'success', 3);
  insertSync.run('protondb', new Date().toISOString(), 'success', 3);
  insertSync.run('prices', new Date().toISOString(), 'success', 3);
}

/**
 * Clear all data from database
 */
export function clearTestData(db: DatabaseType): void {
  db.exec('DELETE FROM price_history');
  db.exec('DELETE FROM current_prices');
  db.exec('DELETE FROM humble_bundle_games');
  db.exec('DELETE FROM humble_bundles');
  db.exec('DELETE FROM protondb_ratings');
  db.exec('DELETE FROM games');
  db.exec('DELETE FROM data_sync_log');
}

/**
 * Close and cleanup database
 */
export function closeTestDatabase(db: DatabaseType): void {
  db.close();
}
