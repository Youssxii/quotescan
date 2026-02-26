import { useRef, useMemo, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  useOverpassData,
  polygonToLocal,
  pointToLocal,
  type OSMBuilding,
} from '../hooks/useOverpassData';
import { useCityBuildings, toLocalCoords } from '../hooks/useBuildingData';
import { estimateBuildingQuote, formatCurrency, formatArea } from '../data/pricing';
import type { CityData } from '../data/cities';
import {
  gridVertexShader,
  gridFragmentShader,
  hologramVertexShader,
  hologramFragmentShader,
  pointsVertexShader,
  pointsFragmentShader,
} from '../shaders/hologram';

const CITY_SCALE = 0.06;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Holographic grid floor
function HoloGrid() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((state) => { uniforms.uTime.value = state.clock.elapsedTime; });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[300, 300]} />
      <shaderMaterial
        vertexShader={gridVertexShader}
        fragmentShader={gridFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Real building shapes from OSM with hologram shader
function RealBuildings({
  buildings,
  centerLat,
  centerLon,
  onHover,
  onUnhover,
}: {
  buildings: OSMBuilding[];
  centerLat: number;
  centerLon: number;
  onHover: (building: OSMBuilding, screenPos: { x: number; y: number }) => void;
  onUnhover: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const { camera, gl } = useThree();
  const introRef = useRef(0);

  // Shared hologram uniforms — updated every frame
  const holoUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uHover: { value: 0 },
    uColor: { value: new THREE.Color('#00D9FF') },
    uOpacity: { value: 0.7 },
  }), []);

  useEffect(() => { introRef.current = 0; }, [buildings]);

  useFrame((state, delta) => {
    holoUniforms.uTime.value = state.clock.elapsedTime;

    if (introRef.current < 1) {
      introRef.current = Math.min(introRef.current + delta * 0.8, 1);
    }
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        const delay = Math.min(i * 0.0004, 0.4);
        const progress = Math.max(0, (introRef.current - delay) / (1 - delay));
        child.scale.y = easeOutCubic(Math.min(progress, 1));
      });
    }
  });

  const meshes = useMemo(() => {
    return buildings.slice(0, 1000).map((b) => {
      const localPoly = polygonToLocal(b.polygon, centerLat, centerLon, CITY_SCALE);
      if (localPoly.length < 3) return null;

      const shape = new THREE.Shape();
      shape.moveTo(localPoly[0].x, localPoly[0].z);
      for (let i = 1; i < localPoly.length; i++) {
        shape.lineTo(localPoly[i].x, localPoly[i].z);
      }
      shape.closePath();

      const height = b.height * CITY_SCALE;

      try {
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: height,
          bevelEnabled: false,
        });
        geo.rotateX(-Math.PI / 2);
        geo.computeVertexNormals();
        return { geometry: geo, building: b, height };
      } catch {
        return null;
      }
    }).filter(Boolean) as { geometry: THREE.ExtrudeGeometry; building: OSMBuilding; height: number }[];
  }, [buildings, centerLat, centerLon]);

  const handlePointerMove = useCallback((e: any) => {
    e.stopPropagation();
    const mesh = e.object;
    if (mesh?.userData?.building) {
      const b = mesh.userData.building as OSMBuilding;
      const center = polygonToLocal(b.polygon, centerLat, centerLon, CITY_SCALE);
      const cx = center.reduce((s, p) => s + p.x, 0) / center.length;
      const cz = center.reduce((s, p) => s + p.z, 0) / center.length;
      const vec = new THREE.Vector3(cx, b.height * CITY_SCALE * 0.5, cz);
      vec.project(camera);
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((vec.x + 1) / 2) * rect.width;
      const y = ((-vec.y + 1) / 2) * rect.height;
      onHover(b, { x, y });
    }
  }, [centerLat, centerLon, camera, gl, onHover]);

  return (
    <group ref={groupRef}>
      {meshes.map(({ geometry, building, height }) => (
        <mesh
          key={building.id}
          geometry={geometry}
          userData={{ building }}
          onPointerMove={handlePointerMove}
          onPointerLeave={onUnhover}
        >
          <shaderMaterial
            vertexShader={hologramVertexShader}
            fragmentShader={hologramFragmentShader}
            uniforms={{
              uTime: holoUniforms.uTime,
              uHover: { value: 0 },
              uColor: holoUniforms.uColor,
              uOpacity: { value: 0.3 + Math.min(height / (80 * CITY_SCALE), 0.5) },
            }}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

// Building edge wireframes — the hologram outline look
function BuildingEdges({
  buildings,
  centerLat,
  centerLon,
}: {
  buildings: OSMBuilding[];
  centerLat: number;
  centerLon: number;
}) {
  const geometry = useMemo(() => {
    const positions: number[] = [];

    buildings.slice(0, 1000).forEach(b => {
      const poly = polygonToLocal(b.polygon, centerLat, centerLon, CITY_SCALE);
      if (poly.length < 3) return;
      const h = b.height * CITY_SCALE;

      // Bottom edges
      for (let i = 0; i < poly.length; i++) {
        const next = poly[(i + 1) % poly.length];
        positions.push(poly[i].x, 0, poly[i].z);
        positions.push(next.x, 0, next.z);
      }
      // Top edges
      for (let i = 0; i < poly.length; i++) {
        const next = poly[(i + 1) % poly.length];
        positions.push(poly[i].x, h, poly[i].z);
        positions.push(next.x, h, next.z);
      }
      // Vertical edges (corners only for cleaner look)
      for (const p of poly) {
        positions.push(p.x, 0, p.z);
        positions.push(p.x, h, p.z);
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [buildings, centerLat, centerLon]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#00D9FF" transparent opacity={0.6} depthWrite={false} />
    </lineSegments>
  );
}

// Street lines
function StreetLines({
  streets,
  centerLat,
  centerLon,
}: {
  streets: { id: number; name: string; type: string; points: { lat: number; lon: number }[] }[];
  centerLat: number;
  centerLon: number;
}) {
  const geometry = useMemo(() => {
    const positions: number[] = [];

    streets.forEach(st => {
      for (let i = 0; i < st.points.length - 1; i++) {
        const a = pointToLocal(st.points[i].lat, st.points[i].lon, centerLat, centerLon, CITY_SCALE);
        const b = pointToLocal(st.points[i + 1].lat, st.points[i + 1].lon, centerLat, centerLon, CITY_SCALE);
        positions.push(a.x, 0.02, a.z);
        positions.push(b.x, 0.02, b.z);
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [streets, centerLat, centerLon]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#1E3A5F" transparent opacity={0.4} depthWrite={false} />
    </lineSegments>
  );
}

// Fallback: particle buildings from towers data
function FallbackParticles({
  city,
}: {
  city: CityData;
}) {
  const { buildings } = useCityBuildings(city.lat, city.lon, 15);
  const pointsRef = useRef<THREE.Points>(null!);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPointSize: { value: 4.0 },
  }), []);

  const geometry = useMemo(() => {
    const positions: number[] = [];
    const heights: number[] = [];
    const randoms: number[] = [];

    buildings.forEach(b => {
      const local = toLocalCoords(b, city.lat, city.lon);
      for (let y = 0; y < local.height; y += local.height / 8) {
        positions.push(
          local.x + (Math.random() - 0.5) * 0.3,
          y,
          local.z + (Math.random() - 0.5) * 0.3
        );
        heights.push(b.h);
        randoms.push(Math.random());
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('aHeight', new THREE.Float32BufferAttribute(heights, 1));
    geo.setAttribute('aRandom', new THREE.Float32BufferAttribute(randoms, 1));
    return geo;
  }, [buildings, city.lat, city.lon]);

  useFrame((state) => { uniforms.uTime.value = state.clock.elapsedTime; });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <shaderMaterial
        vertexShader={pointsVertexShader}
        fragmentShader={pointsFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Tooltip with real building data
export function BuildingTooltip({
  building,
  position,
}: {
  building: OSMBuilding | null;
  position: { x: number; y: number };
}) {
  if (!building) return null;

  const quote = estimateBuildingQuote(building.height);
  const label = building.name || building.street || 'Building';

  return (
    <div className="tooltip" style={{ left: position.x + 16, top: position.y - 20 }}>
      <h3>{label}</h3>
      {building.street && !building.name && (
        <div className="tooltip-row">
          <span className="label">Street</span>
          <span className="value">{building.street}</span>
        </div>
      )}
      {building.name && building.street && (
        <div className="tooltip-row">
          <span className="label">Address</span>
          <span className="value">{building.street}</span>
        </div>
      )}
      <div className="tooltip-row">
        <span className="label">Height</span>
        <span className="value">{building.height.toFixed(0)}m{building.levels ? ` (${building.levels}F)` : ''}</span>
      </div>
      <div className="tooltip-row">
        <span className="label">Facade</span>
        <span className="value">{formatArea(quote.facadeArea)}</span>
      </div>
      <div className="tooltip-row">
        <span className="label">Market rate</span>
        <span className="value">{formatCurrency(quote.marketPrice)}</span>
      </div>
      <div className="tooltip-row">
        <span className="label">VitroBOT</span>
        <span className="value" style={{ color: '#4ADE80' }}>
          {formatCurrency(quote.vitroBotPrice)}
        </span>
      </div>
      <div className="tooltip-total">
        <span className="label">You save</span>
        <span className="value">{quote.savingsPercent.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export default function HologramCity({
  city,
  onHoverBuilding,
  onUnhoverBuilding,
}: {
  city: CityData;
  onHoverBuilding: (building: OSMBuilding | null, pos: { x: number; y: number }) => void;
  onUnhoverBuilding: () => void;
}) {
  const { buildings, streets, loading } = useOverpassData(city.lat, city.lon, 1);

  const handleHover = useCallback((b: OSMBuilding, pos: { x: number; y: number }) => {
    onHoverBuilding(b, pos);
  }, [onHoverBuilding]);

  return (
    <>
      <ambientLight intensity={0.04} />
      <pointLight position={[0, 50, 0]} intensity={0.25} color="#00D9FF" />
      <pointLight position={[30, 20, -30]} intensity={0.08} color="#1E293B" />

      <HoloGrid />

      {!loading && buildings.length > 0 && (
        <>
          <RealBuildings
            buildings={buildings}
            centerLat={city.lat}
            centerLon={city.lon}
            onHover={handleHover}
            onUnhover={onUnhoverBuilding}
          />
          <BuildingEdges
            buildings={buildings}
            centerLat={city.lat}
            centerLon={city.lon}
          />
          <StreetLines
            streets={streets}
            centerLat={city.lat}
            centerLon={city.lon}
          />
        </>
      )}

      {!loading && buildings.length === 0 && (
        <FallbackParticles city={city} />
      )}

      {loading && <LoadingText />}

      <OrbitControls
        enableZoom
        enablePan
        minDistance={5}
        maxDistance={100}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 3, 0]}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
      />
    </>
  );
}

// Simple text-based loading — no expanding circle
function LoadingText() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = 2 + Math.sin(state.clock.elapsedTime * 2) * 0.3;
      ref.current.rotation.y = state.clock.elapsedTime * 1.5;
    }
  });
  return (
    <mesh ref={ref} position={[0, 2, 0]}>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshBasicMaterial color="#00D9FF" wireframe transparent opacity={0.3} />
    </mesh>
  );
}
