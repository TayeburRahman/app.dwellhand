import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const query = searchParams.get('q');

  if (!type || !query) {
    return NextResponse.json({ suggestions: [] });
  }

  if (type !== 'city' && type !== 'county') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!mapboxToken) {
    console.error('Mapbox token is missing for location suggestions');
    return NextResponse.json({ suggestions: [] });
  }

  // Mapbox types: 'place' for city, 'district' for county
  const mapboxType = type === 'city' ? 'place' : 'district';
  // Bounding box for California to restrict suggestions appropriately
  const bbox = '-124.48,32.53,-114.13,42.01';

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?types=${mapboxType}&bbox=${bbox}&country=us&access_token=${mapboxToken}`;
    const res = await fetch(url);
    const data = await res.json();
    
    // Mapbox feature format includes 'text' (e.g. "Los Angeles") and 'place_name'
    const suggestions = (data.features || []).map((f: any) => f.text);
    const uniqueSuggestions = Array.from(new Set(suggestions));

    return NextResponse.json(
      { suggestions: uniqueSuggestions },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching Mapbox location suggestions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
