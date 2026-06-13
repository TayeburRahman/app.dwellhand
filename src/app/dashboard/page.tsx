'use client';

import React from 'react';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Map as MapIcon, ArrowUpRight, BarChart3, Clock, MapPin, Search } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

const supabase = createClient();

const fetchDashboardData = async () => {
  const { data: { user } } = await supabase.auth.getUser();

  // Use the standard ca_permits table as requested in requirements
  const tableName = 'ca_permits';

  const [countRes, recentRes, commRes, resRes] = await Promise.all([
    supabase.from(tableName).select('*', { count: 'estimated', head: true }),
    supabase
      .from(tableName)
      .select('address, permit_number, issue_date, valuation, permit_type')
      .not('issue_date', 'is', null)
      .order('issue_date', { ascending: false })
      .limit(8),
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

export default function DashboardPage() {
  // SWR automatically handles caching, revalidation, and loading states!
  const { data, isLoading } = useSWR('dashboard_data', fetchDashboardData, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
  });

  const router = useRouter();
  const [keyword, setKeyword] = React.useState('');

  const user = data?.user;
  const totalPermits = data?.totalPermits || '0';
  const recentPermits = data?.recentPermits || [];

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
                  router.push(`/contractors?keyword=${encodeURIComponent(keyword.trim())}`);
                }
              }}
              placeholder="Enter a keyword to search all permits..."
              className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 shadow-sm rounded-2xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/20 transition-all font-semibold text-slate-700 placeholder:text-slate-400"
            />
            <Button
              onClick={() => {
                if (keyword.trim()) router.push(`/contractors?keyword=${encodeURIComponent(keyword.trim())}`);
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
                router.push(`/contractors?keyword=${encodeURIComponent(tag)}`);
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
