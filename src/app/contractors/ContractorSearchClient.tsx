'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';
import BuilderCard, { type BuilderProfile } from '@/components/BuilderCard';
import SummaryStats from '@/components/SummaryStats';
import PermitResultList, { type Permit } from '@/components/PermitResultList';
import { Search, Shield, Lock, ArrowUpRight, Loader2 } from 'lucide-react';

// Dynamic import to avoid SSR issues with Mapbox GL
const ContractorMapView = dynamic(() => import('@/components/ContractorMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] rounded-2xl bg-slate-900/50 border border-slate-700 animate-pulse flex items-center justify-center">
      <p className="text-slate-500 text-sm font-bold">Loading map…</p>
    </div>
  ),
});

// ─── Skeleton loaders ──────────────────────── 
function CardSkeleton() {
  return (
    <div className="bg-white/80 border border-white/60 rounded-2xl overflow-hidden shadow-xl animate-pulse">
      <div className="bg-gradient-to-br from-indigo-950 to-slate-900 p-6 h-36" />
      <div className="p-6 grid grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-200" />
            <div className="flex-1">
              <div className="h-2 w-20 bg-slate-200 rounded mb-2" />
              <div className="h-4 w-32 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 animate-pulse">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="bg-white/80 border border-white/60 rounded-2xl p-4 h-24" />
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white/80 border border-white/60 rounded-2xl p-5 h-24" />
      ))}
    </div>
  );
}

// ─── Upgrade wall for non-commercial users ──────────────────── 
function UpgradePrompt() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
        <Lock className="w-9 h-9 text-indigo-500" />
      </div>
      <h2 className="text-2xl font-black text-indigo-950 mb-3">Commercial Access Required</h2>
      <p className="text-slate-500 font-semibold leading-relaxed mb-8">
        Builder Intelligence — including full permit history, activity maps, project classifications,
        and business profiles — is available on the <strong className="text-indigo-700">Commercial Plan</strong>.
      </p>
      <a
        href="/dashboard/settings"
        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm px-8 py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95"
      >
        Upgrade to Commercial <ArrowUpRight className="w-4 h-4" />
      </a>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ContractorSearchClient() {
  const supabase = createClient();

  const [role, setRole] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  const [licenseInput, setLicenseInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<BuilderProfile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [viewportPermits, setViewportPermits] = useState<Permit[] | null>(null);

  // ── Fetch user role on mount ──
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setRole(user?.user_metadata?.role ?? null);
      setLoadingRole(false);
    })();
  }, [supabase]);

  // ── Scroll/Visibility Listener for Sticky Header Search ──
  const [isScrolled, setIsScrolled] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = searchContainerRef.current;
    if (!el) return;

    // The page scrolls inside <main> (dashboard layout), not window.
    // Find the scrollable parent to use as the IntersectionObserver root.
    const scrollParent = el.closest('main') ?? null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting);
      },
      { root: scrollParent, threshold: 0, rootMargin: '0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isCommercial = role === 'paid' || role === 'commercial' || role === 'enterprise';

  // ── Search handler ──
  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const license = licenseInput.trim();
    if (!license) return;

    setIsLoading(true);
    setError(null);
    setSearched(false);
    setProfile(null);
    setPermits([]);
    setViewportPermits(null);
    setProfileMissing(false);

    try {
      const [profileRes, permitsRes] = await Promise.all([
        fetch(`/api/contractors/profile?license=${encodeURIComponent(license)}`),
        fetch(`/api/contractors/permits?license=${encodeURIComponent(license)}`),
      ]);

      if (!profileRes.ok || !permitsRes.ok) {
        const pErr = await profileRes.json().catch(() => ({}));
        const mErr = await permitsRes.json().catch(() => ({}));
        throw new Error(pErr.error || mErr.error || 'Server error fetching builder data.');
      }

      const profileJson = await profileRes.json();
      const permitsJson = await permitsRes.json();

      setProfile(profileJson.profile ?? null);
      setProfileMissing(profileJson.profile === null);
      setPermits(permitsJson.permits ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Unexpected error. Please try again.');
    } finally {
      setIsLoading(false);
      setSearched(true);
    }
  }, [licenseInput]);

  // ── Loading role shell ──
  if (loadingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50">
      {/* ── Page Header ── */}
      <div className={`bg-white/90 backdrop-blur-md border-b border-slate-200/60 px-6 sm:px-8 py-4 sticky top-0 z-40 transition-all duration-300 ${isScrolled ? 'shadow-md py-3' : 'shadow-sm py-5'}`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Search className="w-4 h-4 text-white" />
            </div>
            <div className={`transition-all duration-300 ${isScrolled ? 'hidden md:block' : 'block'}`}>
              <h1 className="text-xl font-black text-indigo-950 leading-none">Contractor License Search</h1>
              <p className="text-slate-400 text-xs font-bold mt-0.5">Look up permits tied to a contractor's license.</p>
            </div>
          </div>

          {/* Compact Search for Header */}
          <div className={`flex-1 max-w-sm transition-all duration-300 ease-in-out origin-left ${isScrolled ? 'opacity-100 scale-100 w-full' : 'opacity-0 scale-95 w-0 overflow-hidden pointer-events-none'}`}>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={licenseInput}
                onChange={e => setLicenseInput(e.target.value)}
                placeholder="Enter License #"
                disabled={isLoading}
                className="flex-1 w-full border border-slate-200 rounded-xl px-4 py-2 text-slate-800 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              <button
                type="submit"
                disabled={isLoading || !licenseInput.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </form>
          </div>

          <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-lg shrink-0 ${isCommercial ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-slate-100 text-slate-500 shadow-slate-100 border border-slate-200'}`}>
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{isCommercial ? 'Commercial Subscription' : 'Regular Access'}</span>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* ── Section 1: Search form (Always Visible) ── */}
        <div ref={searchContainerRef} className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-2xl shadow-xl shadow-indigo-100/40 p-7">
          <form onSubmit={handleSearch}>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Contractor License Number
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={licenseInput}
                onChange={e => setLicenseInput(e.target.value)}
                placeholder="#1083426"
                disabled={isLoading}
                className="flex-1 border border-slate-200 rounded-xl px-5 py-3.5 text-slate-800 font-black text-base outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-300 bg-white/80"
              />
              <button
                type="submit"
                disabled={isLoading || !licenseInput.trim()}
                className="px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</>
                ) : (
                  <><Search className="w-4 h-4" /> Search</>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 font-bold mt-3">
              Type in a contractor's license number to see build history and activity.
              Partial matches are supported.
            </p>
          </form>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5 font-bold text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {isLoading && (
          <div className="space-y-10">
            <CardSkeleton />
            <StatsSkeleton />
            <div className="w-full h-[420px] rounded-2xl bg-slate-900/50 border border-slate-700 animate-pulse" />
            <ListSkeleton />
          </div>
        )}

        {/* ── Results ── */}
        {searched && !isLoading && (
          <div className="relative">
            {/* Paywall Overlay for Non-Commercial Users */}
            {!isCommercial && permits.length > 0 && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-start pt-32 px-6">
                <div className="bg-white/95 backdrop-blur-md border border-indigo-100 rounded-3xl p-10 shadow-2xl shadow-indigo-200/50 max-w-lg text-center sticky top-40 mx-auto">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                    <Lock className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-black text-indigo-950 mb-3">Unlock Builder Intelligence</h3>
                  <p className="text-slate-500 font-bold text-sm leading-relaxed mb-8">
                    You're seeing a preview of the data. Upgrade to the **Commercial Plan** to unlock complete business profiles,
                    permit histories, activity maps, and project valuations.
                  </p>
                  <a
                    href="/dashboard/settings"
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm px-8 py-4 rounded-2xl shadow-xl shadow-indigo-200 transition-all active:scale-95 w-full justify-center"
                  >
                    Upgrade for Full Access <ArrowUpRight className="w-4 h-4" />
                  </a>
                  <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest">
                    Commercial license required for raw data exports
                  </p>
                </div>
              </div>
            )}

            {/* Results Container (Blurred for homeowners) */}
            <div className={`space-y-10 transition-all duration-500 ${!isCommercial && permits.length > 0 ? 'blur-md pointer-events-none select-none grayscale-[0.3]' : ''}`}>
              {permits.length === 0 && !profile ? (
                /* Total empty state */
                <div className="bg-white/80 border border-white/60 rounded-2xl p-16 text-center shadow-xl shadow-indigo-100/30">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Search className="w-6 h-6 text-indigo-300" />
                  </div>
                  <p className="font-black text-slate-700 text-lg mb-1">No data found</p>
                  <p className="text-slate-400 text-sm font-bold">
                    License &quot;{licenseInput}&quot; has no records in our database.
                  </p>
                </div>
              ) : (
                <>
                  {/* ── Section 2: Builder Card ── */}
                  {profile ? (
                    <BuilderCard profile={profile} permits={permits} />
                  ) : profileMissing && permits.length > 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm font-bold text-amber-800">
                      ℹ️ No official Builder Intelligence profile found for this license — showing permit data only.
                    </div>
                  ) : null}

                  {/* ── Section 3: Summary Stats ── */}
                  {permits.length > 0 && <SummaryStats permits={permits} />}

                  {/* ── Section 4: Builder Activity Map ── */}
                  {permits.length > 0 && (
                    <ContractorMapView permits={permits} onViewportChange={setViewportPermits} />
                  )}

                  {/* ── Section 5: Permit / Project Result List ── */}
                  {permits.length > 0 && (
                    <PermitResultList permits={viewportPermits ?? permits} />
                  )}

                  {permits.length === 0 && (
                    <div className="bg-white/80 border border-white/60 rounded-2xl p-10 text-center">
                      <p className="font-bold text-slate-500">No permits found for this license number.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Initial empty state (Always Visible) ── */}
        {!searched && !isLoading && (
          <div className="bg-white/60 border-2 border-dashed border-indigo-100 rounded-2xl p-20 text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Search className="w-7 h-7 text-indigo-300" />
            </div>
            <p className="font-black text-indigo-950 text-lg mb-2">Builder Intelligence</p>
            <p className="text-slate-400 font-bold text-sm leading-relaxed max-w-md mx-auto">
              Enter a CSLB contractor license number above to see the full business profile,
              permit history, activity map, and project type breakdown.
            </p>
            {!isCommercial && (
              <p className="text-indigo-600 font-black text-[10px] uppercase tracking-widest mt-4">
                ✨ Preview available for regular subscribers
              </p>
            )}
            <div className="flex justify-center gap-4 mt-8 flex-wrap text-[10px] font-black uppercase tracking-widest">
              {['Builder Card', 'Activity Map', 'Stats Grid', 'Permit History', 'Project Labels'].map(f => (
                <span key={f} className="px-3 py-1.5 bg-indigo-50 text-indigo-500 rounded-full border border-indigo-100">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
