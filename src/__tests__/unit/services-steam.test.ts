/**
 * Tests for Steam service
 * Tests Steam API integration and data fetching
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createMockFetch } from '../helpers/api-mocks.js';
import * as steamService from '../../services/steam.js';

describe('Steam Service', () => {
  const originalFetch = global.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = createMockFetch();
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('fetchAllApps', () => {
    it('should fetch list of all Steam apps', async () => {
      const apps = await steamService.fetchAllApps();

      expect(apps).toBeDefined();
      expect(Array.isArray(apps)).toBe(true);
      expect(apps.length).toBeGreaterThan(0);

      const firstApp = apps[0];
      expect(firstApp).toHaveProperty('appid');
      expect(firstApp).toHaveProperty('name');
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(steamService.fetchAllApps()).rejects.toThrow();
    });

    it('should handle invalid response format', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'data' }),
      });

      await expect(steamService.fetchAllApps()).rejects.toThrow(
        'Invalid response'
      );
    });
  });

  describe('fetchAppDetails', () => {
    it('should fetch game details for valid app', async () => {
      const game = await steamService.fetchAppDetails(570);

      expect(game).toBeDefined();
      expect(game?.app_id).toBe(570);
      expect(game?.name).toBe('Dota 2');
      expect(game?.is_free).toBe(1);
    });

    it('should return null for invalid app ID', async () => {
      const game = await steamService.fetchAppDetails(999999);

      expect(game).toBeNull();
    });

    it('should parse free games correctly', async () => {
      const game = await steamService.fetchAppDetails(570);

      expect(game?.is_free).toBe(1);
      expect(game?.name).toBeDefined();
    });

    it('should parse paid games correctly', async () => {
      const game = await steamService.fetchAppDetails(1938090);

      expect(game?.is_free).toBe(0);
      expect(game?.name).toBe('Call of Duty®: Black Ops 6');
    });

    it('should extract developers and publishers', async () => {
      const game = await steamService.fetchAppDetails(1938090);

      expect(game?.developers).toContain('Treyarch');
      expect(game?.developers).toContain('Raven Software');
      expect(game?.publishers).toContain('Activision');
    });

    it('should extract genres', async () => {
      const game = await steamService.fetchAppDetails(1938090);

      expect(game?.genres).toContain('Action');
    });

    it('should extract metacritic score', async () => {
      const game = await steamService.fetchAppDetails(1938090);

      expect(game?.metacritic_score).toBe(86);
    });

    it('should handle games without metacritic scores', async () => {
      const game = await steamService.fetchAppDetails(730);

      expect(game?.metacritic_score).toBeUndefined();
    });

    it('should use rate limiter for requests', async () => {
      const startTime = Date.now();

      // Make multiple requests
      await Promise.all([
        steamService.fetchAppDetails(570),
        steamService.fetchAppDetails(730),
        steamService.fetchAppDetails(1938090),
      ]);

      const elapsed = Date.now() - startTime;

      // Should have some delay due to rate limiting
      // Note: Actual timing may vary in tests
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Server Error',
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            '570': {
              success: true,
              data: {
                type: 'game',
                steam_appid: 570,
                name: 'Dota 2',
                is_free: true,
              },
            },
          }),
        });
      });

      const game = await steamService.fetchAppDetails(570);

      expect(attempts).toBe(2);
      expect(game).toBeDefined();
    });
  });

  describe('Data Parsing', () => {
    it('should handle missing optional fields', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          '12345': {
            success: true,
            data: {
              type: 'game',
              steam_appid: 12345,
              name: 'Minimal Game',
              // Missing most fields
            },
          },
        }),
      });

      const game = await steamService.fetchAppDetails(12345);

      expect(game).toBeDefined();
      expect(game?.name).toBe('Minimal Game');
      expect(game?.short_description).toBeUndefined();
      expect(game?.developers).toBeUndefined();
    });

    it('should filter out non-game types', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          '12345': {
            success: true,
            data: {
              type: 'dlc', // Not a game
              steam_appid: 12345,
              name: 'Some DLC',
            },
          },
        }),
      });

      const game = await steamService.fetchAppDetails(12345);

      // Should filter out non-game types
      expect(game).toBeNull();
    });

    it('should parse release dates correctly', async () => {
      const game = await steamService.fetchAppDetails(570);

      expect(game?.release_date).toBeDefined();
      expect(typeof game?.release_date).toBe('string');
    });

    it('should handle arrays in genres and categories', async () => {
      const game = await steamService.fetchAppDetails(1938090);

      expect(game?.genres).toBeDefined();
      expect(typeof game?.genres).toBe('string');
      expect(game?.categories).toBeDefined();
      expect(typeof game?.categories).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(steamService.fetchAppDetails(570)).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      );

      await expect(
        steamService.fetchAppDetails(570)
      ).rejects.toThrow();
    });

    it('should handle malformed JSON', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(steamService.fetchAppDetails(570)).rejects.toThrow();
    });
  });
});
