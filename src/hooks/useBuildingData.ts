import { useState, useEffect, useRef } from 'react';

export interface TowerData {
  id: string;
  h: number;
  lon: number;
  lat: number;
  region: string;
}

export interface CityBuildings {
  buildings: TowerData[];
  center: { lat: number; lon: number };
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}

// Cache the full towers dataset
let towersCache: TowerData[] | null = null;
let loadingPromise: Promise<TowerData[]> | null = null;

async function loadTowers(): Promise<TowerData[]> {
  if (towersCache) return towersCache;
  if (loadingPromise) return loadingPromise;

  loadingPromise = fetch('/world_towers_50m.json')
    .then(r => r.json())
    .then((data: TowerData[]) => {
      towersCache = data;
      return data;
    });

  return loadingPromise;
}

// Extract buildings within a bounding box around a city
export function useCityBuildings(
  lat: number,
  lon: number,
  radiusKm: number = 15
): { buildings: TowerData[]; loading: boolean; count: number } {
  const [buildings, setBuildings] = useState<TowerData[]>([]);
  const [loading, setLoading] = useState(true);
  const prevKey = useRef('');

  useEffect(() => {
    const key = `${lat},${lon},${radiusKm}`;
    if (key === prevKey.current) return;
    prevKey.current = key;

    setLoading(true);

    // Approximate degree offset for km radius
    const latDeg = radiusKm / 111;
    const lonDeg = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

    loadTowers().then(towers => {
      const filtered = towers.filter(t =>
        t.lat >= lat - latDeg && t.lat <= lat + latDeg &&
        t.lon >= lon - lonDeg && t.lon <= lon + lonDeg
      );
      setBuildings(filtered);
      setLoading(false);
    });
  }, [lat, lon, radiusKm]);

  return { buildings, loading, count: buildings.length };
}

// Get global tower count stats
export function useTowerStats(): { total: number; loading: boolean } {
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTowers().then(towers => {
      setTotal(towers.length);
      setLoading(false);
    });
  }, []);

  return { total, loading };
}

// Convert lat/lon building to local XZ coordinates (meters from center)
export function toLocalCoords(
  building: TowerData,
  centerLat: number,
  centerLon: number
): { x: number; z: number; height: number } {
  const latDiff = building.lat - centerLat;
  const lonDiff = building.lon - centerLon;

  // Approximate meters per degree
  const mPerDegreeLat = 111320;
  const mPerDegreeLon = 111320 * Math.cos(centerLat * Math.PI / 180);

  return {
    x: lonDiff * mPerDegreeLon * 0.015, // Scale down for scene
    z: -latDiff * mPerDegreeLat * 0.015,
    height: building.h * 0.15, // Scale height
  };
}
