import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function fetchPermitsByLicense(license: string) {
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
      // Statement timeout — treat as empty, not a crash
      if (error.code === '57014' || error.message?.includes('statement timeout')) {
        break;
      }
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
}

async function fetchPermitsByKeyword(keyword: string) {
  const { data: permits, error } = await supabaseAdmin
    .rpc('search_permits_by_keyword', { p_keyword: keyword });

  if (error) {
    if (error.code === '57014' || error.message?.includes('statement timeout')) {
      return [];
    }
    throw new Error(error.message);
  }

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
}

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
      permits = await fetchPermitsByLicense(license);
    } else if (keyword) {
      permits = await fetchPermitsByKeyword(keyword);
    }
    return NextResponse.json({ permits: permits ?? [] });
  } catch (error: any) {
    // Never expose raw DB errors to the client — return empty gracefully
    console.error('[permits] fetch error:', error.message);
    return NextResponse.json({ permits: [] });
  }
}
