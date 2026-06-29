'use client';

import { Bell, Search, User, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

const fetchUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export function Navbar() {
  const router = useRouter();
  const { data: user, isLoading } = useSWR('user_settings', fetchUser, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
  });

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ address: string; permit_number: string | null; permit_type: string | null; contractor_license: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Live search ca_permits as user types
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 3) { setResults([]); setShowDrop(false); return; }
    const tid = setTimeout(async () => {
      setSearching(true);
      try {
        // Search by address OR permit_number
        const { data } = await supabase
          .from('ca_permits')
          .select('address, permit_number, permit_type, contractor_license')
          .or(`address.ilike.%${q}%,permit_number.ilike.%${q}%`)
          .limit(8);
        setResults(data ?? []);
        setShowDrop(true);
      } catch {}
      setSearching(false);
    }, 250);
    return () => clearTimeout(tid);
  }, [query]);

  const handleSelect = (row: { address: string; permit_number: string | null; contractor_license: string | null }) => {
    setShowDrop(false);
    setQuery('');
    // Navigate to contractors page with license and address pre-filled
    const params = new URLSearchParams();
    if (row.contractor_license) {
      // Clean multi-licenses or suffixes (e.g. "1009682-B | 1009682-C10" -> "1009682")
      const baseLicense = row.contractor_license.split('|')[0].split('-')[0].trim();
      params.set('license', baseLicense);
    } else {
      // If no license, search globally by permit number or address
      params.set('keyword', row.permit_number || row.address);
    }
    if (row.address) params.set('address', row.address); // for highlighting
    router.push(`/dashboard?${params}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      setShowDrop(false);
      // Pass the raw query as a keyword search
      router.push(`/dashboard?keyword=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };

  const getInitials = () => {
    if (isLoading) return '...';
    if (!user) return 'U';
    const fullName = user.user_metadata?.full_name;
    if (fullName && fullName.trim().length > 0) return fullName.trim().charAt(0).toUpperCase();
    return user.email ? user.email.charAt(0).toUpperCase() : 'U';
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white/50 backdrop-blur-md sticky top-0 z-50 px-8 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md hidden md:block" ref={wrapRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (results.length) setShowDrop(true); }}
            placeholder="Search permits by address or number…"
            className="w-full pl-10 pr-8 py-2 text-sm bg-slate-100/70 border border-transparent rounded-lg outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 transition-all placeholder:text-slate-400 font-medium"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); setShowDrop(false); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Dropdown results */}
          {showDrop && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
              {results.map((row, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(row)}
                  className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
                >
                  <div className="text-sm font-bold text-slate-800 truncate">{row.address}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {row.permit_number && (
                      <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">#{row.permit_number}</span>
                    )}
                    {row.permit_type && (
                      <span className="text-[10px] font-bold text-indigo-500">{row.permit_type}</span>
                    )}
                  </div>
                </button>
              ))}
              <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 bg-slate-50">
                Press Enter to search all results
              </div>
            </div>
          )}
          {searching && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-3 text-center text-xs text-slate-400 font-bold">
              Searching…
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </button>
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary/20">
          {getInitials()}
        </div>
      </div>
    </header>
  );
}
