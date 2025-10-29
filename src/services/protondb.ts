import { fetchJson, RateLimiter } from '../utils/http.js';
import protondbRepo from '../db/repositories/protondb.js';
import getDb from '../db/connection.js';
import type {
  ProtonDBRatingInsert,
  ProtonDBApiResponse,
  SyncResult,
  SyncProgress
} from '../types/index.js';

const PROTONDB_API_BASE = 'https://www.protondb.com/api/v1';

// Conservative rate limiting (we don't know ProtonDB's actual limits)
const rateLimiter = new RateLimiter(10, 60000); // 10 requests per minute

/**
 * Fetch ProtonDB rating for a single game
 */
export async function fetchGameRating(steamAppId: number): Promise<ProtonDBRatingInsert | null> {
  try {
    const url = `${PROTONDB_API_BASE}/reports/summaries/${steamAppId}.json`;

    const data = await rateLimiter.execute(() =>
      fetchJson<ProtonDBApiResponse>(url, { retries: 2, timeout: 5000 })
    );

    if (!data || !data.tier) {
      return null;
    }

    return {
      steam_app_id: steamAppId,
      tier: data.tier.toLowerCase() as ProtonDBRatingInsert['tier'],
      confidence: data.confidence || null,
      score: data.score || null,
      total_reports: data.total || 0,
      trending_tier: data.trendingTier?.toLowerCase() as ProtonDBRatingInsert['tier'] | undefined || null
    };
  } catch (error) {
    // Game might not have ProtonDB data yet
    const err = error as Error;
    if (err.message.includes('404')) {
      console.log(`No ProtonDB data for game ${steamAppId}`);
      return null;
    }
    console.error(`Error fetching ProtonDB rating for ${steamAppId}:`, err.message);
    throw error;
  }
}

/**
 * Fetch and store ratings for multiple games
 */
export async function fetchAndStoreRatings(
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
      const rating = await fetchGameRating(steamAppId);

      if (rating) {
        protondbRepo.upsertRating(rating);
        results.success++;
      } else {
        results.skipped++;
      }

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: steamAppIds.length,
          steamAppId,
          status: rating ? 'success' : 'skipped'
        });
      }
    } catch (error) {
      results.failed++;
      console.error(`Failed to process game ${steamAppId}:`, (error as Error).message);
    }
  }

  return results;
}

interface SyncOptions {
  limit?: number | null;
  updateStaleOnly?: boolean;
  staleHours?: number;
}

/**
 * Sync ProtonDB ratings for all games in the database
 */
export async function syncAllRatings(options: SyncOptions = {}): Promise<SyncResult> {
  const {
    limit = null,
    updateStaleOnly = true,
    staleHours = 168 // 1 week
  } = options;

  console.log('Starting ProtonDB sync...');
  const startTime = Date.now();

  const db = getDb();

  // Get list of games to update
  let query = 'SELECT steam_app_id FROM games';

  if (updateStaleOnly) {
    query = `
      SELECT g.steam_app_id
      FROM games g
      LEFT JOIN protondb_ratings p ON g.steam_app_id = p.steam_app_id
      WHERE p.steam_app_id IS NULL
         OR p.last_updated < datetime('now', '-${staleHours} hours')
    `;
  }

  if (limit) {
    query += ` LIMIT ${limit}`;
  }

  const games = db.prepare(query).all() as Array<{ steam_app_id: number }>;
  console.log(`Found ${games.length} games to sync`);

  if (games.length === 0) {
    console.log('No games need updating');
    return { success: 0, failed: 0, skipped: 0, duration: 0 };
  }

  const steamAppIds = games.map(g => g.steam_app_id);

  const results = await fetchAndStoreRatings(steamAppIds, (progress) => {
    if (progress.current % 10 === 0 || progress.current === progress.total) {
      console.log(
        `Progress: ${progress.current}/${progress.total} ` +
        `(${Math.round((progress.current / progress.total) * 100)}%)`
      );
    }
  });

  const duration = Date.now() - startTime;
  console.log(
    `ProtonDB sync complete: ${results.success} updated, ` +
    `${results.skipped} skipped, ${results.failed} failed ` +
    `in ${(duration / 1000).toFixed(1)}s`
  );

  // Log sync status
  const syncLog = db.prepare(`
    INSERT INTO data_sync_log (source, last_sync_at, status, records_updated)
    VALUES ('protondb', datetime('now'), 'success', ?)
    ON CONFLICT(source) DO UPDATE SET
      last_sync_at = datetime('now'),
      status = 'success',
      records_updated = ?
  `);
  syncLog.run(results.success, results.success);

  return { ...results, duration };
}

export default {
  fetchGameRating,
  fetchAndStoreRatings,
  syncAllRatings
};
