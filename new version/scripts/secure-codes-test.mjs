import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newClassJoinCode, normalizeClassJoinCode, isEightWordClassCode } from '../server/joinCodes.js';

const taken = new Set();
const fakeDb = { prepare: () => ({ get: (_sql, code) => taken.has(code) ? { exists: 1 } : undefined }) };
for (let i = 0; i < 100; i++) {
  const code = newClassJoinCode(fakeDb);
  assert.match(code, /^[a-z]+(?:-[a-z]+){7}$/, 'class code must contain exactly eight random words');
  assert.equal(code.split('-').length, 8);
  assert.equal(isEightWordClassCode(code), true);
  taken.add(code);
  assert.equal(normalizeClassJoinCode(code.replaceAll('-', ' ')), code, 'spaces should be accepted when joining');
}
assert.equal(isEightWordClassCode('A1B2C3D4'), false);
assert.equal(normalizeClassJoinCode('  AMBER   brook-silver  '), 'amber-brook-silver');
const dbSource = fs.readFileSync(new URL('../server/db.js', import.meta.url), 'utf8');
const roomSource = fs.readFileSync(new URL('../server/rooms.js', import.meta.url), 'utf8');
assert.match(dbSource, /randomInt\(1_000_000_000, 10_000_000_000\)/, 'room codes must be 10-digit numeric values');
assert.match(dbSource, /!\^\\d\{10\}\$|!\/\^\\d\{10\}\$\//, 'legacy room codes must be migrated');
assert.match(roomSource, /\^\\d\{10\}\$/, 'room join endpoint must validate 10-digit codes');
console.log('Secure code tests passed: 100 unique eight-word class codes and 10-digit room-code validation/migration.');
