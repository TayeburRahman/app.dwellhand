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
  const { data } = await supabaseAdmin
      .from('builder_intelligence')
      .select('contractor_license, cslb_company_name')
      .ilike('cslb_company_name', '%TESLA%')
      .limit(2);
  console.log("Tesla Builder:", data);
}
run();
