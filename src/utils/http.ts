import type { FetchOptions } from '../types/index.js';

/**
 * Simple HTTP client utilities using native fetch
 */

/**
 * Make a GET request with error handling and retry logic
 */
export async function fetchJson<T = any>(url: string, options: FetchOptions = {}): Promise<T> {
  const {
    retries = 3,
    retryDelay = 1000,
    timeout = 10000,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Deckworthy/1.0 (Game Price Aggregator)',
          ...fetchOptions.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      lastError = error as Error;
      console.error(`Request failed (attempt ${attempt + 1}/${retries}):`, lastError.message);

      if (attempt < retries - 1) {
        await sleep(retryDelay * Math.pow(2, attempt)); // Exponential backoff
      }
    }
  }

  throw new Error(`Failed after ${retries} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Sleep utility for retry delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate limiter to prevent hitting API limits
 */
export class RateLimiter {
  private maxRequests: number;
  private perMilliseconds: number;
  private requests: number[];

  constructor(maxRequests: number, perMilliseconds: number) {
    this.maxRequests = maxRequests;
    this.perMilliseconds = perMilliseconds;
    this.requests = [];
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // Remove old requests outside the time window
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.perMilliseconds
    );

    // If we've hit the limit, wait
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      if (oldestRequest !== undefined) {
        const waitTime = this.perMilliseconds - (now - oldestRequest);
        await sleep(waitTime);
        return this.waitForSlot();
      }
    }

    this.requests.push(now);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot();
    return fn();
  }
}
