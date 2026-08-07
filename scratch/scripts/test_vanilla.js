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
      .from('ca_permits')
      .select('contractor_license')
      .or('contractor_license.like.888104%')
      .limit(2);
  console.log("With like %:", data);
  
  const { data: d2 } = await supabaseAdmin
      .from('ca_permits')
      .select('contractor_license')
      .or('contractor_license.ilike.888104%')
      .limit(2);
  console.log("With ilike %:", d2);
  
  const { data: d3 } = await supabaseAdmin
      .from('ca_permits')
      .select('contractor_license')
      .or('contractor_license.like.888104*')
      .limit(2);
  console.log("With like *:", d3);
}
run();
