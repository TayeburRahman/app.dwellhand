import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const license = searchParams.get('license')?.trim();

  if (!license) {
    return NextResponse.json({ error: 'License required' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from('builder_intelligence')
    .select('*')
    .eq('contractor_license', license)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let mappedProfile = null;
  if (profile) {
    mappedProfile = {
      id: profile.id?.toString() || 'unknown',
      contractor_license: profile.contractor_license,
      business_name: profile.cslb_company_name || profile.contractor,
      owner_name: profile.ceo,
      business_address: profile.cslb_business_address,
      city: null,
      state: null,
      zip_code: null,
      entity_type: profile.cslb_entity_type,
      license_status: profile.cslb_license_status?.includes('active') ? 'Active' : profile.cslb_license_status?.includes('expired') ? 'Expired' : profile.cslb_license_status,
      license_class: profile.cslb_classification,
      issue_date: profile.cslb_issue_date,
      expiration_date: profile.cslb_expire_date,
      price_indicator: null,
    };
  }

  return NextResponse.json({ profile: mappedProfile });
}
