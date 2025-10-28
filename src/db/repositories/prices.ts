import type Database from 'better-sqlite3';
import getDb from '../connection.js';
import type {
  Price,
  CurrentPrice,
  PriceHistory,
  PriceStats,
  ProtonTier
} from '../../types/index.js';

interface DealWithGame {
  steam_app_id: number;
  name: string;
  header_image_url: string | null;
  store: string;
  price_usd: number;
  discount_percent: number;
  sale_end_date: string | null;
  url: string | null;
  proton_tier: ProtonTier | null;
}

interface ActiveSale {
  steam_app_id: number;
  name: string;
  store: string;
  price_usd: number;
  discount_percent: number;
  sale_end_date: string | null;
}

export class PricesRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDb();
  }

  /**
   * Get current prices for a game
   */
  getCurrentPrices(steamAppId: number): CurrentPrice[] {
    return this.db.prepare(`
      SELECT * FROM current_prices WHERE steam_app_id = ?
      ORDER BY price_usd ASC
    `).all(steamAppId) as CurrentPrice[];
  }

  /**
   * Get price history for a game
   */
  getPriceHistory(steamAppId: number, days: number = 90, store: string | null = null): PriceHistory[] {
    let query = `
      SELECT * FROM price_history
      WHERE steam_app_id = ?
      AND recorded_at >= datetime('now', '-${days} days')
    `;

    const params: (number | string)[] = [steamAppId];

    if (store) {
      query += ` AND store = ?`;
      params.push(store);
    }

    query += ` ORDER BY recorded_at DESC`;

    return this.db.prepare(query).all(...params) as PriceHistory[];
  }

  /**
   * Record a price in history
   */
  recordPrice(price: Price): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO price_history (
        steam_app_id, store, price_usd, discount_percent, is_on_sale, sale_end_date, url
      ) VALUES (
        $steamAppId, $store, $priceUsd, $discountPercent, $isOnSale, $saleEndDate, $url
      )
    `);

    return stmt.run({
      steamAppId: price.steam_app_id,
      store: price.store,
      priceUsd: price.price_usd,
      discountPercent: price.discount_percent || 0,
      isOnSale: price.is_on_sale ? 1 : 0,
      saleEndDate: price.sale_end_date || null,
      url: price.url || null
    });
  }

  /**
   * Update current price for a game and store
   */
  updateCurrentPrice(price: Price): Database.RunResult {
    // First, record in history
    this.recordPrice(price);

    // Then update current prices
    const stmt = this.db.prepare(`
      INSERT INTO current_prices (
        steam_app_id, store, price_usd, discount_percent, is_on_sale, sale_end_date, url
      ) VALUES (
        $steamAppId, $store, $priceUsd, $discountPercent, $isOnSale, $saleEndDate, $url
      )
      ON CONFLICT(steam_app_id, store) DO UPDATE SET
        price_usd = $priceUsd,
        discount_percent = $discountPercent,
        is_on_sale = $isOnSale,
        sale_end_date = $saleEndDate,
        url = $url,
        last_updated = CURRENT_TIMESTAMP
    `);

    return stmt.run({
      steamAppId: price.steam_app_id,
      store: price.store,
      priceUsd: price.price_usd,
      discountPercent: price.discount_percent || 0,
      isOnSale: price.is_on_sale ? 1 : 0,
      saleEndDate: price.sale_end_date || null,
      url: price.url || null
    });
  }

  /**
   * Batch update current prices
   */
  updateCurrentPrices(prices: Price[]): void {
    const update = this.db.transaction((pricesList: Price[]) => {
      for (const price of pricesList) {
        this.updateCurrentPrice(price);
      }
    });

    update(prices);
  }

  /**
   * Get games with the best current deals
   */
  getBestDeals(limit: number = 10, minDiscountPercent: number = 50): DealWithGame[] {
    return this.db.prepare(`
      SELECT
        g.steam_app_id,
        g.name,
        g.header_image_url,
        cp.store,
        cp.price_usd,
        cp.discount_percent,
        cp.sale_end_date,
        cp.url,
        p.tier as proton_tier
      FROM current_prices cp
      JOIN games g ON cp.steam_app_id = g.steam_app_id
      LEFT JOIN protondb_ratings p ON g.steam_app_id = p.steam_app_id
      WHERE cp.is_on_sale = 1
      AND cp.discount_percent >= ?
      ORDER BY cp.discount_percent DESC, cp.price_usd ASC
      LIMIT ?
    `).all(minDiscountPercent, limit) as DealWithGame[];
  }

  /**
   * Get price change statistics for a game
   */
  getPriceStats(steamAppId: number, days: number = 90): PriceStats[] {
    return this.db.prepare(`
      SELECT
        store,
        MIN(price_usd) as lowest_price,
        MAX(price_usd) as highest_price,
        AVG(price_usd) as avg_price,
        COUNT(*) as price_changes
      FROM price_history
      WHERE steam_app_id = ?
      AND recorded_at >= datetime('now', '-${days} days')
      GROUP BY store
    `).all(steamAppId) as PriceStats[];
  }

  /**
   * Delete old price history records
   */
  cleanOldHistory(daysToKeep: number = 365): Database.RunResult {
    const stmt = this.db.prepare(`
      DELETE FROM price_history
      WHERE recorded_at < datetime('now', '-${daysToKeep} days')
    `);

    return stmt.run();
  }

  /**
   * Get all active sales
   */
  getActiveSales(): ActiveSale[] {
    return this.db.prepare(`
      SELECT
        g.steam_app_id,
        g.name,
        cp.store,
        cp.price_usd,
        cp.discount_percent,
        cp.sale_end_date
      FROM current_prices cp
      JOIN games g ON cp.steam_app_id = g.steam_app_id
      WHERE cp.is_on_sale = 1
      AND (cp.sale_end_date IS NULL OR cp.sale_end_date > datetime('now'))
      ORDER BY cp.discount_percent DESC
    `).all() as ActiveSale[];
  }
}

export default new PricesRepository();
