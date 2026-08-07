const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  console.log("Starting queries...");
  
  const d2 = Date.now();
  const recentRes = await supabaseAdmin
      .from('ca_permits')
      .select('address, permit_number, issue_date, valuation, permit_type')
      .order('issue_date', { ascending: false })
      .limit(8);
  console.log("Recent without null check:", Date.now() - d2, "ms. Error:", recentRes.error?.message, recentRes.data?.length);
}
test();
