const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  console.log("Starting queries...");
  
  const d1 = Date.now();
  const countRes = await supabaseAdmin.from('ca_permits').select('*', { count: 'estimated', head: true });
  console.log("Count:", Date.now() - d1, "ms. Error:", countRes.error?.message, countRes.count);

  const d2 = Date.now();
  const recentRes = await supabaseAdmin
      .from('ca_permits')
      .select('address, permit_number, issue_date, valuation, permit_type')
      .not('issue_date', 'is', null)
      .order('issue_date', { ascending: false })
      .limit(8);
  console.log("Recent:", Date.now() - d2, "ms. Error:", recentRes.error?.message, recentRes.data?.length);

  const d3 = Date.now();
  const commRes = await supabaseAdmin.from('ca_permits').select('*', { count: 'estimated', head: true }).eq('is_commercial', true);
  console.log("Comm:", Date.now() - d3, "ms. Error:", commRes.error?.message, commRes.count);
}
test();
