const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2].trim().replace(/^"|"$/g, '');
});

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const baseLicenses = ['888104'];
  const licenseClass = 'C39';
  const base = (lic) => lic.includes('-') ? lic.split('-')[0] : lic;

  const { data: fallbackPermits, error } = await supabaseAdmin
    .from('ca_permits')
    .select('contractor_license, address, work_description')
    .or(baseLicenses.map(lic => `contractor_license.like.${base(lic)}%`).join(','))
    .not('address', 'is', null)
    .limit(5);

  console.log("Without order fallbackPermits:", fallbackPermits, error);
}
run();
