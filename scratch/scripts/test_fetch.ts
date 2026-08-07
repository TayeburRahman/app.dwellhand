import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const baseLicenses = ['888104'];
const licenseClass = 'C39';
const base = (lic: string) => lic.includes('-') ? lic.split('-')[0] : lic;

async function run() {
  const { data } = await supabaseAdmin
      .from('ca_permits')
      .select('contractor_license, address, work_description')
      .or(baseLicenses.map(lic => `contractor_license.like.${base(lic)}-${licenseClass}%`).join(','))
      .not('address', 'is', null)
      .order('issue_date', { ascending: false })
      .limit(2);
  console.log("Phase 1:", data);
  
  const { data: d2, error: e2 } = await supabaseAdmin
      .from('ca_permits')
      .select('contractor_license, address, work_description')
      .or(baseLicenses.map(lic => `contractor_license.like.${base(lic)}%`).join(','))
      .not('address', 'is', null)
      .order('issue_date', { ascending: false })
      .limit(2);
  console.log("Phase 2:", d2, e2);
}
run();
