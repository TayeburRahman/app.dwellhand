import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const license = '993102';
  const { data, error } = await supabase
    .from('ca_permits')
    .select('permit_number, contractor_license')
    .gte('contractor_license', license)
    .lt('contractor_license', license + '~')
    .limit(5);

  return NextResponse.json({ count: data?.length, data, error });
}
