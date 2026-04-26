'use client';

import React from 'react';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Map as MapIcon, ArrowUpRight, BarChart3, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

const supabase = createClient();

const fetchDashboardData = async () => {
  const { data: { user } } = await supabase.auth.getUser();

  const role = user?.user_metadata?.role || 'free';
  const tableName = role === 'paid' ? 'la_permits_2016_to_2026_03_20' : 'permits_sample';

  const [countRes, recentRes] = await Promise.all([
    supabase.from(tableName).select('*', { count: 'exact', head: true }),
    supabase
      .from(tableName)
      .select('id, address, status, issue_date, valuation')
      .not('issue_date', 'is', null)
      .order('issue_date', { ascending: false })
      .limit(5)
  ]);

  return {
    user,
    totalPermits: (!countRes.error && countRes.count !== null) ? countRes.count.toLocaleString() : 'Unavailable',
    recentPermits: recentRes.data || []
  };
};

export default function DashboardPage() {
  // SWR automatically handles caching, revalidation, and loading states!
  const { data, isLoading } = useSWR('dashboard_data', fetchDashboardData, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
  });

  const user = data?.user;
  const totalPermits = data?.totalPermits || '0';
  const recentPermits = data?.recentPermits || [];

  return (
    <div className="space-y-8 animate-in pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-2 flex items-center gap-2">
          {isLoading ? (
            <span className="h-5 w-48 bg-slate-100 rounded animate-pulse" />
          ) : (
            <>
              Welcome back, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Explorer'}
              <Badge variant="secondary" className="font-medium">
                {user?.user_metadata?.role === 'paid' ? 'Professional Plan' : 'Standard Plan'}
              </Badge>
            </>
          )}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-sm border-border bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Total Permits
            </CardTitle>
            <BarChart3 className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-24 bg-slate-100 rounded animate-pulse" />
            ) : (
              <div className="text-2xl font-bold text-slate-900">{totalPermits}</div>
            )}
            <p className="text-xs text-slate-500 mt-1">Available in your current tier</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Regions Covered
            </CardTitle>
            <MapPin className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">Los Angeles</div>
            <p className="text-xs text-slate-500 mt-1">Primary coverage area</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Data Freshness
            </CardTitle>
            <Clock className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">Real-time</div>
            <p className="text-xs text-slate-500 mt-1">Synced with SWR caching</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm border-border bg-white flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Interactive Map
            </CardTitle>
            <MapIcon className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="text-2xl font-bold text-slate-900 mb-4">Explore Permits</div>
            <p className="text-sm text-slate-600 mb-6 flex-1">
              Access the interactive map to visualize permit data clusters across Los Angeles in real-time.
            </p>
            <Link href="/map" className="w-full">
              <Button className="w-full font-medium">Open Explorer</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-white flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Data Access
            </CardTitle>
            <FileText className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="text-2xl font-bold text-slate-900 mb-4">
              {isLoading ? (
                <div className="h-8 w-40 bg-slate-100 rounded animate-pulse" />
              ) : (
                user?.user_metadata?.role === 'paid' ? 'Pro Tier Active' : 'Free Tier Active'
              )}
            </div>
            <p className="text-sm text-slate-600 mb-6 flex-1">
              {isLoading ? (
                <span className="block h-10 w-full bg-slate-100 rounded animate-pulse" />
              ) : (
                user?.user_metadata?.role === 'paid'
                  ? 'You have full access to historical records (2016+).'
                  : 'You are currently viewing a limited dataset. Upgrade to unlock historical records (2016 - 2025).'
              )}
            </p>
            <Button variant="outline" className="w-full font-medium pb-2 group" disabled={isLoading}>
              Upgrade Account <ArrowUpRight className="w-4 h-4 ml-2 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card className="shadow-sm border-border bg-white overflow-hidden">
          <CardHeader className="border-b border-border bg-slate-50/50 pb-4">
            <CardTitle className="text-lg font-semibold text-slate-900">
              Recent Permits
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-white border-b border-border uppercase font-medium">
                <tr>
                  <th className="px-6 py-4">Address</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Valuation</th>
                  <th className="px-6 py-4">Issue Date</th>
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
                    <tr key={permit.id} className="bg-white hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {permit.address || 'Unknown Address'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="bg-slate-50 text-slate-700 font-medium border-slate-200">
                          {permit.status || 'Pending'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {permit.valuation ? `$${permit.valuation.toLocaleString()}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {permit.issue_date ? new Date(permit.issue_date).toLocaleDateString() : 'N/A'}
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
