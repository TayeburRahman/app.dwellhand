import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const license = searchParams.get('license')?.trim();

  if (!license) {
    return NextResponse.json({ error: 'License required' }, { status: 400 });
  }

  const supabase = await createClient();

  // No row limit — server-side query is safe for 20M+ table because
  // contractor_license is indexed and filters to only this contractor's records.
  const allPermits: any[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data: permits, error } = await supabase
      .from('ca_permits')
      .select(
        'address, city, state, zip_code, permit_type, issue_date, permit_number, ' +
        'valuation, permit_link, is_commercial, is_residential, is_basement, ' +
        'is_hillside, latitude, longitude, work_description, project_type, ' +
        'project_category, contractor'
      )
      .gte('contractor_license', license)
      .lt('contractor_license', license + '~')
      .order('issue_date', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (permits) {
      allPermits.push(...permits);
    }

    if (!permits || permits.length < PAGE_SIZE) {
      break;
    }
    page++;
  }

  return NextResponse.json({ permits: allPermits });
}
