'use client';

import { useState, useMemo, useCallback } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { getLADBSLink } from '@/lib/utils';

export interface Permit {
  address: string | null;
  city: string | null;
  permit_type: string | null;
  issue_date: string | null;
  permit_number: string | null;
  valuation: number | null;
  permit_link: string | null;
  is_commercial: boolean | null;
  is_residential: boolean | null;
  is_basement: boolean | null;
  is_hillside: boolean | null;
  latitude: number | null;
  longitude: number | null;
  work_description: string | null;
  project_type: string | null;
  project_category: string | null;
  contractor: string | null;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'residential', label: '🏠 Residential' },
  { key: 'commercial', label: '🏢 Commercial' },
  { key: 'new_build', label: '🔨 New Build' },
  { key: 'basement', label: '⬇️ Basement' },
  { key: 'hillside', label: '⛰️ Hillside' },
  { key: 'alteration', label: '🔧 Alteration' },
];

function getProjectLabels(permit: Permit): string[] {
  const labels: string[] = [];
  if (permit.is_residential) labels.push('Residential');
  if (permit.is_commercial) labels.push('Commercial');
  if (permit.is_basement) labels.push('Basement');
  if (permit.is_hillside) labels.push('Hillside');
  const type = permit.permit_type?.toLowerCase() ?? '';
  if (type.includes('new')) labels.push('New Build');
  if (type.includes('alter') || type.includes('renovation')) labels.push('Alteration');
  if (type.includes('adu')) labels.push('ADU');
  if (type.includes('addition')) labels.push('Addition');
  if (type.includes('grading') || type.includes('retaining')) labels.push('Grading');
  if (labels.length === 0 && permit.permit_type) labels.push(permit.permit_type);
  return labels;
}

const LABEL_COLORS: Record<string, string> = {
  Residential: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Commercial: 'bg-blue-50 text-blue-700 border-blue-200',
  Basement: 'bg-amber-50 text-amber-700 border-amber-200',
  Hillside: 'bg-rose-50 text-rose-700 border-rose-200',
  'New Build': 'bg-violet-50 text-violet-700 border-violet-200',
  Alteration: 'bg-slate-50 text-slate-700 border-slate-200',
  ADU: 'bg-teal-50 text-teal-700 border-teal-200',
  Addition: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Grading: 'bg-orange-50 text-orange-700 border-orange-200',
};

function filterPermit(permit: Permit, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'residential') return !!permit.is_residential;
  if (filter === 'commercial') return !!permit.is_commercial;
  if (filter === 'basement') return !!permit.is_basement;
  if (filter === 'hillside') return !!permit.is_hillside;
  if (filter === 'new_build') return !!(permit.permit_type?.toLowerCase().includes('new') || permit.permit_type?.toLowerCase().includes('addition'));
  if (filter === 'alteration') return !!(permit.permit_type?.toLowerCase().includes('alter') || permit.permit_type?.toLowerCase().includes('renovation'));
  return true;
}

interface PermitResultListProps {
  permits: Permit[];
}

export default function PermitResultList({ permits }: PermitResultListProps) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(
    () => permits.filter(p => filterPermit(p, activeFilter)),
    [permits, activeFilter]
  );

  const visible = showAll ? filtered : filtered.slice(0, 30);

  const handleFilter = useCallback((key: string) => {
    setActiveFilter(key);
    setShowAll(false);
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-5 bg-indigo-500 rounded-full" />
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
            Permit History
          </h3>
        </div>
        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap mb-5">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => handleFilter(f.key)}
            className={`text-xs font-black px-3 py-1.5 rounded-full border transition-all ${
              activeFilter === f.key
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Permit Cards */}
      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <p className="text-slate-400 font-bold">No permits match this filter</p>
          </div>
        ) : (
          visible.map((permit, idx) => {
            const labels = getProjectLabels(permit);
            return (
              <div
                key={permit.permit_number ?? idx}
                className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left side */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <p className="font-black text-slate-900 text-sm truncate group-hover:text-indigo-700 transition-colors">
                        {permit.address ?? 'Address Unknown'}
                      </p>
                      {permit.city && (
                        <span className="text-xs font-bold text-slate-400">{permit.city}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {permit.permit_number && (
                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          #{permit.permit_number}
                        </span>
                      )}
                      {permit.issue_date && (
                        <span className="text-[10px] font-bold text-slate-400">
                          📅 {permit.issue_date}
                        </span>
                      )}
                      {permit.valuation != null && permit.valuation >= 10000 && (
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          ${Number(permit.valuation).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {permit.work_description && (
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed line-clamp-2">
                        {permit.work_description}
                      </p>
                    )}
                  </div>

                  {/* Right side — labels + link */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex flex-wrap justify-end gap-1.5 max-w-[160px]">
                      {labels.map(label => (
                        <span
                          key={label}
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${LABEL_COLORS[label] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}
                        >
                          {label}
                        </span>
                      ))}
                    </div>

                    {permit.permit_number && (
                      <a
                        href={getLADBSLink(permit.permit_number, permit.permit_link ?? undefined)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors border border-indigo-200"
                      >
                        <ExternalLink className="w-3 h-3" />
                        LADBS
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Show more */}
      {!showAll && filtered.length > 30 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full mt-4 py-3 text-sm font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-2xl border border-indigo-200 transition-colors"
        >
          Show {filtered.length - 30} more permits ↓
        </button>
      )}
    </div>
  );
}
