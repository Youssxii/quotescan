import { useState, useEffect, useRef } from 'react';

export interface OSMBuilding {
  id: number;
  name: string;
  street: string;
  height: number;
  levels: number;
  polygon: { lat: number; lon: number }[];
  material: string;
}

export interface OSMStreet {
  id: number;
  name: string;
  type: string;
  points: { lat: number; lon: number }[];
}

export interface OverpassData {
  buildings: OSMBuilding[];
  streets: OSMStreet[];
  loading: boolean;
  error: string | null;
  count: number;
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const cache = new Map<string, { buildings: OSMBuilding[]; streets: OSMStreet[] }>();

function parseHeight(tags: Record<string, string>): number {
  if (tags.height) {
    const h = parseFloat(tags.height);
    if (!isNaN(h)) return h;
  }
  if (tags['building:levels']) {
    const levels = parseInt(tags['building:levels']);
    if (!isNaN(levels)) return levels * 3.5;
  }
  // Default height based on building type
  const type = tags.building || '';
  if (['skyscraper', 'tower'].includes(type)) return 80;
  if (['commercial', 'office', 'hotel'].includes(type)) return 25;
  if (['apartments', 'residential'].includes(type)) return 15;
  return 10;
}

function getBuildingName(tags: Record<string, string>): string {
  return tags['name:en'] || tags.name || '';
}

function getStreetName(tags: Record<string, string>): string {
  if (tags['addr:street']) return tags['addr:street'];
  return '';
}

export function useOverpassData(
  lat: number,
  lon: number,
  radiusKm: number = 1
): OverpassData {
  const [data, setData] = useState<{ buildings: OSMBuilding[]; streets: OSMStreet[] }>({
    buildings: [],
    streets: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevKey = useRef('');

  useEffect(() => {
    const key = `${lat.toFixed(4)},${lon.toFixed(4)},${radiusKm}`;
    if (key === prevKey.current) return;
    prevKey.current = key;

    // Check cache
    if (cache.has(key)) {
      setData(cache.get(key)!);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Compute bounding box
    const latDeg = radiusKm / 111;
    const lonDeg = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
    const bbox = `${(lat - latDeg).toFixed(5)},${(lon - lonDeg).toFixed(5)},${(lat + latDeg).toFixed(5)},${(lon + lonDeg).toFixed(5)}`;

    const query = `[out:json][timeout:30];(way["building"](${bbox});way["highway"](${bbox}););out geom;`;

    fetch(`${OVERPASS_URL}?data=${encodeURIComponent(query)}`)
      .then(r => {
        if (!r.ok) throw new Error(`Overpass API: ${r.status}`);
        return r.json();
      })
      .then(json => {
        const elements = json.elements || [];

        const streets: OSMStreet[] = elements
          .filter((e: any) => e.tags?.highway && e.geometry)
          .map((e: any) => ({
            id: e.id,
            name: e.tags.name || e.tags.highway || '',
            type: e.tags.highway,
            points: e.geometry,
          }));

        const buildings: OSMBuilding[] = elements
          .filter((e: any) => e.tags?.building && e.geometry && e.geometry.length >= 3)
          .map((e: any) => {
            const name = getBuildingName(e.tags);
            const street = getStreetName(e.tags);
            return {
              id: e.id,
              name,
              street,
              height: parseHeight(e.tags),
              levels: parseInt(e.tags['building:levels'] || '0') || 0,
              polygon: e.geometry,
              material: e.tags['building:material'] || '',
            };
          });

        // Assign nearest street to buildings without one
        buildings.forEach(b => {
          if (b.street) return;
          const centerLat = b.polygon.reduce((s, p) => s + p.lat, 0) / b.polygon.length;
          const centerLon = b.polygon.reduce((s, p) => s + p.lon, 0) / b.polygon.length;

          let minDist = Infinity;
          let nearestName = '';
          for (const st of streets) {
            if (!st.name || st.name === st.type) continue;
            for (const p of st.points) {
              const d = Math.hypot(p.lat - centerLat, p.lon - centerLon);
              if (d < minDist) {
                minDist = d;
                nearestName = st.name;
              }
            }
          }
          if (nearestName && minDist < 0.002) {
            b.street = nearestName;
          }
        });

        const result = { buildings, streets };
        cache.set(key, result);
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        console.error('Overpass fetch error:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [lat, lon, radiusKm]);

  return {
    ...data,
    loading,
    error,
    count: data.buildings.length,
  };
}

// Convert lat/lon polygon to local XZ coordinates (meters from center)
export function polygonToLocal(
  polygon: { lat: number; lon: number }[],
  centerLat: number,
  centerLon: number,
  scale: number = 1
): { x: number; z: number }[] {
  const mPerDegreeLat = 111320;
  const mPerDegreeLon = 111320 * Math.cos(centerLat * Math.PI / 180);

  return polygon.map(p => ({
    x: (p.lon - centerLon) * mPerDegreeLon * scale,
    z: -(p.lat - centerLat) * mPerDegreeLat * scale,
  }));
}

export function pointToLocal(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  scale: number = 1
): { x: number; z: number } {
  const mPerDegreeLat = 111320;
  const mPerDegreeLon = 111320 * Math.cos(centerLat * Math.PI / 180);
  return {
    x: (lon - centerLon) * mPerDegreeLon * scale,
    z: -(lat - centerLat) * mPerDegreeLat * scale,
  };
}
