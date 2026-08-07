const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testSequential() {
  console.log("Starting data query...");
  const d1 = Date.now();
  const { data, error } = await supabaseAdmin.rpc('get_builder_intelligence', {
    p_category: 'new_build', p_property_type: 'all', p_sub_filter: '',
    p_sort_by: 'count', p_result_limit: 100, p_offset: 0, p_keyword: '', p_city: '', p_county: ''
  });
  console.log("Data query time:", Date.now() - d1, "ms. Error:", error?.message);

  console.log("Starting count query...");
  const c1 = Date.now();
  const { data: count, error: countErr } = await supabaseAdmin.rpc('get_builder_intelligence_count', {
    p_category: 'new_build', p_property_type: 'all', p_sub_filter: '',
    p_keyword: '', p_city: '', p_county: ''
  });
  console.log("Count query time:", Date.now() - c1, "ms. Error:", countErr?.message);
}
testSequential();
