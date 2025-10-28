import { fetchJson, RateLimiter } from '../utils/http.js';
import pricesRepo from '../db/repositories/prices.js';
import getDb from '../db/connection.js';
import dotenv from 'dotenv';
import type {
  Price,
  SyncResult,
  ITADPriceResponse
} from '../types/index.js';

dotenv.config();

const ITAD_API_KEY = process.env.ITAD_API_KEY;
const ITAD_API_BASE = 'https://api.isthereanydeal.com';

// ITAD allows 1000 requests per minute
const rateLimiter = new RateLimiter(900, 60000); // 900 requests per minute (leave buffer)

/**
 * Convert Steam App ID to ITAD plain ID
 * ITAD uses a format like "app/123456" for Steam games
 */
function steamAppIdToItadPlain(steamAppId: number): string {
  return `app/${steamAppId}`;
}

/**
 * Get current prices for a game from multiple stores
 */
export async function fetchGamePrices(steamAppId: number): Promise<Price[]> {
  if (!ITAD_API_KEY) {
    throw new Error('ITAD_API_KEY not configured');
  }

  try {
    const plain = steamAppIdToItadPlain(steamAppId);
    const url = `${ITAD_API_BASE}/v01/game/prices/`;

    const params = new URLSearchParams({
      key: ITAD_API_KEY,
      plains: plain,
      region: 'us',
      country: 'US',
      shops: 'steam,gog,epic,humble' // Can add more stores
    });

    const data = await rateLimiter.execute(() =>
      fetchJson<ITADPriceResponse>(`${url}?${params}`, { retries: 2, timeout: 10000 })
    );

    if (!data?.data?.[plain]?.list) {
      return [];
    }

    // Transform ITAD data to our price format
    const prices: Price[] = data.data[plain].list.map(deal => ({
      steam_app_id: steamAppId,
      store: deal.shop.name.toLowerCase(),
      price_usd: deal.price_new,
      discount_percent: Math.round(((deal.price_old - deal.price_new) / deal.price_old) * 100),
      is_on_sale: deal.price_cut > 0,
      sale_end_date: deal.price_cut_end ? new Date(deal.price_cut_end * 1000).toISOString() : null,
      url: deal.url
    }));

    return prices;
  } catch (error) {
    console.error(`Error fetching prices for ${steamAppId}:`, (error as Error).message);
    return [];
  }
}

/**
 * Fetch prices for multiple games (batch request)
 */
export async function fetchMultipleGamePrices(steamAppIds: number[]): Promise<Price[]> {
  if (!ITAD_API_KEY) {
    throw new Error('ITAD_API_KEY not configured');
  }

  // ITAD supports up to 500 games per request, but let's use smaller batches
  const batchSize = 100;
  const allPrices: Price[] = [];

  for (let i = 0; i < steamAppIds.length; i += batchSize) {
    const batch = steamAppIds.slice(i, i + batchSize);
    const plains = batch.map(steamAppIdToItadPlain).join(',');

    try {
      const url = `${ITAD_API_BASE}/v01/game/prices/`;

      const params = new URLSearchParams({
        key: ITAD_API_KEY,
        plains,
        region: 'us',
        country: 'US',
        shops: 'steam,gog,epic,humble'
      });

      const data = await rateLimiter.execute(() =>
        fetchJson<ITADPriceResponse>(`${url}?${params}`, { retries: 2, timeout: 30000 })
      );

      if (!data?.data) continue;

      // Process each game's prices
      Object.entries(data.data).forEach(([plain, gameData]) => {
        const steamAppId = parseInt(plain.replace('app/', ''));

        if (!gameData.list) return;

        gameData.list.forEach(deal => {
          allPrices.push({
            steam_app_id: steamAppId,
            store: deal.shop.name.toLowerCase(),
            price_usd: deal.price_new,
            discount_percent: Math.round(((deal.price_old - deal.price_new) / deal.price_old) * 100),
            is_on_sale: deal.price_cut > 0,
            sale_end_date: deal.price_cut_end ? new Date(deal.price_cut_end * 1000).toISOString() : null,
            url: deal.url
          });
        });
      });

      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(steamAppIds.length / batchSize)}`);
    } catch (error) {
      console.error(`Error fetching batch starting at ${i}:`, (error as Error).message);
    }
  }

  return allPrices;
}

interface HistoryOptions {
  shops?: string;
  since?: Date | null;
}

/**
 * Get price history for a game
 */
export async function fetchPriceHistory(
  steamAppId: number,
  options: HistoryOptions = {}
): Promise<any[]> {
  const { shops = 'steam', since = null } = options;

  if (!ITAD_API_KEY) {
    throw new Error('ITAD_API_KEY not configured');
  }

  try {
    const plain = steamAppIdToItadPlain(steamAppId);
    const url = `${ITAD_API_BASE}/v01/game/history/`;

    const params = new URLSearchParams({
      key: ITAD_API_KEY,
      plain,
      shops,
      region: 'us',
      country: 'US'
    });

    if (since) {
      params.append('since', Math.floor(since.getTime() / 1000).toString());
    }

    const data = await rateLimiter.execute(() =>
      fetchJson<any>(`${url}?${params}`, { retries: 2, timeout: 10000 })
    );

    if (!data?.data) {
      return [];
    }

    return data.data;
  } catch (error) {
    console.error(`Error fetching price history for ${steamAppId}:`, (error as Error).message);
    return [];
  }
}

interface SyncOptions {
  limit?: number | null;
}

/**
 * Sync prices for all games in the database
 */
export async function syncAllPrices(options: SyncOptions = {}): Promise<SyncResult> {
  const { limit = null } = options;

  console.log('Starting ITAD price sync...');
  const startTime = Date.now();

  const db = getDb();

  // Get all games
  let query = 'SELECT steam_app_id FROM games';
  if (limit) {
    query += ` LIMIT ${limit}`;
  }

  const games = db.prepare(query).all() as Array<{ steam_app_id: number }>;
  console.log(`Syncing prices for ${games.length} games...`);

  if (games.length === 0) {
    console.log('No games to sync');
    return { success: 0, failed: 0, skipped: 0, duration: 0 };
  }

  const steamAppIds = games.map(g => g.steam_app_id);

  // Fetch prices in batches
  const allPrices = await fetchMultipleGamePrices(steamAppIds);

  // Store prices
  console.log(`Storing ${allPrices.length} price records...`);
  let success = 0;

  try {
    pricesRepo.updateCurrentPrices(allPrices);
    success = allPrices.length;
  } catch (error) {
    console.error('Error storing prices:', (error as Error).message);
  }

  const duration = Date.now() - startTime;
  console.log(
    `Price sync complete: ${success} prices updated ` +
    `in ${(duration / 1000).toFixed(1)}s`
  );

  // Log sync status
  const syncLog = db.prepare(`
    INSERT INTO data_sync_log (source, last_sync_at, status, records_updated)
    VALUES ('itad', datetime('now'), 'success', ?)
    ON CONFLICT(source) DO UPDATE SET
      last_sync_at = datetime('now'),
      status = 'success',
      records_updated = ?
  `);
  syncLog.run(success, success);

  return { success, failed: 0, skipped: 0, duration };
}

export default {
  fetchGamePrices,
  fetchMultipleGamePrices,
  fetchPriceHistory,
  syncAllPrices
};
