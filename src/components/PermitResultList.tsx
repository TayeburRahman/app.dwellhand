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
  square_feet?: number | null;
  status?: string | null;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'residential', label: '🏠 Residential' },
  { key: 'commercial', label: '🏢 Commercial' },
  { key: 'new_build', label: '🔨 New Build' },
  { key: 'basement', label: '⬇️ Basement' },
  { key: 'hillside', label: '⛰️ Hillside' },
  { key: 'alteration', label: '🔧 Alteration' },
  { key: 'nonbldg', label: '🏗️ NonBldg' },
  { key: 'adu', label: '🏠 ADU/JADU' },
];

function getProjectLabels(permit: Permit): string[] {
  const labels: string[] = [];
  if (permit.is_residential) labels.push('Residential');
  if (permit.is_commercial) labels.push('Commercial');
  if (permit.is_basement) labels.push('Basement');
  if (permit.is_hillside) labels.push('Hillside');
  
  const type = permit.permit_type?.toLowerCase() ?? '';
  const pType = permit.project_type?.toLowerCase() ?? '';
  const desc = permit.work_description?.toLowerCase() ?? '';

  if (type.includes('new') || type.includes('addition')) labels.push('New Build');
  if (type.includes('alter') || type.includes('renovation')) labels.push('Alteration');
  if (type.includes('adu') || desc.includes('adu') || desc.includes('jadu')) labels.push('ADU');
  
  const isNonBldg = type.includes('nonbldg') || type.includes('non-bldg') || type.includes('non building') ||
                    pType.includes('nonbldg') || pType.includes('non-bldg') || pType.includes('non building');
  if (isNonBldg) labels.push('NonBldg');

  if (type.includes('grading') || type.includes('retaining')) labels.push('Grading');

  if (labels.length === 0 && permit.permit_type) labels.push(permit.permit_type);
  return Array.from(new Set(labels));
}

const LABEL_COLORS: Record<string, string> = {
  Residential: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Commercial: 'bg-teal-50 text-teal-700 border-teal-200',
  Basement: 'bg-stone-50 text-stone-700 border-stone-200',
  Hillside: 'bg-amber-50 text-amber-800 border-amber-200',
  'New Build': 'bg-violet-50 text-violet-700 border-violet-200',
  Alteration: 'bg-slate-50 text-slate-700 border-slate-200',
  ADU: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Addition: 'bg-blue-50 text-blue-700 border-blue-200',
  Grading: 'bg-orange-50 text-orange-700 border-orange-200',
  NonBldg: 'bg-rose-50 text-rose-700 border-rose-200',
};

function filterPermit(permit: Permit, filter: string): boolean {
  const type = permit.permit_type?.toLowerCase() ?? '';
  const pType = permit.project_type?.toLowerCase() ?? '';
  const desc = permit.work_description?.toLowerCase() ?? '';

  if (filter === 'all') return true;
  if (filter === 'residential') return !!permit.is_residential;
  if (filter === 'commercial') return !!permit.is_commercial;
  if (filter === 'basement') return !!permit.is_basement;
  if (filter === 'hillside') return !!permit.is_hillside;
  if (filter === 'new_build') return !!(type.includes('new') || type.includes('addition'));
  if (filter === 'alteration') return !!(type.includes('alter') || type.includes('renovation'));
  if (filter === 'nonbldg') return !!(type.includes('nonbldg') || type.includes('non-bldg') || type.includes('non building') || pType.includes('nonbldg') || pType.includes('non-bldg') || pType.includes('non building'));
  if (filter === 'adu') return !!(type.includes('adu') || desc.includes('adu') || desc.includes('jadu'));
  return true;
}

interface PermitResultListProps {
  permits: Permit[];
}

export default function PermitResultList({ permits }: PermitResultListProps) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(30);

  const filtered = useMemo(
    () => permits.filter(p => filterPermit(p, activeFilter)),
    [permits, activeFilter]
  );

  const visible = filtered.slice(0, visibleCount);

  const handleFilter = useCallback((key: string) => {
    setActiveFilter(key);
    setVisibleCount(30);
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-5 bg-emerald-500 rounded-full" />
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
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-200'
                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Responsive Permit Cards List */}
      <div className="space-y-4">
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
                className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-2xl p-5 hover:border-emerald-300 hover:shadow-md transition-all flex flex-col gap-4 group"
              >
                {/* Top Row: Address, Permit Type, Link */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MapPin className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="font-black text-slate-900 text-base group-hover:text-emerald-700 transition-colors">
                      {permit.address ?? 'Address Unknown'}
                    </span>
                    {permit.city && (
                      <span className="text-xs font-bold text-slate-400">{permit.city}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {permit.permit_type ?? 'N/A'}
                    </span>
                    {permit.permit_number && (
                      <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        #{permit.permit_number}
                      </span>
                    )}
                  </div>
                </div>

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
                      className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-xl transition-colors border border-emerald-200 w-max shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Permit Link
                    </a>
                  )}
                </div>
              </div>

              {/* Middle Row: Meta Data (Issue Date, Valuation, Project Type, Sq Ft, Status) */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Issue Date</span>
                  <span className="text-sm font-bold text-slate-700">{permit.issue_date ?? 'N/A'}</span>
                </div>
                
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Valuation</span>
                  <span className="text-sm font-black text-emerald-700">
                    {permit.valuation != null ? `$${Number(permit.valuation).toLocaleString()}` : 'N/A'}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Project Type</span>
                  <span className="text-sm font-bold text-slate-700">{permit.project_type ?? 'N/A'}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Sq Ft</span>
                  <span className="text-sm font-bold text-slate-700">{permit.square_feet != null ? Number(permit.square_feet).toLocaleString() : 'N/A'}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Status</span>
                  <span className="text-[10px] font-black bg-white text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 max-w-[150px] truncate">
                    {permit.status ?? 'N/A'}
                  </span>
                </div>
              </div>

              {/* Bottom Row: Work Description */}
              <div className="text-xs text-slate-500 leading-relaxed max-w-4xl">
                <span className="font-bold text-slate-700 block mb-1">Work Description:</span>
                {permit.work_description ?? 'No description provided.'}
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Show more */}
      {filtered.length > visibleCount && (
        <button
          onClick={() => setVisibleCount(prev => prev + 50)}
          className="w-full mt-6 py-4 text-sm font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-2xl border border-emerald-200 transition-colors shadow-sm"
        >
          Show more permits ({filtered.length - visibleCount} remaining) ↓
        </button>
      )}
    </div>
  );
}
