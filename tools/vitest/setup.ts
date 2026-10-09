import fs from 'node:fs';
import path from 'node:path';

// Loads apps/campaign/.env.local (local Supabase URL/keys) for integration tests, without overriding real env.
const file = path.resolve(__dirname, '../../apps/campaign/.env.local');
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
  }
}
