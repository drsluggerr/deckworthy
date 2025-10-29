/**
 * Tests for HTTP utilities
 * Tests rate limiter and fetch wrapper functionality
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { RateLimiter, fetchJson, sleep } from '../../utils/http.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow requests within rate limit', async () => {
    const limiter = new RateLimiter(5, 1000);
    const results: number[] = [];

    // Execute 5 requests (within limit)
    const promises = Array.from({ length: 5 }, async (_, i) => {
      await limiter.execute(async () => {
        results.push(i);
        return i;
      });
    });

    await Promise.all(promises);

    expect(results).toHaveLength(5);
    expect(results).toEqual([0, 1, 2, 3, 4]);
  });

  it('should delay requests exceeding rate limit', async () => {
    const limiter = new RateLimiter(2, 1000); // 2 requests per second
    const executionTimes: number[] = [];

    // Try to execute 4 requests
    const executeRequest = async (id: number) => {
      return limiter.execute(async () => {
        executionTimes.push(Date.now());
        return id;
      });
    };

    // Start all requests at once
    const promise1 = executeRequest(1);
    const promise2 = executeRequest(2);
    const promise3 = executeRequest(3);
    const promise4 = executeRequest(4);

    // First 2 should execute immediately
    await Promise.all([promise1, promise2]);
    expect(executionTimes).toHaveLength(2);

    // Advance time by 1 second to allow next batch
    jest.advanceTimersByTime(1000);

    // Next 2 should execute
    await Promise.all([promise3, promise4]);
    expect(executionTimes).toHaveLength(4);
  });

  it('should clean up old request timestamps', async () => {
    const limiter = new RateLimiter(3, 1000);

    // Execute 3 requests
    await limiter.waitForSlot();
    await limiter.waitForSlot();
    await limiter.waitForSlot();

    // Advance time past the window
    jest.advanceTimersByTime(1100);

    // Should be able to execute 3 more without waiting
    const start = Date.now();
    await limiter.waitForSlot();
    await limiter.waitForSlot();
    await limiter.waitForSlot();
    const elapsed = Date.now() - start;

    // Should execute immediately (within 50ms)
    expect(elapsed).toBeLessThan(50);
  });

  it('should handle concurrent requests correctly', async () => {
    const limiter = new RateLimiter(5, 1000);
    const results: number[] = [];

    // Simulate 10 concurrent requests
    const promises = Array.from({ length: 10 }, (_, i) =>
      limiter.execute(async () => {
        results.push(i);
        return i;
      })
    );

    // Execute all and advance timers
    const settling = Promise.all(promises);
    jest.advanceTimersByTime(2000); // Advance enough time for all to complete
    await settling;

    expect(results).toHaveLength(10);
    expect(new Set(results).size).toBe(10); // All unique
  });
});

describe('fetchJson', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Mock fetch
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('should successfully fetch JSON data', async () => {
    const mockData = { id: 1, name: 'Test' };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const result = await fetchJson('https://api.example.com/data');

    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should include custom User-Agent header', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await fetchJson('https://api.example.com/data');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/data',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('Deckworthy'),
        }),
      })
    );
  });

  it('should retry on failure', async () => {
    const mockData = { success: true };

    // Fail twice, then succeed
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

    const result = await fetchJson('https://api.example.com/data', {
      retries: 3,
      retryDelay: 100,
    });

    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should throw error after max retries', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    await expect(
      fetchJson('https://api.example.com/data', {
        retries: 2,
        retryDelay: 10,
      })
    ).rejects.toThrow('Failed after 2 attempts');

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should handle HTTP error responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(
      fetchJson('https://api.example.com/data', { retries: 1 })
    ).rejects.toThrow('HTTP 404');
  });

  it('should respect timeout', async () => {
    jest.useRealTimers(); // Use real timers for timeout test

    // Create a promise that never resolves
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      new Promise(() => {}) // Never resolves
    );

    await expect(
      fetchJson('https://api.example.com/data', {
        timeout: 100,
        retries: 1,
      })
    ).rejects.toThrow();
  });

  it('should handle exponential backoff on retries', async () => {
    const delays: number[] = [];
    let lastTime = Date.now();

    (global.fetch as jest.Mock).mockImplementation(async () => {
      const now = Date.now();
      if (delays.length > 0) {
        delays.push(now - lastTime);
      }
      lastTime = now;
      throw new Error('Network error');
    });

    try {
      await fetchJson('https://api.example.com/data', {
        retries: 3,
        retryDelay: 100,
      });
    } catch (error) {
      // Expected to fail
    }

    // Check that delays increase exponentially
    expect(delays[0]).toBeGreaterThanOrEqual(100); // 100ms * 2^0
    expect(delays[1]).toBeGreaterThanOrEqual(200); // 100ms * 2^1
  });

  it('should merge custom headers with default headers', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await fetchJson('https://api.example.com/data', {
      headers: {
        'Authorization': 'Bearer token123',
        'Custom-Header': 'value',
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/data',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('Deckworthy'),
          'Authorization': 'Bearer token123',
          'Custom-Header': 'value',
        }),
      })
    );
  });
});

describe('sleep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should resolve after specified milliseconds', async () => {
    const promise = sleep(1000);

    jest.advanceTimersByTime(999);
    expect(promise).toBeInstanceOf(Promise);

    jest.advanceTimersByTime(1);
    await expect(promise).resolves.toBeUndefined();
  });

  it('should handle multiple concurrent sleeps', async () => {
    const sleep1 = sleep(1000);
    const sleep2 = sleep(500);
    const sleep3 = sleep(1500);

    jest.advanceTimersByTime(500);
    await expect(sleep2).resolves.toBeUndefined();

    jest.advanceTimersByTime(500);
    await expect(sleep1).resolves.toBeUndefined();

    jest.advanceTimersByTime(500);
    await expect(sleep3).resolves.toBeUndefined();
  });
});
