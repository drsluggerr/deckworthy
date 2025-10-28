import { Router, Request, Response } from 'express';
import pricesRepo from '../db/repositories/prices.js';
import bundlesRepo from '../db/repositories/bundles.js';

const router = Router();

/**
 * GET /api/deals/best
 * Get the best current deals
 */
router.get('/best', (req: Request, res: Response): void => {
  try {
    const { limit = '20', min_discount = '50' } = req.query as Record<string, string | undefined>;

    const deals = pricesRepo.getBestDeals(
      parseInt(limit),
      parseInt(min_discount)
    );

    res.json({ deals });
  } catch (error) {
    console.error('Error fetching best deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

/**
 * GET /api/deals/active-sales
 * Get all active sales
 */
router.get('/active-sales', (req: Request, res: Response): void => {
  try {
    const sales = pricesRepo.getActiveSales();
    res.json({ sales });
  } catch (error) {
    console.error('Error fetching active sales:', error);
    res.status(500).json({ error: 'Failed to fetch active sales' });
  }
});

/**
 * GET /api/deals/bundles
 * Get all active Humble Bundles
 */
router.get('/bundles', (req: Request, res: Response): void => {
  try {
    const bundles = bundlesRepo.getActiveBundles();

    // Get games for each bundle
    const bundlesWithGames = bundles.map(bundle => ({
      ...bundle,
      games: bundlesRepo.getBundleGames(bundle.id)
    }));

    res.json({ bundles: bundlesWithGames });
  } catch (error) {
    console.error('Error fetching bundles:', error);
    res.status(500).json({ error: 'Failed to fetch bundles' });
  }
});

/**
 * GET /api/deals/bundles/:bundleId
 * Get a specific bundle with its games
 */
router.get('/bundles/:bundleId', (req: Request, res: Response): void => {
  try {
    const { bundleId } = req.params;
    const bundle = bundlesRepo.getBundle(parseInt(bundleId));

    if (!bundle) {
      res.status(404).json({ error: 'Bundle not found' });
      return;
    }

    const games = bundlesRepo.getBundleGames(parseInt(bundleId));

    res.json({
      ...bundle,
      games
    });
  } catch (error) {
    console.error('Error fetching bundle:', error);
    res.status(500).json({ error: 'Failed to fetch bundle' });
  }
});

export default router;
