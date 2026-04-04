/**
 * One-off: load .env.local and run the same migration pipeline as instrumentation.
 * Usage: npx tsx scripts/apply-migrations.ts
 */
import { config } from 'dotenv';
import { runMigrations } from '../src/lib/db/run-migrate';

config();
config({ path: '.env.local', override: true });

runMigrations().catch((err) => {
  console.error(err);
  process.exit(1);
});
