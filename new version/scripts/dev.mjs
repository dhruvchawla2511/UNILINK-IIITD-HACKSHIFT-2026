// Starts the local database server and the website together (npm run dev).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

// Node does not load .env files automatically; load local settings before starting the server.
const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const procs = [
  spawn(process.execPath, [path.join(root, 'server', 'index.js')], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [vite], { cwd: root, stdio: 'inherit' }),
];
const stop = () => procs.forEach((p) => p.kill());
procs.forEach((p) => p.on('exit', stop));
['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => { stop(); process.exit(0); }));
