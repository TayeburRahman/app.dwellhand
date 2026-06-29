import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const getCachedPermits = unstable_cache(
  async (license: string) => {
    const allPermits: any[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;

    while (true) {
      const { data: permits, error } = await supabaseAdmin
        .from('ca_permits')
        .select(
          'address, city, state, zip_code, permit_type, issue_date, permit_number, ' +
          'valuation, permit_link, is_commercial, is_residential, is_basement, ' +
          'is_hillside, latitude, longitude, work_description, project_type, ' +
          'project_category, contractor, square_feet, status'
        )
        .like('contractor_license', license + '%')
        .order('issue_date', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        throw new Error(error.message);
      }

      if (permits) {
        allPermits.push(...permits);
      }

      if (!permits || permits.length < PAGE_SIZE) {
        break;
      }
      page++;
    }

    return allPermits;
  },
  ['contractor-permits'],
  { revalidate: 3600 }
);

const getCachedKeywordPermits = unstable_cache(
  async (keyword: string) => {
    const { data: permits, error } = await supabaseAdmin
      .rpc('search_permits_by_keyword', { p_keyword: keyword });

    if (error) throw new Error(error.message);

    const resultList = permits || [];
    if (resultList.length > 0) {
      const permitNumbers = resultList.map((p: any) => p.permit_number).filter(Boolean);
      if (permitNumbers.length > 0) {
        const { data: licenses, error: licenseError } = await supabaseAdmin
          .from('ca_permits')
          .select('permit_number, contractor_license')
          .in('permit_number', permitNumbers);

        if (!licenseError && licenses) {
          const licenseMap = new Map(licenses.map(l => [l.permit_number, l.contractor_license]));
          resultList.forEach((p: any) => {
            p.contractor_license = licenseMap.get(p.permit_number) || null;
          });
        }
      }
    }

    return resultList;
  },
  ['keyword-permits'],
  { revalidate: 3600 }
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const license = searchParams.get('license')?.trim();
  const keyword = searchParams.get('keyword')?.trim();

  if (!license && !keyword) {
    return NextResponse.json({ error: 'License or Keyword required' }, { status: 400 });
  }

  try {
    let permits;
    if (license) {
      permits = await getCachedPermits(license);
    } else if (keyword) {
      permits = await getCachedKeywordPermits(keyword);
    }
    return NextResponse.json({ permits });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
