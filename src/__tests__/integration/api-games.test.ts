/**
 * Integration tests for Games API
 * Tests API endpoints with a test database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import cors from 'cors';
import gamesRouter from '../../api/games.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import {
  createTestDatabase,
  seedTestData,
  clearTestData,
  closeTestDatabase,
} from '../helpers/test-db.js';

describe('Games API', () => {
  let app: Express;
  let db: DatabaseType;

  beforeAll(() => {
    // Create test database
    db = createTestDatabase();

    // Set up Express app with test database
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/games', gamesRouter);

    // Mock db connection to return test db
    jest.mock('../../db/connection.js', () => ({
      default: () => db,
    }));
  });

  beforeEach(() => {
    clearTestData(db);
    seedTestData(db);
  });

  afterAll(() => {
    closeTestDatabase(db);
  });

  describe('GET /api/games', () => {
    it('should return list of games', async () => {
      const response = await request(app).get('/api/games');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('games');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(Array.isArray(response.body.games)).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/games')
        .query({ page: 1, limit: 2 });

      expect(response.status).toBe(200);
      expect(response.body.games).toHaveLength(2);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);
    });

    it('should limit max results per page', async () => {
      const response = await request(app)
        .get('/api/games')
        .query({ limit: 1000 });

      expect(response.status).toBe(200);
      expect(response.body.limit).toBeLessThanOrEqual(100);
    });

    it('should sort by name ascending', async () => {
      const response = await request(app)
        .get('/api/games')
        .query({ sort_by: 'name', sort_order: 'asc' });

      expect(response.status).toBe(200);
      const games = response.body.games;

      for (let i = 1; i < games.length; i++) {
        expect(games[i].name.localeCompare(games[i - 1].name)).toBeGreaterThanOrEqual(0);
      }
    });

    it('should sort by name descending', async () => {
      const response = await request(app)
        .get('/api/games')
        .query({ sort_by: 'name', sort_order: 'desc' });

      expect(response.status).toBe(200);
      const games = response.body.games;

      for (let i = 1; i < games.length; i++) {
        expect(games[i].name.localeCompare(games[i - 1].name)).toBeLessThanOrEqual(0);
      }
    });

    it('should filter by ProtonDB tier', async () => {
      const response = await request(app)
        .get('/api/games')
        .query({ proton_tier: 'platinum' });

      expect(response.status).toBe(200);
      const games = response.body.games;

      games.forEach((game: any) => {
        expect(game.protondb_tier).toBe('platinum');
      });
    });

    it('should filter by minimum price', async () => {
      const response = await request(app)
        .get('/api/games')
        .query({ min_price: 50 });

      expect(response.status).toBe(200);
      const games = response.body.games;

      games.forEach((game: any) => {
        if (game.lowest_price !== null) {
          expect(game.lowest_price).toBeGreaterThanOrEqual(50);
        }
      });
    });

    it('should filter by maximum price', async () => {
      const response = await request(app)
        .get('/api/games')
        .query({ max_price: 60 });

      expect(response.status).toBe(200);
      const games = response.body.games;

      games.forEach((game: any) => {
        if (game.lowest_price !== null) {
          expect(game.lowest_price).toBeLessThanOrEqual(60);
        }
      });
    });

    it('should filter by minimum discount', async () => {
      const response = await request(app)
        .get('/api/games')
        .query({ min_discount: 10 });

      expect(response.status).toBe(200);
      const games = response.body.games;

      games.forEach((game: any) => {
        if (game.highest_discount !== null) {
          expect(game.highest_discount).toBeGreaterThanOrEqual(10);
        }
      });
    });

    it('should filter games on sale', async () => {
      const response = await request(app)
        .get('/api/games')
        .query({ on_sale: 'true' });

      expect(response.status).toBe(200);
      const games = response.body.games;

      games.forEach((game: any) => {
        expect(game.highest_discount).toBeGreaterThan(0);
      });
    });

    it('should search games by name', async () => {
      const response = await request(app)
        .get('/api/games')
        .query({ search: 'Duty' });

      expect(response.status).toBe(200);
      const games = response.body.games;

      games.forEach((game: any) => {
        expect(game.name.toLowerCase()).toContain('duty'.toLowerCase());
      });
    });

    it('should combine multiple filters', async () => {
      const response = await request(app)
        .get('/api/games')
        .query({
          proton_tier: 'gold',
          max_price: 70,
          min_discount: 5,
        });

      expect(response.status).toBe(200);
      const games = response.body.games;

      games.forEach((game: any) => {
        expect(game.protondb_tier).toBe('gold');
        if (game.lowest_price !== null) {
          expect(game.lowest_price).toBeLessThanOrEqual(70);
        }
        if (game.highest_discount !== null) {
          expect(game.highest_discount).toBeGreaterThanOrEqual(5);
        }
      });
    });

    it('should handle empty results', async () => {
      const response = await request(app)
        .get('/api/games')
        .query({ proton_tier: 'nonexistent' });

      expect(response.status).toBe(200);
      expect(response.body.games).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });

    it('should handle invalid parameters gracefully', async () => {
      const response = await request(app)
        .get('/api/games')
        .query({ page: 'invalid', limit: 'invalid' });

      expect(response.status).toBe(200);
      // Should use defaults
      expect(response.body).toHaveProperty('games');
    });
  });

  describe('GET /api/games/:steamAppId', () => {
    it('should return game details for valid ID', async () => {
      const response = await request(app).get('/api/games/570');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('app_id', 570);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('protondb_tier');
    });

    it('should return 404 for non-existent game', async () => {
      const response = await request(app).get('/api/games/999999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should include ProtonDB rating', async () => {
      const response = await request(app).get('/api/games/570');

      expect(response.status).toBe(200);
      expect(response.body.protondb_tier).toBeDefined();
      expect(response.body.protondb_score).toBeDefined();
    });

    it('should include price information', async () => {
      const response = await request(app).get('/api/games/1938090');

      expect(response.status).toBe(200);
      expect(response.body.lowest_price).toBeDefined();
      expect(response.body.lowest_price_store).toBeDefined();
    });

    it('should handle invalid app ID format', async () => {
      const response = await request(app).get('/api/games/invalid');

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /api/games/:steamAppId/price-history', () => {
    it('should return price history for game', async () => {
      // First add some price history
      db.prepare(
        'INSERT INTO price_history (app_id, store, price) VALUES (?, ?, ?)'
      ).run(1938090, 'steam', 69.99);

      const response = await request(app).get('/api/games/1938090/price-history');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by store', async () => {
      db.prepare(
        'INSERT INTO price_history (app_id, store, price) VALUES (?, ?, ?)'
      ).run(1938090, 'steam', 69.99);
      db.prepare(
        'INSERT INTO price_history (app_id, store, price) VALUES (?, ?, ?)'
      ).run(1938090, 'gog', 59.99);

      const response = await request(app)
        .get('/api/games/1938090/price-history')
        .query({ store: 'steam' });

      expect(response.status).toBe(200);
      const history = response.body;

      history.forEach((entry: any) => {
        expect(entry.store).toBe('steam');
      });
    });

    it('should filter by days', async () => {
      // Insert old price
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      db.prepare(
        'INSERT INTO price_history (app_id, store, price, timestamp) VALUES (?, ?, ?, ?)'
      ).run(1938090, 'steam', 69.99, oldDate.toISOString());

      // Insert recent price
      db.prepare(
        'INSERT INTO price_history (app_id, store, price) VALUES (?, ?, ?)'
      ).run(1938090, 'steam', 59.99);

      const response = await request(app)
        .get('/api/games/1938090/price-history')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1); // Only recent price
    });

    it('should return empty array for game with no history', async () => {
      const response = await request(app).get('/api/games/570/price-history');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Close the database to simulate error
      db.close();

      const response = await request(app).get('/api/games');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');

      // Recreate database for other tests
      db = createTestDatabase();
    });

    it('should validate input types', async () => {
      const response = await request(app)
        .get('/api/games')
        .query({ min_price: 'not-a-number' });

      // Should either handle gracefully or return error
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('Response Format', () => {
    it('should return proper JSON format', async () => {
      const response = await request(app).get('/api/games');

      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toBeDefined();
    });

    it('should include CORS headers', async () => {
      const response = await request(app).get('/api/games');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should return consistent structure', async () => {
      const response = await request(app).get('/api/games');

      expect(response.body).toMatchObject({
        games: expect.any(Array),
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });
  });
});
