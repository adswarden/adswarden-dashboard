#!/usr/bin/env npx tsx
/**
 * Truncate extension enduser_events table (one row per serve).
 * Run: npx tsx scripts/truncate-enduser-events-and-logs.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set. Use .env.local or set the env var.');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    await sql.unsafe('TRUNCATE TABLE enduser_events ');
    console.log('✓ enduser_events truncated');
  } catch (e) {
    console.error('Failed:', e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
