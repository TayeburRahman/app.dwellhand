'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Layers, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from './ui/switch';

const LockedField = ({ label, value, requiredTier, currentTier }: any) => {
  const tiers = ['FREE', 'RESIDENTIAL', 'COMMERCIAL', 'ENTERPRISE'];
  const requiredIndex = tiers.indexOf(requiredTier);
  const currentIndex = tiers.indexOf(currentTier);
  const isLocked = currentIndex < requiredIndex;

  if (isLocked) {
    return (
      <div className="col-span-2 sm:col-span-1" onClick={() => alert('Upgrade your plan to unlock this information')}>
        <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-2 mt-1 cursor-pointer bg-slate-50 p-1.5 rounded border border-slate-100 hover:border-slate-300 transition-colors group">
          <span className="text-sm font-mono text-slate-300 blur-[4px] select-none flex-1">Hidden Data 12</span>
          <span className="text-sm group-hover:scale-110 transition-transform">🔒</span>
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-2 sm:col-span-1">
      <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">{label}</span>
      <span className="text-sm font-semibold text-slate-800 break-words">{value || 'N/A'}</span>
    </div>
  );
};

const MAP_STYLES = {
  DARK: 'mapbox://styles/barneymandate/cmodp22ff003401sx4l24hy5d',
  LIGHT: 'mapbox://styles/barneymandate/cmmz9n7vx00hl01sk8zs7gp32'
};

// ── CITY CONFIG ──────────────────────────────────────────────────────────────
// To add a new city: add one entry here. No other code changes needed.
const CITIES = [
  {
    key: 'all',
    label: 'All Cities',
    dbValue: null,
    center: [-118.2437, 34.0522] as [number, number],
    zoom: 11,
  },
  {
    key: 'los_angeles',
    label: 'Los Angeles',
    dbValue: 'Los Angeles',
    center: [-118.2437, 34.0522] as [number, number],
    zoom: 12,
  },
  {
    key: 'beverly_hills',
    label: 'Beverly Hills',
    dbValue: 'Beverly Hills',
    center: [-118.4003, 34.0736] as [number, number],
    zoom: 13,
  },
  {
    key: 'santa_monica',
    label: 'Santa Monica',
    dbValue: 'Santa Monica',
    center: [-118.4912, 34.0195] as [number, number],
    zoom: 13,
  },
  {
    key: 'malibu',
    label: 'Malibu',
    dbValue: 'Malibu',
    center: [-118.7798, 34.0259] as [number, number],
    zoom: 12,
  },
] as const;

type CityKey = typeof CITIES[number]['key'];

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (mapboxToken) {
  mapboxgl.accessToken = mapboxToken;
}

export default function MapComponent() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const [mapStyle, setMapStyle] = useState<string>(MAP_STYLES.DARK);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isListViewOpen, setIsListViewOpen] = useState(true);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [selectedPermit, setSelectedPermit] = useState<any>(null);
  const [currentTier, setCurrentTier] = useState('FREE'); // Set tier for testing
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [sortBy, setSortBy] = useState<'most_active' | 'valuation' | 'name_az' | 'years_biz' | 'permit_year'>('most_active');
  const [selectedCity, setSelectedCity] = useState<CityKey>('all');

  // Viewport tracking for bound-based queries
  const [bounds, setBounds] = useState<mapboxgl.LngLatBounds | null>(null);

  // Database-Level Filters
  const [filters, setFilters] = useState({
    commercial: false,
    residential: false,
    basement: false,
    hillside: false,
    is_owner_builder: false,
  });

  // Mode Selection (PROMPT 9)
  type Mode = 'Builder' | 'Architect' | 'Engineer' | 'Trade' | 'Expeditor' | null;
  const [activeMode, setActiveMode] = useState<Mode>(null);
  const [builderSubFilter, setBuilderSubFilter] = useState<string | null>(null);
  const [tradeSubFilters, setTradeSubFilters] = useState<Record<string, boolean>>({
    Electrical: false, Plumbing: false, Mechanical: false, Grading: false,
    'Retaining Walls': false, 'Swimming Pool / Spa': false,
    Demolition: false, Roofing: false, Septic: false,
  });

  const supabase = createClient();

  // Fetch from Supabase using Viewport Bounds
  const fetchPermitData = useCallback(async () => {
    if (!bounds) return;

    setLoading(true);
    setError(null);

    const minLng = bounds.getWest();
    const maxLng = bounds.getEast();
    const minLat = bounds.getSouth();
    const maxLat = bounds.getNorth();

    // Query ca_permits_view (which handles the <10k valuation rule)
    // NOTE: Using ca_permits directly if view is not available yet, 
    // please switch to ca_permits_view once created in SQL Editor.
    let query = supabase
      .from('ca_permits')
      .select('id, latitude, longitude, address, city, state, zip_code, permit_number, issue_date, contractor, contractor_license, square_feet, work_description, permit_type, valuation')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gte('latitude', minLat)
      .lte('latitude', maxLat)
      .gte('longitude', minLng)
      .lte('longitude', maxLng)
      .limit(500); // Max 500 records per fetch

    // Apply Supabase-level sorting (PROMPT 11)
    if (sortBy === 'valuation') {
      query = query.order('valuation', { ascending: false, nullsFirst: false });
    } else if (sortBy === 'name_az') {
      query = query.order('contractor', { ascending: true, nullsFirst: false });
    } else if (sortBy === 'years_biz') {
      // Proxy: earliest issue_date = longest in business
      query = query.order('issue_date', { ascending: true });
    } else if (sortBy === 'permit_year') {
      query = query.order('issue_date', { ascending: false });
    } else {
      // most_active: newest first as default ordering; client-side group sort applied in render
      query = query.order('issue_date', { ascending: false });
    }

    // Apply city filter at Supabase query level (PROMPT 12)
    const cityConfig = CITIES.find(c => c.key === selectedCity);
    if (cityConfig?.dbValue) {
      query = query.eq('city', cityConfig.dbValue);
    }
    if (filters.commercial) query = query.eq('commercial', true);
    if (filters.residential) query = query.eq('residential', true);
    if (filters.basement) query = query.eq('basement', true);
    if (filters.hillside) query = query.eq('hillside', true);
    if (filters.is_owner_builder) query = query.eq('is_owner_builder', true);

    // Apply Mode filters at Supabase query level (PROMPT 9)
    if (activeMode === 'Builder') {
      if (builderSubFilter === 'New Builds') {
        query = query.ilike('permit_type', '%new%');
      } else if (builderSubFilter === 'ADU') {
        query = query.ilike('permit_type', '%adu%');
      } else if (builderSubFilter === 'Remediation') {
        query = query.ilike('permit_type', '%remediat%');
      } else {
        query = query.not('permit_type', 'ilike', '%electrical%')
                     .not('permit_type', 'ilike', '%plumbing%')
                     .not('permit_type', 'ilike', '%mechanical%');
      }
    } else if (activeMode === 'Architect') {
      query = query.ilike('permit_type', '%architect%');
    } else if (activeMode === 'Engineer') {
      query = query.ilike('permit_type', '%engineer%');
    } else if (activeMode === 'Expeditor') {
      query = query.ilike('permit_type', '%expedit%');
    } else if (activeMode === 'Trade') {
      const activeTradeKeys = Object.entries(tradeSubFilters)
        .filter(([, v]) => v)
        .map(([k]) => k.toLowerCase());
      if (activeTradeKeys.length > 0) {
        // Build OR filter for selected trade types at Supabase level
        const orClauses = activeTradeKeys
          .map(k => `permit_type.ilike.%${k}%`)
          .join(',');
        query = query.or(orClauses);
      } else {
        // Default: all trade types
        query = query.or(
          'permit_type.ilike.%electrical%,permit_type.ilike.%plumbing%,permit_type.ilike.%mechanical%,permit_type.ilike.%grading%,permit_type.ilike.%demolition%,permit_type.ilike.%roofing%,permit_type.ilike.%septic%,permit_type.ilike.%pool%,permit_type.ilike.%retaining%'
        );
      }
    }

    const { data: rawData, error: dbError } = await query;

    if (dbError) {
      console.error("Supabase Error:", dbError);
      
      // Fallback to sample data table if ca_permits_view is not ready
      if (dbError.code === '42P01') {
        setError("View 'ca_permits_view' does not exist yet. Please run the SQL script.");
      } else {
        setError(`Database query failed: ${dbError.message}`);
      }
      setLoading(false);
      return;
    }

    // Transform raw Supabase data to Mapbox GeoJSON
    const geojson = {
      type: 'FeatureCollection',
      features: (rawData || []).map((d: any) => {
        let category = 'Builder';
        const lowerType = (d.permit_type || '').toLowerCase();
        
        if (lowerType.match(/(electrical|plumbing|mechanical|grading|pool|spa|demolition|roofing|septic)/)) {
          category = 'Trade';
        } else if (lowerType.includes('architect') || (d.contractor && d.contractor.toLowerCase().includes('architect'))) {
          category = 'Architect';
        }

        return {
          type: 'Feature',
          properties: {
            id: d.id,
            address: d.address || 'Unknown Address',
            city: d.city || 'Unknown',
            state: d.state || 'CA',
            zip_code: d.zip_code || '',
            permit_number: d.permit_number || '',
            type: d.permit_type || 'Unknown Type',
            category: category,
            valuation: (d.valuation && d.valuation >= 10000) ? d.valuation : null,
            issue_date: d.issue_date || 'N/A',
            contractor: d.contractor || 'N/A',
            license: d.contractor_license || 'N/A',
            sq_ft: d.square_feet || 0,
            description: d.work_description || 'No description'
          },
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(d.longitude), parseFloat(d.latitude)]
          }
        };
      })
    };

    setData(geojson);
    setLoading(false);
  }, [bounds, filters, activeMode, builderSubFilter, tradeSubFilters, sortBy, selectedCity, supabase]);

  // Trigger fetch when bounds or filters change
  useEffect(() => {
    fetchPermitData();
  }, [fetchPermitData]);

  // Update map source when data changes
  useEffect(() => {
    if (!map.current || !data) return;
    const m = map.current;

    if (m.isStyleLoaded() && m.getSource('permits')) {
      (m.getSource('permits') as mapboxgl.GeoJSONSource).setData(data);
    }
  }, [data]);

  // Main Map Initialization
  useEffect(() => {
    if (!mapContainer.current) return;

    if (!mapboxgl.accessToken) {
      setError("Missing Mapbox Access Token. Please check env variables.");
      return;
    }

    if (!map.current) {
      try {
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: mapStyle,
          center: [-118.2437, 34.0522], // DTLA
          zoom: 12,
          pitch: 45,
          failIfMajorPerformanceCaveat: false
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Set initial bounds once map loads
        map.current.on('load', () => {
          setBounds(map.current!.getBounds());
        });

        // Auto-refresh data on pan/zoom (moveend)
        map.current.on('moveend', () => {
          setBounds(map.current!.getBounds());
        });

        map.current.on('style.load', () => {
          const m = map.current!;

          if (!m.getSource('permits')) {
            m.addSource('permits', {
              type: 'geojson',
              data: data || { type: 'FeatureCollection', features: [] },
              cluster: false
            });

            m.addLayer({
              id: 'permit-points',
              type: 'circle',
              source: 'permits',
              paint: {
                'circle-color': [
                  'match',
                  ['get', 'category'],
                  'Builder', '#3b82f6',   // Blue
                  'Trade', '#f59e0b',     // Amber
                  'Architect', '#8b5cf6', // Purple
                  /* default */ '#10b981' // Green
                ],
                'circle-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  10, 4,
                  15, 8
                ],
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#ffffff'
              }
            });
          }

          setupInteractions();
        });

      } catch (err: any) {
        setError(`Mapbox init failed: ${err.message}`);
      }
    } else {
      map.current.setStyle(mapStyle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const setupInteractions = () => {
    if (!map.current) return;
    const m = map.current;

    // Remove existing listeners if necessary (though setupInteractions is only called on style.load)
    m.off('click', 'permit-points', handlePointClick);
    m.on('click', 'permit-points', handlePointClick);

    m.on('mouseenter', 'permit-points', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'permit-points', () => { m.getCanvas().style.cursor = ''; });
  };

  const handlePointClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
    e.preventDefault();
    if (!e.features || e.features.length === 0) return;

    const props = e.features[0].properties;

    if (popupRef.current) {
      popupRef.current.remove();
    }

    const popupNode = document.createElement('div');
    popupNode.className = 'p-4 min-w-[280px] bg-white font-sans';
    popupNode.style.fontFamily = 'Inter, sans-serif';

    const valDisplay = props?.valuation ? `$${Number(props.valuation).toLocaleString()}` : 'N/A (<$10k or undefined)';
    const sqFt = Number(props?.sq_ft || 0).toLocaleString();

    const ladbsLink = `https://www.ladbsservices2.lacity.org/OnlineServices/PermitReport/PcisPermitDetail?id1=${props?.permit_number}`;

    popupNode.innerHTML = `
      <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 800; color: #0f172a; line-height: 1.2;">${props?.address}</h4>
      <span style="display: inline-block; padding: 3px 8px; background: #e2e8f0; border-radius: 4px; font-size: 10px; font-weight: 800; color: #334155; margin-bottom: 12px; text-transform: uppercase;">${props?.city}, ${props?.state} ${props?.zip_code}</span>
      
      <div style="font-size: 12px; color: #475569; display: flex; flex-direction: column; gap: 6px;">
         <div style="display: flex; justify-content: space-between;"><strong>Permit Type:</strong> <span>${props?.type}</span></div>
         <div style="display: flex; justify-content: space-between; align-items: center;">
           <strong>Issue Date:</strong> 
           <span style="background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 11px;">${props?.issue_date}</span>
         </div>
         
         <div style="margin-top: 4px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 4px;">
           <div><strong>Contractor:</strong> <br/><span style="color: #64748b; font-size: 11px;">${props?.contractor}</span></div>
           <div><strong>License:</strong> <span style="color: #64748b;">${props?.license}</span></div>
         </div>

         <div style="display: flex; justify-content: space-between; margin-top: 4px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
           <div>
             <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #94a3b8;">Valuation</span><br/>
             <span style="font-size: 14px; font-weight: 900; color: #10b981;">${valDisplay}</span>
           </div>
           <div style="text-align: right;">
             <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #94a3b8;">Sq Ft</span><br/>
             <span style="font-size: 14px; font-weight: 900; color: #3b82f6;">${sqFt}</span>
           </div>
         </div>
         
         <div style="margin-top: 4px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
           <a href="${ladbsLink}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: none; font-weight: 700; display: block; margin-bottom: 8px; font-size: 11px;">🔗 View on LADBS</a>
           <strong>Work Description:</strong><br/>
           <div style="color: #64748b; font-size: 11px; margin-top: 2px; line-height: 1.4; max-height: 60px; overflow-y: auto;">
             ${props?.description}
           </div>
         </div>

         <button id="view-details-btn" style="margin-top: 8px; width: 100%; padding: 8px; background: #0f172a; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1">
           View More Details
         </button>
      </div>
    `;

    popupRef.current = new mapboxgl.Popup({ closeButton: true, className: 'premium-popup', offset: 15, maxWidth: '340px' })
      .setLngLat(e.lngLat)
      .setDOMContent(popupNode)
      .addTo(map.current!);

    setTimeout(() => {
      const btn = popupNode.querySelector('#view-details-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          setSelectedPermit(props);
          setIsSidePanelOpen(true);
        });
      }
    }, 0);
  };

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !map.current) return;

    setIsSearching(true);
    
    // Query Supabase for matching neighborhood or address
    const { data, error } = await supabase
      .from('ca_permits')
      .select('latitude, longitude')
      .or(`neighborhood.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%`)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(1)
      .single();

    setIsSearching(false);

    if (data && data.longitude && data.latitude) {
      map.current.flyTo({
        center: [parseFloat(data.longitude), parseFloat(data.latitude)],
        zoom: 14,
        essential: true
      });
    } else {
      // Show simple alert if no result
      alert('Location not found in permit database.');
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] flex overflow-hidden bg-slate-50">
      
      {/* Map + Side Panel Container */}
      <div className="flex-1 relative flex overflow-hidden">
        
        {/* Search Bar (Top Center Overlay) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4 pointer-events-auto flex flex-col items-center gap-2">
          <form onSubmit={handleSearch} className="relative flex items-center w-full shadow-2xl rounded-full bg-white/95 backdrop-blur-md border border-slate-200 overflow-hidden">
            <div className="pl-4 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <input 
              type="text" 
              placeholder="Search neighborhood or address..."
              className="w-full py-3 px-3 text-sm font-semibold outline-none bg-transparent text-slate-800 placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isSearching}
            />
            <button 
              type="submit" 
              className={`px-5 py-3 bg-slate-900 text-white text-sm font-bold transition-colors hover:bg-slate-800 ${isSearching ? 'opacity-70 cursor-not-allowed' : ''}`}
              disabled={isSearching}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* Mode Bar */}
          <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-slate-200 rounded-full px-3 py-1.5 shadow-xl">
            {([
              { key: 'Builder', label: 'Builder', color: 'bg-blue-500' },
              { key: 'Architect', label: 'Architect', color: 'bg-purple-500' },
              { key: 'Engineer', label: 'Engineer', color: 'bg-orange-500' },
              { key: 'Trade', label: 'Trade', color: 'bg-amber-500' },
              { key: 'Expeditor', label: 'Expeditor', color: 'bg-teal-500' },
            ] as const).map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => {
                  setActiveMode(prev => prev === key ? null : key);
                  setBuilderSubFilter(null);
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  activeMode === key
                    ? `${color} text-white shadow-md`
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
            {activeMode && (
              <button
                onClick={() => { setActiveMode(null); setBuilderSubFilter(null); setTradeSubFilters(prev => Object.fromEntries(Object.keys(prev).map(k => [k, false]))); }}
                className="ml-1 px-2 py-1 text-xs font-bold text-red-400 hover:text-red-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Builder Sub-filters */}
          {activeMode === 'Builder' && (
            <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-blue-200 rounded-full px-3 py-1.5 shadow-lg">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mr-1">Sub-filter:</span>
              {(['New Builds', 'ADU', 'Remediation'] as const).map(sub => (
                <button
                  key={sub}
                  onClick={() => setBuilderSubFilter(prev => prev === sub ? null : sub)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    builderSubFilter === sub
                      ? 'bg-blue-500 text-white shadow'
                      : 'text-slate-500 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}

          {/* Trade Sub-filters (checkboxes) */}
          {activeMode === 'Trade' && (
            <div className="flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur-md border border-amber-200 rounded-2xl px-4 py-2.5 shadow-lg max-w-lg">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest w-full mb-1">Trade Type:</span>
              {Object.keys(tradeSubFilters).map(trade => (
                <button
                  key={trade}
                  onClick={() => setTradeSubFilters(prev => ({ ...prev, [trade]: !prev[trade] }))}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                    tradeSubFilters[trade]
                      ? 'bg-amber-500 text-white shadow'
                      : 'text-slate-500 border border-slate-200 hover:border-amber-300 hover:text-amber-700'
                  }`}
                >
                  {trade}
                </button>
              ))}
            </div>
          )}

          {/* City Switcher (PROMPT 12) */}
          <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md border border-slate-200 rounded-full px-2 py-1 shadow-lg">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">City:</span>
            {CITIES.map(city => (
              <button
                key={city.key}
                onClick={() => {
                  setSelectedCity(city.key);
                  if (map.current) {
                    map.current.flyTo({
                      center: city.center,
                      zoom: city.zoom,
                      essential: true,
                    });
                  }
                }}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                  selectedCity === city.key
                    ? 'bg-slate-900 text-white shadow'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {city.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Side Panel (Slides in from left over the map) */}
        <div 
          className={`absolute top-0 left-0 h-full w-[420px] bg-white shadow-[10px_0_30px_-10px_rgba(0,0,0,0.2)] z-40 transform transition-transform duration-300 ease-in-out ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="h-full flex flex-col relative">
            <div className="p-5 border-b border-border bg-slate-50 flex items-center gap-4">
              <button 
                onClick={() => setIsSidePanelOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-600 flex-shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
              <div>
                <h2 className="font-bold text-lg text-slate-900 leading-tight">Permit Details</h2>
                {selectedPermit && <p className="text-xs text-slate-500 font-medium mt-0.5 truncate max-w-[300px]">{selectedPermit.address}</p>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {selectedPermit ? (
                <>
                  <div className="space-y-4">
                    <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 text-emerald-600 flex items-center justify-between">
                      Free Tier Data
                    </h3>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                      <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Address</span><span className="text-sm font-semibold">{selectedPermit.address}</span></div>
                      <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">City</span><span className="text-sm font-semibold">{selectedPermit.city}</span></div>
                      <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Zip</span><span className="text-sm font-semibold">{selectedPermit.zip_code}</span></div>
                      <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">State</span><span className="text-sm font-semibold">{selectedPermit.state}</span></div>
                      
                      <div className="col-span-2"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Contractor</span><span className="text-sm font-semibold text-slate-800">{selectedPermit.contractor} <span className="text-slate-400 font-normal">({selectedPermit.license})</span></span></div>
                      
                      <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Permit Type</span><span className="text-sm font-semibold">{selectedPermit.type}</span></div>
                      <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Issue Date</span><span className="text-sm font-semibold">{selectedPermit.issue_date}</span></div>
                      
                      <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Sq Ft</span><span className="text-sm font-semibold">{selectedPermit.sq_ft}</span></div>
                      {selectedPermit.valuation && (
                        <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Valuation</span><span className="text-sm font-bold text-emerald-600">${Number(selectedPermit.valuation).toLocaleString()}</span></div>
                      )}
                      
                      <div className="col-span-2"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Work Description</span><p className="text-sm text-slate-700 mt-1 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">{selectedPermit.description}</p></div>
                      
                      <div className="col-span-2 mt-2">
                        <a href={`https://www.ladbsservices2.lacity.org/OnlineServices/PermitReport/PcisPermitDetail?id1=${selectedPermit.permit_number}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-blue-600 text-sm font-bold bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-md transition-colors">
                          🔗 View Official LADBS Permit
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center justify-between">
                      Residential <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">$75/mo</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                      <LockedField label="Permit Number" value={selectedPermit.permit_number} requiredTier="RESIDENTIAL" currentTier={currentTier} />
                      <LockedField label="Project Type" value={selectedPermit.project_type} requiredTier="RESIDENTIAL" currentTier={currentTier} />
                      <LockedField label="Architect" value={selectedPermit.architect_name ? `${selectedPermit.architect_name} (${selectedPermit.architect_license})` : null} requiredTier="RESIDENTIAL" currentTier={currentTier} />
                      <LockedField label="Permit Expeditor" value={selectedPermit.permit_expeditor} requiredTier="RESIDENTIAL" currentTier={currentTier} />
                      <LockedField label="APN" value={selectedPermit.apn} requiredTier="RESIDENTIAL" currentTier={currentTier} />
                      <LockedField label="Geologist" value={selectedPermit.geologist_name ? `${selectedPermit.geologist_name} (${selectedPermit.geologist_license})` : null} requiredTier="RESIDENTIAL" currentTier={currentTier} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center justify-between">
                      Commercial <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">$125/mo</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                      <LockedField label="Project Category" value={selectedPermit.project_category} requiredTier="COMMERCIAL" currentTier={currentTier} />
                      <LockedField label="Engineer" value={selectedPermit.engineer_name ? `${selectedPermit.engineer_name} (${selectedPermit.engineer_license})` : null} requiredTier="COMMERCIAL" currentTier={currentTier} />
                      <LockedField label="Permit Link" value="🔗 Official Document" requiredTier="COMMERCIAL" currentTier={currentTier} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center justify-between">
                      Enterprise <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">$175/mo</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                      <LockedField label="Permits Pulled" value={selectedPermit.permits_pulled} requiredTier="ENTERPRISE" currentTier={currentTier} />
                      <LockedField label="Addresses Worked" value={selectedPermit.addresses_worked_on} requiredTier="ENTERPRISE" currentTier={currentTier} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  </div>
                  <p className="font-medium">Select a permit to view details.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* On-Map Toggle Pills (bottom-left) — PROMPT 10 */}
        <div className={`absolute bottom-6 left-4 z-20 flex flex-col gap-2 pointer-events-auto transition-opacity duration-300 ${isSidePanelOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'commercial',       label: 'Commercial' },
              { key: 'residential',      label: 'Residential' },
              { key: 'basement',         label: 'Basement' },
              { key: 'hillside',         label: 'Hillside' },
              { key: 'is_owner_builder', label: 'Owner Builder' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                id={`toggle-${key}`}
                onClick={() => toggleFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-md border transition-all duration-200 ${
                  filters[key]
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-200 scale-105'
                    : 'bg-white/90 text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${filters[key] ? 'bg-white' : 'bg-slate-300'}`} />
                {label}
              </button>
            ))}
          </div>
          {Object.values(filters).some(Boolean) && (
            <button
              onClick={() => setFilters({ commercial: false, residential: false, basement: false, hillside: false, is_owner_builder: false })}
              className="self-start px-3 py-1 rounded-full text-[10px] font-bold text-red-400 bg-white/90 border border-red-200 hover:bg-red-50 transition-colors shadow"
            >
              Clear All Toggles
            </button>
          )}
        </div>

        {/* Map Theme Selector (bottom-right compact) */}
        <div className="absolute bottom-6 right-4 z-20 pointer-events-auto">
          <Select value={mapStyle} onValueChange={setMapStyle}>
            <SelectTrigger className="bg-white/90 backdrop-blur-md border border-slate-200 shadow-lg h-8 text-xs font-bold text-slate-600 rounded-full px-3 w-auto gap-2">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value={MAP_STYLES.DARK}>🌑 Tactical Dark</SelectItem>
              <SelectItem value={MAP_STYLES.LIGHT}>☀️ Clean Light</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Main Map Container */}
        <div className="w-full h-full relative" ref={mapContainer}>
          {loading && (
            <div className="absolute inset-x-0 top-0 h-1 bg-primary/20 overflow-hidden z-20">
              <div className="h-full bg-primary animate-[pulse_1.5s_ease-in-out_infinite]" style={{ width: '50%', transform: 'translateX(-100%)' }} />
            </div>
          )}

          {error && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-full max-w-md">
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-bold">Data Fetch Error</AlertTitle>
                <AlertDescription className="text-xs mt-2 block break-words">
                  {error}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </div>

      {/* List View Panel (Right side) */}
      {isListViewOpen && (
        <div className="w-[380px] bg-white border-l border-border shadow-xl z-20 flex flex-col h-full flex-shrink-0">
          {/* Panel Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border bg-white">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 text-base">Permits in View</h2>
                <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                  {data?.features?.length || 0}
                </span>
              </div>
              <button 
                onClick={() => setIsListViewOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Sort Controls */}
            <div className="flex gap-1 flex-wrap">
              {([
                { key: 'most_active', label: 'Most Active' },
                { key: 'valuation',   label: '$ High→Low' },
                { key: 'name_az',     label: 'A → Z' },
                { key: 'years_biz',   label: 'Years in Biz' },
                { key: 'permit_year', label: 'Newest' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                    sortBy === key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Permit List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
                <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                <span className="text-xs font-semibold">Loading permits...</span>
              </div>
            ) : !data?.features?.length ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400 p-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <p className="text-xs font-semibold text-center">No permits in current viewport.<br/>Pan or zoom to load data.</p>
              </div>
            ) : (
              (() => {
                let features = [...(data?.features || [])];

                // Client-side Most Active sort: rank by contractor permit count in viewport
                if (sortBy === 'most_active') {
                  const counts: Record<string, number> = {};
                  features.forEach(f => {
                    const c = f.properties?.contractor || 'Unknown';
                    counts[c] = (counts[c] || 0) + 1;
                  });
                  features.sort((a, b) => {
                    const ca = a.properties?.contractor || 'Unknown';
                    const cb = b.properties?.contractor || 'Unknown';
                    return (counts[cb] || 0) - (counts[ca] || 0);
                  });
                }

                return features.map((feature, i) => {
                  const p = feature.properties;
                  const categoryColor: Record<string, string> = {
                    Builder: 'bg-blue-100 text-blue-700',
                    Trade: 'bg-amber-100 text-amber-700',
                    Architect: 'bg-purple-100 text-purple-700',
                  };
                  const colorClass = categoryColor[p?.category] || 'bg-slate-100 text-slate-600';

                  return (
                    <div
                      key={p?.id || i}
                      className="px-4 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors group"
                      onClick={() => {
                        setSelectedPermit(p);
                        setIsSidePanelOpen(true);
                        if (map.current) {
                          map.current.flyTo({
                            center: feature.geometry.coordinates as [number, number],
                            zoom: 16,
                            essential: true
                          });
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                            {p?.contractor || 'Unknown Contractor'}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{p?.address}</p>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${colorClass}`}>
                          {p?.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-slate-400 font-semibold truncate flex-1">{p?.type}</span>
                        <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">{p?.issue_date}</span>
                      </div>

                      {p?.valuation && (
                        <div className="mt-1.5">
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            ${Number(p.valuation).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                });
              })()
            )}
          </div>
        </div>
      )}

      {/* Show List View Button (if closed) */}
      {!isListViewOpen && (
        <button
          onClick={() => setIsListViewOpen(true)}
          className="absolute top-4 right-4 z-30 bg-white shadow-lg border border-border px-4 py-2 rounded-full text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Show List View
        </button>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .premium-popup .mapboxgl-popup-content {
           border-radius: 12px;
           box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
           border: 1px solid rgba(0,0,0,0.05);
           padding: 12px !important;
           background: #ffffff !important;
        }
        .premium-popup .mapboxgl-popup-tip {
           border-top-color: #fff !important;
        }
        .mapboxgl-popup {
           z-index: 50;
        }
      `}} />
    </div>
  );
}
