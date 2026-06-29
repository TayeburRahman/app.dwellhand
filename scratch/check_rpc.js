const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.rpc('get_table_schema', { table_name: 'ca_permits' });
  console.log("Schema error:", error);
  
  // Try calling search_permits_by_keyword and inspect the keys of the returned rows
  const { data: keywordData, error: keywordError } = await supabase.rpc('search_permits_by_keyword', { p_keyword: 'solar' }).limit(3);
  if (keywordData && keywordData.length > 0) {
    console.log("Returned columns for search_permits_by_keyword:", Object.keys(keywordData[0]));
    console.log("Contractor license details in returned row:", keywordData.map(r => ({ contractor: r.contractor, contractor_license: r.contractor_license })));
  } else {
    console.log("No data or error:", keywordError);
  }
}
test();
