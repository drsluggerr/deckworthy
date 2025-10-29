/**
 * Type definitions for Deckworthy data models
 */

export interface Game {
  steam_app_id: number;
  name: string;
  short_description: string | null;
  header_image_url: string | null;
  steam_url: string;
  release_date: string | null;
  developers: string; // JSON stringified array
  publishers: string; // JSON stringified array
  genres: string; // JSON stringified array
  tags: string; // JSON stringified array
  is_free: boolean;
  last_updated: string;
}

export interface GameInsert {
  steam_app_id: number;
  name: string;
  short_description?: string | null;
  header_image_url?: string | null;
  steam_url?: string;
  release_date?: string | null;
  developers?: string[];
  publishers?: string[];
  genres?: string[];
  tags?: string[];
  is_free?: boolean;
}

export interface GameWithRating extends Game {
  proton_tier: ProtonTier | null;
  proton_confidence: string | null;
  proton_score: number | null;
  proton_reports: number | null;
  min_price: number | null;
  max_discount: number | null;
  active_sales: number;
}

export type ProtonTier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'borked' | 'pending';

export interface ProtonDBRating {
  steam_app_id: number;
  tier: ProtonTier;
  confidence: string | null;
  score: number | null;
  total_reports: number;
  trending_tier: ProtonTier | null;
  last_updated: string;
}

export interface ProtonDBRatingInsert {
  steam_app_id: number;
  tier: ProtonTier;
  confidence?: string | null;
  score?: number | null;
  total_reports?: number;
  trending_tier?: ProtonTier | null;
}

export interface Price {
  steam_app_id: number;
  store: string;
  price_usd: number;
  discount_percent: number;
  is_on_sale: boolean;
  sale_end_date: string | null;
  url: string | null;
}

export interface PriceHistory extends Price {
  id: number;
  recorded_at: string;
}

export interface CurrentPrice extends Price {
  last_updated: string;
}

export interface HumbleBundle {
  id: number;
  bundle_name: string;
  bundle_url: string;
  bundle_type: string | null;
  end_date: string | null;
  is_active: boolean;
  last_updated: string;
}

export interface HumbleBundleInsert {
  bundle_name: string;
  bundle_url: string;
  bundle_type?: string | null;
  end_date?: string | null;
}

export interface HumbleBundleGame {
  id: number;
  bundle_id: number;
  steam_app_id: number;
  tier: string | null;
}

export interface DataSyncLog {
  source: 'steam' | 'protondb' | 'itad' | 'humble';
  last_sync_at: string;
  status: 'success' | 'failed';
  error_message: string | null;
  records_updated: number;
}

// API Response types
export interface PaginatedGamesResponse {
  games: GameWithRating[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GameDetailResponse extends Game {
  current_prices: CurrentPrice[];
  humble_bundles: (HumbleBundle & { tier: string | null })[];
}

export interface PriceHistoryResponse {
  history: PriceHistory[];
  stats: PriceStats[];
}

export interface PriceStats {
  store: string;
  lowest_price: number;
  highest_price: number;
  avg_price: number;
  price_changes: number;
}

export interface StatsResponse {
  total_games: number;
  proton_distribution: ProtonDistribution[];
  active_sales: number;
  average_discount: number;
  best_discount: number;
  price_ranges: PriceRange[];
  last_sync: DataSyncLog[];
}

export interface ProtonDistribution {
  tier: ProtonTier;
  count: number;
  avg_score: number;
}

export interface PriceRange {
  price_range: string;
  count: number;
}

// Query parameter types
export interface GamesQueryParams {
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'release_date' | 'min_price' | 'max_discount' | 'proton_score';
  sortOrder?: 'asc' | 'desc';
  protonTier?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  minDiscount?: number | null;
  onSale?: boolean;
  search?: string | null;
}

// Sync result types
export interface SyncResult {
  success: number;
  failed: number;
  skipped: number;
  duration?: number;
}

export interface SyncProgress {
  current: number;
  total: number;
  steamAppId: number;
  status: 'success' | 'failed' | 'skipped';
}

// External API response types
export interface SteamApp {
  appid: number;
  name: string;
}

export interface SteamAppListResponse {
  applist: {
    apps: SteamApp[];
  };
}

export interface SteamAppDetailsResponse {
  [appId: string]: {
    success: boolean;
    data?: {
      type: string;
      name: string;
      steam_appid: number;
      short_description?: string;
      header_image?: string;
      release_date?: {
        date?: string;
      };
      developers?: string[];
      publishers?: string[];
      genres?: Array<{ description: string }>;
      is_free?: boolean;
    };
  };
}

export interface ProtonDBApiResponse {
  tier: string;
  confidence?: string;
  score?: number;
  total?: number;
  trendingTier?: string;
}

export interface ITADPriceResponse {
  data: {
    [plain: string]: {
      list?: Array<{
        shop: {
          name: string;
        };
        price_new: number;
        price_old: number;
        price_cut: number;
        price_cut_end?: number;
        url: string;
      }>;
    };
  };
}
