import fs from 'node:fs';
import path from 'node:path';

let cachedEnv = null;

function normalizeEnvValue(value) {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

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
  const runtimeValue = normalizeEnvValue(process.env[name]);
  if (runtimeValue) {
    return runtimeValue;
  }

  if (!cachedEnv) {
    cachedEnv = parseEnvFile();
  }

  return normalizeEnvValue(cachedEnv[name]);
}
