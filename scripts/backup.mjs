import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);
const source = process.env.CAMPUSCONNECT_DB ? path.resolve(process.env.CAMPUSCONNECT_DB) : path.join(root, 'database', 'campusconnect.db');
if (!fs.existsSync(source)) {
  console.error(`Database not found: ${source}. Start UniLink once before creating a backup.`);
  process.exit(1);
}
const destinationDir = path.join(root, 'database', 'backups');
fs.mkdirSync(destinationDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = path.join(destinationDir, `campusconnect-${stamp}.db`);
const db = new DatabaseSync(source);
try {
  db.exec(`VACUUM INTO '${destination.replace(/'/g, "''")}'`);
  console.log(`Database backup created: ${destination}`);
} finally {
  db.close();
}
