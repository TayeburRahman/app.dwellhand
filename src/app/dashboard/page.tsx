'use client';

import React, { Suspense } from 'react';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Map as MapIcon, ArrowUpRight, BarChart3, Clock, MapPin, Search, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import PermitResultList from '@/components/PermitResultList';

const ContractorMapView = dynamic(() => import('@/components/ContractorMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[480px] rounded-2xl bg-slate-900/50 border border-slate-700 animate-pulse flex items-center justify-center">
      <p className="text-slate-500 text-sm font-bold">Loading map…</p>
    </div>
  ),
});

const supabase = createClient();

const fetchDashboardData = async () => {
  const { data: { user } } = await supabase.auth.getUser();

  // Use the standard ca_permits table as requested in requirements
  const tableName = 'ca_permits';

  const [countRes, recentRes, commRes, resRes] = await Promise.all([
    supabase.from(tableName).select('*', { count: 'estimated', head: true }),
    supabase.rpc('get_recent_permits'),
    supabase.from(tableName).select('*', { count: 'estimated', head: true }).eq('is_commercial', true),
    supabase.from(tableName).select('*', { count: 'estimated', head: true }).eq('is_residential', true)
  ]);

  return {
    user,
    totalPermits: (!countRes.error && countRes.count !== null) ? countRes.count.toLocaleString() : '0',
    commercialCount: (!commRes.error && commRes.count !== null) ? commRes.count.toLocaleString() : '0',
    residentialCount: (!resRes.error && resRes.count !== null) ? resRes.count.toLocaleString() : '0',
    recentPermits: recentRes.data || []
  };
};

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const keywordQuery = searchParams.get('keyword') || '';
  const licenseQuery = searchParams.get('license') || '';
  const addressQuery = searchParams.get('address') || '';

  const activeQuery = keywordQuery || licenseQuery || addressQuery;

  // Sync state for map viewport changes
  const [viewportPermits, setViewportPermits] = React.useState<any[] | null>(null);

  // Reset viewport permits when search query changes
  React.useEffect(() => {
    setViewportPermits(null);
  }, [activeQuery]);

  // SWR automatically handles caching, revalidation, and loading states!
  const { data, isLoading } = useSWR('dashboard_data', fetchDashboardData, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
  });

  const [currentTier, setCurrentTier] = React.useState('FREE');
  React.useEffect(() => {
    const fetchUserTier = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.user_metadata?.role;
      if (role === 'paid' || role === 'enterprise') {
        setCurrentTier('ENTERPRISE');
      } else if (role === 'commercial') {
        setCurrentTier('COMMERCIAL');
      } else if (role === 'residential') {
        setCurrentTier('RESIDENTIAL');
      } else {
        setCurrentTier('FREE');
      }
    };
    fetchUserTier();
  }, []);

  const { data: searchResults, error: searchError, isLoading: searchLoading } = useSWR(
    activeQuery ? `search_permits_${activeQuery}` : null,
    async () => {
      let url = '';
      if (licenseQuery) {
        url = `/api/contractors/permits?license=${encodeURIComponent(licenseQuery)}`;
      } else if (keywordQuery) {
        url = `/api/contractors/permits?keyword=${encodeURIComponent(keywordQuery)}`;
      } else if (addressQuery) {
        url = `/api/contractors/permits?keyword=${encodeURIComponent(addressQuery)}`;
      }
      if (!url) return [];
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch search results');
      }
      const data = await res.json();
      return data.permits || [];
    }
  );

  const [keyword, setKeyword] = React.useState('');

  // Sync search keyword input with keywordQuery parameter
  React.useEffect(() => {
    if (keywordQuery) {
      setKeyword(keywordQuery);
    }
  }, [keywordQuery]);

  const user = data?.user;
  const totalPermits = data?.totalPermits || '0';
  const recentPermits = data?.recentPermits || [];

  if (activeQuery) {
    return (
      <div className="space-y-8 animate-in pb-10 mesh-gradient min-h-full -m-8 p-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              setKeyword('');
              router.push('/dashboard');
            }}
            className="text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            ← Back to Market Intelligence
          </button>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Permit Explorer Results
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold tracking-tight text-indigo-950">
            {licenseQuery ? `Builder Permits` : `Keyword Search Results`}
          </h1>
          <p className="text-sm font-semibold text-slate-500 mt-2">
            {licenseQuery
              ? `Showing permits for contractor license #${licenseQuery}`
              : `Showing permits matching keyword "${keywordQuery || addressQuery}"`}
          </p>
        </div>

        {searchLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1 space-y-6">
              <div className="w-full h-[480px] rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="h-6 w-48 bg-slate-100 rounded animate-pulse" />
              <div className="h-28 w-full bg-slate-100 rounded-2xl animate-pulse" />
              <div className="h-28 w-full bg-slate-100 rounded-2xl animate-pulse" />
              <div className="h-28 w-full bg-slate-100 rounded-2xl animate-pulse" />
            </div>
          </div>
        ) : searchError ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-bold">Error: {searchError.message}</p>
          </div>
        ) : !searchResults || searchResults.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-16 text-center shadow-lg shadow-indigo-100/30">
            <p className="text-slate-500 text-lg font-bold">No matching permits found</p>
            <p className="text-slate-400 text-sm mt-1">Try another search keyword or check spelling.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column: Map & Legend */}
            <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24">
              <ContractorMapView permits={searchResults} onViewportChange={setViewportPermits} />
            </div>

            {/* Right Column: Listings */}
            <div className="lg:col-span-2 relative">
              <PermitResultList
                permits={viewportPermits ?? searchResults}
                highlightAddress={addressQuery}
                currentTier={currentTier}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in pb-10 mesh-gradient min-h-full -m-8 p-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-indigo-950 leading-none">Market Intelligence</h1>
          <div className="text-slate-500 mt-4 flex items-center gap-3">
            {isLoading ? (
              <span className="h-5 w-48 bg-slate-100 rounded animate-pulse" />
            ) : (
              <>
                <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-100 uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Data Engine: Synchronized
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-full text-indigo-600 border border-indigo-100">
                  {user?.user_metadata?.role === 'paid' || user?.user_metadata?.role === 'enterprise' ? 'Enterprise Access' : 
                   user?.user_metadata?.role === 'commercial' ? 'Commercial Access' : 
                   user?.user_metadata?.role === 'residential' ? 'Residential Access' : 'Personal Access'}
                </span>
              </>
            )}
          </div>
        </div>
        {!isLoading && (
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left md:text-right">
            Feed ID: {Math.random().toString(36).substring(7).toUpperCase()} • {new Date().toLocaleTimeString()}
          </div>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="glass shadow-2xl border-white/60 group hover:scale-[1.02] transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Market Inventory
            </CardTitle>
            <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-7 w-20 bg-slate-100 rounded animate-pulse" />
            ) : (
              <div className="text-2xl md:text-3xl font-bold text-indigo-950">{totalPermits}</div>
            )}
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Verified Records</p>
          </CardContent>
        </Card>

        <Card className="glass shadow-2xl border-white/60 group hover:scale-[1.02] transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Residential Units
            </CardTitle>
            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-7 w-20 bg-slate-100 rounded animate-pulse" />
            ) : (
              <div className="text-2xl md:text-3xl font-bold text-emerald-600">{data?.residentialCount || '0'}</div>
            )}
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Development Pipeline</p>
          </CardContent>
        </Card>

        <Card className="glass shadow-2xl border-white/60 group hover:scale-[1.02] transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Commercial Assets
            </CardTitle>
            <BarChart3 className="w-3.5 h-3.5 text-violet-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-7 w-20 bg-slate-100 rounded animate-pulse" />
            ) : (
              <div className="text-2xl md:text-3xl font-bold text-violet-600">{data?.commercialCount || '0'}</div>
            )}
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Institutional Growth</p>
          </CardContent>
        </Card>

        <Card className="glass shadow-2xl border-white/60 group hover:scale-[1.02] transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Network Status
            </CardTitle>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-indigo-950 flex items-center gap-2">
              ACTIVE
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Cloud Synchronized</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass shadow-2xl border-white/60 overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardContent className="p-6 relative z-10 flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-indigo-950 flex items-center gap-2 mb-1">
              <Search className="w-5 h-5 text-indigo-500" /> Keyword Intelligence
            </h2>
            <p className="text-sm font-semibold text-slate-500">
              Discover permits by specific materials, brands, or descriptions (e.g., "solar", "pool", "tesla").
            </p>
          </div>
          <div className="w-full sm:w-auto flex-1 max-w-md relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && keyword.trim()) {
                  router.push(`/dashboard?keyword=${encodeURIComponent(keyword.trim())}`);
                }
              }}
              placeholder="Enter a keyword to search all permits..."
              className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 shadow-sm rounded-2xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/20 transition-all font-semibold text-slate-700 placeholder:text-slate-400"
            />
            <Button
              onClick={() => {
                if (keyword.trim()) router.push(`/dashboard?keyword=${encodeURIComponent(keyword.trim())}`);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all"
              size="sm"
            >
              Search
            </Button>
          </div>
        </CardContent>
        <div className="bg-slate-50/50 border-t border-slate-100 px-6 py-3 flex items-center gap-3 overflow-x-auto relative z-10">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Popular:</span>
          {['Solar', 'Pool', 'Roofing', 'HVAC', 'ADU', 'Kitchen', 'Foundation', 'Tesla'].map(tag => (
            <button
              key={tag}
              onClick={() => {
                setKeyword(tag);
                router.push(`/dashboard?keyword=${encodeURIComponent(tag)}`);
              }}
              className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded-full transition-colors whitespace-nowrap"
            >
              {tag}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass shadow-2xl border-white/40 flex flex-col group overflow-hidden min-h-[300px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Geospatial Analysis
            </CardTitle>
            <MapIcon className="w-4 h-4 text-indigo-500 group-hover:rotate-12 transition-transform" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col relative z-10">
            <div className="text-4xl font-bold text-indigo-950 mb-3 tracking-tighter">Permit Explorer</div>
            <p className="text-sm font-semibold text-slate-500 mb-8 flex-1 leading-relaxed">
              Visualize municipal permit density and development velocity. Advanced spatial filters allow for granular neighborhood-level intelligence.
            </p>
            <Link href="/map" className="w-full">
              <Button className="w-full font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-7 shadow-2xl shadow-indigo-200/50 text-sm tracking-widest uppercase active:scale-95 transition-all">Access Intelligence Map</Button>
            </Link>
          </CardContent>
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-[100px] -mr-24 -mt-24" />
        </Card>

        <Card className="glass shadow-2xl border-white/40 flex flex-col group overflow-hidden min-h-[300px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Compliance & Auth
            </CardTitle>
            <FileText className="w-4 h-4 text-violet-500 group-hover:rotate-12 transition-transform" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col relative z-10">
            <div className="text-4xl font-bold text-indigo-950 mb-3 tracking-tighter">
              {user?.user_metadata?.role === 'paid' ? 'Enterprise' : 'Professional'}
            </div>
            <p className="text-sm font-semibold text-slate-500 mb-8 flex-1 leading-relaxed">
              Authorized for full-spectrum market data. Enterprise hooks for API integration and builder intelligence exports are enabled.
            </p>
            <Button variant="outline" className="w-full font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-2xl py-7 group text-sm tracking-widest uppercase active:scale-95 transition-all shadow-sm">
              Account Configuration <ArrowUpRight className="w-4 h-4 ml-2 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </CardContent>
          <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/5 rounded-full blur-[100px] -mr-24 -mt-24" />
        </Card>
      </div>

      <div className="mt-8">
        <Card className="glass shadow-2xl border-white/40 overflow-hidden rounded-2xl">
          <CardHeader className="border-b border-indigo-50 bg-indigo-50/20 pb-4">
            <CardTitle className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Intelligence Feed: Recent Transactions
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-white border-b border-border uppercase font-medium">
                <tr>
                  <th className="px-6 py-4 font-bold tracking-widest">Address</th>
                  <th className="px-6 py-4 font-bold tracking-widest text-center">Category</th>
                  <th className="px-6 py-4 font-bold tracking-widest text-right">Valuation</th>
                  <th className="px-6 py-4 font-bold tracking-widest text-right">Issue Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="bg-white">
                      <td className="px-6 py-4"><div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-6 w-20 bg-slate-100 rounded-full animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-16 bg-slate-100 rounded animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 rounded animate-pulse" /></td>
                    </tr>
                  ))
                ) : recentPermits.length > 0 ? (
                  recentPermits.map((permit: any) => (
                    <tr key={permit.permit_number} className="bg-white/40 hover:bg-white transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {permit.address || 'Unknown Address'}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">
                          {permit.permit_number || 'No Permit #'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant="outline" className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-tight text-slate-600 border-slate-200">
                          {permit.permit_type?.includes('new') ? 'New Build' : (permit.permit_type || 'Alteration')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {permit.valuation && permit.valuation >= 10000 ? (
                          <span className="text-sm font-bold text-emerald-600">
                            ${permit.valuation.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-slate-400 italic">Under $10k</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500 font-bold tabular-nums">
                        {permit.issue_date}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      No recent permits found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border bg-slate-50/50 p-4 text-center hover:bg-slate-50 transition-colors">
            <Link href="/map" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center justify-center gap-1">
              View All Locations on Map <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
