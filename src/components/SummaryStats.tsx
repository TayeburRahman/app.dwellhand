'use client';

import { useMemo } from 'react';
import { BarChart3, TrendingUp, Home, Building2, Layers, Hammer, Mountain, ArrowUpDown } from 'lucide-react';

interface Permit {
  valuation: number | null;
  is_residential: boolean | null;
  is_commercial: boolean | null;
  is_basement: boolean | null;
  is_hillside: boolean | null;
  permit_type: string | null;
}

interface SummaryStatsProps {
  permits: Permit[];
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-2xl p-4 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all group">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
        <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
      <p className="text-2xl font-black text-indigo-950 tracking-tight">{value}</p>
      {sub && <p className="text-[10px] font-bold text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function SummaryStats({ permits }: SummaryStatsProps) {
  const stats = useMemo(() => {
    const total = permits.length;
    const totalVal = permits.reduce((sum, p) => sum + (p.valuation ?? 0), 0);
    const residential = permits.filter(p => p.is_residential).length;
    const commercial = permits.filter(p => p.is_commercial).length;
    const basement = permits.filter(p => p.is_basement).length;
    const hillside = permits.filter(p => p.is_hillside).length;
    const newBuild = permits.filter(p =>
      p.permit_type?.toLowerCase().includes('new') || p.permit_type?.toLowerCase().includes('addition')
    ).length;
    const alteration = permits.filter(p =>
      p.permit_type?.toLowerCase().includes('alter') || p.permit_type?.toLowerCase().includes('renovation')
    ).length;
    const avgVal = total > 0 ? Math.round(totalVal / total) : 0;

    return { total, totalVal, residential, commercial, basement, hillside, newBuild, alteration, avgVal };
  }, [permits]);

  const fmt = (n: number) => n.toLocaleString();
  const fmtVal = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1.5 h-5 bg-indigo-500 rounded-full" />
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Builder Summary</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        <StatCard
          label="Total Permits"
          value={fmt(stats.total)}
          sub="All time"
          icon={BarChart3}
          color="bg-indigo-500"
        />
        <StatCard
          label="Total Valuation"
          value={fmtVal(stats.totalVal)}
          sub="Aggregate"
          icon={TrendingUp}
          color="bg-emerald-500"
        />
        <StatCard
          label="Residential"
          value={fmt(stats.residential)}
          sub={`${stats.total ? Math.round((stats.residential / stats.total) * 100) : 0}% of total`}
          icon={Home}
          color="bg-emerald-400"
        />
        <StatCard
          label="Commercial"
          value={fmt(stats.commercial)}
          sub={`${stats.total ? Math.round((stats.commercial / stats.total) * 100) : 0}% of total`}
          icon={Building2}
          color="bg-blue-500"
        />
        <StatCard
          label="New Builds"
          value={fmt(stats.newBuild)}
          sub="New construction"
          icon={Hammer}
          color="bg-violet-500"
        />
        <StatCard
          label="Basement"
          value={fmt(stats.basement)}
          sub="Basement projects"
          icon={Layers}
          color="bg-amber-500"
        />
        <StatCard
          label="Hillside / Grading"
          value={fmt(stats.hillside)}
          sub="Slope & grading"
          icon={Mountain}
          color="bg-rose-500"
        />
        <StatCard
          label="Alterations"
          value={fmt(stats.alteration)}
          sub="Renovation work"
          icon={ArrowUpDown}
          color="bg-slate-500"
        />
        <StatCard
          label="Avg Valuation"
          value={fmtVal(stats.avgVal)}
          sub="Per project"
          icon={BarChart3}
          color="bg-indigo-400"
        />
      </div>
    </div>
  );
}
