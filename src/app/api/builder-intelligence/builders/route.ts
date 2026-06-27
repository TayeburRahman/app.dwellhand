import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';

const PAGE_SIZE = 100;

type SortBy = 'count' | 'valuation';

interface RpcPermitRow {
  contractor_license: string;
  contractor_name: string | null;
  project_count: number;
  total_valuation: number;
  sample_addresses: string[] | null;
}

// Global client for cached public data fetching
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const getCachedPermitBased = unstable_cache(
  async (category: string, propertyType: string, subFilter: string, sortBy: SortBy, page: number, keyword: string, city: string, county: string) => {
    const offset = (page - 1) * PAGE_SIZE;

    // Run data fetch and total count in parallel
    const [dataRes, countRes] = await Promise.all([
      supabaseAdmin.rpc('get_builder_intelligence', {
        p_category:      category,
        p_property_type: propertyType,
        p_sub_filter:    subFilter,
        p_sort_by:       sortBy,
        p_result_limit:  PAGE_SIZE,
        p_offset:        offset,
        p_keyword:       keyword,
        p_city:          city,
        p_county:        county,
      }),
      supabaseAdmin.rpc('get_builder_intelligence_count', {
        p_category:      category,
        p_property_type: propertyType,
        p_sub_filter:    subFilter,
        p_keyword:       keyword,
        p_city:          city,
        p_county:        county,
      }),
    ]);

    if (dataRes.error) throw new Error(dataRes.error.message);
    if (countRes.error) throw new Error(countRes.error.message);

    const rows = (dataRes.data ?? []) as RpcPermitRow[];
    const totalCount = Number(countRes.data ?? 0);

    // Enrich with business names from builder_intelligence_test
    const licenses = rows.map(r => r.contractor_license);
    const { data: profiles } = licenses.length
      ? await supabaseAdmin
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

    return {
      builders,
      total_count:  totalCount,
      total_pages:  Math.ceil(totalCount / PAGE_SIZE),
      current_page: page,
    };
  },
  ['builder-intelligence-permit'],
  { revalidate: 3600 }
);

const getCachedClassificationBased = unstable_cache(
  async (licenseClass: string, propertyType: string, sortBy: SortBy, page: number, keyword: string, city: string, county: string) => {
    if (!licenseClass) {
      return { builders: [], total_count: 0, total_pages: 0, current_page: page };
    }

    const offset = (page - 1) * PAGE_SIZE;

    const [dataRes, countRes] = await Promise.all([
      supabaseAdmin.rpc('get_builders_by_class', {
        p_license_class: licenseClass,
        p_property_type: propertyType,
        p_sort_by:       sortBy,
        p_result_limit:  PAGE_SIZE,
        p_offset:        offset,
        p_keyword:       keyword,
        p_city:          city,
        p_county:        county,
      }),
      supabaseAdmin.rpc('get_builders_by_class_count', {
        p_license_class: licenseClass,
        p_property_type: propertyType,
        p_keyword:       keyword,
        p_city:          city,
        p_county:        county,
      }),
    ]);

    if (dataRes.error) throw new Error(dataRes.error.message);
    if (countRes.error) throw new Error(countRes.error.message);

    const rows = (dataRes.data ?? []) as Array<{
      contractor_license: string;
      contractor_name: string | null;
      project_count: number;
      total_valuation: number;
      sample_addresses: string[] | null;
    }>;
    const totalCount = Number(countRes.data ?? 0);

    const baseLicenses = rows.map(r => r.contractor_license);
    const { data: profiles } = baseLicenses.length
      ? await supabaseAdmin
          .from('builder_intelligence_test')
          .select('contractor_license, cslb_company_name, cslb_license_status')
          .in('contractor_license', baseLicenses)
      : { data: [] };

    const profileMap = new Map<string, { name: string; status: string }>();
    for (const p of profiles ?? []) {
      profileMap.set(String(p.contractor_license), {
        name: p.cslb_company_name ?? '',
        status: p.cslb_license_status ?? '',
      });
    }

    const builders = rows.map((r, i) => {
      const prof = profileMap.get(r.contractor_license);
      return {
        rank:               offset + i + 1,
        contractor_license: r.contractor_license,
        business_name:      prof?.name || r.contractor_name || 'Unknown Builder',
        license_status:     prof?.status ?? null,
        project_count:      r.project_count,
        total_valuation:    r.total_valuation,
        addresses:          r.sample_addresses ?? [],
      };
    });

    return {
      builders,
      total_count:  totalCount,
      total_pages:  Math.ceil(totalCount / PAGE_SIZE),
      current_page: page,
    };
  },
  ['builder-intelligence-classification'],
  { revalidate: 3600 }
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category     = searchParams.get('category')      ?? 'new_build';
  const propertyType = searchParams.get('type')          ?? 'all';
  const subFilter    = searchParams.get('filter')        ?? '';
  const licenseClass = searchParams.get('license_class') ?? '';
  const sortBy       = (searchParams.get('sort') ?? 'count') as SortBy;
  const page         = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const keyword      = searchParams.get('keyword')       ?? '';
  const city         = searchParams.get('city')          ?? '';
  const county       = searchParams.get('county')        ?? '';

  try {
    if (category === 'meps' || category === 'trades') {
      const data = await getCachedClassificationBased(licenseClass, propertyType, sortBy, page, keyword, city, county);
      return NextResponse.json(data);
    }

    const data = await getCachedPermitBased(category, propertyType, subFilter, sortBy, page, keyword, city, county);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
