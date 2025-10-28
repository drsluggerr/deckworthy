#!/usr/bin/env node

/**
 * Job to sync Steam games data
 * Usage: tsx src/jobs/sync-games.ts [limit]
 */

import dotenv from 'dotenv';
import steamService from '../services/steam.js';
import { closeDb } from '../db/connection.js';

dotenv.config();

async function main() {
  const limit = process.argv[2] ? parseInt(process.argv[2]) : 1000;

  console.log('===================================');
  console.log('    Steam Games Sync Job');
  console.log('===================================');
  console.log('');

  try {
    const results = await steamService.syncPopularGames({ limit });

    console.log('');
    console.log('===================================');
    console.log('         Sync Complete');
    console.log('===================================');
    console.log(`✓ Success: ${results.success} games`);
    console.log(`⊘ Skipped: ${results.skipped} entries`);
    console.log(`✗ Failed:  ${results.failed} entries`);
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
