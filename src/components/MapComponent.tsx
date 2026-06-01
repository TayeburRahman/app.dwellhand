'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Layers, AlertCircle, Loader2, Home, Building2, Mountain, Spade, UserCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from './ui/switch';
import { getLADBSLink } from '@/lib/utils';

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
    center: [-118.40, 34.04] as [number, number],
    zoom: 10,
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
  const [addressPermits, setAddressPermits] = useState<any[]>([]);
  const sidePanelContentRef = useRef<HTMLDivElement>(null);
  const [currentTier, setCurrentTier] = useState('FREE'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [sortBy, setSortBy] = useState<'most_active' | 'valuation' | 'name_az' | 'years_biz' | null>(null);
  const [selectedCity, setSelectedCity] = useState<CityKey>('all');

  const supabase = createClient();

  // ── ROLE & TIER SYNC ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchUserTier = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.user_metadata?.role;

      if (role === 'paid' || role === 'enterprise') {
        setCurrentTier('ENTERPRISE');
      } else if (role === 'commercial') {
        setCurrentTier('COMMERCIAL');
      } else if (role === 'residential') {
        setCurrentTier('RESIDENTIAL');
      } else {
        setCurrentTier('FREE');
      }
    };
    fetchUserTier();
  }, [supabase.auth]);

  // Update highlight layer when selection changes
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const m = map.current;
    if (m.getLayer('selected-permit-point')) {
      m.setFilter('selected-permit-point', ['==', ['get', 'id'], selectedPermit?.permit_number || '']);
    }
  }, [selectedPermit]);

  const sidePanelOpenRef = useRef(false);
  const sidePanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sidePanelOpenRef.current = isSidePanelOpen;
    if (isSidePanelOpen && popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  }, [isSidePanelOpen]);

  // Handle map resize when side panels toggle to prevent layout issues
  useEffect(() => {
    if (!map.current) return;

    const resizeMap = () => {
      map.current?.resize();
    };

    // Immediate resize
    resizeMap();
    // Multiple resizes during transition to ensure smoothness
    const timers = [
      setTimeout(resizeMap, 100),
      setTimeout(resizeMap, 300),
      setTimeout(resizeMap, 500),
      setTimeout(resizeMap, 800),
    ];

    return () => timers.forEach(clearTimeout);
  }, [isListViewOpen]);

  // Scroll side panel to top on change
  useEffect(() => {
    if (sidePanelContentRef.current) {
      sidePanelContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedPermit?.id]);

  // Handle click outside side panel to close it
  useEffect(() => {
    if (!isSidePanelOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (sidePanelRef.current && !sidePanelRef.current.contains(event.target as Node)) {
        // Don't close if we clicked a button (like a map dot trigger or toggle)
        const isButton = (event.target as HTMLElement).closest('button');
        const isMapPoint = (event.target as HTMLElement).closest('.mapboxgl-canvas');

        // If it's a map click not on a button, or just general whitespace
        if (!isButton) {
          setIsSidePanelOpen(false);
        }
      }
    };

    // Delay listener to avoid immediate trigger upon opening
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidePanelOpen]);

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
      .select(`
        latitude, longitude, address, city, state, zip_code, 
        permit_number, issue_date, contractor, contractor_license, 
        square_feet, work_description, permit_type, valuation,
        project_type, architect, architect_license, permit_expediter,
        apn, geologist, geologist_license, project_category,
        engineer, engineer_license, permit_link,
        is_owner_builder, is_commercial, is_residential, is_hillside, is_basement
      `)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gte('latitude', minLat)
      .lte('latitude', maxLat)
      .gte('longitude', minLng)
      .lte('longitude', maxLng)
      .limit(500);

    // Apply Supabase-level sorting (PROMPT 11 & Requirements Sync)
    if (sortBy === 'valuation') {
      query = query.order('valuation', { ascending: false, nullsFirst: false });
    } else if (sortBy === 'name_az') {
      query = query.order('contractor', { ascending: true, nullsFirst: false });
    } else if (sortBy === 'years_biz') {
      query = query.order('issue_date', { ascending: true }); // Proxy for oldest (longest in biz)
    }
    //  else if (sortBy === 'permit_year') {
    // query = query.order('issue_date', { ascending: false });
    // } 
    else {
      // most_active or default: newest first
      query = query.order('issue_date', { ascending: false });
    }

    // Apply city filter at Supabase query level (PROMPT 12)
    const cityConfig = CITIES.find(c => c.key === selectedCity);
    if (cityConfig?.dbValue) {
      query = query.eq('city', cityConfig.dbValue);
    }
    // Apply Toggle Filters (Exclusive-when-Active Logic)
    const categoryFilters: string[] = [];
    if (filters.commercial) categoryFilters.push('is_commercial.eq.true');
    if (filters.residential) categoryFilters.push('is_residential.eq.true');
    if (filters.is_owner_builder) categoryFilters.push('is_owner_builder.eq.true');

    if (categoryFilters.length > 0) {
      query = query.or(categoryFilters.join(','));
    }

    if (filters.basement) query = query.eq('is_basement', true);
    if (filters.hillside) query = query.eq('is_hillside', true);

    // THE FIX: If any filter is active (Categories or Features) 
    // AND Owner-Builder is NOT explicitly requested, strictly exclude them.
    const isAnyFilterActive = filters.commercial || filters.residential || filters.is_owner_builder || filters.basement || filters.hillside;
    if (isAnyFilterActive && !filters.is_owner_builder) {
      query = query.neq('is_owner_builder', true);
    }

    // Apply Mode filters at Supabase query level (PROMPT 9)
    if (activeMode === 'Builder') {
      if (builderSubFilter === 'New Builds') {
        query = query.ilike('permit_type', '%new%');
      } else if (builderSubFilter === 'ADU') {
        query = query.eq('project_category', 'Accessory Dwelling Unit');
      } else if (builderSubFilter === 'Remediation') {
        query = query.ilike('permit_type', '%remediat%');
      } else {
        query = query.not('permit_type', 'ilike', '%electrical%')
          .not('permit_type', 'ilike', '%plumbing%')
          .not('permit_type', 'ilike', '%mechanical%');
      }
    } else if (activeMode === 'Architect') {
      query = query.not('architect', 'is', null);
    } else if (activeMode === 'Engineer') {
      query = query.or('engineer.not.is.null,geologist.not.is.null');
    } else if (activeMode === 'Expeditor') {
      query = query.not('permit_expediter', 'is', null);
    } else if (activeMode === 'Trade') {
      const activeTradeFilters = Object.entries(tradeSubFilters)
        .filter(([, v]) => v)
        .map(([k]) => k);

      if (activeTradeFilters.length > 0) {
        // Build OR filter for selected trade types at Supabase level
        const orClauses = activeTradeFilters.map(filter => {
          if (filter === 'Retaining Walls') return 'project_category.eq.Retaining Wall';
          if (filter === 'Swimming Pool / Spa') return 'permit_type.ilike.%pool%';
          return `permit_type.ilike.%${filter.toLowerCase()}%`;
        });
        query = query.or(orClauses.join(','));
      } else {
        // Default: all trade types
        query = query.or(
          'permit_type.ilike.%electrical%,permit_type.ilike.%plumbing%,permit_type.ilike.%mechanical%,permit_type.ilike.%grading%,permit_type.ilike.%demolition%,permit_type.ilike.%roofing%,permit_type.ilike.%septic%,permit_type.ilike.%pool%,project_category.eq.Retaining Wall'
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
        // 1. Professional Category Mapping (for Tags & Filters)
        let category = 'Builder';
        const lowerType = (d.permit_type || '').toLowerCase();

        if (activeMode === 'Architect' && d.architect) {
          category = 'Architect';
        } else if (activeMode === 'Engineer' && (d.engineer || d.geologist)) {
          category = 'Engineer';
        } else if (activeMode === 'Expeditor' && d.permit_expediter) {
          category = 'Expeditor';
        } else if (activeMode === 'Trade' && (lowerType.match(/(electrical|plumbing|mechanical|grading|pool|spa|demolition|roofing|septic)/) || d.project_category === 'Retaining Wall')) {
          category = 'Trade';
        } else {
          if (lowerType.match(/(electrical|plumbing|mechanical|grading|pool|spa|demolition|roofing|septic)/) || d.project_category === 'Retaining Wall') {
            category = 'Trade';
          } else if (d.architect) {
            category = 'Architect';
          } else if (d.engineer || d.geologist) {
            category = 'Engineer';
          } else if (d.permit_expediter) {
            category = 'Expeditor';
          }
        }

        // 2. Map Dot Color Scheme (Requirement 3.3)
        let colorType = 'Contractor'; // Default Blue
        if (d.is_owner_builder) {
          colorType = 'Owner-Builder'; // Yellow
        } else if (d.is_commercial) {
          colorType = 'Commercial'; // Green
        }

        return {
          type: 'Feature',
          properties: {
            id: d.permit_number,
            address: d.address || 'Unknown Address',
            city: d.city || 'Unknown',
            state: d.state || 'CA',
            zip_code: d.zip_code || '',
            permit_number: d.permit_number || '',
            type: d.permit_type || 'Unknown Type',
            category: category,
            color_type: colorType,
            valuation: (d.valuation && d.valuation >= 10000) ? d.valuation : null,
            issue_date: d.issue_date || 'N/A',
            contractor: d.contractor || 'N/A',
            license: d.contractor_license || 'N/A',
            square_feet: d.square_feet || 0,
            work_description: d.work_description || 'No description provided.',
            project_type: d.project_type,
            architect: d.architect,
            architect_license: d.architect_license,
            permit_expediter: d.permit_expediter,
            apn: d.apn,
            geologist: d.geologist,
            geologist_license: d.geologist_license,
            project_category: d.project_category,
            engineer: d.engineer,
            engineer_license: d.engineer_license,
            permit_link: d.permit_link,
            permits_pulled: null, // Placeholder for Phase 3
            addresses_worked_on: null // Placeholder for Phase 3
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

    const updateSource = () => {
      const source = m.getSource('permits') as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData(data);
      }
    };

    if (m.isStyleLoaded()) {
      updateSource();
    } else {
      m.once('style.load', updateSource);
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
          center: [-118.40, 34.04], // LA County
          zoom: 10,
          pitch: 45,
          failIfMajorPerformanceCaveat: false
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Set initial bounds once map loads
        map.current.on('load', () => {
          if (map.current) {
            setBounds(map.current.getBounds());
          }
        });

        // Fallback for load event if already loaded
        if (map.current.isStyleLoaded()) {
          setBounds(map.current.getBounds());
        }

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
                  ['get', 'color_type'],
                  'Contractor', '#3b82f6',     // Blue
                  'Owner-Builder', '#facc15', // Yellow
                  'Commercial', '#22c55e',    // Green
                  /* default */ '#3b82f6'
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

            // HIGHLIGHT LAYER for selected dot
            m.addLayer({
              id: 'selected-permit-point',
              type: 'circle',
              source: 'permits',
              paint: {
                'circle-color': [
                  'match',
                  ['get', 'color_type'],
                  'Contractor', '#3b82f6',
                  'Owner-Builder', '#facc15',
                  'Commercial', '#22c55e',
                  /* default */ '#3b82f6'
                ],
                'circle-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  10, 8,
                  15, 14
                ],
                'circle-stroke-width': 4,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-opacity': 1,
                'circle-opacity': 1,
              },
              filter: ['==', ['get', 'id'], ''] // Initially nothing selected
            });
          } else if (data) {
            // Ensure data is synced if source survived but style reloaded
            (m.getSource('permits') as mapboxgl.GeoJSONSource).setData(data);
          }

          setupInteractions();
        });

      } catch (err: any) {
        setError(`Mapbox init failed: ${err.message}`);
      }
    } else {
      map.current.setStyle(mapStyle);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
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


  const handleSelectPermit = async (permitId: string, initialData?: any) => {
    if (!permitId) return;

    // If we have initial data (from map click or list), show it immediately for instant feedback
    if (initialData) {
      setSelectedPermit(initialData);
      setIsSidePanelOpen(true);
    }

    setLoading(true);
    const { data: d, error } = await supabase
      .from('ca_permits')
      .select(`
        latitude, longitude, address, city, state, zip_code, 
        permit_number, issue_date, contractor, contractor_license, 
        square_feet, work_description, permit_type, valuation,
        project_type, architect, architect_license, permit_expediter,
        apn, geologist, geologist_license, project_category,
        engineer, engineer_license, permit_link,
        is_owner_builder, is_commercial, is_residential, is_hillside, is_basement
      `)
      .eq('permit_number', permitId)
      .single();

    setLoading(false);
    if (d) {
      // 1. Fetch all other permits for this same address/APN (Property History)
      const { data: allForAddress } = await supabase
        .from('ca_permits')
        .select(`
          latitude, longitude, address, city, state, zip_code, 
          permit_number, issue_date, contractor, contractor_license, 
          square_feet, work_description, permit_type, valuation,
          project_type, architect, architect_license, permit_expediter,
          apn, geologist, geologist_license, project_category,
          engineer, engineer_license, permit_link,
          is_owner_builder, is_commercial, is_residential, is_hillside, is_basement
        `)
        .eq(d.apn ? 'apn' : 'address', d.apn || d.address)
        .order('issue_date', { ascending: false });

      setAddressPermits(allForAddress || [d]);

      let category = 'Builder';
      const lowerType = (d.permit_type || '').toLowerCase();

      // High Priority: Match current active mode first
      if (activeMode === 'Architect' && d.architect) {
        category = 'Architect';
      } else if (activeMode === 'Engineer' && (d.engineer || d.geologist)) {
        category = 'Engineer';
      } else if (activeMode === 'Expeditor' && d.permit_expediter) {
        category = 'Expeditor';
      } else if (activeMode === 'Trade' && (lowerType.match(/(electrical|plumbing|mechanical|grading|pool|spa|demolition|roofing|septic)/) || d.project_category === 'Retaining Wall')) {
        category = 'Trade';
      } else {
        // Default fallthrough
        if (lowerType.match(/(electrical|plumbing|mechanical|grading|pool|spa|demolition|roofing|septic)/) || d.project_category === 'Retaining Wall') {
          category = 'Trade';
        } else if (d.architect) {
          category = 'Architect';
        } else if (d.engineer || d.geologist) {
          category = 'Engineer';
        } else if (d.permit_expediter) {
          category = 'Expeditor';
        }
      }

      // 2. Map Dot Color Scheme (Requirement 3.3)
      let colorType = 'Contractor';
      if (d.is_owner_builder) {
        colorType = 'Owner-Builder';
      } else if (d.is_commercial) {
        colorType = 'Commercial';
      }

      const freshProps = {
        id: d.permit_number,
        address: d.address || 'Unknown Address',
        city: d.city || 'Unknown',
        state: d.state || 'CA',
        zip_code: d.zip_code || '',
        permit_number: d.permit_number || '',
        type: d.permit_type || 'Unknown Type',
        category: category,
        color_type: colorType,
        valuation: (d.valuation && d.valuation >= 10000) ? d.valuation : null,
        issue_date: d.issue_date || 'N/A',
        contractor: d.contractor || 'N/A',
        license: d.contractor_license || 'N/A',
        square_feet: d.square_feet || 0,
        work_description: d.work_description || 'No description provided.',
        project_type: d.project_type,
        architect: d.architect,
        architect_license: d.architect_license,
        permit_expediter: d.permit_expediter,
        apn: d.apn,
        geologist: d.geologist,
        geologist_license: d.geologist_license,
        project_category: d.project_category,
        engineer: d.engineer,
        engineer_license: d.engineer_license,
        permit_link: d.permit_link,
        permits_pulled: null,
        addresses_worked_on: null
      };

      setSelectedPermit(freshProps);
      setIsSidePanelOpen(true);
      return freshProps;
    }
    return null;
  };

  const handlePointClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
    e.preventDefault();
    if (!e.features || e.features.length === 0) return;

    const props = e.features[0].properties;
    if (!props) return;

    // Center map on the clicked point
    const coordinates = (e.features[0].geometry as any).coordinates.slice();
    if (map.current) {
      map.current.flyTo({
        center: coordinates,
        zoom: Math.max(map.current.getZoom(), 15.5),
        offset: [0, 100], // Pushes the center down, effectively moving the point UP on screen
        essential: true,
        duration: 1500
      });
    }

    // Close side panel when a new popup is opened to avoid overlap
    setIsSidePanelOpen(false);

    // Ensure any open popup is closed 
    if (popupRef.current) {
      popupRef.current.remove();
    }

    const popupNode = document.createElement('div');
    popupNode.className = 'p-4 min-w-[280px] bg-white font-sans';
    popupNode.style.fontFamily = 'Inter, sans-serif';

    const squareFeet = Number(props.square_feet || 0).toLocaleString();
    const ladbsLink = getLADBSLink(props.permit_number, props.permit_link);

    const valuationHtml = props.valuation
      ? `<div>
           <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #94a3b8;">Valuation</span><br/>
           <span style="font-size: 14px; font-weight: 900; color: #10b981;">$${Number(props.valuation).toLocaleString()}</span>
         </div>`
      : '';

    popupNode.innerHTML = `
      <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 800; color: #0f172a; line-height: 1.2;">${props.address}</h4>
      <span style="display: inline-block; padding: 3px 8px; background: #e2e8f0; border-radius: 4px; font-size: 10px; font-weight: 800; color: #334155; margin-bottom: 12px; text-transform: uppercase;">${props.city}, ${props.state} ${props.zip_code}</span>
      
      <div style="font-size: 12px; color: #475569; display: flex; flex-direction: column; gap: 6px;">
         <div style="display: flex; justify-content: space-between;"><strong>Permit Type:</strong> <span>${props.type}</span></div>
         <div style="display: flex; justify-content: space-between; align-items: center;">
           <strong>Issue Date:</strong> 
           <span style="background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 11px;">${props.issue_date}</span>
         </div>
         
         <div style="margin-top: 4px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 4px;">
           <div><strong>Contractor:</strong> <br/><span style="color: #64748b; font-size: 11px;">${props.contractor}</span></div>
           <div><strong>License:</strong> <span style="color: #64748b;">${props.license}</span></div>
         </div>

         <div style="display: flex; justify-content: space-between; margin-top: 4px; padding-top: 8px; border-top: 1px solid #e2e8f0; align-items: flex-end;">
           ${valuationHtml}
           <div style="text-align: right; flex-grow: 1;">
             <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #94a3b8;">Sq Ft</span><br/>
             <span style="font-size: 14px; font-weight: 900; color: #3b82f6;">${squareFeet}</span>
           </div>
         </div>
         
         <div style="margin-top: 4px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
           <a href="${ladbsLink}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: none; font-weight: 700; display: block; margin-bottom: 8px; font-size: 11px;">🔗 View on LADBS</a>
           <strong>Work Description:</strong><br/>
           <div style="color: #64748b; font-size: 11px; margin-top: 2px; line-height: 1.4; max-height: 60px; overflow-y: auto;">
             ${props.work_description}
           </div>
         </div>

         <button id="view-details-btn" style="margin-top: 8px; width: 100%; padding: 8px; background: #0f172a; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1">
           View More Details
         </button>
      </div>
    `;

    popupRef.current = new mapboxgl.Popup({ 
      closeButton: true, 
      className: 'premium-popup', 
      offset: 15, 
      maxWidth: '340px',
      anchor: 'bottom'
    })
      .setLngLat(e.lngLat)
      .setDOMContent(popupNode)
      .addTo(map.current!);

    // Handle button click in popup
    setTimeout(() => {
      const btn = popupNode.querySelector('#view-details-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          // Pass props as initial data for instant sidebar feedback
          handleSelectPermit(props.id || props.permit_number, props); 
          if (popupRef.current) {
            popupRef.current.remove();
            popupRef.current = null;
          }
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
    let query = supabase
      .from('ca_permits')
      .select(`
        latitude, longitude, address, city, state, zip_code, 
        permit_number, issue_date, contractor, contractor_license, 
        square_feet, work_description, permit_type, valuation,
        project_type, architect, architect_license, permit_expediter,
        apn, geologist, geologist_license, project_category,
        engineer, engineer_license, permit_link,
        is_owner_builder, is_commercial, is_residential, is_hillside, is_basement
      `)
      .or(`neighborhood.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%`);

    // Apply active toggles to search results for consistency
    const catF: string[] = [];
    if (filters.commercial) catF.push('is_commercial.eq.true');
    if (filters.residential) catF.push('is_residential.eq.true');
    if (filters.is_owner_builder) catF.push('is_owner_builder.eq.true');

    if (catF.length > 0) {
      query = query.or(catF.join(','));
    }

    if (filters.basement) query = query.eq('is_basement', true);
    if (filters.hillside) query = query.eq('is_hillside', true);

    const isAnyFActive = filters.commercial || filters.residential || filters.is_owner_builder || filters.basement || filters.hillside;
    if (isAnyFActive && !filters.is_owner_builder) {
      query = query.neq('is_owner_builder', true);
    }

    const { data: d, error } = await query
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(1)
      .maybeSingle();

    setIsSearching(false);

    if (d && d.longitude && d.latitude) {
      const coords: [number, number] = [parseFloat(d.longitude), parseFloat(d.latitude)];

      // 1. Zoom to the dot with high detail
      map.current.flyTo({
        center: coords,
        zoom: 17,
        essential: true,
        pitch: 45
      });

      // 2. Transform raw data to our permit property format
      // Data-driven category mapping (Requirements Refinement)
      let category = 'Builder';
      const lowerType = (d.permit_type || '').toLowerCase();

      // High Priority: Match current active mode first
      if (activeMode === 'Architect' && d.architect) {
        category = 'Architect';
      } else if (activeMode === 'Engineer' && (d.engineer || d.geologist)) {
        category = 'Engineer';
      } else if (activeMode === 'Expeditor' && d.permit_expediter) {
        category = 'Expeditor';
      } else if (activeMode === 'Trade' && lowerType.match(/(electrical|plumbing|mechanical|grading|pool|spa|demolition|roofing|septic)/)) {
        category = 'Trade';
      } else {
        // Default fallthrough
        if (lowerType.match(/(electrical|plumbing|mechanical|grading|pool|spa|demolition|roofing|septic)/)) {
          category = 'Trade';
        } else if (d.architect) {
          category = 'Architect';
        } else if (d.engineer || d.geologist) {
          category = 'Engineer';
        } else if (d.permit_expediter) {
          category = 'Expeditor';
        }
      }

      // 3. Populate side panel and open it using our unified handler
      handleSelectPermit(d.permit_number);

      // 4. Highlight the dot with a temporary popup (optional/as requested)
      // Since we want to avoid side panel/popup overlap, we use a simple popup or marker
      // But the side panel is now open and contains all the info, fulfilling "populate side panel"
    } else {
      alert('Location not found in permit database.');
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden bg-slate-50">

      {/* Map + Side Panel Container */}
      <div className="flex-1 relative flex overflow-hidden order-1 md:order-1">

        {/* Search & Mode Controls (Top Center Overlay) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4 pointer-events-auto flex flex-col items-center gap-2">
          <form onSubmit={handleSearch} className="relative flex items-center w-full glass rounded-full overflow-hidden transition-all duration-300 hover:shadow-2xl">
            <div className="pl-4 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <input
              type="text"
              placeholder="Search neighborhood or address..."
              className="w-full py-2.5 md:py-3 px-3 text-sm font-semibold outline-none bg-transparent text-slate-800 placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isSearching}
            />
            <button
              type="submit"
              className={`px-4 md:px-6 py-2.5 md:py-3 bg-slate-900 text-white text-xs md:text-sm font-bold transition-all hover:bg-slate-800 active:scale-95 ${isSearching ? 'opacity-70 cursor-not-allowed' : ''}`}
              disabled={isSearching}
            >
              {isSearching ? '...' : 'Search'}
            </button>
          </form>


          {/* City Switcher */}
          <div className="flex items-center gap-1 glass rounded-full px-2 py-1 shadow-2xl border-white/60 max-w-full overflow-x-auto no-scrollbar">
            <span className="hidden md:inline text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2">Jurisdiction:</span>
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
                className={`px-3 md:px-4 py-1 md:py-1.5 rounded-full text-[10px] font-bold tracking-tight transition-all active:scale-95 ${selectedCity === city.key
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                  : 'text-slate-500 hover:text-indigo-600'
                  }`}
              >
                {city.label}
              </button>
            ))}
          </div>

          {/* Mode Bar */}
          <div className="flex items-center gap-1.5 glass rounded-full px-2 md:px-3 py-1.5 shadow-xl overflow-x-auto max-w-full no-scrollbar">
            {([
              { key: 'Builder', label: 'Builder', color: 'bg-blue-500' },
              { key: 'Architect', label: 'Architect', color: 'bg-purple-500' },
              { key: 'Engineer', label: 'Engineer', color: 'bg-orange-500' },
              { key: 'Trade', label: 'Trade', color: 'bg-indigo-600' },
              { key: 'Expeditor', label: 'Expediter', color: 'bg-teal-500' },
            ] as const).map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => {
                  setActiveMode(prev => prev === key ? null : key);
                  setBuilderSubFilter(null);
                }}
                className={`px-2.5 md:px-3 py-1 rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap transition-all ${activeMode === key
                  ? `${color} text-white shadow-md scale-105`
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                  }`}
              >
                {label}
              </button>
            ))}
            {activeMode && (
              <button
                onClick={() => { setActiveMode(null); setBuilderSubFilter(null); setTradeSubFilters(prev => Object.fromEntries(Object.keys(prev).map(k => [k, false]))); }}
                className="ml-1 px-2 py-1 text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          {/* Builder Sub-filters */}
          {activeMode === 'Builder' && (
            <div className="flex items-center gap-1.5 glass border-blue-200/50 rounded-full px-3 py-1.5 shadow-lg animate-in">
              <span className="hidden md:inline text-[10px] font-bold text-blue-500 uppercase tracking-widest mr-1">Sub-filter:</span>
              {(['New Builds', 'ADU', 'Remediation'] as const).map(sub => (
                <button
                  key={sub}
                  onClick={() => setBuilderSubFilter(prev => prev === sub ? null : sub)}
                  className={`px-2.5 md:px-3 py-1 rounded-full text-[10px] md:text-xs font-bold transition-all ${builderSubFilter === sub
                    ? 'bg-blue-500 text-white shadow'
                    : 'text-slate-500 hover:bg-blue-50/50 hover:text-blue-700'
                    }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}

          {/* Trade Sub-filters (checkboxes) */}
          {activeMode === 'Trade' && (
            <div className="flex flex-wrap items-center justify-center gap-1 md:gap-1.5 glass border-indigo-200/50 rounded-2xl px-4 py-2.5 shadow-lg max-w-lg animate-in">
              <span className="text-[9px] md:text-[10px] font-bold text-indigo-600 uppercase tracking-widest w-full text-center md:text-left mb-1">Trade Type:</span>
              {Object.keys(tradeSubFilters).map(trade => (
                <button
                  key={trade}
                  onClick={() => setTradeSubFilters(prev => ({ ...prev, [trade]: !prev[trade] }))}
                  className={`px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-[10px] font-bold transition-all ${tradeSubFilters[trade]
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-500 border border-slate-200/50 hover:border-indigo-300 hover:text-indigo-700'
                    }`}
                >
                  {trade}
                </button>
              ))}
            </div>
          )}
        </div>


        {/* Toggle Button to reopen side panel when collapsed */}
        {!isSidePanelOpen && (
          <button
            onClick={() => setIsSidePanelOpen(true)}
            className="absolute top-1/2 -translate-y-1/2 left-0 z-40 w-8 h-20 bg-white border border-slate-200 border-l-0 rounded-r-2xl shadow-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all active:scale-95 group animate-in slide-in-from-left duration-500"
            title="Expand Details"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 transition-transform"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        )}

        {/* Side Panel (Details) */}
        <div
          ref={sidePanelRef}
          className={`absolute top-0 left-0 h-full w-full md:w-[420px] bg-white/95 backdrop-blur-xl shadow-2xl z-40 transform transition-all duration-500 ease-[cubic-bezier(0.16, 1, 0.3, 1)] ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full opacity-0'}`}
        >
          <div className="h-full flex flex-col relative">
            <div className="p-5 md:p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
              <button
                onClick={() => setIsSidePanelOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all active:scale-90 shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              </button>
              <div className="min-w-0">
                <h2 className="font-bold text-xl text-indigo-950 tracking-tight leading-none">Asset Intelligence</h2>
                {selectedPermit && <p className="text-xs text-indigo-500 font-bold mt-2 truncate uppercase tracking-tighter">{selectedPermit.address}</p>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-10 custom-scrollbar">
              {selectedPermit ? (
                <>
                  <div className="space-y-4">
                    <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 text-emerald-600 flex items-center justify-between">
                      Property History ({addressPermits.length})
                    </h3>
                    <div className="space-y-3">
                      {addressPermits.map((p) => (
                        <div
                          key={p.permit_number}
                          onClick={() => handleSelectPermit(p.permit_number, p)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedPermit?.permit_number === p.permit_number ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-100 hover:border-indigo-100'}`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight">{p.permit_type}</span>
                            <span className="text-[10px] font-bold text-slate-400">{p.issue_date}</span>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 mt-1 truncate">{p.contractor || 'Owner-Builder'}</p>
                          {p.valuation && <p className="text-[10px] font-bold text-emerald-600 mt-1">${Number(p.valuation).toLocaleString()}</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 text-emerald-600 flex items-center justify-between">
                      Detailed Permit Info
                    </h3>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                      <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Address</span><span className="text-sm font-semibold">{selectedPermit.address}</span></div>
                      <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">City</span><span className="text-sm font-semibold">{selectedPermit.city}</span></div>
                      <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Zip</span><span className="text-sm font-semibold">{selectedPermit.zip_code}</span></div>
                      <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">State</span><span className="text-sm font-semibold">{selectedPermit.state}</span></div>

                      <div className="col-span-2"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Contractor</span><span className="text-sm font-semibold text-slate-800">{selectedPermit.contractor} <span className="text-slate-400 font-normal">({selectedPermit.license})</span></span></div>

                      <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Permit Type</span><span className="text-sm font-semibold">{selectedPermit.type}</span></div>
                      <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Issue Date</span><span className="text-sm font-semibold">{selectedPermit.issue_date}</span></div>

                      <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Sq Ft</span><span className="text-sm font-semibold">{Number(selectedPermit.square_feet).toLocaleString()}</span></div>
                      {selectedPermit.valuation && (
                        <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Valuation</span><span className="text-sm font-bold text-emerald-600">${Number(selectedPermit.valuation).toLocaleString()}</span></div>
                      )}

                      <div className="col-span-2"><span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Work Description</span><p className="text-sm text-slate-700 mt-1 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">{selectedPermit.work_description}</p></div>

                      <div className="col-span-2 mt-2">
                        <a href={getLADBSLink(selectedPermit.permit_number, selectedPermit.permit_link)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-blue-600 text-sm font-bold bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-md transition-colors">
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
                      <LockedField label="Architect" value={selectedPermit.architect ? `${selectedPermit.architect} (${selectedPermit.architect_license || 'No License'})` : 'No Data'} requiredTier="RESIDENTIAL" currentTier={currentTier} />
                      <LockedField label="Expediter" value={selectedPermit.permit_expediter || 'No Data'} requiredTier="RESIDENTIAL" currentTier={currentTier} />
                      <LockedField label="APN" value={selectedPermit.apn} requiredTier="RESIDENTIAL" currentTier={currentTier} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center justify-between">
                      Commercial <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">$125/mo</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                      <LockedField label="Project Category" value={selectedPermit.project_category} requiredTier="COMMERCIAL" currentTier={currentTier} />
                      <LockedField
                        label="Engineer"
                        value={
                          [
                            selectedPermit.engineer ? `${selectedPermit.engineer} (${selectedPermit.engineer_license || 'No License'})` : null,
                            selectedPermit.geologist ? `Geologist: ${selectedPermit.geologist} (${selectedPermit.geologist_license || 'No License'})` : null
                          ].filter(Boolean).join(' | ') || 'No Data'
                        }
                        requiredTier="COMMERCIAL"
                        currentTier={currentTier}
                      />
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

        {/* On-Map Toggle Pills (bottom-left) */}
        <div className={`absolute bottom-6 left-4 z-20 flex flex-col gap-3 pointer-events-auto transition-all duration-500 ${isSidePanelOpen ? 'opacity-0 pointer-events-none translate-x-[-20px]' : 'opacity-100'}`}>
          <div className="glass rounded-2xl p-4 shadow-2xl border-white/40 flex flex-col gap-3 min-w-[210px]">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 mb-1">Map Filters</h3>

            {[
              { key: 'is_owner_builder', label: 'Owner-Builder', icon: <UserCheck className="w-3.5 h-3.5" /> },
              { key: 'commercial', label: 'Commercial', icon: <Building2 className="w-3.5 h-3.5" /> },
              { key: 'residential', label: 'Residential', icon: <Home className="w-3.5 h-3.5" /> },
              { key: 'basement', label: 'Basement', icon: <Spade className="w-3.5 h-3.5" /> },
              { key: 'hillside', label: 'Hillside', icon: <Mountain className="w-3.5 h-3.5" /> },
            ].map(({ key, label, icon }) => (
              <div key={key} className="flex items-center justify-between gap-4 px-1 group">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg transition-colors ${filters[key as keyof typeof filters] ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                    {icon}
                  </div>
                  <span className={`text-[11px] font-bold transition-colors ${filters[key as keyof typeof filters] ? 'text-indigo-950' : 'text-slate-500'}`}>
                    {label}
                  </span>
                </div>
                <Switch
                  checked={!!filters[key as keyof typeof filters]}
                  onCheckedChange={() => toggleFilter(key as keyof typeof filters)}
                />
              </div>
            ))}


          </div>
        </div>

        {/* Map Theme Selector (bottom-right) */}
        <div className="absolute bottom-6 right-4 z-20 pointer-events-auto">
          <Select value={mapStyle} onValueChange={setMapStyle}>
            <SelectTrigger className="glass shadow-2xl h-10 text-[10px] md:text-xs font-bold text-slate-600 rounded-full px-4 w-auto gap-3 hover:scale-105 transition-all">
              <Layers className="w-4 h-4 text-slate-500" />
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent align="end" className="glass border-slate-200/50 rounded-2xl overflow-hidden shadow-2xl">
              <SelectItem value={MAP_STYLES.DARK} className="font-bold py-2.5">🌑 Tactical Dark</SelectItem>
              <SelectItem value={MAP_STYLES.LIGHT} className="font-bold py-2.5">☀️ Clean Light</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Main Map Container */}
        <div className="w-full h-full relative" ref={mapContainer}>
          {loading && (
            <div className="absolute inset-x-0 top-0 h-1 bg-blue-500/20 overflow-hidden z-20">
              <div className="h-full bg-blue-500 animate-[progress_2s_ease-in-out_infinite]" style={{ width: '40%' }} />
            </div>
          )}
          {/* ... error alert remains ... */}
        </div>

        {/* Analyze List Button (Top-Right Positioning) */}
        {!isListViewOpen && (
          <button
            onClick={() => setIsListViewOpen(true)}
            className="absolute top-48 right-4 md:top-4 md:right-16 z-30 bg-indigo-600 text-white shadow-[0_20px_40px_rgba(79,70,229,0.3)] px-5 md:px-8 py-2.5 md:py-3 rounded-2xl text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-indigo-700 hover:scale-105 transition-all active:scale-95 flex items-center gap-2 md:gap-3 border border-indigo-400/30 animate-in fade-in slide-in-from-right-4 duration-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="md:w-[16px] md:h-[16px]"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
            Analyze List
          </button>
        )}
      </div>

      {/* List View Panel (Right side) */}
      {isListViewOpen && (
        <div className="w-full md:w-[380px] h-1/2 md:h-full bg-white/95 backdrop-blur-xl border-t md:border-t-0 md:border-l border-slate-100 shadow-2xl z-20 flex flex-col flex-shrink-0 transition-all duration-500 animate-in order-2 md:order-2">
          {/* Panel Header */}
          <div className="px-5 md:px-6 pt-5 md:pt-6 pb-4 border-b border-slate-50 bg-white/50">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <h2 className="font-bold text-xl text-indigo-950 tracking-tighter leading-none">Market Density</h2>
                <span className="text-[9px] font-black bg-indigo-100/50 text-indigo-700 px-2.5 py-1 rounded-md border border-indigo-200/50 tracking-[0.2em] uppercase">
                  {data?.features?.length || 0} Assets
                </span>

              </div>
              <button
                onClick={() => setIsListViewOpen(false)}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="flex flex-col gap-4 mb-6 bg-slate-50/50 p-4 rounded-[2rem] border border-slate-100/80">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Sort Priority</span>
                {sortBy && (
                  <button
                    onClick={() => setSortBy(null)}
                    className="text-[10px] font-bold text-red-400 hover:text-red-500 uppercase tracking-wider flex items-center gap-1 transition-colors"
                  >
                    Reset Order
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'most_active', label: 'Most Active' },
                  { key: 'valuation', label: 'Valuation' },
                  { key: 'name_az', label: 'A to Z' },
                  { key: 'years_biz', label: 'Years in Biz' }
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(prev => prev === key ? null : key as any)}
                    className={`flex-1 min-w-[46%] flex items-center justify-center py-3 px-2 rounded-xl transition-all active:scale-95 border ${sortBy === key
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-2xl shadow-indigo-100'
                      : 'bg-white text-slate-600 border-slate-100 hover:border-indigo-200 hover:text-indigo-600 shadow-sm'
                      }`}
                  >
                    <span className="text-[10px] font-bold leading-tight tracking-tight uppercase text-center">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Permit List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
                <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                <span className="text-xs font-semibold">Loading permits...</span>
              </div>
            ) : !data?.features?.length ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400 p-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <p className="text-xs font-semibold text-center">No permits in current viewport.<br />Pan or zoom to load data.</p>
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
                    Trade: 'bg-indigo-100 text-indigo-700',
                    Architect: 'bg-purple-100 text-purple-700',
                  };
                  const colorClass = categoryColor[p?.category] || 'bg-slate-100 text-slate-600';

                  return (
                    <div
                      key={p?.id || i}
                      className="px-4 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors group"
                      onClick={() => {
                        if (p?.id) {
                          handleSelectPermit(p.id);
                        }
                        // Popup will be closed by the useEffect watching isSidePanelOpen
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
