import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
async function test() {
  const batch = ["888104", "750184"];
  const licenseClass = "C10";
  const { data, error } = await supabaseAdmin
    .from('ca_permits')
    .select('contractor_license, address, work_description')
    .or(batch.map(lic => `contractor_license.like.${lic}-${licenseClass}%`).join(','))
    .limit(5);
  console.log("Phase 1:", error, data);

  const { data: d2, error: e2 } = await supabaseAdmin
    .from('ca_permits')
    .select('contractor_license, address, work_description')
    .or(batch.map(lic => `contractor_license.like.${lic}%`).join(','))
    .limit(5);
  console.log("Phase 2:", e2, d2);
}
test();
