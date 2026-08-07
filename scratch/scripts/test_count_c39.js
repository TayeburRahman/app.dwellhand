const fs = require('fs');
if (fs.existsSync('.env.local')) {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = value;
    }
  });
}

const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  console.log("Counting permits matching %C39%...");
  const start = Date.now();
  const { count, error } = await supabaseAdmin
    .from('ca_permits')
    .select('*', { count: 'exact', head: true })
    .ilike('contractor_license', '%C39%');
  console.log("Time taken:", Date.now() - start, "ms");
  console.log("Error:", error?.message);
  console.log("Count:", count);
}
run();
