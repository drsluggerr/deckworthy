import type Database from 'better-sqlite3';
import getDb from '../connection.js';
import type {
  ProtonDBRating,
  ProtonDBRatingInsert,
  ProtonDistribution
} from '../../types/index.js';

export class ProtonDBRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDb();
  }

  /**
   * Get ProtonDB rating for a game
   */
  getRating(steamAppId: number): ProtonDBRating | undefined {
    return this.db.prepare(
      'SELECT * FROM protondb_ratings WHERE steam_app_id = ?'
    ).get(steamAppId) as ProtonDBRating | undefined;
  }

  /**
   * Insert or update a ProtonDB rating
   */
  upsertRating(rating: ProtonDBRatingInsert): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO protondb_ratings (
        steam_app_id, tier, confidence, score, total_reports, trending_tier
      ) VALUES (
        $steamAppId, $tier, $confidence, $score, $totalReports, $trendingTier
      )
      ON CONFLICT(steam_app_id) DO UPDATE SET
        tier = $tier,
        confidence = $confidence,
        score = $score,
        total_reports = $totalReports,
        trending_tier = $trendingTier,
        last_updated = CURRENT_TIMESTAMP
    `);

    return stmt.run({
      steamAppId: rating.steam_app_id,
      tier: rating.tier,
      confidence: rating.confidence || null,
      score: rating.score || null,
      totalReports: rating.total_reports || 0,
      trendingTier: rating.trending_tier || null
    });
  }

  /**
   * Batch upsert ratings
   */
  upsertRatings(ratings: ProtonDBRatingInsert[]): void {
    const upsert = this.db.transaction((ratingsList: ProtonDBRatingInsert[]) => {
      for (const rating of ratingsList) {
        this.upsertRating(rating);
      }
    });

    upsert(ratings);
  }

  /**
   * Get all ratings that haven't been updated recently
   */
  getStaleRatings(hoursSinceUpdate: number = 24): Array<{ steam_app_id: number }> {
    return this.db.prepare(`
      SELECT steam_app_id
      FROM protondb_ratings
      WHERE last_updated < datetime('now', '-${hoursSinceUpdate} hours')
    `).all() as Array<{ steam_app_id: number }>;
  }

  /**
   * Get rating statistics
   */
  getStats(): ProtonDistribution[] {
    return this.db.prepare(`
      SELECT
        tier,
        COUNT(*) as count,
        ROUND(AVG(score), 2) as avg_score
      FROM protondb_ratings
      GROUP BY tier
      ORDER BY
        CASE tier
          WHEN 'platinum' THEN 1
          WHEN 'gold' THEN 2
          WHEN 'silver' THEN 3
          WHEN 'bronze' THEN 4
          WHEN 'borked' THEN 5
          ELSE 6
        END
    `).all() as ProtonDistribution[];
  }

  /**
   * Delete a rating
   */
  deleteRating(steamAppId: number): Database.RunResult {
    const stmt = this.db.prepare('DELETE FROM protondb_ratings WHERE steam_app_id = ?');
    return stmt.run(steamAppId);
  }
}

export default new ProtonDBRepository();
