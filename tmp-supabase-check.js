const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const envPath = path.resolve(process.cwd(), '.env');
const env = {};
for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const idx = line.indexOf('=');
  if (idx === -1) continue;
  const key = line.slice(0, idx).trim();
  let value = line.slice(idx + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  env[key] = value;
}
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
supabase
  .from('equipment_specs')
  .select('*')
  .or('make.ilike.%caterpillar%,model.ilike.%caterpillar%,serial_number.ilike.%caterpillar%')
  .limit(5)
  .then(({ data, error }) => {
    console.log(JSON.stringify({ data, error }, null, 2));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
