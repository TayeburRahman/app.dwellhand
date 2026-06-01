'use client';

import { useEffect, useRef, useMemo } from 'react';

interface Permit {
  address: string | null;
  permit_number: string | null;
  permit_type: string | null;
  valuation: number | null;
  issue_date: string | null;
  work_description: string | null;
  is_commercial: boolean | null;
  is_residential: boolean | null;
  is_basement: boolean | null;
  is_hillside: boolean | null;
  latitude: number | null;
  longitude: number | null;
}

interface ContractorMapViewProps {
  permits: Permit[];
}

function getPinColor(permit: Permit): string {
  if (permit.is_hillside) return '#f43f5e';    // rose
  if (permit.is_basement) return '#f59e0b';    // amber
  if (permit.is_commercial) return '#3b82f6';  // blue
  return '#10b981';                             // emerald (residential default)
}

function formatVal(v: number | null) {
  if (!v) return 'N/A';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

export default function ContractorMapView({ permits }: ContractorMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const validPermits = useMemo(
    () => permits.filter(p => p.latitude != null && p.longitude != null),
    [permits]
  );

  useEffect(() => {
    let mapboxgl: typeof import('mapbox-gl');
    let cancelled = false;

    async function initMap() {
      if (!mapContainer.current || mapRef.current) return;
      const mb = await import('mapbox-gl');
      await import('mapbox-gl/dist/mapbox-gl.css');
      if (cancelled) return;

      mapboxgl = mb.default as unknown as typeof import('mapbox-gl');
      (mapboxgl as any).accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

      const map = new (mapboxgl as any).Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-118.25, 34.05],
        zoom: 10,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on('load', () => {
        if (cancelled || validPermits.length === 0) return;

        // Add source
        map.addSource('contractor-permits', {
          type: 'geojson',
          data: {
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
                color: getPinColor(p),
              },
            })),
          },
        });

        // Glow layer
        map.addLayer({
          id: 'contractor-glow',
          type: 'circle',
          source: 'contractor-permits',
          paint: {
            'circle-radius': 14,
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.15,
            'circle-blur': 1,
          },
        });

        // Dot layer
        map.addLayer({
          id: 'contractor-dots',
          type: 'circle',
          source: 'contractor-permits',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 14, 9],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.95,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Popup on click
        map.on('click', 'contractor-dots', (e: any) => {
          const props = e.features[0].properties;
          const coords = e.features[0].geometry.coordinates.slice();
          const typeBadge = props.is_commercial ? 'Commercial' : 'Residential';
          const extra = [
            props.is_basement && 'Basement',
            props.is_hillside && 'Hillside',
          ].filter(Boolean).join(' · ');

          new (mapboxgl as any).Popup({ offset: 12, closeButton: true, maxWidth: '300px' })
            .setLngLat(coords)
            .setHTML(`
              <div style="font-family:system-ui;padding:4px 2px">
                <p style="font-size:13px;font-weight:900;color:#1e293b;margin:0 0 4px">${props.address}</p>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
                  <span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:#e0e7ff;color:#4338ca">${typeBadge}</span>
                  ${extra ? `<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:#fef3c7;color:#92400e">${extra}</span>` : ''}
                </div>
                <p style="font-size:11px;color:#64748b;margin:2px 0">
                  <b>#${props.permit_number}</b> &nbsp;·&nbsp; ${props.permit_type}
                </p>
                <p style="font-size:11px;color:#64748b;margin:2px 0">
                  📅 ${props.issue_date} &nbsp;·&nbsp; <b style="color:#059669">${formatVal(props.valuation)}</b>
                </p>
                ${props.work_description ? `<p style="font-size:10px;color:#94a3b8;margin-top:6px;line-height:1.4">${props.work_description.slice(0, 120)}${props.work_description.length > 120 ? '…' : ''}</p>` : ''}
              </div>
            `)
            .addTo(map);
        });

        map.on('mouseenter', 'contractor-dots', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'contractor-dots', () => {
          map.getCanvas().style.cursor = '';
        });

        // Fit bounds to all pins
        if (validPermits.length > 1) {
          const lngs = validPermits.map(p => p.longitude!);
          const lats = validPermits.map(p => p.latitude!);
          map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: 60, maxZoom: 14, duration: 1000 }
          );
        } else if (validPermits.length === 1) {
          map.flyTo({ center: [validPermits[0].longitude!, validPermits[0].latitude!], zoom: 13 });
        }
      });
    }

    initMap();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [validPermits]);

  if (validPermits.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-700 rounded-2xl h-[340px] flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <p className="text-slate-400 text-sm font-bold">No geocoded permit locations available</p>
        <p className="text-slate-600 text-xs">Map pins require latitude/longitude data in ca_permits</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-5 bg-indigo-500 rounded-full" />
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Builder Activity Map</h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Residential</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Commercial</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Basement</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />Hillside</span>
        </div>
      </div>
      <div
        ref={mapContainer}
        className="w-full h-[420px] rounded-2xl overflow-hidden border border-slate-700 shadow-xl shadow-slate-900/30"
      />
      <p className="text-[10px] font-bold text-slate-400 mt-2 text-right">
        {validPermits.length} pinned location{validPermits.length !== 1 ? 's' : ''} · Click pins for details
      </p>
    </div>
  );
}
