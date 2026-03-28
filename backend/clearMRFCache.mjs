// One-shot cache clear script — run with: node clearMRFCache.mjs
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'companyiq.db');

try {
  const db = new Database(dbPath);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map(t => t.name));

  // Delete stale MRF reports so next run is fresh
  const hasReports = tables.some(t => t.name === 'reports');
  if (hasReports) {
    const result = db.prepare("DELETE FROM reports WHERE ticker = 'MRF'").run();
    console.log(`✅ Cleared ${result.changes} MRF report(s) from DB`);
  } else {
    console.log('No reports table found, cache is already clean');
  }
  db.close();
} catch (e) {
  console.error('Failed to clear cache:', e.message);
}
