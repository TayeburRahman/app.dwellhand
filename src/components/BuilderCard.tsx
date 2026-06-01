'use client';

import { useMemo } from 'react';
import { Building2, User, MapPin, Hash, Calendar, Shield, Tag, TrendingUp } from 'lucide-react';

export interface BuilderProfile {
  id: string;
  contractor_license: string;
  business_name: string | null;
  owner_name: string | null;
  business_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  entity_type: string | null;
  license_status: string | null;
  license_class: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  price_indicator: string | null;
}

interface PermitForClassification {
  is_residential: boolean | null;
  is_commercial: boolean | null;
}

interface BuilderCardProps {
  profile: BuilderProfile;
  permits: PermitForClassification[];
}

const PRICE_INDICATOR_STYLES: Record<string, string> = {
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Moderate: 'bg-amber-50 text-amber-700 border-amber-200',
  High: 'bg-orange-50 text-orange-700 border-orange-200',
  Premium: 'bg-violet-50 text-violet-700 border-violet-200',
};

const STATUS_STYLES: Record<string, string> = {
  Active: 'bg-emerald-500',
  Inactive: 'bg-slate-400',
  Expired: 'bg-red-500',
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function BuilderCard({ profile, permits }: BuilderCardProps) {
  const { residentialPct, commercialPct, primaryType } = useMemo(() => {
    if (!permits.length) return { residentialPct: 0, commercialPct: 0, primaryType: 'Unknown' };
    const res = permits.filter(p => p.is_residential).length;
    const com = permits.filter(p => p.is_commercial).length;
    const total = permits.length;
    const resPct = Math.round((res / total) * 100);
    const comPct = Math.round((com / total) * 100);
    return {
      residentialPct: resPct,
      commercialPct: comPct,
      primaryType: resPct >= comPct ? 'Primarily Residential' : 'Primarily Commercial',
    };
  }, [permits]);

  const statusDot = STATUS_STYLES[profile.license_status ?? ''] ?? 'bg-slate-400';

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-2xl shadow-xl shadow-indigo-100/40 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-950 to-slate-900 p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #6366f1 0%, transparent 60%)' }} />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${statusDot} animate-pulse`} />
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                  {profile.license_status ?? 'Unknown Status'}
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight leading-tight">
                {profile.business_name ?? 'Business Name Unavailable'}
              </h2>
              {profile.owner_name && (
                <p className="text-sm text-indigo-200 mt-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {profile.owner_name}
                </p>
              )}
            </div>
            {/* Price indicator */}
            {profile.price_indicator ? (
              <span className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${PRICE_INDICATOR_STYLES[profile.price_indicator] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {profile.price_indicator}
              </span>
            ) : (
              <span className="text-xs font-bold text-indigo-400 bg-white/10 px-3 py-1.5 rounded-full border border-white/20">
                Price TBD
              </span>
            )}
          </div>

          {/* Classification badges */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <span className={`text-xs font-black px-3 py-1 rounded-full ${residentialPct >= commercialPct ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/10 text-indigo-300 border border-white/20'}`}>
              🏠 Primarily Residential
            </span>
            <span className={`text-xs font-black px-3 py-1 rounded-full ${commercialPct > residentialPct ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-white/10 text-indigo-300 border border-white/20'}`}>
              🏢 Primarily Commercial
            </span>
          </div>
        </div>
      </div>

      {/* Classification bar */}
      {permits.length > 0 && (
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-3 text-xs font-bold text-slate-600 mb-1.5">
            <span className="text-emerald-600">Residential {residentialPct}%</span>
            <span className="text-slate-300">|</span>
            <span className="text-blue-600">Commercial {commercialPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700"
              style={{ width: `${residentialPct}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-700"
              style={{ width: `${commercialPct}%` }}
            />
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{primaryType}</p>
        </div>
      )}

      {/* Info grid */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Address */}
        {profile.business_address && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Business Address</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5 leading-snug">
                {profile.business_address}
                {(profile.city || profile.state) && (
                  <span className="block text-slate-500">
                    {[profile.city, profile.state, profile.zip_code].filter(Boolean).join(', ')}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* License Number */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Hash className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">License Number</p>
            <p className="text-sm font-black text-slate-800 mt-0.5">{profile.contractor_license}</p>
          </div>
        </div>

        {/* Entity Type */}
        {profile.entity_type && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Building2 className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entity Type</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{profile.entity_type}</p>
            </div>
          </div>
        )}

        {/* License Class */}
        {profile.license_class && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Shield className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">License Class</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{profile.license_class}</p>
            </div>
          </div>
        )}

        {/* Issue Date */}
        {profile.issue_date && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Calendar className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">License Issued</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{formatDate(profile.issue_date)}</p>
            </div>
          </div>
        )}

        {/* Expiration Date */}
        {profile.expiration_date && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Tag className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expires</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{formatDate(profile.expiration_date)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
