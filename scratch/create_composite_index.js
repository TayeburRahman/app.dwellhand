const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if (k && v) acc[k] = v;
  return acc;
}, {});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `CREATE INDEX IF NOT EXISTS idx_ca_permits_city_base_license ON ca_permits (LOWER(city), SPLIT_PART(contractor_license, '-', 1));`
  });
  console.log("Create index:", error);
}
run();
