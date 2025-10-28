import { Router, Request, Response } from 'express';
import gamesRepo from '../db/repositories/games.js';
import pricesRepo from '../db/repositories/prices.js';
import type { GamesQueryParams } from '../types/index.js';

const router = Router();

/**
 * GET /api/games
 * Get all games with filtering, sorting, and pagination
 */
router.get('/', (req: Request, res: Response): void => {
  try {
    const {
      page = '1',
      limit = '50',
      sort_by = 'name',
      sort_order = 'asc',
      proton_tier,
      min_price,
      max_price,
      min_discount,
      on_sale,
      search
    } = req.query as Record<string, string | undefined>;

    const queryParams: GamesQueryParams = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100), // Max 100 per page
      sortBy: sort_by as GamesQueryParams['sortBy'],
      sortOrder: sort_order as 'asc' | 'desc',
      protonTier: proton_tier,
      minPrice: min_price ? parseFloat(min_price) : null,
      maxPrice: max_price ? parseFloat(max_price) : null,
      minDiscount: min_discount ? parseInt(min_discount) : null,
      onSale: on_sale === 'true' ? true : null,
      search: search || null
    };

    const result = gamesRepo.getGames(queryParams);

    res.json(result);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

/**
 * GET /api/games/:steamAppId
 * Get detailed information for a single game
 */
router.get('/:steamAppId', (req: Request, res: Response): void => {
  try {
    const { steamAppId } = req.params;
    const game = gamesRepo.getGameById(parseInt(steamAppId));

    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    res.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

/**
 * GET /api/games/:steamAppId/price-history
 * Get price history for a game
 */
router.get('/:steamAppId/price-history', (req: Request, res: Response): void => {
  try {
    const { steamAppId } = req.params;
    const { days = '90', store } = req.query as Record<string, string | undefined>;

    const history = pricesRepo.getPriceHistory(
      parseInt(steamAppId),
      parseInt(days),
      store || null
    );

    const stats = pricesRepo.getPriceStats(parseInt(steamAppId), parseInt(days));

    res.json({
      history,
      stats
    });
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

export default router;
