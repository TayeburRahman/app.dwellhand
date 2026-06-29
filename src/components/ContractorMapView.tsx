'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { getLADBSLink } from '@/lib/utils';

import { Permit } from '@/components/PermitResultList';

interface ContractorMapViewProps {
  permits: Permit[];
  onViewportChange?: (visiblePermits: Permit[]) => void;
}

function getPinColor(permit: Permit): string {
  if (permit.is_hillside) return '#f43f5e';   // rose
  if (permit.is_basement) return '#f59e0b';   // amber
  if (permit.is_commercial) return '#3b82f6';   // blue
  return '#10b981';                              // emerald (residential default)
}

function formatVal(v: number | null) {
  if (!v) return 'N/A';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

const LEGEND = [
  { label: 'Residential', color: '#10b981' },
  { label: 'Commercial', color: '#3b82f6' },
  { label: 'Basement', color: '#f59e0b' },
  { label: 'Hillside', color: '#f43f5e' },
];

export default function ContractorMapView({ permits, onViewportChange }: ContractorMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const validPermits = useMemo(
    () => permits.filter(p => p.latitude != null && p.longitude != null),
    [permits]
  );

  // Stats
  const stats = useMemo(() => ({
    residential: validPermits.filter(p => p.is_residential).length,
    commercial: validPermits.filter(p => p.is_commercial).length,
    basement: validPermits.filter(p => p.is_basement).length,
    hillside: validPermits.filter(p => p.is_hillside).length,
  }), [validPermits]);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapContainer.current || mapRef.current) return;
      const mb = await import('mapbox-gl');
      await import('mapbox-gl/dist/mapbox-gl.css');
      if (cancelled) return;

      const mapboxgl = mb.default as any;
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-118.25, 34.05],
        zoom: 10,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

      mapRef.current = map;

      map.on('load', () => {
        if (cancelled || validPermits.length === 0) { setReady(true); return; }

        const geojson: any = {
          type: 'FeatureCollection',
          features: validPermits.map(p => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.longitude!, p.latitude!] },
            properties: {
              address: p.address ?? 'Unknown',
              permit_number: p.permit_number ?? '',
              permit_type: p.permit_type ?? 'Unknown',
              valuation: p.valuation,
              issue_date: p.issue_date ?? '',
              work_description: p.work_description ?? '',
              is_residential: p.is_residential,
              is_commercial: p.is_commercial,
              is_basement: p.is_basement,
              is_hillside: p.is_hillside,
              permit_link: p.permit_link ?? '',
              color: getPinColor(p),
              contractor: p.contractor ?? '',
              contractor_license: p.contractor_license ?? '',
            },
          })),
        };

        map.addSource('permits', { type: 'geojson', data: geojson, cluster: true, clusterMaxZoom: 14, clusterRadius: 50 });

        // Cluster circles
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'permits',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': ['step', ['get', 'point_count'], '#6366f1', 10, '#4f46e5', 50, '#3730a3'],
            'circle-radius': ['step', ['get', 'point_count'], 20, 10, 28, 50, 36],
            'circle-opacity': 0.92,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Cluster count labels
        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'permits',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 13,
          },
          paint: { 'text-color': '#ffffff' },
        });

        // Glow halo for individual pins
        map.addLayer({
          id: 'pin-glow',
          type: 'circle',
          source: 'permits',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': 16,
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.18,
            'circle-blur': 0.8,
          },
        });

        // Individual pins
        map.addLayer({
          id: 'pins',
          type: 'circle',
          source: 'permits',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 14, 10],
            'circle-color': ['get', 'color'],
            'circle-opacity': 1,
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Popup on individual pin click
        map.on('click', 'pins', (e: any) => {
          const props = e.features[0].properties;
          const coords = e.features[0].geometry.coordinates.slice();
          const badges = [
            props.is_commercial ? { label: 'Commercial', bg: '#dbeafe', color: '#1d4ed8' } : null,
            props.is_residential ? { label: 'Residential', bg: '#d1fae5', color: '#065f46' } : null,
            props.is_basement ? { label: 'Basement', bg: '#fef3c7', color: '#92400e' } : null,
            props.is_hillside ? { label: 'Hillside', bg: '#ffe4e6', color: '#9f1239' } : null,
          ].filter(Boolean) as { label: string; bg: string; color: string }[];

          const link = getLADBSLink(props.permit_number, props.permit_link);

          new mapboxgl.Popup({ offset: 14, closeButton: true, maxWidth: '320px' })
            .setLngLat(coords)
            .setHTML(`
              <div style="font-family:Inter,system-ui,sans-serif;padding:6px 2px;min-width:220px">
                <p style="font-size:13px;font-weight:900;color:#0f172a;margin:0 0 8px;line-height:1.3">${props.address}</p>
                <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">
                  ${badges.map(b => `<span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:999px;background:${b.bg};color:${b.color}">${b.label}</span>`).join('')}
                </div>
                <div style="background:#f8fafc;border-radius:10px;padding:8px 10px;margin-bottom:8px">
                  <p style="font-size:11px;color:#475569;margin:0 0 3px"><span style="font-weight:800;color:#1e293b">Permit:</span> #${props.permit_number} &nbsp;·&nbsp; ${props.permit_type}</p>
                  <p style="font-size:11px;color:#475569;margin:0 0 3px"><span style="font-weight:800;color:#1e293b">Date:</span> ${props.issue_date} &nbsp;·&nbsp; <span style="font-weight:900;color:#059669">${formatVal(props.valuation)}</span></p>
                  ${props.contractor ? `
                    <p style="font-size:11px;color:#475569;margin:0">
                      <span style="font-weight:800;color:#1e293b">Builder:</span>
                      ${props.contractor_license ? `<a href="/contractors?license=${encodeURIComponent(props.contractor_license)}" style="color:#4f46e5;font-weight:800;text-decoration:underline">${props.contractor}</a>` : `<span style="font-weight:700">${props.contractor}</span>`}
                    </p>
                  ` : ''}
                </div>
                ${props.work_description ? `<p style="font-size:10px;color:#94a3b8;line-height:1.5;margin:0 0 8px">${props.work_description.slice(0, 130)}${props.work_description.length > 130 ? '…' : ''}</p>` : ''}
                ${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;color:#059669;text-decoration:none;padding:4px 8px;background:#ecfdf5;border-radius:6px;border:1px solid #a7f3d0">View Details ↗</a>` : ''}
              </div>
            `)
            .addTo(map);
        });

        // Click cluster → zoom in
        map.on('click', 'clusters', (e: any) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
          const clusterId = features[0].properties.cluster_id;
          (map.getSource('permits') as any).getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (err) return;
            map.easeTo({ center: features[0].geometry.coordinates, zoom });
          });
        });

        map.on('mouseenter', 'pins', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'pins', () => { map.getCanvas().style.cursor = ''; });
        map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });

        // Viewport change handler
        const updateViewport = () => {
          if (!onViewportChange) return;
          const bounds = map.getBounds();
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          const visible = permits.filter(p =>
            p.longitude != null && p.latitude != null &&
            p.longitude >= sw.lng && p.longitude <= ne.lng &&
            p.latitude >= sw.lat && p.latitude <= ne.lat
          );
          onViewportChange(visible);
        };

        map.on('moveend', updateViewport);

        // Fit bounds
        if (validPermits.length > 1) {
          const lngs = validPermits.map(p => p.longitude!);
          const lats = validPermits.map(p => p.latitude!);
          map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: 60, maxZoom: 14, duration: 1000 }
          );
        } else if (validPermits.length === 1) {
          map.flyTo({ center: [validPermits[0].longitude!, validPermits[0].latitude!], zoom: 14 });
        } else {
          updateViewport();
        }

        setReady(true);
      });
    }

    initMap();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [validPermits, onViewportChange, permits]);

  if (validPermits.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-5 bg-indigo-500 rounded-full" />
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Builder Activity Map</h3>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl h-[360px] flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm font-bold">No map locations available</p>
          <p className="text-slate-400 text-xs">Permit records are missing latitude/longitude coordinates</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-5 bg-indigo-500 rounded-full" />
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Builder Activity Map</h3>
        </div>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
          {validPermits.length} location{validPermits.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Stats bar */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {[
          { label: 'Residential', count: stats.residential, color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Commercial', count: stats.commercial, color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Basement', count: stats.basement, color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Hillside', count: stats.hillside, color: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 ${s.bg}`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.color}`} />
            <span className={`text-sm font-black ${s.text}`}>{s.count}</span>
            <span className="text-[10px] font-bold text-slate-500">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Map container */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-lg shadow-indigo-100/40">
        <div
          ref={mapContainer}
          className="w-full h-[480px]"
        />
        {/* Legend overlay */}
        <div className="absolute bottom-8 left-3 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-2.5 shadow-md">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Pin Legend</p>
          <div className="space-y-1">
            {LEGEND.map(l => (
              <div key={l.label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ background: l.color }} />
                <span className="text-[10px] font-bold text-slate-600">{l.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-1 pt-1 border-t border-slate-100">
              <span className="w-5 h-5 rounded-full flex-shrink-0 bg-indigo-600 flex items-center justify-center">
                <span className="text-white text-[7px] font-black">N+</span>
              </span>
              <span className="text-[10px] font-bold text-slate-600">Cluster</span>
            </div>
          </div>
        </div>
        {/* Loading shimmer */}
        {!ready && (
          <div className="absolute inset-0 bg-slate-100 animate-pulse flex items-center justify-center">
            <p className="text-slate-400 text-sm font-bold">Loading map…</p>
          </div>
        )}
      </div>
      <p className="text-[10px] font-bold text-slate-400 mt-2 text-right">
        Click pins for permit details · Scroll to zoom · Click clusters to expand
      </p>
    </div>
  );
}
