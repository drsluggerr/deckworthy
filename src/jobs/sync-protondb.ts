#!/usr/bin/env node

/**
 * Job to sync ProtonDB ratings
 * Usage: tsx src/jobs/sync-protondb.ts [limit]
 */

import dotenv from 'dotenv';
import protondbService from '../services/protondb.js';
import { closeDb } from '../db/connection.js';

dotenv.config();

async function main() {
  const limit = process.argv[2] ? parseInt(process.argv[2]) : null;

  console.log('===================================');
  console.log('   ProtonDB Ratings Sync Job');
  console.log('===================================');
  console.log('');

  try {
    const results = await protondbService.syncAllRatings({
      limit,
      updateStaleOnly: true,
      staleHours: 168 // 1 week
    });

    console.log('');
    console.log('===================================');
    console.log('         Sync Complete');
    console.log('===================================');
    console.log(`✓ Success: ${results.success} ratings`);
    console.log(`⊘ Skipped: ${results.skipped} games`);
    console.log(`✗ Failed:  ${results.failed} requests`);
    console.log(`⏱  Duration: ${((results.duration || 0) / 1000).toFixed(1)}s`);
    console.log('');

    closeDb();
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Sync failed:', (error as Error).message);
    console.error('');
    closeDb();
    process.exit(1);
  }
}

main();
