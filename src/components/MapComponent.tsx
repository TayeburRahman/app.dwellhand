'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Layers, Filter, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from './ui/switch';

const MAP_STYLES = {
  DARK: 'mapbox://styles/barneymandate/cmodp22ff003401sx4l24hy5d',
  LIGHT: 'mapbox://styles/barneymandate/cmmz9n7vx00hl01sk8zs7gp32'
};

const LA_BOUNDARIES_VECTOR = 'mapbox://barneymandate.btswvlsf';

// Validate token presence
const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (mapboxToken) {
  mapboxgl.accessToken = mapboxToken;
}

export default function MapComponent() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  // Custom states
  const [mapStyle, setMapStyle] = useState<string>(MAP_STYLES.DARK);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showOptionalLayer, setShowOptionalLayer] = useState<boolean>(false);

  const supabase = createClient();

  useEffect(() => {
    // 1. Fetch data from Supabase
    const fetchPermitData = async () => {
      setLoading(true);
      const { data: rawData, error: dbError } = await supabase
        .from('permits_sample')
        .select('id, latitude, longitude, address, city, status, permit_type, valuation, issue_date, contractor, contractor_license, square_feet, work_description')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(3000); // Sensible limit for client side

      if (dbError) {
        setError('Failed to fetch permit data.');
        setLoading(false);
        return;
      }

      // 2. Transform to GeoJSON
      const geojson = {
        type: 'FeatureCollection',
        features: rawData.map((d: any) => {
          const rawStatus = d.status || 'Pending';
          const upperStatus = rawStatus.toUpperCase();
          let filterStatus = 'OTHER';
          if (upperStatus.includes('ISSUED')) filterStatus = 'ISSUED';
          else if (upperStatus.includes('FINAL')) filterStatus = 'FINALED';

          const rawType = d.permit_type || 'Unknown Type';
          const upperType = rawType.toUpperCase();
          let filterType = 'OTHER';
          if (upperType.includes('NEW')) filterType = 'NEW';
          else if (upperType.includes('ALTER') || upperType.includes('REPAIR')) filterType = 'ALTERATION';
          else if (upperType.includes('ADDITION')) filterType = 'ADDITION';
          else if (upperType.includes('DEMO')) filterType = 'DEMOLITION';

          return {
            type: 'Feature',
            properties: {
              id: d.id,
              address: d.address || 'Unknown Address',
              city: d.city || 'Los Angeles',
              status: rawStatus,
              filter_status: filterStatus,
              type: rawType,
              filter_type: filterType,
              valuation: d.valuation || 0,
              issue_date: d.issue_date || 'N/A',
              contractor: d.contractor || 'N/A',
              license: d.contractor_license || 'N/A',
              sq_ft: d.square_feet || 0,
              description: d.work_description || 'No description provided'
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
    };

    fetchPermitData();
  }, [supabase]);

  const interactionsBound = useRef(false);

  // Main Map Initialization
  useEffect(() => {
    if (!mapContainer.current || !data) return;

    if (!mapboxgl.accessToken) {
      setError("Missing Mapbox Access Token. Please check env variables.");
      return;
    }

    if (!map.current) {
      try {
        // Initialize map ONLY ONCE
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: mapStyle,
          center: [-118.2437, 34.0522], // DTLA
          zoom: 10,
          pitch: 45,
          failIfMajorPerformanceCaveat: false
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Dynamic style loader
        map.current.on('style.load', () => {
          if (!map.current || !data) return;
          const m = map.current;

          // Make entirely sure the source is correctly inserted on every style load
          if (!m.getSource('permits')) {
            m.addSource('permits', {
              type: 'geojson',
              data: data,
              cluster: false
            });

            m.addLayer({
              id: 'permit-points',
              type: 'circle',
              source: 'permits',
              paint: {
                'circle-color': '#10b981',
                'circle-radius': 6,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff'
              }
            });
          } else {
            (m.getSource('permits') as mapboxgl.GeoJSONSource).setData(data);
          }

          applyFilters();

          // ONLY bind interactions once to prevent duplication lag!
          if (!interactionsBound.current) {
            setupInteractions();
            interactionsBound.current = true;
          }
        });

        map.current.on('error', (e) => {
          const err = e.error as any;
          if (err?.status === 401) setError('Mapbox Token Unauthorized (401)');
        });
      } catch (err: any) {
        setError(`Mapbox init failed: ${err.message}`);
      }
    } else {
      // If map ALREADY exists, we just update the style and let the 'style.load' listener safely rebuild layers
      try {
        map.current.setStyle(mapStyle);
      } catch (e: any) {
        console.error("Style update error:", e);
      }
    }
  }, [data, mapStyle]);

  const applyFilters = () => {
    if (!map.current || !map.current.getLayer('permit-points')) return;

    const conditions: any[] = ['all'];

    if (statusFilter !== 'all') {
      conditions.push(['==', ['get', 'filter_status'], statusFilter]);
    }

    if (typeFilter !== 'all') {
      conditions.push(['==', ['get', 'filter_type'], typeFilter]);
    }

    if (conditions.length === 1) {
      // Clear filters
      map.current.setFilter('permit-points', null);
    } else {
      map.current.setFilter('permit-points', conditions);
    }
  };

  // Safe apply filters whenever React state changes
  useEffect(() => {
    applyFilters();
  }, [statusFilter, typeFilter]);

  // Toggle optional layer
  useEffect(() => {
    // If you uncomment the boundaries layer above, you can uncomment this toggle below
    /*
    if (map.current && map.current.getLayer('la-boundaries-layer')) {
      map.current.setLayoutProperty(
        'la-boundaries-layer',
        'visibility',
        showOptionalLayer ? 'visible' : 'none'
      );
    }
    */
  }, [showOptionalLayer]);

  const setupInteractions = () => {
    if (!map.current) return;
    const m = map.current;

    // Inspect a single point
    m.on('click', 'permit-points', (e) => {
      // Very Important: prevent event from hitting the map's default click handler
      // which immediately closes the popup due to 'closeOnClick'.
      e.preventDefault();

      if (!e.features || e.features.length === 0) return;

      const props = e.features[0].properties;
      console.log('Clicked permit dot:', props); // Debug log

      // Close existing popup if any
      if (popupRef.current) {
        popupRef.current.remove();
      }

      const popupNode = document.createElement('div');
      popupNode.className = 'p-4 min-w-[280px] bg-white font-sans';
      popupNode.style.fontFamily = 'Inter, sans-serif';

      const val = Number(props?.valuation || 0).toLocaleString();
      const sqFt = Number(props?.sq_ft || 0).toLocaleString();

      // Attempt to intelligently parse ZIP from address string, else just default state to CA
      const addressString = props?.address || '';
      const zipMatch = addressString.match(/\b\d{5}\b/);
      let cleanAddress = addressString;
      let zipStr = zipMatch ? zipMatch[0] : '';
      if (zipMatch) {
        cleanAddress = cleanAddress.replace(zipMatch[0], '').trim();
      }

      const fullAddress = `${cleanAddress}, ${props?.city}, CA ${zipStr}`.replace(/,\s*,/g, ',');

      popupNode.innerHTML = `
        <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 800; color: #0f172a; line-height: 1.2;">${fullAddress}</h4>
        <span style="display: inline-block; padding: 3px 8px; background: #e2e8f0; border-radius: 4px; font-size: 10px; font-weight: 800; color: #334155; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${props?.status || 'Active'}</span>
        
        <div style="font-size: 12px; color: #475569; display: flex; flex-direction: column; gap: 6px;">
           <div style="display: flex; justify-content: space-between;"><strong>Permit Type:</strong> <span>${props?.type}</span></div>
           <div style="display: flex; justify-content: space-between; align-items: center;">
             <strong>Issue Date:</strong> 
             <span style="background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 11px;">${props?.issue_date}</span>
           </div>
           
           <div style="margin-top: 4px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 4px;">
             <div><strong>Contractor:</strong> <br/><span style="color: #64748b; font-size: 11px;">${props?.contractor}</span></div>
             <div><strong>License:</strong> <span style="colfsor: #64748b;">${props?.license}</span></div>
           </div>

           <div style="display: flex; justify-content: space-between; margin-top: 4px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
             <div>
               <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #94a3b8;">Valuation</span><br/>
               <span style="font-size: 14px; font-weight: 900; color: #10b981;">$${val}</span>
             </div>
             <div style="text-align: right;">
               <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #94a3b8;">Sq Ft</span><br/>
               <span style="font-size: 14px; font-weight: 900; color: #3b82f6;">${sqFt}</span>
             </div>
           </div>
           
           <div style="margin-top: 4px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
             <strong>Work Description:</strong><br/>
             <div style="color: #64748b; font-size: 11px; margin-top: 2px; line-height: 1.4; max-height: 80px; overflow-y: auto;">
               ${props?.description}
             </div>
           </div>
        </div>
      `;

      // Create new popup and store ref using actual clicked Coordinates
      popupRef.current = new mapboxgl.Popup({ closeButton: true, className: 'premium-popup', offset: 15, maxWidth: '340px' })
        .setLngLat(e.lngLat)
        .setDOMContent(popupNode)
        .addTo(m);
    });

    m.on('mouseenter', 'permit-points', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'permit-points', () => { m.getCanvas().style.cursor = ''; });
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] flex overflow-hidden bg-slate-50">
      {/* Map Control Panel (Client-Side filtering) */}
      <Card className="absolute top-4 left-4 z-10 w-80 shadow-lg border-border bg-white/90 backdrop-blur-md">
        <div className="p-4 space-y-5">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Layers className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold text-slate-900">Map Controls</h2>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-500">Map Theme</Label>
              <Select value={mapStyle} onValueChange={setMapStyle}>
                <SelectTrigger className="bg-white h-9">
                  <SelectValue placeholder="Select Style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MAP_STYLES.DARK}>Tactical Dark (Custom)</SelectItem>
                  <SelectItem value={MAP_STYLES.LIGHT}>Clean Light (Custom)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Memoized filtering prevents hard re-renders */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Permit Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white h-9">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Permits</SelectItem>
                  <SelectItem value="ISSUED">Issued Only</SelectItem>
                  <SelectItem value="FINALED">Finaled Only</SelectItem>
                  <SelectItem value="OTHER">Pending / Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Permit Type
              </Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="bg-white h-9">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="NEW">New Building</SelectItem>
                  <SelectItem value="ALTERATION">Alteration / Repair</SelectItem>
                  <SelectItem value="ADDITION">Addition</SelectItem>
                  <SelectItem value="DEMOLITION">Demolition</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label className="text-xs font-semibold text-slate-500 cursor-pointer" htmlFor="vector-layer">
                Show Boundary Layer
              </Label>
              <Switch
                id="vector-layer"
                checked={showOptionalLayer}
                onCheckedChange={setShowOptionalLayer}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Main Map Container */}
      <div className="w-full h-full relative" ref={mapContainer}>
        {loading && (
          <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <div className="text-sm font-semibold text-slate-700 animate-pulse">Syncing spatial data via realtime...</div>
          </div>
        )}

        {error && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-full max-w-md">
            <Alert variant="destructive" className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-bold">Map Initialization Error</AlertTitle>
              <AlertDescription className="text-xs mt-2 block break-words">
                {error}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>

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
