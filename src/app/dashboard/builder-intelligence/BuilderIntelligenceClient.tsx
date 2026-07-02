'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Building2, TrendingUp, Hash, Search, ChevronDown,
  ArrowUpRight, Loader2, Shield, Lock, Star, MapPin,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'new_build' | 'alteration' | 'adu' | 'meps' | 'trades';
type PropertyType = 'all' | 'residential' | 'commercial';
type SortBy = 'count' | 'valuation';
type SubFilter = 'all' | 'basement' | 'hillside';

interface Builder {
  rank: number;
  contractor_license: string;
  business_name: string;
  license_status: string | null;
  project_count: number;
  total_valuation: number;
  addresses: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'new_build', label: 'New Build', icon: '🏗️' },
  { key: 'alteration', label: 'Alteration / Addition / Repair', icon: '🔧' },
  { key: 'adu', label: 'ADU', icon: '🏡' },
  // MEPs = exactly C10 (Electrical), C20 (HVAC), C36 (Plumbing) per CSLB classification
  { key: 'meps', label: 'MEPs', icon: '⚡' },
  { key: 'trades', label: 'Owner-Builder', icon: '🛠️' },
];

// MEPs are strictly C10, C20, and C36 per CSLB classification.
// A contractor holding B + C10 will appear in both New Build and MEPs.
const MEP_CLASSES = [
  { code: 'C10', label: 'C10 – Electrical' },
  { code: 'C20', label: 'C20 – HVAC' },
  { code: 'C36', label: 'C36 – Plumbing' },
];

// C-class specialty trades + D-class specialty contractors (CSLB)
// Note: contractor_license in CA_PERMITS stores the full license+class suffix
// e.g. "1001034-C39", "1001034-D49"
const TRADE_OPTIONS = [
  { code: 'C12', label: 'C12 - Excavation / Earthwork / Asphalt' },
  { code: 'C8', label: 'C8 - Concrete / Pavers / Retaining Walls' },
  { code: 'C5', label: 'C5 - Framing' },
  { code: 'C53', label: 'C53 - Pool' },
  { code: 'C46', label: 'C46 - Solar' },
  { code: 'C39', label: 'C39 - Roofing' },
  { code: 'C42', label: 'C42 - Sanitation' },
  { code: 'D41', label: 'D41 - Siding And Decking' },
  { code: 'D51', label: 'D51 - Waterproofing' },
  { code: 'C21', label: 'C21 - Demolition' },
  { code: 'C29', label: 'C29 - Masonry / Outdoor Kitchen' },
  { code: 'C27', label: 'C27 - Landscaping' },
  { code: 'C13', label: 'C13 - Fence' },
  { code: 'C6', label: 'C6 - Cabinets / Finish Carpentry / Doors / Baseboards' },
  { code: 'C15', label: 'C15 - Flooring' },
  { code: 'C35', label: 'C35 - Stucco' },
  { code: 'C43', label: 'C43 - Sheet Metal' },
  { code: 'C17', label: 'C17 - Glazing' },
];

const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500',
  expired: 'bg-red-500',
};

// ─── Helper formatters ────────────────────────────────────────────────────────

function fmtVal(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function statusDot(status: string | null) {
  if (!status) return 'bg-slate-400';
  const s = status.toLowerCase();
  if (s.includes('active')) return STATUS_DOT.active;
  if (s.includes('expired')) return STATUS_DOT.expired;
  return 'bg-slate-400';
}

// ─── Autocomplete Input ───────────────────────────────────────────────────────

const autocompleteCache: Record<string, string[]> = {};

function AutocompleteInput({
  type,
  placeholder,
  value,
  onChange,
  onSearch,
  icon: Icon
}: {
  type: 'city' | 'county';
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  onSearch: () => void;
  icon: any;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      const trimmed = value.trim();
      if (!trimmed) {
        setSuggestions([]);
        return;
      }

      const cacheKey = `${type}:${trimmed.toLowerCase()}`;
      if (autocompleteCache[cacheKey]) {
        setSuggestions(autocompleteCache[cacheKey]);
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(`/api/locations/suggestions?type=${type}&q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          autocompleteCache[cacheKey] = data.suggestions || [];
          setSuggestions(autocompleteCache[cacheKey]);
        }
      } catch (err) {
        // ignore errors for autocomplete
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 150);
    return () => clearTimeout(timeoutId);
  }, [value, type]);

  return (
    <div className="relative" ref={wrapperRef}>
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => {
          if (value.trim()) setShowDropdown(true);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            setShowDropdown(false);
            onSearch();
          }
        }}
        className="w-full pl-9 pr-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all placeholder:text-slate-400"
      />

      {showDropdown && (suggestions.length > 0 || isLoading) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-xs text-slate-400 text-center flex items-center justify-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
            </div>
          ) : (
            <ul className="py-1">
              {suggestions.map((suggestion, i) => (
                <li
                  key={i}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer transition-colors"
                  onClick={() => {
                    onChange(suggestion);
                    setShowDropdown(false);
                  }}
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BuilderSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white/80 border border-white/60 rounded-2xl p-5 h-28" />
      ))}
    </div>
  );
}

// ─── Builder Result Card ──────────────────────────────────────────────────────

function BuilderCard({ builder }: { builder: Builder }) {
  const [expanded, setExpanded] = useState(false);
  const rankColor =
    builder.rank === 1 ? 'bg-amber-400 text-white shadow-amber-200' :
      builder.rank === 2 ? 'bg-slate-400 text-white shadow-slate-200' :
        builder.rank === 3 ? 'bg-orange-400 text-white shadow-orange-200' :
          'bg-indigo-50 text-indigo-600';

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
      <div className="p-5 flex items-start gap-4">
        {/* Rank */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 shadow-sm ${rankColor}`}>
          {builder.rank <= 3 ? <Star className="w-4 h-4" /> : `#${builder.rank}`}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-slate-900 text-base leading-tight group-hover:text-indigo-700 transition-colors truncate max-w-xs">
                  {builder.business_name}
                </h3>
                {builder.rank <= 3 && (
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    Top {builder.rank}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  <Hash className="w-3 h-3" />{builder.contractor_license}
                </span>
                {builder.license_status && (
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot(builder.license_status)}`} />
                    {builder.license_status}
                  </span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Projects</p>
                <p className="text-lg font-black text-indigo-700">{builder.project_count.toLocaleString()}</p>
              </div>
              <div className="w-px h-8 bg-slate-100" />
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Value</p>
                <p className="text-lg font-black text-emerald-600">{fmtVal(builder.total_valuation)}</p>
              </div>
              <a
                href={`/contractors?license=${encodeURIComponent(builder.contractor_license)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] font-black text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-xl transition-colors shadow-sm shadow-indigo-200 whitespace-nowrap"
              >
                View Profile <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Addresses */}
          {(builder.addresses ?? []).length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest"
              >
                <MapPin className="w-3 h-3" />
                {expanded ? 'Hide' : 'Show'} recent permits ({builder.addresses.length})
                <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
              {expanded && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {builder.addresses.map((entry, i) => {
                    const sepIdx = entry.indexOf('||');
                    const addr = sepIdx >= 0 ? entry.substring(0, sepIdx) : entry;
                    const desc = sepIdx >= 0 ? entry.substring(sepIdx + 2) : null;
                    return (
                      <a
                        key={i}
                        href={`/contractors?license=${encodeURIComponent(builder.contractor_license)}&address=${encodeURIComponent(addr)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`View permit details for ${addr}`}
                        className="inline-flex items-start gap-1.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 hover:border-indigo-400 hover:shadow-sm transition-all cursor-pointer group/addr w-full"
                      >
                        <MapPin className="w-2.5 h-2.5 text-indigo-400 group-hover/addr:text-indigo-600 flex-shrink-0 mt-0.5" />
                        <span className="flex-1 min-w-0">
                          <span className="font-black">{addr}</span>
                          {desc && (
                            <span className="text-indigo-400 font-normal"> — {desc}</span>
                          )}
                        </span>
                        <ArrowUpRight className="w-2.5 h-2.5 text-indigo-300 group-hover/addr:text-indigo-600 flex-shrink-0 mt-0.5" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upgrade wall ─────────────────────────────────────────────────────────────

function UpgradePrompt() {
  return (
    <div className="max-w-xl mx-auto text-center py-16 px-6">
      <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
        <Lock className="w-9 h-9 text-indigo-500" />
      </div>
      <h2 className="text-2xl font-black text-indigo-950 mb-3">Enterprise Access Required</h2>
      <p className="text-slate-500 font-semibold leading-relaxed mb-8">
        Builder Intelligence — discover, rank, and compare builders across LA County — is available
        on the <strong className="text-indigo-700">Enterprise Plan</strong>.
      </p>
      <a
        href="/dashboard/settings"
        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm px-8 py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95"
      >
        Upgrade Now <ArrowUpRight className="w-4 h-4" />
      </a>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BuilderIntelligenceClient() {
  const supabase = createClient();

  const [role, setRole] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  const [category, setCategory] = useState<Category>('new_build');
  const [propertyType, setPropertyType] = useState<PropertyType>('all');
  const [subFilter, setSubFilter] = useState<SubFilter>('all');
  const [licenseClass, setLicenseClass] = useState('');
  const [tradeCode, setTradeCode] = useState('C39');
  const [sortBy, setSortBy] = useState<SortBy>('count');

  const [city, setCity] = useState('');
  const [county, setCounty] = useState('');

  const [builders, setBuilders] = useState<Builder[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user role
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setRole(user?.user_metadata?.role ?? null);
      setLoadingRole(false);
    })();
  }, [supabase]);

  const isEnterprise = role === 'enterprise' || role === 'paid' || role === 'commercial';

  // Reset sub-filters when category changes
  useEffect(() => {
    setSubFilter('all');
    setLicenseClass(category === 'meps' ? 'C10' : '');
    setTradeCode('C39');
    setCity('');
    setCounty('');
    setBuilders([]);
    setHasSearched(false);
    setError(null);
  }, [category]);

  const handleSearch = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    if (page === 1) setHasSearched(false);

    const params = new URLSearchParams({ category, type: propertyType, sort: sortBy, page: String(page) });
    if (subFilter !== 'all') params.set('filter', subFilter);
    if (category === 'meps') params.set('license_class', licenseClass);
    if (category === 'trades') params.set('license_class', tradeCode);
    if (city.trim()) params.set('city', city.trim());
    if (county.trim()) params.set('county', county.trim());

    try {
      const res = await fetch(`/api/builder-intelligence/builders?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Server error');
      }
      const json = await res.json();
      setBuilders(json.builders ?? []);
      setTotalCount(json.total_count ?? 0);
      setTotalPages(json.total_pages ?? 1);
      setCurrentPage(page);
    } catch (err: any) {
      setError(err.message ?? 'Unexpected error. Please try again.');
    } finally {
      setIsLoading(false);
      setHasSearched(true);
    }
  }, [category, propertyType, subFilter, licenseClass, tradeCode, sortBy, city, county]);

  const goToPage = useCallback((page: number) => {
    handleSearch(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [handleSearch]);

  if (loadingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50">
      {/* ── Header ── */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200/60 px-6 sm:px-8 py-5 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-indigo-950 leading-none">Builder Intelligence</h1>
              <p className="text-slate-400 text-xs font-bold mt-0.5">Find & compare builders across LA County</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Property type toggle */}
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              {(['all', 'residential', 'commercial'] as PropertyType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setPropertyType(t)}
                  className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all ${propertyType === t
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  {t === 'all' ? 'All' : t === 'residential' ? '🏠 Residential' : '🏢 Commercial'}
                </button>
              ))}
            </div>

            <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-lg ${isEnterprise
              ? 'bg-indigo-600 text-white shadow-indigo-200'
              : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}>
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isEnterprise ? 'Enterprise' : 'Upgrade Required'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {!isEnterprise ? (
          <UpgradePrompt />
        ) : (
          <>
            {/* ── Category Tabs ── */}
            <div className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-2xl shadow-sm p-2 flex gap-1 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all ${category === cat.key
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                >
                  <span>{cat.icon}</span>
                  <span className="hidden sm:inline">{cat.label}</span>
                </button>
              ))}
            </div>

            {/* ── Filter Bar ── */}
            <div className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-2xl shadow-sm p-5 space-y-4">
              {/* Alteration sub-filters */}
              {category === 'alteration' && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Filter by</p>
                  <div className="flex gap-2 flex-wrap">
                    {([
                      { key: 'all', label: 'All Types' },
                      { key: 'basement', label: '⬇️ Basement Builds' },
                      { key: 'hillside', label: '⛰️ Hillside Builds' },
                    ] as { key: SubFilter; label: string }[]).map(f => (
                      <button
                        key={f.key}
                        onClick={() => setSubFilter(f.key)}
                        className={`text-xs font-black px-4 py-2 rounded-xl border transition-all ${subFilter === f.key
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                          }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* MEPs class filter */}
              {category === 'meps' && (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">License Class</p>
                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                      C10 · C20 · C36 only
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mb-3">
                    Builders holding a B license <em>and</em> a MEP class (e.g. B+C10) will appear in both New Build and MEPs.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {MEP_CLASSES.map(c => (
                      <button
                        key={c.code}
                        onClick={() => setLicenseClass(c.code)}
                        className={`text-xs font-black px-4 py-2 rounded-xl border transition-all ${licenseClass === c.code
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                          }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trades dropdown */}
              {category === 'trades' && (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Trade</p>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      C-class &amp; D-class specialty
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mb-3">
                    Filtered by the trade suffix in <code className="bg-slate-100 px-1 rounded">contractor_license</code> (e.g. 1001034-D49).
                    A builder with B+D49 appears in both New Build and this trade.
                  </p>
                  <div className="relative max-w-xs">
                    <select
                      value={tradeCode}
                      onChange={e => setTradeCode(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 bg-white appearance-none outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                    >
                      <optgroup label="C-class Specialty">
                        {TRADE_OPTIONS.filter(o => o.code.startsWith('C')).map(o => (
                          <option key={o.code} value={o.code}>{o.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="D-class Specialty">
                        {TRADE_OPTIONS.filter(o => o.code.startsWith('D')).map(o => (
                          <option key={o.code} value={o.code}>{o.label}</option>
                        ))}
                      </optgroup>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Location Filters */}
              <div className="pt-4 border-t border-slate-100 mt-2 mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Location Search</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AutocompleteInput
                    type="city"
                    placeholder="City (e.g. Los Angeles)"
                    value={city}
                    onChange={setCity}
                    onSearch={() => handleSearch(1)}
                    icon={MapPin}
                  />
                  <AutocompleteInput
                    type="county"
                    placeholder="County (e.g. Los Angeles)"
                    value={county}
                    onChange={setCounty}
                    onSearch={() => handleSearch(1)}
                    icon={MapPin}
                  />
                </div>
              </div>

              {/* Sort + Search row */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sort By</p>
                  <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                    {([
                      { key: 'count', label: '# Most Projects' },
                      { key: 'valuation', label: '$ Highest Value' },
                    ] as { key: SortBy; label: string }[]).map(s => (
                      <button
                        key={s.key}
                        onClick={() => setSortBy(s.key)}
                        className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all ${sortBy === s.key
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-400 hover:text-slate-600'
                          }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleSearch(1)}
                  disabled={isLoading}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm px-8 py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</>
                  ) : (
                    <><Search className="w-4 h-4" /> Find Builders</>
                  )}
                </button>
              </div>
            </div>

            {/* ── Error ── */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5 font-bold text-sm">
                ⚠️ {error}
              </div>
            )}

            {/* ── Loading ── */}
            {isLoading && <BuilderSkeleton />}

            {/* ── Results ── */}
            {!isLoading && hasSearched && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-indigo-500 rounded-full" />
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                      Builder Rankings
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                      {totalCount.toLocaleString()} total builder{totalCount !== 1 ? 's' : ''}
                    </span>
                    {totalPages > 1 && (
                      <span className="text-[10px] font-bold text-slate-400">
                        Page {currentPage} of {totalPages}
                      </span>
                    )}
                  </div>
                </div>

                {builders.length === 0 ? (
                  <div className="bg-white/80 border border-white/60 rounded-2xl p-16 text-center">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Building2 className="w-6 h-6 text-indigo-300" />
                    </div>
                    <p className="font-black text-slate-700 text-lg mb-1">No builders found</p>
                    <p className="text-slate-400 text-sm font-bold">
                      Try adjusting the filters or selecting a different category.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {builders.map((b: Builder) => (
                        <BuilderCard key={b.contractor_license} builder={b} />
                      ))}
                    </div>

                    {/* ── Pagination ── */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100">
                        <button
                          onClick={() => goToPage(currentPage - 1)}
                          disabled={currentPage === 1 || isLoading}
                          className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          ← Previous
                        </button>

                        <div className="flex items-center gap-1.5 flex-wrap justify-center">
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                            .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                              acc.push(p);
                              return acc;
                            }, [])
                            .map((item, idx) =>
                              item === '…' ? (
                                <span key={`ellipsis-${idx}`} className="w-9 text-center text-slate-400 font-black text-sm">…</span>
                              ) : (
                                <button
                                  key={item}
                                  onClick={() => goToPage(item as number)}
                                  disabled={isLoading}
                                  className={`w-9 h-9 rounded-xl text-sm font-black transition-all disabled:opacity-50 ${item === currentPage
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                    : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                                >
                                  {item}
                                </button>
                              )
                            )}
                        </div>

                        <button
                          onClick={() => goToPage(currentPage + 1)}
                          disabled={currentPage === totalPages || isLoading}
                          className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Initial state ── */}
            {!isLoading && !hasSearched && (
              <div className="bg-white/60 border-2 border-dashed border-indigo-100 rounded-2xl p-20 text-center">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <Search className="w-7 h-7 text-indigo-300" />
                </div>
                <p className="font-black text-indigo-950 text-lg mb-2">Ready to Discover Builders</p>
                <p className="text-slate-400 font-bold text-sm leading-relaxed max-w-md mx-auto">
                  Select a category and click <strong className="text-indigo-600">Find Builders</strong> to see ranked
                  contractors by project volume and total valuation.
                </p>

                <div className="flex justify-center gap-3 mt-8 flex-wrap">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setCategory(cat.key)}
                      className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border transition-all ${category === cat.key
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-indigo-50 text-indigo-500 border-indigo-100 hover:border-indigo-300'
                        }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>

                <div className="mt-10 grid grid-cols-3 gap-4 max-w-sm mx-auto text-center">
                  <div className="flex flex-col items-center gap-1">
                    <Building2 className="w-5 h-5 text-indigo-400" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ranked List</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Valuation</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <ArrowUpRight className="w-5 h-5 text-violet-400" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Builder Profile</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
