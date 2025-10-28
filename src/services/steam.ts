import { fetchJson, RateLimiter, sleep } from '../utils/http.js';
import gamesRepo from '../db/repositories/games.js';
import getDb from '../db/connection.js';
import dotenv from 'dotenv';
import type {
  GameInsert,
  SteamApp,
  SteamAppListResponse,
  SteamAppDetailsResponse,
  SyncResult,
  SyncProgress
} from '../types/index.js';

dotenv.config();

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const STEAM_API_BASE = 'https://api.steampowered.com';
const STEAM_STORE_API = 'https://store.steampowered.com/api';

// Steam allows 100,000 requests/day, so ~1 per second is safe
const rateLimiter = new RateLimiter(50, 60000); // 50 requests per minute

/**
 * Get the full list of Steam apps
 */
export async function fetchAllApps(): Promise<SteamApp[]> {
  try {
    const url = `${STEAM_API_BASE}/ISteamApps/GetAppList/v2/`;
    const data = await fetchJson<SteamAppListResponse>(url);

    if (!data?.applist?.apps) {
      throw new Error('Invalid response from Steam API');
    }

    return data.applist.apps;
  } catch (error) {
    console.error('Error fetching Steam app list:', (error as Error).message);
    throw error;
  }
}

/**
 * Get detailed information about a specific app from the Steam Store API
 */
export async function fetchAppDetails(steamAppId: number): Promise<GameInsert | null> {
  try {
    const url = `${STEAM_STORE_API}/appdetails?appids=${steamAppId}&cc=us`;

    const data = await rateLimiter.execute(() =>
      fetchJson<SteamAppDetailsResponse>(url, { retries: 2, timeout: 10000 })
    );

    const appData = data[steamAppId];
    if (!appData || !appData.success || !appData.data) {
      return null;
    }

    const gameData = appData.data;

    // Only include actual games (type: 'game')
    if (gameData.type !== 'game') {
      return null;
    }

    return {
      steam_app_id: steamAppId,
      name: gameData.name,
      short_description: gameData.short_description || null,
      header_image_url: gameData.header_image || null,
      steam_url: `https://store.steampowered.com/app/${steamAppId}`,
      release_date: gameData.release_date?.date || null,
      developers: gameData.developers || [],
      publishers: gameData.publishers || [],
      genres: gameData.genres?.map(g => g.description) || [],
      tags: [], // Tags would require scraping or separate API
      is_free: gameData.is_free || false
    };
  } catch (error) {
    const err = error as Error;
    // 429 = rate limited, should back off
    if (err.message.includes('429')) {
      console.warn('Rate limited by Steam, waiting 60s...');
      await sleep(60000);
      return fetchAppDetails(steamAppId); // Retry
    }

    console.error(`Error fetching details for app ${steamAppId}:`, err.message);
    return null;
  }
}

/**
 * Fetch and store game details for multiple games
 */
export async function fetchAndStoreGames(
  steamAppIds: number[],
  onProgress: ((progress: SyncProgress) => void) | null = null
): Promise<SyncResult> {
  const results: SyncResult = {
    success: 0,
    failed: 0,
    skipped: 0
  };

  for (let i = 0; i < steamAppIds.length; i++) {
    const steamAppId = steamAppIds[i];
    if (steamAppId === undefined) continue;

    try {
      const gameDetails = await fetchAppDetails(steamAppId);

      if (gameDetails) {
        console.log(gameDetails)
        gamesRepo.upsertGame(gameDetails);
        results.success++;
      } else {
        console.debug("Skipped")
        results.skipped++;
      }

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: steamAppIds.length,
          steamAppId,
          status: gameDetails ? 'success' : 'skipped'
        });
      }

      // Be nice to Steam's servers
      await sleep(1000);
    } catch (error) {
      results.failed++;
      console.error(`Failed to process game ${steamAppId}:`, (error as Error).message);
    }
  }

  return results;
}

interface SyncOptions {
  limit?: number;
}

/**
 * Sync popular Steam games (top N by app ID, which roughly correlates with popularity)
 */
export async function syncPopularGames(options: SyncOptions = {}): Promise<SyncResult> {
  const {
    limit =  2000 // Start with top 1000 games
  } = options;

  console.log(`Starting Steam sync for ${limit} popular games...`);
  const startTime = Date.now();

  // Get list of all Steam apps
  console.log('Fetching Steam app list...');
  const allApps = await fetchAllApps();
  console.log(`Found ${allApps.length} total Steam apps`);

  // Sort by app ID (lower IDs are generally older/more popular games)
  // Filter out non-game apps (rough heuristic: app IDs > 1000000 are often DLC/tools)
  const games = allApps
    .filter(app => app.appid < 1000000)
    .sort((a, b) => a.appid - b.appid)
    .slice(0, limit);

  console.log(`Processing ${games.length} games...`);

  const results = await fetchAndStoreGames(
    games.map(g => g.appid),
    (progress) => {
      if (progress.current % 10 === 0 || progress.current === progress.total) {
        console.log(
          `Progress: ${progress.current}/${progress.total} ` +
          `(${Math.round((progress.current / progress.total) * 100)}%)`
        );
      }
    }
  );

  const duration = Date.now() - startTime;
  console.log(
    `Steam sync complete: ${results.success} games added, ` +
    `${results.skipped} skipped, ${results.failed} failed ` +
    `in ${(duration / 1000).toFixed(1)}s`
  );

  // Log sync status
  const db = getDb();
  const syncLog = db.prepare(`
    INSERT INTO data_sync_log (source, last_sync_at, status, records_updated)
    VALUES ('steam', datetime('now'), 'success', ?)
    ON CONFLICT(source) DO UPDATE SET
      last_sync_at = datetime('now'),
      status = 'success',
      records_updated = ?
  `);
  syncLog.run(results.success, results.success);

  return { ...results, duration };
}

/**
 * Sync specific games by their Steam App IDs
 */
export async function syncSpecificGames(steamAppIds: number[]): Promise<SyncResult> {
  console.log(`Syncing ${steamAppIds.length} specific games...`);
  const startTime = Date.now();

  const results = await fetchAndStoreGames(steamAppIds);

  const duration = Date.now() - startTime;
  console.log(`Sync complete in ${(duration / 1000).toFixed(1)}s`);

  return { ...results, duration };
}

export default {
  fetchAllApps,
  fetchAppDetails,
  fetchAndStoreGames,
  syncPopularGames,
  syncSpecificGames
};
