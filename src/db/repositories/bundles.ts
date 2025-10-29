import type Database from 'better-sqlite3';
import getDb from '../connection.js';
import type {
  HumbleBundle,
  HumbleBundleInsert,
  Game,
  ProtonTier
} from '../../types/index.js';

interface BundleGame extends Game {
  tier: string | null;
  proton_tier: ProtonTier | null;
  proton_score: number | null;
}

interface BundleWithTier extends HumbleBundle {
  tier: string | null;
}

export class BundlesRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDb();
  }

  /**
   * Get all active bundles
   */
  getActiveBundles(): HumbleBundle[] {
    return this.db.prepare(`
      SELECT * FROM humble_bundles
      WHERE is_active = 1
      AND (end_date IS NULL OR end_date > datetime('now'))
      ORDER BY end_date ASC
    `).all() as HumbleBundle[];
  }

  /**
   * Get a single bundle by ID
   */
  getBundle(bundleId: number): HumbleBundle | undefined {
    return this.db.prepare('SELECT * FROM humble_bundles WHERE id = ?').get(bundleId) as HumbleBundle | undefined;
  }

  /**
   * Get games in a bundle
   */
  getBundleGames(bundleId: number): BundleGame[] {
    return this.db.prepare(`
      SELECT
        g.*,
        hbg.tier,
        p.tier as proton_tier,
        p.score as proton_score
      FROM humble_bundle_games hbg
      JOIN games g ON hbg.steam_app_id = g.steam_app_id
      LEFT JOIN protondb_ratings p ON g.steam_app_id = p.steam_app_id
      WHERE hbg.bundle_id = ?
      ORDER BY hbg.tier, g.name
    `).all(bundleId) as BundleGame[];
  }

  /**
   * Get bundles containing a specific game
   */
  getBundlesForGame(steamAppId: number): BundleWithTier[] {
    return this.db.prepare(`
      SELECT
        hb.*,
        hbg.tier
      FROM humble_bundles hb
      JOIN humble_bundle_games hbg ON hb.id = hbg.bundle_id
      WHERE hbg.steam_app_id = ?
      AND hb.is_active = 1
      ORDER BY hb.end_date ASC
    `).all(steamAppId) as BundleWithTier[];
  }

  /**
   * Create a new bundle
   */
  createBundle(bundle: HumbleBundleInsert): number {
    const stmt = this.db.prepare(`
      INSERT INTO humble_bundles (bundle_name, bundle_url, bundle_type, end_date)
      VALUES ($name, $url, $type, $endDate)
    `);

    const result = stmt.run({
      name: bundle.bundle_name,
      url: bundle.bundle_url,
      type: bundle.bundle_type || null,
      endDate: bundle.end_date || null
    });

    return result.lastInsertRowid as number;
  }

  /**
   * Add a game to a bundle
   */
  addGameToBundle(bundleId: number, steamAppId: number, tier: string | null = null): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO humble_bundle_games (bundle_id, steam_app_id, tier)
      VALUES (?, ?, ?)
    `);

    return stmt.run(bundleId, steamAppId, tier);
  }

  /**
   * Add multiple games to a bundle
   */
  addGamesToBundle(bundleId: number, games: Array<{ steam_app_id: number; tier?: string | null }>): void {
    const add = this.db.transaction((gamesList: Array<{ steam_app_id: number; tier?: string | null }>) => {
      for (const game of gamesList) {
        this.addGameToBundle(bundleId, game.steam_app_id, game.tier || null);
      }
    });

    add(games);
  }

  /**
   * Update bundle
   */
  updateBundle(bundleId: number, updates: Partial<HumbleBundleInsert & { is_active?: boolean }>): Database.RunResult | undefined {
    const fields: string[] = [];
    const params: Record<string, any> = {};

    if (updates.bundle_name !== undefined) {
      fields.push('bundle_name = $name');
      params.name = updates.bundle_name;
    }
    if (updates.bundle_url !== undefined) {
      fields.push('bundle_url = $url');
      params.url = updates.bundle_url;
    }
    if (updates.bundle_type !== undefined) {
      fields.push('bundle_type = $type');
      params.type = updates.bundle_type;
    }
    if (updates.end_date !== undefined) {
      fields.push('end_date = $endDate');
      params.endDate = updates.end_date;
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = $isActive');
      params.isActive = updates.is_active;
    }

    if (fields.length === 0) return;

    fields.push('last_updated = CURRENT_TIMESTAMP');
    params.bundleId = bundleId;

    const stmt = this.db.prepare(`
      UPDATE humble_bundles
      SET ${fields.join(', ')}
      WHERE id = $bundleId
    `);

    return stmt.run(params);
  }

  /**
   * Deactivate a bundle
   */
  deactivateBundle(bundleId: number): Database.RunResult | undefined {
    return this.updateBundle(bundleId, { is_active: false });
  }

  /**
   * Delete a bundle and its games
   */
  deleteBundle(bundleId: number): Database.RunResult {
    const stmt = this.db.prepare('DELETE FROM humble_bundles WHERE id = ?');
    return stmt.run(bundleId);
  }

  /**
   * Deactivate expired bundles
   */
  deactivateExpiredBundles(): Database.RunResult {
    const stmt = this.db.prepare(`
      UPDATE humble_bundles
      SET is_active = 0, last_updated = CURRENT_TIMESTAMP
      WHERE end_date < datetime('now')
      AND is_active = 1
    `);

    return stmt.run();
  }
}

export default new BundlesRepository();
