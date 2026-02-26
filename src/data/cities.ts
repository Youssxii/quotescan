// Target cities from VitroBOT deck + major global cities
// Phase 1: Dubai + Singapore, Phase 2: HK + Tokyo, Phase 3: NYC + Shanghai + Shenzhen

export interface CityData {
  name: string;
  country: string;
  lat: number;
  lon: number;
  phase: number;
  buildings50m: number; // from world_towers_50m.json
  marketSizeM: number;  // in $M from deck
  avgBuildingHeight: number;
}

// Core target cities from deck
export const TARGET_CITIES: CityData[] = [
  { name: 'Dubai', country: 'UAE', lat: 25.2048, lon: 55.2708, phase: 1, buildings50m: 1200, marketSizeM: 24, avgBuildingHeight: 120 },
  { name: 'Singapore', country: 'SG', lat: 1.3521, lon: 103.8198, phase: 1, buildings50m: 800, marketSizeM: 23, avgBuildingHeight: 95 },
  { name: 'Hong Kong', country: 'HK', lat: 22.3193, lon: 114.1694, phase: 2, buildings50m: 3500, marketSizeM: 45, avgBuildingHeight: 110 },
  { name: 'Tokyo', country: 'JP', lat: 35.6762, lon: 139.6503, phase: 2, buildings50m: 2800, marketSizeM: 46, avgBuildingHeight: 85 },
  { name: 'New York', country: 'US', lat: 40.7128, lon: -74.0060, phase: 3, buildings50m: 6500, marketSizeM: 52, avgBuildingHeight: 130 },
  { name: 'Shanghai', country: 'CN', lat: 31.2304, lon: 121.4737, phase: 3, buildings50m: 4200, marketSizeM: 38, avgBuildingHeight: 100 },
  { name: 'Shenzhen', country: 'CN', lat: 22.5431, lon: 114.0579, phase: 3, buildings50m: 3100, marketSizeM: 37, avgBuildingHeight: 95 },
];

// Additional major cities for the global feel
export const GLOBAL_CITIES: CityData[] = [
  ...TARGET_CITIES,
  { name: 'London', country: 'UK', lat: 51.5074, lon: -0.1278, phase: 0, buildings50m: 1800, marketSizeM: 18, avgBuildingHeight: 75 },
  { name: 'Paris', country: 'FR', lat: 48.8566, lon: 2.3522, phase: 0, buildings50m: 400, marketSizeM: 12, avgBuildingHeight: 60 },
  { name: 'Sydney', country: 'AU', lat: -33.8688, lon: 151.2093, phase: 0, buildings50m: 600, marketSizeM: 8, avgBuildingHeight: 80 },
  { name: 'São Paulo', country: 'BR', lat: -23.5505, lon: -46.6333, phase: 0, buildings50m: 2200, marketSizeM: 6, avgBuildingHeight: 70 },
  { name: 'Seoul', country: 'KR', lat: 37.5665, lon: 126.9780, phase: 0, buildings50m: 1500, marketSizeM: 14, avgBuildingHeight: 85 },
  { name: 'Mumbai', country: 'IN', lat: 19.0760, lon: 72.8777, phase: 0, buildings50m: 900, marketSizeM: 5, avgBuildingHeight: 70 },
  { name: 'Chicago', country: 'US', lat: 41.8781, lon: -87.6298, phase: 0, buildings50m: 1200, marketSizeM: 10, avgBuildingHeight: 100 },
  { name: 'Toronto', country: 'CA', lat: 43.6532, lon: -79.3832, phase: 0, buildings50m: 800, marketSizeM: 7, avgBuildingHeight: 85 },
  { name: 'Kuala Lumpur', country: 'MY', lat: 3.1390, lon: 101.6869, phase: 0, buildings50m: 500, marketSizeM: 4, avgBuildingHeight: 90 },
  { name: 'Bangkok', country: 'TH', lat: 13.7563, lon: 100.5018, phase: 0, buildings50m: 700, marketSizeM: 5, avgBuildingHeight: 75 },
  { name: 'Doha', country: 'QA', lat: 25.2854, lon: 51.5310, phase: 0, buildings50m: 350, marketSizeM: 8, avgBuildingHeight: 110 },
  { name: 'Abu Dhabi', country: 'AE', lat: 24.4539, lon: 54.3773, phase: 0, buildings50m: 400, marketSizeM: 7, avgBuildingHeight: 95 },
  { name: 'Riyadh', country: 'SA', lat: 24.7136, lon: 46.6753, phase: 0, buildings50m: 300, marketSizeM: 6, avgBuildingHeight: 80 },
  { name: 'Jakarta', country: 'ID', lat: -6.2088, lon: 106.8456, phase: 0, buildings50m: 600, marketSizeM: 4, avgBuildingHeight: 70 },
  { name: 'Mexico City', country: 'MX', lat: 19.4326, lon: -99.1332, phase: 0, buildings50m: 500, marketSizeM: 3, avgBuildingHeight: 65 },
  { name: 'Marseille', country: 'FR', lat: 43.2965, lon: 5.3698, phase: 0, buildings50m: 50, marketSizeM: 2, avgBuildingHeight: 55 },
];

// Convert lat/lon to 3D sphere coordinates
export function latLonToVec3(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return [x, y, z];
}

// Search cities by name
export function searchCities(query: string): CityData[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return GLOBAL_CITIES
    .filter(c => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
    .slice(0, 6);
}
