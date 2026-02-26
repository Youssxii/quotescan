import { useState, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import GlobeScene from './components/GlobeScene';
import HologramCity, { BuildingTooltip } from './components/HologramCity';
import type { CityData } from './data/cities';
import type { OSMBuilding } from './hooks/useOverpassData';
import { searchCities, GLOBAL_CITIES } from './data/cities';
import { useTowerStats } from './hooks/useBuildingData';

type ViewMode = 'globe' | 'city';

function SearchOverlay({
  view,
  onCitySelect,
}: {
  view: ViewMode;
  onCitySelect: (city: CityData) => void;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CityData[]>([]);
  const [focused, setFocused] = useState(false);

  const handleInput = useCallback((val: string) => {
    setQuery(val);
    setSuggestions(val.length > 0 ? searchCities(val) : []);
  }, []);

  const handleSelect = useCallback((city: CityData) => {
    setQuery('');
    setSuggestions([]);
    onCitySelect(city);
  }, [onCitySelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      handleSelect(suggestions[0]);
    }
  }, [suggestions, handleSelect]);

  return (
    <div className={`search-container ${view === 'city' ? 'compact' : ''}`}>
      {view === 'globe' && (
        <>
          <div className="search-title">QuoteScan</div>
          <div className="search-subtitle">
            Global Facade Cleaning Intelligence — Powered by VitroBOT
          </div>
        </>
      )}
      <div className="search-box">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          className="search-input"
          type="text"
          placeholder="Search any city worldwide..."
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={handleKeyDown}
        />
        {focused && suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.map(city => (
              <div
                key={city.name}
                className="suggestion-item"
                onMouseDown={() => handleSelect(city)}
              >
                <span className="suggestion-name">
                  {city.name}, {city.country}
                </span>
                <span className="suggestion-meta">
                  {city.buildings50m.toLocaleString()} buildings
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatsBar() {
  const { total } = useTowerStats();

  return (
    <div className="stats-bar">
      <div>
        <div className="stat-value">{total > 0 ? (total / 1000).toFixed(0) + 'K' : '...'}</div>
        <div className="stat-label">Buildings mapped</div>
      </div>
      <div>
        <div className="stat-value">{GLOBAL_CITIES.length}</div>
        <div className="stat-label">Cities covered</div>
      </div>
      <div>
        <div className="stat-value">$3/m²</div>
        <div className="stat-label">VitroBOT rate</div>
      </div>
      <div>
        <div className="stat-value">86%</div>
        <div className="stat-label">Avg savings</div>
      </div>
    </div>
  );
}

function CityBar({ city }: { city: CityData }) {
  return (
    <div className="city-bar">
      <div>
        <div className="city-name">{city.name}</div>
        <div className="city-meta">
          {city.country} — Phase {city.phase || '—'} Market
          {city.marketSizeM > 0 ? ` — $${city.marketSizeM}M opportunity` : ''}
        </div>
      </div>
      <div className="city-stats">
        <div>
          <div className="stat-value">{city.buildings50m.toLocaleString()}</div>
          <div className="stat-label">Buildings +50m</div>
        </div>
        <div>
          <div className="stat-value">{city.avgBuildingHeight}m</div>
          <div className="stat-label">Avg height</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<ViewMode>('globe');
  const [selectedCity, setSelectedCity] = useState<CityData | null>(null);
  const [hoveredBuilding, setHoveredBuilding] = useState<OSMBuilding | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [transitioning, setTransitioning] = useState(false);

  const handleCitySelect = useCallback((city: CityData) => {
    // Fade to black, then switch view
    setTransitioning(true);
    setTimeout(() => {
      setSelectedCity(city);
      setView('city');
      setTimeout(() => setTransitioning(false), 100);
    }, 400);
  }, []);

  const handleBack = useCallback(() => {
    setTransitioning(true);
    setTimeout(() => {
      setView('globe');
      setSelectedCity(null);
      setHoveredBuilding(null);
      setTimeout(() => setTransitioning(false), 100);
    }, 400);
  }, []);

  const handleHoverBuilding = useCallback((b: OSMBuilding | null, pos: { x: number; y: number }) => {
    setHoveredBuilding(b);
    setTooltipPos(pos);
  }, []);

  const handleUnhoverBuilding = useCallback(() => {
    setHoveredBuilding(null);
  }, []);

  return (
    <>
      {/* 3D Canvas — Globe view */}
      {view === 'globe' && (
        <div className="canvas-container">
          <Canvas
            flat
            camera={{ fov: 50, position: [0, 0, 350] }}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: 'high-performance',
            }}
            style={{ background: '#0F172A' }}
          >
            <Suspense fallback={null}>
              <GlobeScene onCitySelect={handleCitySelect} />
            </Suspense>
          </Canvas>
        </div>
      )}

      {/* 3D Canvas — City hologram view */}
      {view === 'city' && selectedCity && (
        <div className="canvas-container">
          <Canvas
            camera={{
              position: [20, 15, 20],
              fov: 50,
              near: 0.1,
              far: 2000,
            }}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: 'high-performance',
            }}
            style={{ background: '#0F172A' }}
          >
            <Suspense fallback={null}>
              <HologramCity
                city={selectedCity}
                onHoverBuilding={handleHoverBuilding}
                onUnhoverBuilding={handleUnhoverBuilding}
              />
            </Suspense>

            <EffectComposer>
              <Bloom
                intensity={1.2}
                luminanceThreshold={0.15}
                luminanceSmoothing={0.9}
                mipmapBlur
              />
              <ChromaticAberration
                blendFunction={BlendFunction.NORMAL}
                offset={[0.0003, 0.0003]}
              />
            </EffectComposer>
          </Canvas>
        </div>
      )}

      {/* Fade transition overlay */}
      <div className={`transition-overlay ${transitioning ? 'active' : ''}`} />

      {/* UI Overlay */}
      <div className="ui-overlay">
        <div className="brand">
          <div className="brand-name">VitroBOT</div>
          <div className="brand-sub">QuoteScan — Facade Intelligence</div>
        </div>

        <SearchOverlay view={view} onCitySelect={handleCitySelect} />

        {view === 'globe' && <StatsBar />}
        {view === 'city' && selectedCity && <CityBar city={selectedCity} />}

        {view === 'city' && (
          <button className="back-btn" onClick={handleBack}>
            ← Globe
          </button>
        )}

        <BuildingTooltip building={hoveredBuilding} position={tooltipPos} />
      </div>

      <div className="scanlines" />
    </>
  );
}
