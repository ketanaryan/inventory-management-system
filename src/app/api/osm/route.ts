import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Missing lat or lng' }, { status: 400 });
  }

  const query = `[out:json];(node["amenity"="hospital"](around:5000, ${lat}, ${lng});way["amenity"="hospital"](around:5000, ${lat}, ${lng});relation["amenity"="hospital"](around:5000, ${lat}, ${lng}););out center;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PharmaVerify/1.0 (https://inventory-management-system-zeta-nine.vercel.app)'
      }
    });

    if (!response.ok) {
      throw new Error(`OSM API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('OSM API Proxy Error:', error);
    return NextResponse.json({ error: 'Failed to fetch from OSM API' }, { status: 500 });
  }
}
