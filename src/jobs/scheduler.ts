import cron from 'node-cron';
import dotenv from 'dotenv';
import protondbService from '../services/protondb.js';
import itadService from '../services/isthereanydeal.js';
import steamService from '../services/steam.js';

dotenv.config();

/**
 * Scheduled job runner
 * This can be imported and started from the main server, or run standalone
 */

export function startScheduler(): void {
  console.log('🕐 Starting scheduled jobs...');

  // Sync prices every 6 hours (default)
  const priceSchedule = process.env.SYNC_PRICES_SCHEDULE || '0 */6 * * *';
  cron.schedule(priceSchedule, async () => {
    console.log('⏰ Running scheduled price sync...');
    try {
      await itadService.syncAllPrices({});
      console.log('✓ Price sync completed');
    } catch (error) {
      console.error('✗ Price sync failed:', (error as Error).message);
    }
  });
  console.log(`   - Price sync: ${priceSchedule}`);

  // Sync ProtonDB ratings daily at 2am (default)
  const protonSchedule = process.env.SYNC_PROTONDB_SCHEDULE || '0 2 * * *';
  cron.schedule(protonSchedule, async () => {
    console.log('⏰ Running scheduled ProtonDB sync...');
    try {
      await protondbService.syncAllRatings({ updateStaleOnly: true });
      console.log('✓ ProtonDB sync completed');
    } catch (error) {
      console.error('✗ ProtonDB sync failed:', (error as Error).message);
    }
  });
  console.log(`   - ProtonDB sync: ${protonSchedule}`);

  // Sync new games weekly on Sunday at 3am (default)
  const gamesSchedule = process.env.SYNC_GAMES_SCHEDULE || '0 3 * * 0';
  cron.schedule(gamesSchedule, async () => {
    console.log('⏰ Running scheduled games sync...');
    try {
      await steamService.syncPopularGames({ limit: 1000 });
      console.log('✓ Games sync completed');
    } catch (error) {
      console.error('✗ Games sync failed:', (error as Error).message);
    }
  });
  console.log(`   - Games sync: ${gamesSchedule}`);

  console.log('✓ Scheduler started');
  console.log('');
}

// If run directly, start the scheduler and keep running
if (import.meta.url === `file://${process.argv[1]}`) {
  startScheduler();
  console.log('Scheduler running. Press Ctrl+C to stop.');

  // Keep the process alive
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, stopping scheduler...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, stopping scheduler...');
    process.exit(0);
  });
}

export default { startScheduler };
