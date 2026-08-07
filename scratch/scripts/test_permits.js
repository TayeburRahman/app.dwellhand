const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkLike() {
  console.log("Checking like...");
  const start = Date.now();
  const { data, error } = await supabaseAdmin
    .from('ca_permits')
    .select('permit_number')
    .like('contractor_license', '1001034%')
    .limit(10);
  console.log("Time:", Date.now() - start, "ms. Error:", error?.message, "Count:", data?.length);
}
checkLike();
