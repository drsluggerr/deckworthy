import { Router, Request, Response } from 'express';
import gamesRepo from '../db/repositories/games.js';
import protondbRepo from '../db/repositories/protondb.js';
import getDb from '../db/connection.js';
import type { StatsResponse, DataSyncLog, PriceRange } from '../types/index.js';

const router = Router();

/**
 * GET /api/stats
 * Get overall statistics
 */
router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb();

    // Total games
    const totalGames = gamesRepo.getCount();

    // ProtonDB tier distribution
    const protonStats = protondbRepo.getStats();

    // Total games on sale
    const activeSalesResult = db.prepare(`
      SELECT COUNT(DISTINCT steam_app_id) as count
      FROM current_prices
      WHERE is_on_sale = 1
    `).get() as { count: number };

    // Average discount
    const avgDiscountResult = db.prepare(`
      SELECT AVG(discount_percent) as avg_discount
      FROM current_prices
      WHERE is_on_sale = 1
    `).get() as { avg_discount: number | null };

    // Best discount currently
    const bestDiscountResult = db.prepare(`
      SELECT MAX(discount_percent) as max_discount
      FROM current_prices
      WHERE is_on_sale = 1
    `).get() as { max_discount: number | null };

    // Games by price range
    const priceRanges = db.prepare(`
      SELECT
        CASE
          WHEN price_usd = 0 THEN 'Free'
          WHEN price_usd < 5 THEN '$0-$5'
          WHEN price_usd < 10 THEN '$5-$10'
          WHEN price_usd < 20 THEN '$10-$20'
          WHEN price_usd < 30 THEN '$20-$30'
          WHEN price_usd < 40 THEN '$30-$40'
          WHEN price_usd < 60 THEN '$40-$60'
          ELSE '$60+'
        END as price_range,
        COUNT(DISTINCT steam_app_id) as count
      FROM current_prices
      GROUP BY price_range
      ORDER BY MIN(price_usd)
    `).all() as PriceRange[];

    // Last sync times
    const lastSync = db.prepare(`
      SELECT * FROM data_sync_log ORDER BY last_sync_at DESC
    `).all() as DataSyncLog[];

    const response: StatsResponse = {
      total_games: totalGames,
      proton_distribution: protonStats,
      active_sales: activeSalesResult.count || 0,
      average_discount: Math.round(avgDiscountResult.avg_discount || 0),
      best_discount: bestDiscountResult.max_discount || 0,
      price_ranges: priceRanges,
      last_sync: lastSync
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
