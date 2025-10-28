import type Database from 'better-sqlite3';
import getDb from '../connection.js';
import type {
  Game,
  GameInsert,
  GameWithRating,
  GamesQueryParams,
  PaginatedGamesResponse,
  GameDetailResponse,
  CurrentPrice,
  HumbleBundle
} from '../../types/index.js';

export class GamesRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDb();
  }

  /**
   * Get all games with optional filtering, sorting, and pagination
   */
  getGames(params: GamesQueryParams): PaginatedGamesResponse {
    const {
      page = 1,
      limit = 50,
      sortBy = 'name',
      sortOrder = 'asc',
      protonTier = null,
      minPrice = null,
      maxPrice = null,
      minDiscount = null,
      onSale = null,
      search = null
    } = params;

    let query = `
      SELECT
        g.*,
        p.tier as proton_tier,
        p.confidence as proton_confidence,
        p.score as proton_score,
        MIN(cp.price_usd) as min_price,
        MAX(cp.discount_percent) as max_discount,
        COUNT(CASE WHEN cp.is_on_sale = 1 THEN 1 END) as active_sales
      FROM games g
      LEFT JOIN protondb_ratings p ON g.steam_app_id = p.steam_app_id
      LEFT JOIN current_prices cp ON g.steam_app_id = cp.steam_app_id
      WHERE 1=1
    `;

    const queryParams: Record<string, any> = {};

    // Apply filters
    if (protonTier) {
      const tiers = protonTier.split(',').map(t => t.trim());
      const placeholders = tiers.map((_, i) => `$tier${i}`).join(',');
      query += ` AND p.tier IN (${placeholders})`;
      tiers.forEach((tier, i) => {
        queryParams[`tier${i}`] = tier;
      });
    }

    if (search) {
      query += ` AND g.name LIKE $search`;
      queryParams.search = `%${search}%`;
    }

    query += ` GROUP BY g.steam_app_id`;

    // Apply price filters after grouping
    if (minPrice !== null) {
      query += ` HAVING MIN(cp.price_usd) >= $minPrice`;
      queryParams.minPrice = minPrice;
    }

    if (maxPrice !== null) {
      query += ` ${minPrice !== null ? 'AND' : 'HAVING'} MIN(cp.price_usd) <= $maxPrice`;
      queryParams.maxPrice = maxPrice;
    }

    if (minDiscount !== null) {
      query += ` ${(minPrice !== null || maxPrice !== null) ? 'AND' : 'HAVING'} MAX(cp.discount_percent) >= $minDiscount`;
      queryParams.minDiscount = minDiscount;
    }

    if (onSale !== null) {
      query += ` ${(minPrice !== null || maxPrice !== null || minDiscount !== null) ? 'AND' : 'HAVING'} COUNT(CASE WHEN cp.is_on_sale = 1 THEN 1 END) > 0`;
    }

    // Get total count before pagination
    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const countResult = this.db.prepare(countQuery).get(queryParams) as { total: number };
    const total = countResult.total;

    // Apply sorting
    const validSortColumns = ['name', 'release_date', 'min_price', 'max_discount', 'proton_score'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'name';
    const order = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY ${sortColumn} ${order}`;

    // Apply pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $limit OFFSET $offset`;
    queryParams.limit = limit;
    queryParams.offset = offset;

    const games = this.db.prepare(query).all(queryParams) as GameWithRating[];

    return {
      games,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get a single game by Steam App ID with all related data
   */
  getGameById(steamAppId: number): GameDetailResponse | null {
    const game = this.db.prepare(`
      SELECT g.*, p.*
      FROM games g
      LEFT JOIN protondb_ratings p ON g.steam_app_id = p.steam_app_id
      WHERE g.steam_app_id = ?
    `).get(steamAppId) as (Game & { tier?: string }) | undefined;

    if (!game) return null;

    // Get current prices
    const prices = this.db.prepare(`
      SELECT * FROM current_prices WHERE steam_app_id = ?
    `).all(steamAppId) as CurrentPrice[];

    // Get humble bundles
    const bundles = this.db.prepare(`
      SELECT hb.*, hbg.tier
      FROM humble_bundles hb
      JOIN humble_bundle_games hbg ON hb.id = hbg.bundle_id
      WHERE hbg.steam_app_id = ? AND hb.is_active = 1
    `).all(steamAppId) as (HumbleBundle & { tier: string | null })[];

    return {
      ...game,
      current_prices: prices,
      humble_bundles: bundles
    } as GameDetailResponse;
  }

  /**
   * Insert or update a game
   */
  upsertGame(game: GameInsert): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO games (
        steam_app_id, name, short_description, header_image_url, steam_url,
        release_date, developers, publishers, genres, tags, is_free
      ) VALUES (
        $steamAppId, $name, $shortDescription, $headerImageUrl, $steamUrl,
        $releaseDate, $developers, $publishers, $genres, $tags, $isFree
      )
      ON CONFLICT(steam_app_id) DO UPDATE SET
        name = $name,
        short_description = $shortDescription,
        header_image_url = $headerImageUrl,
        steam_url = $steamUrl,
        release_date = $releaseDate,
        developers = $developers,
        publishers = $publishers,
        genres = $genres,
        tags = $tags,
        is_free = $isFree,
        last_updated = CURRENT_TIMESTAMP
    `);

    return stmt.run({
      steamAppId: game.steam_app_id,
      name: game.name,
      shortDescription: game.short_description || null,
      headerImageUrl: game.header_image_url || null,
      steamUrl: game.steam_url || `https://store.steampowered.com/app/${game.steam_app_id}`,
      releaseDate: game.release_date || null,
      developers: JSON.stringify(game.developers || []),
      publishers: JSON.stringify(game.publishers || []),
      genres: JSON.stringify(game.genres || []),
      tags: JSON.stringify(game.tags || []),
      isFree: game.is_free || false
    });
  }

  /**
   * Batch insert or update games
   */
  upsertGames(games: GameInsert[]): void {
    const upsert = this.db.transaction((gamesList: GameInsert[]) => {
      for (const game of gamesList) {
        this.upsertGame(game);
      }
    });

    upsert(games);
  }

  /**
   * Delete a game
   */
  deleteGame(steamAppId: number): Database.RunResult {
    const stmt = this.db.prepare('DELETE FROM games WHERE steam_app_id = ?');
    return stmt.run(steamAppId);
  }

  /**
   * Get game count
   */
  getCount(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number };
    return result.count;
  }
}

export default new GamesRepository();
