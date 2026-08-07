const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('ca_permits')
    .select(`
        latitude, longitude, address, city, state, zip_code, 
        permit_number, issue_date, contractor, contractor_license, 
        square_feet, work_description, permit_type, valuation,
        project_type, architect, architect_license, permit_expediter,
        apn, geologist, geologist_license, project_category,
        engineer, engineer_license, permit_link,
        is_owner_builder, is_commercial, is_residential, is_hillside, is_basement
    `)
    .limit(1);
    
  console.log("Error:", error);
  console.log("Data:", data);
}

check();
