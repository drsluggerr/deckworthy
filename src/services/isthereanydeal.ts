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
const STEAM_SHOP_ID = 61; // Steam's shop ID in ITAD

// ITAD allows 1000 requests per minute
const rateLimiter = new RateLimiter(900, 60000); // 900 requests per minute (leave buffer)

/**
 * Convert Steam App ID to ITAD shop identifier (for lookup)
 * ITAD uses a format like "app/123456" for Steam games
 */
function steamAppIdToShopId(steamAppId: number): string {
  return `app/${steamAppId}`;
}

/**
 * Lookup ITAD game IDs (UUIDs) from Steam App IDs
 * New API requires UUIDs instead of plain identifiers
 */
async function lookupGameIds(steamAppIds: number[]): Promise<Map<number, string>> {
  const shopIds = steamAppIds.map(steamAppIdToShopId);

  // Lookup endpoint doesn't require authentication
  const url = `${ITAD_API_BASE}/lookup/id/shop/${STEAM_SHOP_ID}/v1`;

  try {
    const data = await rateLimiter.execute(() =>
      fetchJson<Record<string, string | null>>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shopIds),
        retries: 2,
        timeout: 10000
      })
    );

    // Map Steam App IDs to ITAD UUIDs
    const idMap = new Map<number, string>();
    steamAppIds.forEach(appId => {
      const shopId = steamAppIdToShopId(appId);
      const uuid = data[shopId];
      if (uuid) {
        idMap.set(appId, uuid);
      }
    });

    return idMap;
  } catch (error) {
    console.error('Error looking up game IDs:', (error as Error).message);
    return new Map();
  }
}

/**
 * Get current prices for a game from multiple stores
 */
export async function fetchGamePrices(steamAppId: number): Promise<Price[]> {
  if (!ITAD_API_KEY) {
    throw new Error('ITAD_API_KEY not configured');
  }

  try {
    // Step 1: Lookup the ITAD UUID for this Steam App ID
    const idMap = await lookupGameIds([steamAppId]);
    const gameId = idMap.get(steamAppId);

    if (!gameId) {
      console.log(`No ITAD game ID found for Steam App ${steamAppId}`);
      return [];
    }

    // Step 2: Fetch prices using the UUID
    const url = `${ITAD_API_BASE}/games/prices/v3?key=${ITAD_API_KEY}&country=US`;

    const data = await rateLimiter.execute(() =>
      fetchJson<any[]>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([gameId]),
        retries: 2,
        timeout: 10000
      })
    );

    if (!data || data.length === 0 || !data[0]?.deals) {
      return [];
    }

    const gameData = data[0];

    // Transform ITAD data to our price format
    const prices: Price[] = gameData.deals.map((deal: any) => {
      const oldPrice = deal.regular?.amount || deal.price.amount;
      const newPrice = deal.price.amount;
      const discountPercent = oldPrice > 0 ? Math.round(((oldPrice - newPrice) / oldPrice) * 100) : 0;

      return {
        steam_app_id: steamAppId,
        store: deal.shop.name.toLowerCase(),
        price_usd: newPrice,
        discount_percent: discountPercent,
        is_on_sale: deal.cut > 0 ? 1 : 0,
        sale_end_date: null, // v3 API doesn't include end date in the same format
        url: null // v3 API doesn't include direct URL
      };
    });

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

  console.log('Looking up ITAD game IDs...');

  // Step 1: Lookup all ITAD UUIDs for the Steam App IDs in batches
  const lookupBatchSize = 500; // ITAD supports up to 500 per lookup
  const idMap = new Map<number, string>();

  for (let i = 0; i < steamAppIds.length; i += lookupBatchSize) {
    const batch = steamAppIds.slice(i, i + lookupBatchSize);
    const batchMap = await lookupGameIds(batch);
    batchMap.forEach((uuid, appId) => idMap.set(appId, uuid));
    console.log(`Looked up ${i + batch.length}/${steamAppIds.length} games`);
  }

  console.log(`Found ${idMap.size}/${steamAppIds.length} games in ITAD`);

  if (idMap.size === 0) {
    return [];
  }

  // Step 2: Fetch prices in batches (API supports up to 200 games per request)
  const pricesBatchSize = 200;
  const allPrices: Price[] = [];
  const gameIds = Array.from(idMap.values());
  const appIdsByGameId = new Map<string, number>();
  idMap.forEach((uuid, appId) => appIdsByGameId.set(uuid, appId));

  for (let i = 0; i < gameIds.length; i += pricesBatchSize) {
    const batch = gameIds.slice(i, i + pricesBatchSize);

    try {
      const url = `${ITAD_API_BASE}/games/prices/v3?key=${encodeURIComponent(ITAD_API_KEY || '')}&country=US`;

      const data = await rateLimiter.execute(() =>
        fetchJson<any[]>(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
          retries: 2,
          timeout: 30000
        })
      );

      if (!data || !Array.isArray(data)) continue;

      // Process each game's prices
      data.forEach(gameData => {
        if (!gameData?.id || !gameData?.deals) return;

        const steamAppId = appIdsByGameId.get(gameData.id);
        if (!steamAppId) return;

        gameData.deals.forEach((deal: any) => {
          const oldPrice = deal.regular?.amount || deal.price.amount;
          const newPrice = deal.price.amount;
          const discountPercent = oldPrice > 0 ? Math.round(((oldPrice - newPrice) / oldPrice) * 100) : 0;

          allPrices.push({
            steam_app_id: steamAppId,
            store: deal.shop.name.toLowerCase(),
            price_usd: newPrice,
            discount_percent: discountPercent,
            is_on_sale: deal.cut > 0 ? 1 : 0,
            sale_end_date: null, // v3 API doesn't include end date in the same format
            url: null // v3 API doesn't include direct URL
          });
        });
      });

      console.log(`Processed prices batch ${Math.floor(i / pricesBatchSize) + 1}/${Math.ceil(gameIds.length / pricesBatchSize)}`);
    } catch (error) {
      console.error(`Error fetching prices batch starting at ${i}:`, (error as Error).message);
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
 * Note: History endpoint is not yet migrated to v3 API
 * This function may need updates when ITAD releases the v3 history endpoint
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
    // Lookup the ITAD UUID first
    const idMap = await lookupGameIds([steamAppId]);
    const gameId = idMap.get(steamAppId);

    if (!gameId) {
      console.log(`No ITAD game ID found for Steam App ${steamAppId}`);
      return [];
    }

    // Note: The history endpoint may still be on v01 or might have a v2/v3 version
    // Check ITAD docs for the current version
    console.warn('Price history endpoint may need verification for correct API version');
    return [];
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
