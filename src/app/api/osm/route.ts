import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Missing lat or lng' }, { status: 400 });
  }

  const query = `[out:json];(node["amenity"="hospital"](around:5000, ${lat}, ${lng});way["amenity"="hospital"](around:5000, ${lat}, ${lng});relation["amenity"="hospital"](around:5000, ${lat}, ${lng}););out center;`;
  
  const endpoints = [
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    `https://lz4.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    `https://z.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`
  ];

  let lastError = null;

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PharmaVerify/1.0 (https://inventory-management-system-zeta-nine.vercel.app)'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      } else {
        lastError = new Error(`OSM API ${url} responded with status: ${response.status}`);
        console.warn(lastError.message);
      }
    } catch (error) {
      lastError = error;
      console.warn(`Fetch failed for ${url}:`, error);
    }
  }

  console.error('All OSM API endpoints failed. Last error:', lastError);
  return NextResponse.json({ error: 'Failed to fetch from OSM API' }, { status: 500 });
}
