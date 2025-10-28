#!/usr/bin/env node

/**
 * Job to sync game prices from IsThereAnyDeal
 * Usage: tsx src/jobs/sync-prices.ts [limit]
 */

import dotenv from 'dotenv';
import itadService from '../services/isthereanydeal.js';
import { closeDb } from '../db/connection.js';

dotenv.config();

async function main() {
  const limit = process.argv[2] ? parseInt(process.argv[2]) : null;

  console.log('===================================');
  console.log('      Price Sync Job (ITAD)');
  console.log('===================================');
  console.log('');

  if (!process.env.ITAD_API_KEY) {
    console.error('❌ Error: ITAD_API_KEY not configured in .env');
    console.error('   Get a free API key from: https://isthereanydeal.com/dev/app/');
    console.error('');
    process.exit(1);
  }

  try {
    const results = await itadService.syncAllPrices({ limit });

    console.log('');
    console.log('===================================');
    console.log('         Sync Complete');
    console.log('===================================');
    console.log(`✓ Success: ${results.success} prices`);
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
