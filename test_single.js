const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  console.log("Starting single query...");
  const start = Date.now();
  const { data, error } = await supabaseAdmin.rpc('get_builder_intelligence', {
    p_category: 'new_build', p_property_type: 'all', p_sub_filter: '',
    p_sort_by: 'count', p_result_limit: 100, p_offset: 0, p_keyword: '', p_city: '', p_county: ''
  });
  console.log("Time taken:", Date.now() - start, "ms");
  console.log("Error:", error?.message);
  console.log("Rows:", data?.length);
}
test();
