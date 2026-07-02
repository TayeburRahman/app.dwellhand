import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 100;

type SortBy = 'count' | 'valuation';

interface RpcPermitRow {
  contractor_license: string;
  contractor_name: string | null;
  project_count: number;
  total_valuation: number;
  sample_addresses: string[] | null;
}

// Global client for public data fetching
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Shared helper: fetch trade-specific addresses + descriptions ────────────
// Batches OR queries into chunks of 25 to stay within PostgREST URL limits.
// Phase 1: try trade-specific license suffix (e.g. '1234567-C39').
// Phase 2: fall back to any permit ('1234567%') for contractors with no results.
//
// IMPORTANT: builder_intelligence.contractor_license may be stored as a base
// number ('1234567') OR with a class suffix ('1234567-C39').
// We always extract the base number before building queries so that:
//   Phase 1 generates '1234567-C39%'  (not '1234567-C39-C39%')
//   Phase 2 generates '1234567%'       (not '1234567-C39%')
async function fetchAddressesForLicenses(
  baseLicenses: string[],
  licenseClass: string
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!baseLicenses.length) return map;

  // Strip any '-CLASS' suffix to get the pure numeric base license
  const base = (lic: string) => lic.includes('-') ? lic.split('-')[0] : lic;

  const BATCH = 25;

  function addToMap(
    permits: Array<{ contractor_license: string; address: string; work_description: string | null }>,
    matchList: string[],
    specificClass: boolean
  ) {
    for (const p of permits) {
      let matchedLic: string | undefined;
      if (specificClass) {
        matchedLic = matchList.find(lic =>
          p.contractor_license === `${base(lic)}-${licenseClass}` ||
          p.contractor_license.startsWith(`${base(lic)}-${licenseClass}`)
        );
      } else {
        matchedLic = matchList.find(lic => p.contractor_license.startsWith(base(lic)));
      }
      if (!matchedLic) continue;
      if (!map.has(matchedLic)) map.set(matchedLic, []);
      const list = map.get(matchedLic)!;
      const dupe = list.some(s => s.startsWith(p.address + '||') || s === p.address);
      if (list.length < 5 && !dupe) {
        const desc = p.work_description ? p.work_description.trim().substring(0, 80) : null;
        list.push(desc ? `${p.address}||${desc}` : p.address);
      }
    }
  }

  // Phase 1 — trade-specific (batched)
  for (let i = 0; i < baseLicenses.length; i += BATCH) {
    const batch = baseLicenses.slice(i, i + BATCH);
    const { data } = await supabaseAdmin
      .from('ca_permits')
      .select('contractor_license, address, work_description')
      .or(batch.map(lic => `contractor_license.like.${base(lic)}-${licenseClass}%`).join(','))
      .not('address', 'is', null)
      .limit(200);
    if (data) addToMap(data, batch, true);
  }

  // Phase 2 — fallback for contractors with no trade-specific permits (batched)
  const noResults = baseLicenses.filter(lic => !map.has(lic));
  for (let i = 0; i < noResults.length; i += BATCH) {
    const batch = noResults.slice(i, i + BATCH);
    const { data } = await supabaseAdmin
      .from('ca_permits')
      .select('contractor_license, address, work_description')
      .or(batch.map(lic => `contractor_license.like.${base(lic)}%`).join(','))
      .not('address', 'is', null)
      .limit(200);
    if (data) addToMap(data, batch, false);
  }

  return map;
}

async function fetchPermitBased(
  category: string,
  propertyType: string,
  subFilter: string,
  sortBy: SortBy,
  page: number,
  keyword: string,
  city: string,
  county: string
) {
  const offset = (page - 1) * PAGE_SIZE;

  const [dataRes, countRes] = await Promise.all([
    supabaseAdmin.rpc('get_builder_intelligence', {
      p_category: category,
      p_property_type: propertyType,
      p_sub_filter: subFilter,
      p_sort_by: sortBy,
      p_result_limit: PAGE_SIZE,
      p_offset: offset,
      p_keyword: keyword,
      p_city: city,
      p_county: county,
    }),
    supabaseAdmin.rpc('get_builder_intelligence_count', {
      p_category: category,
      p_property_type: propertyType,
      p_sub_filter: subFilter,
      p_keyword: keyword,
      p_city: city,
      p_county: county,
    }),
  ]);

  if (dataRes.error) throw new Error(dataRes.error.message);
  if (countRes.error) throw new Error(countRes.error.message);

  const rows = (dataRes.data ?? []) as RpcPermitRow[];
  const totalCount = Number(countRes.data ?? 0);

  // Enrich with business names from builder_intelligence
  const licenses = rows.map(r => r.contractor_license);
  const { data: profiles } = licenses.length
    ? await supabaseAdmin
      .from('builder_intelligence')
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
      rank: offset + i + 1,
      contractor_license: r.contractor_license,
      business_name: prof?.name ?? r.contractor_name ?? 'Unknown Builder',
      license_status: prof?.status ?? null,
      project_count: r.project_count,
      total_valuation: r.total_valuation,
      addresses: r.sample_addresses ?? [],
    };
  });

  return {
    builders,
    total_count: totalCount,
    total_pages: Math.ceil(totalCount / PAGE_SIZE),
    current_page: page,
  };
}

async function fetchClassificationBased(
  licenseClass: string,
  propertyType: string,
  sortBy: SortBy,
  page: number,
  keyword: string,
  city: string,
  county: string
) {
  if (!licenseClass) {
    return { builders: [], total_count: 0, total_pages: 0, current_page: page };
  }

  const offset = (page - 1) * PAGE_SIZE;

  // Fast-path: When there are no permit-specific filters (keyword, city, county),
  // query builder_intelligence directly to avoid expensive table scans on ca_permits.
  if (!keyword && !city && !county) {
    const countField =
      propertyType === 'residential' ? 'residential_permits' :
        propertyType === 'commercial' ? 'commercial_permits' :
          'total_permits';

    const [countRes, dataRes] = await Promise.all([
      supabaseAdmin
        .from('builder_intelligence')
        .select('*', { count: 'exact', head: true })
        .ilike('cslb_classification', `%${licenseClass}%`)
        .gt(countField, 0),
      supabaseAdmin
        .from('builder_intelligence')
        .select(`
          contractor_license,
          cslb_company_name,
          cslb_license_status,
          total_permits,
          total_valuation,
          residential_permits,
          commercial_permits
        `)
        .ilike('cslb_classification', `%${licenseClass}%`)
        .gt(countField, 0)
        .order(
          sortBy === 'valuation' ? 'total_valuation' : countField,
          { ascending: false }
        )
        .range(offset, offset + PAGE_SIZE - 1)
    ]);

    if (countRes.error) throw new Error(countRes.error.message);
    if (dataRes.error) throw new Error(dataRes.error.message);

    const totalCount = countRes.count ?? 0;
    const buildersList = dataRes.data ?? [];
    const licenses = buildersList.map(b => b.contractor_license);

    const addressMap = await fetchAddressesForLicenses(licenses, licenseClass);

    const builders = buildersList.map((r, i) => {
      let projectCount = r.total_permits;
      if (propertyType === 'residential') projectCount = r.residential_permits;
      if (propertyType === 'commercial') projectCount = r.commercial_permits;

      return {
        rank: offset + i + 1,
        contractor_license: r.contractor_license,
        business_name: r.cslb_company_name || 'Unknown Builder',
        license_status: r.cslb_license_status ?? null,
        project_count: projectCount,
        total_valuation: r.total_valuation,
        addresses: addressMap.get(r.contractor_license) ?? [],
      };
    });

    return {
      builders,
      total_count: totalCount,
      total_pages: Math.ceil(totalCount / PAGE_SIZE),
      current_page: page,
    };
  }

  // Slow-path: city/county/keyword filters require scanning ca_permits
  const [dataRes, countRes] = await Promise.all([
    supabaseAdmin.rpc('get_builders_by_class', {
      p_license_class: licenseClass,
      p_property_type: propertyType,
      p_sort_by: sortBy,
      p_result_limit: PAGE_SIZE,
      p_offset: offset,
      p_keyword: keyword,
      p_city: city,
      p_county: county,
    }),
    supabaseAdmin.rpc('get_builders_by_class_count', {
      p_license_class: licenseClass,
      p_property_type: propertyType,
      p_keyword: keyword,
      p_city: city,
      p_county: county,
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
      .from('builder_intelligence')
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

  const slowAddressMap = await fetchAddressesForLicenses(baseLicenses, licenseClass);

  const builders = rows.map((r, i) => {
    const prof = profileMap.get(r.contractor_license);
    return {
      rank: offset + i + 1,
      contractor_license: r.contractor_license,
      business_name: prof?.name || r.contractor_name || 'Unknown Builder',
      license_status: prof?.status ?? null,
      project_count: r.project_count,
      total_valuation: r.total_valuation,
      addresses: slowAddressMap.get(r.contractor_license) ?? [],
    };
  });

  return {
    builders,
    total_count: totalCount,
    total_pages: Math.ceil(totalCount / PAGE_SIZE),
    current_page: page,
  };
}

const getCachedClassificationBased = unstable_cache(
  async (licenseClass: string, propertyType: string, sortBy: SortBy, page: number, keyword: string, city: string, county: string) => {
    return fetchClassificationBased(licenseClass, propertyType, sortBy, page, keyword, city, county);
  },
  ['builder-intelligence-classification'],
  { revalidate: 3600 }
);

const getCachedPermitBased = unstable_cache(
  async (category: string, propertyType: string, subFilter: string, sortBy: SortBy, page: number, keyword: string, city: string, county: string) => {
    return fetchPermitBased(category, propertyType, subFilter, sortBy, page, keyword, city, county);
  },
  ['builder-intelligence-permit'],
  { revalidate: 3600 }
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') ?? 'new_build';
  const propertyType = searchParams.get('type') ?? 'all';
  const subFilter = searchParams.get('filter') ?? '';
  const licenseClass = searchParams.get('license_class') ?? '';
  const sortBy = (searchParams.get('sort') ?? 'count') as SortBy;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const keyword = searchParams.get('keyword') ?? '';
  const city = searchParams.get('city') ?? '';
  const county = searchParams.get('county') ?? '';

  try {
    let data;
    if (category === 'meps' || category === 'trades') {
      data = await getCachedClassificationBased(licenseClass, propertyType, sortBy, page, keyword, city, county);
    } else {
      data = await getCachedPermitBased(category, propertyType, subFilter, sortBy, page, keyword, city, county);
    }
    return NextResponse.json(data);
  } catch (err: any) {
    // Never expose raw DB errors — return empty gracefully on timeout or other errors
    console.error('[builder-intelligence] fetch error:', err.message);
    if (err.message?.includes('statement timeout') || err.code === '57014') {
      return NextResponse.json({ builders: [], total_count: 0, total_pages: 0, current_page: page });
    }
    return NextResponse.json({ builders: [], total_count: 0, total_pages: 0, current_page: page });
  }
}
