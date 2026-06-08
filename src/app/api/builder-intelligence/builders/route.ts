import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE = 100;

type SortBy = 'count' | 'valuation';

interface RpcPermitRow {
  contractor_license: string;
  contractor_name: string | null;
  project_count: number;
  total_valuation: number;
  sample_addresses: string[] | null;
}

interface RpcClassRow extends RpcPermitRow {
  business_name: string | null;
  license_class: string | null;
  license_status: string | null;
}

async function handlePermitBased(
  supabase: any,
  category: string,
  propertyType: string,
  subFilter: string,
  sortBy: SortBy,
  page: number,
) {
  const offset = (page - 1) * PAGE_SIZE;

  // Run data fetch and total count in parallel
  const [dataRes, countRes] = await Promise.all([
    supabase.rpc('get_builder_intelligence', {
      p_category:      category,
      p_property_type: propertyType,
      p_sub_filter:    subFilter,
      p_sort_by:       sortBy,
      p_result_limit:  PAGE_SIZE,
      p_offset:        offset,
    }),
    supabase.rpc('get_builder_intelligence_count', {
      p_category:      category,
      p_property_type: propertyType,
      p_sub_filter:    subFilter,
    }),
  ]);

  if (dataRes.error) return NextResponse.json({ error: dataRes.error.message }, { status: 500 });
  if (countRes.error) return NextResponse.json({ error: countRes.error.message }, { status: 500 });

  const rows = (dataRes.data ?? []) as RpcPermitRow[];
  const totalCount = Number(countRes.data ?? 0);

  // Enrich with business names from builder_intelligence_test
  const licenses = rows.map(r => r.contractor_license);
  const { data: profiles } = licenses.length
    ? await supabase
        .from('builder_intelligence_test')
        .select('contractor_license, cslb_company_name, cslb_license_status')
        .in('contractor_license', licenses)
    : { data: [] };

  const profileMap = new Map<string, { name: string; status: string }>();
  for (const p of profiles ?? []) {
    profileMap.set(String(p.contractor_license), {
      name: p.cslb_company_name,
      status: p.cslb_license_status,
    });
  }

  const builders = rows.map((r, i) => {
    const prof = profileMap.get(r.contractor_license);
    return {
      rank:               offset + i + 1,
      contractor_license: r.contractor_license,
      business_name:      prof?.name ?? r.contractor_name ?? 'Unknown Builder',
      license_status:     prof?.status ?? null,
      project_count:      r.project_count,
      total_valuation:    r.total_valuation,
      addresses:          r.sample_addresses ?? [],
    };
  });

  return NextResponse.json({
    builders,
    total_count:  totalCount,
    total_pages:  Math.ceil(totalCount / PAGE_SIZE),
    current_page: page,
  });
}

async function handleClassificationBased(
  supabase: any,
  licenseClass: string,
  propertyType: string,
  sortBy: SortBy,
  page: number,
) {
  const offset = (page - 1) * PAGE_SIZE;

  const [dataRes, countRes] = await Promise.all([
    supabase.rpc('get_builders_by_classification', {
      p_license_class: licenseClass,
      p_property_type: propertyType,
      p_sort_by:       sortBy,
      p_result_limit:  PAGE_SIZE,
      p_offset:        offset,
    }),
    supabase.rpc('get_builders_by_classification_count', {
      p_license_class: licenseClass,
    }),
  ]);

  if (dataRes.error) return NextResponse.json({ error: dataRes.error.message }, { status: 500 });
  if (countRes.error) return NextResponse.json({ error: countRes.error.message }, { status: 500 });

  const rows = (dataRes.data ?? []) as RpcClassRow[];
  const totalCount = Number(countRes.data ?? 0);

  const builders = rows.map((r, i) => ({
    rank:               offset + i + 1,
    contractor_license: r.contractor_license,
    business_name:      r.business_name ?? r.contractor_name ?? 'Unknown Builder',
    license_status:     r.license_status ?? null,
    license_class:      r.license_class ?? '',
    project_count:      r.project_count,
    total_valuation:    r.total_valuation,
    addresses:          r.sample_addresses ?? [],
  }));

  return NextResponse.json({
    builders,
    total_count:  totalCount,
    total_pages:  Math.ceil(totalCount / PAGE_SIZE),
    current_page: page,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category     = searchParams.get('category')      ?? 'new_build';
  const propertyType = searchParams.get('type')          ?? 'all';
  const subFilter    = searchParams.get('filter')        ?? '';
  const licenseClass = searchParams.get('license_class') ?? '';
  const sortBy       = (searchParams.get('sort') ?? 'count') as SortBy;
  const page         = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  const supabase = await createClient();

  if (category === 'meps' || category === 'trades') {
    return handleClassificationBased(supabase, licenseClass, propertyType, sortBy, page);
  }

  return handlePermitBased(supabase, category, propertyType, subFilter, sortBy, page);
}
