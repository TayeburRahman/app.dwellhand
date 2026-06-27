const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabaseAdmin.rpc('get_table_schema', { table_name: 'ca_permits' });
  console.log(data || error);
}
test();
