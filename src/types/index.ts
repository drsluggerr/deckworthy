/**
 * Main type definitions export
 */

export * from './models.js';

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// HTTP client options
export interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

// Rate limiter options
export interface RateLimiterOptions {
  maxRequests: number;
  perMilliseconds: number;
}

// Cron schedule options
export interface SchedulerOptions {
  priceSchedule?: string;
  protonSchedule?: string;
  gamesSchedule?: string;
}

// Database query builders
export type WhereClause = Record<string, string | number | boolean | null>;
export type OrderByClause = { column: string; direction: 'ASC' | 'DESC' };
