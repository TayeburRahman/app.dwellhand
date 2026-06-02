const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const license = '993102';
  
  // Check builder_intelligence_test
  const { data: profile } = await supabase
    .from('builder_intelligence_test')
    .select('*')
    .eq('contractor_license', license);
  console.log('Profile:', profile);

  // Check ca_permits
  const { data: permits } = await supabase
    .from('ca_permits')
    .select('*')
    .eq('contractor_license', license)
    .limit(5);
  console.log('Permits with contractor_license 993102:', permits);

  // Check if there are any permits at all to see the columns
  const { data: anyPermit } = await supabase
    .from('ca_permits')
    .select('*')
    .limit(1);
  console.log('Sample permit:', anyPermit);
}

main().catch(console.error);
