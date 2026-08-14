import fs from 'node:fs';
import path from 'node:path';

let cachedEnv = null;

function parseEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const loaded = {};
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    loaded[key] = value;
  }
  return loaded;
}

export function getServerEnv(name) {
  if (process.env[name]) {
    return process.env[name];
  }

  if (!cachedEnv) {
    cachedEnv = parseEnvFile();
  }

  return cachedEnv[name];
}