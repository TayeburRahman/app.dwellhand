'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getLADBSLink } from '@/lib/utils';

interface PermitResult {
  address: string;
  permit_type: string;
  issue_date: string;
  permit_number: string;
  city: string;
  valuation: number | null;
  permit_link?: string;
}

const LADBS_BASE = 'https://www.ladbsservices2.lacity.org/OnlineServices/PermitReport/PcisPermitDetail?id1=';

export default function ContractorSearchClient() {
  const supabase = createClient();
  const [licenseInput, setLicenseInput] = useState('');
  const [results, setResults] = useState<PermitResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const license = licenseInput.trim();
    if (!license) return;

    setIsLoading(true);
    setError(null);
    setSearched(false);

    // Query against contractor_license index — Supabase query level only
    const { data, error: dbError } = await supabase
      .from('ca_permits')
      .select('address, permit_type, issue_date, permit_number, city, valuation, permit_link')
      .ilike('contractor_license', `%${license}%`)
      .order('issue_date', { ascending: false })
      .limit(200);

    setIsLoading(false);
    setSearched(true);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    setResults(data || []);
  }, [licenseInput, supabase]);

  return (
    <div className="bg-slate-50">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <h1 className="text-xl font-black text-slate-900">Contractor License Search</h1>
        </div>
        <p className="text-slate-500 text-sm ml-11">
          Look up all permits tied to a contractor license number. Queried directly against the Supabase index.
        </p>
      </div>

      {/* Search Form */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Contractor License Number
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={licenseInput}
              onChange={(e) => setLicenseInput(e.target.value)}
              placeholder="e.g. B-123456 or 987654"
              className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-semibold text-sm outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all placeholder:text-slate-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !licenseInput.trim()}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"/></svg>
                  Searching...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  Search
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Partial matches supported. Returns up to 200 most recent permits. Phase 3 will add full builder profile pages.
          </p>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* Results */}
        {searched && !isLoading && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900 text-lg">
                {results.length === 0
                  ? 'No permits found'
                  : `${results.length} permit${results.length !== 1 ? 's' : ''} found`}
              </h2>
              {results.length > 0 && (
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                  Max 200 results — Phase 3 unlocks full history
                </span>
              )}
            </div>

            {results.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
                <p className="text-slate-500 font-semibold">No permits found for license <span className="text-slate-800">&quot;{licenseInput}&quot;</span></p>
                <p className="text-slate-400 text-sm mt-1">Try a partial number or check for typos.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((permit) => (
                  <div
                    key={permit.permit_number}
                    className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-base truncate group-hover:text-slate-700 transition-colors">
                          {permit.address}
                        </p>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">{permit.city}</p>

                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                            {permit.permit_type || 'Unknown Type'}
                          </span>
                          <span className="text-xs text-slate-400 font-semibold">
                            📅 {permit.issue_date || 'N/A'}
                          </span>
                          {permit.permit_number && (
                            <span className="text-xs text-slate-400 font-semibold">
                              # {permit.permit_number}
                            </span>
                          )}
                          {permit.valuation && permit.valuation >= 10000 && (
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                              ${Number(permit.valuation).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {permit.permit_number && (
                        <a
                          href={getLADBSLink(permit.permit_number, permit.permit_link)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          LADBS
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Initial empty state */}
        {!searched && !isLoading && (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <p className="font-bold text-slate-700 text-base mb-1">Enter a contractor license number above</p>
            <p className="text-slate-400 text-sm">All permits tied to that license will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
