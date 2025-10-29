/**
 * Tests for database layer
 * Tests database operations, repositories, and data integrity
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { Database as DatabaseType } from 'better-sqlite3';
import {
  createTestDatabase,
  seedTestData,
  clearTestData,
  closeTestDatabase,
} from '../helpers/test-db.js';

describe('Database Schema', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    closeTestDatabase(db);
  });

  it('should create all required tables', () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all() as Array<{ name: string }>;

    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('games');
    expect(tableNames).toContain('protondb_ratings');
    expect(tableNames).toContain('current_prices');
    expect(tableNames).toContain('price_history');
    expect(tableNames).toContain('humble_bundles');
    expect(tableNames).toContain('humble_bundle_games');
    expect(tableNames).toContain('data_sync_log');
  });

  it('should create games_full view', () => {
    const views = db
      .prepare("SELECT name FROM sqlite_master WHERE type='view'")
      .all() as Array<{ name: string }>;

    const viewNames = views.map(v => v.name);
    expect(viewNames).toContain('games_full');
  });

  it('should have proper foreign key relationships', () => {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Insert a game
    const insertGame = db.prepare(
      'INSERT INTO games (app_id, name) VALUES (?, ?)'
    );
    insertGame.run(12345, 'Test Game');

    // Insert ProtonDB rating with valid foreign key
    const insertRating = db.prepare(
      'INSERT INTO protondb_ratings (app_id, tier) VALUES (?, ?)'
    );
    insertRating.run(12345, 'gold');

    // Try to insert rating with invalid foreign key
    expect(() => {
      insertRating.run(99999, 'gold');
    }).toThrow();

    // Delete game should cascade
    db.prepare('DELETE FROM games WHERE app_id = ?').run(12345);

    const rating = db
      .prepare('SELECT * FROM protondb_ratings WHERE app_id = ?')
      .get(12345);

    expect(rating).toBeUndefined();
  });

  it('should create proper indexes', () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index'")
      .all() as Array<{ name: string }>;

    const indexNames = indexes.map(i => i.name);

    expect(indexNames).toContain('idx_games_name');
    expect(indexNames).toContain('idx_protondb_tier');
    expect(indexNames).toContain('idx_prices_app_id');
  });
});

describe('Database Operations', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    closeTestDatabase(db);
  });

  describe('Games Table', () => {
    it('should insert a game successfully', () => {
      const stmt = db.prepare(`
        INSERT INTO games (app_id, name, short_description, is_free)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(12345, 'Test Game', 'A test game', 0);

      expect(result.changes).toBe(1);

      const game = db
        .prepare('SELECT * FROM games WHERE app_id = ?')
        .get(12345) as any;

      expect(game).toBeDefined();
      expect(game.name).toBe('Test Game');
      expect(game.short_description).toBe('A test game');
      expect(game.is_free).toBe(0);
    });

    it('should handle duplicate app_id correctly', () => {
      const stmt = db.prepare(
        'INSERT INTO games (app_id, name) VALUES (?, ?)'
      );

      stmt.run(12345, 'Test Game 1');

      // Try to insert duplicate
      expect(() => {
        stmt.run(12345, 'Test Game 2');
      }).toThrow();
    });

    it('should update game information', () => {
      db.prepare('INSERT INTO games (app_id, name) VALUES (?, ?)').run(
        12345,
        'Test Game'
      );

      db.prepare('UPDATE games SET name = ? WHERE app_id = ?').run(
        'Updated Game',
        12345
      );

      const game = db
        .prepare('SELECT * FROM games WHERE app_id = ?')
        .get(12345) as any;

      expect(game.name).toBe('Updated Game');
    });

    it('should search games by name', () => {
      db.prepare('INSERT INTO games (app_id, name) VALUES (?, ?)').run(
        1,
        'Counter-Strike 2'
      );
      db.prepare('INSERT INTO games (app_id, name) VALUES (?, ?)').run(
        2,
        'Call of Duty'
      );
      db.prepare('INSERT INTO games (app_id, name) VALUES (?, ?)').run(
        3,
        'Dota 2'
      );

      const games = db
        .prepare("SELECT * FROM games WHERE name LIKE ? ORDER BY name")
        .all('%Counter%') as any[];

      expect(games).toHaveLength(1);
      expect(games[0].name).toBe('Counter-Strike 2');
    });
  });

  describe('ProtonDB Ratings', () => {
    beforeEach(() => {
      // Insert test games
      db.prepare('INSERT INTO games (app_id, name) VALUES (?, ?)').run(
        570,
        'Dota 2'
      );
      db.prepare('INSERT INTO games (app_id, name) VALUES (?, ?)').run(
        730,
        'CS2'
      );
    });

    it('should insert ProtonDB rating', () => {
      const stmt = db.prepare(`
        INSERT INTO protondb_ratings (app_id, tier, confidence, score, total_reports)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(570, 'platinum', 'high', 95, 5000);

      expect(result.changes).toBe(1);

      const rating = db
        .prepare('SELECT * FROM protondb_ratings WHERE app_id = ?')
        .get(570) as any;

      expect(rating.tier).toBe('platinum');
      expect(rating.confidence).toBe('high');
      expect(rating.score).toBe(95);
    });

    it('should upsert ratings correctly', () => {
      const upsert = db.prepare(`
        INSERT INTO protondb_ratings (app_id, tier, score)
        VALUES (?, ?, ?)
        ON CONFLICT(app_id) DO UPDATE SET
          tier = excluded.tier,
          score = excluded.score
      `);

      // First insert
      upsert.run(570, 'gold', 85);

      let rating = db
        .prepare('SELECT * FROM protondb_ratings WHERE app_id = ?')
        .get(570) as any;
      expect(rating.tier).toBe('gold');
      expect(rating.score).toBe(85);

      // Update
      upsert.run(570, 'platinum', 95);

      rating = db
        .prepare('SELECT * FROM protondb_ratings WHERE app_id = ?')
        .get(570) as any;
      expect(rating.tier).toBe('platinum');
      expect(rating.score).toBe(95);
    });

    it('should get rating statistics by tier', () => {
      db.prepare(
        'INSERT INTO protondb_ratings (app_id, tier, score) VALUES (?, ?, ?)'
      ).run(570, 'platinum', 95);
      db.prepare(
        'INSERT INTO protondb_ratings (app_id, tier, score) VALUES (?, ?, ?)'
      ).run(730, 'gold', 85);

      const stats = db.prepare(`
        SELECT tier, COUNT(*) as count, AVG(score) as avg_score
        FROM protondb_ratings
        GROUP BY tier
      `).all() as any[];

      expect(stats).toHaveLength(2);
      expect(stats.find((s: any) => s.tier === 'platinum')?.count).toBe(1);
      expect(stats.find((s: any) => s.tier === 'gold')?.count).toBe(1);
    });
  });

  describe('Prices', () => {
    beforeEach(() => {
      db.prepare('INSERT INTO games (app_id, name) VALUES (?, ?)').run(
        12345,
        'Test Game'
      );
    });

    it('should insert current price', () => {
      const stmt = db.prepare(`
        INSERT INTO current_prices (app_id, store, price_new, price_old, price_cut, url)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        12345,
        'steam',
        59.99,
        69.99,
        14,
        'https://store.steampowered.com/app/12345'
      );

      expect(result.changes).toBe(1);

      const price = db
        .prepare('SELECT * FROM current_prices WHERE app_id = ? AND store = ?')
        .get(12345, 'steam') as any;

      expect(price.price_new).toBe(59.99);
      expect(price.price_cut).toBe(14);
    });

    it('should handle unique constraint on app_id + store', () => {
      const stmt = db.prepare(
        'INSERT INTO current_prices (app_id, store, price_new) VALUES (?, ?, ?)'
      );

      stmt.run(12345, 'steam', 59.99);

      // Try to insert duplicate
      expect(() => {
        stmt.run(12345, 'steam', 49.99);
      }).toThrow();
    });

    it('should find lowest price across stores', () => {
      const stmt = db.prepare(
        'INSERT INTO current_prices (app_id, store, price_new) VALUES (?, ?, ?)'
      );

      stmt.run(12345, 'steam', 59.99);
      stmt.run(12345, 'gog', 49.99);
      stmt.run(12345, 'epic', 54.99);

      const lowestPrice = db
        .prepare(
          'SELECT MIN(price_new) as lowest_price FROM current_prices WHERE app_id = ?'
        )
        .get(12345) as any;

      expect(lowestPrice.lowest_price).toBe(49.99);
    });

    it('should insert price history', () => {
      const stmt = db.prepare(`
        INSERT INTO price_history (app_id, store, price)
        VALUES (?, ?, ?)
      `);

      stmt.run(12345, 'steam', 69.99);
      stmt.run(12345, 'steam', 59.99);
      stmt.run(12345, 'steam', 49.99);

      const history = db
        .prepare(
          'SELECT * FROM price_history WHERE app_id = ? ORDER BY timestamp DESC'
        )
        .all(12345) as any[];

      expect(history).toHaveLength(3);
      expect(history[0].price).toBe(49.99); // Most recent
    });
  });

  describe('Games Full View', () => {
    it('should join games with ratings and prices', () => {
      // Insert game
      db.prepare(
        'INSERT INTO games (app_id, name, is_free) VALUES (?, ?, ?)'
      ).run(12345, 'Test Game', 0);

      // Insert rating
      db.prepare(
        'INSERT INTO protondb_ratings (app_id, tier, score) VALUES (?, ?, ?)'
      ).run(12345, 'gold', 85);

      // Insert prices
      db.prepare(
        'INSERT INTO current_prices (app_id, store, price_new) VALUES (?, ?, ?)'
      ).run(12345, 'steam', 59.99);
      db.prepare(
        'INSERT INTO current_prices (app_id, store, price_new) VALUES (?, ?, ?)'
      ).run(12345, 'gog', 49.99);

      const game = db
        .prepare('SELECT * FROM games_full WHERE app_id = ?')
        .get(12345) as any;

      expect(game.name).toBe('Test Game');
      expect(game.protondb_tier).toBe('gold');
      expect(game.protondb_score).toBe(85);
      expect(game.lowest_price).toBe(49.99);
      expect(game.lowest_price_store).toBe('gog');
    });
  });

  describe('Transactions', () => {
    it('should rollback on error', () => {
      const transaction = db.transaction(() => {
        db.prepare('INSERT INTO games (app_id, name) VALUES (?, ?)').run(
          12345,
          'Test Game'
        );
        db.prepare('INSERT INTO games (app_id, name) VALUES (?, ?)').run(
          67890,
          'Test Game 2'
        );
        // Intentional error - duplicate key
        db.prepare('INSERT INTO games (app_id, name) VALUES (?, ?)').run(
          12345,
          'Duplicate'
        );
      });

      expect(() => transaction()).toThrow();

      // Both inserts should be rolled back
      const games = db.prepare('SELECT COUNT(*) as count FROM games').get() as any;
      expect(games.count).toBe(0);
    });

    it('should commit all changes on success', () => {
      const transaction = db.transaction(() => {
        db.prepare('INSERT INTO games (app_id, name) VALUES (?, ?)').run(
          12345,
          'Game 1'
        );
        db.prepare('INSERT INTO games (app_id, name) VALUES (?, ?)').run(
          67890,
          'Game 2'
        );
      });

      transaction();

      const games = db.prepare('SELECT COUNT(*) as count FROM games').get() as any;
      expect(games.count).toBe(2);
    });
  });
});

describe('Database Seeding', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    closeTestDatabase(db);
  });

  it('should seed test data correctly', () => {
    seedTestData(db);

    const games = db.prepare('SELECT COUNT(*) as count FROM games').get() as any;
    const ratings = db.prepare('SELECT COUNT(*) as count FROM protondb_ratings').get() as any;
    const prices = db.prepare('SELECT COUNT(*) as count FROM current_prices').get() as any;

    expect(games.count).toBeGreaterThan(0);
    expect(ratings.count).toBeGreaterThan(0);
    expect(prices.count).toBeGreaterThan(0);
  });

  it('should clear test data correctly', () => {
    seedTestData(db);
    clearTestData(db);

    const games = db.prepare('SELECT COUNT(*) as count FROM games').get() as any;
    const ratings = db.prepare('SELECT COUNT(*) as count FROM protondb_ratings').get() as any;
    const prices = db.prepare('SELECT COUNT(*) as count FROM current_prices').get() as any;

    expect(games.count).toBe(0);
    expect(ratings.count).toBe(0);
    expect(prices.count).toBe(0);
  });
});
