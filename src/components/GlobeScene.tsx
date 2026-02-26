import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import R3fGlobe from 'r3f-globe';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import { GLOBAL_CITIES, type CityData } from '../data/cities';

const COUNTRIES_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const GLOBE_RADIUS = 100;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function GlobeScene({
  onCitySelect,
}: {
  onCitySelect: (city: CityData) => void;
}) {
  const [countries, setCountries] = useState<any[]>([]);
  const globeRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  // Zoom animation state
  const animRef = useRef<{
    active: boolean;
    city: CityData;
    targetPos: THREE.Vector3;
    startPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    targetLookAt: THREE.Vector3;
    progress: number;
  } | null>(null);

  // Load country polygons
  useEffect(() => {
    fetch(COUNTRIES_URL)
      .then(r => r.json())
      .then(topology => {
        const geo = feature(topology, topology.objects.countries);
        const filtered = (geo as any).features.filter(
          (f: any) => f.properties?.name !== 'Antarctica' && f.id !== '010'
        );
        setCountries(filtered);
      })
      .catch(console.error);
  }, []);

  // City markers
  const cityPoints = useMemo(() =>
    GLOBAL_CITIES.map(c => ({
      lat: c.lat,
      lng: c.lon,
      city: c.name,
      country: c.country,
      isTarget: c.phase > 0,
      size: c.phase > 0 ? 0.5 : 0.3,
      data: c,
    })),
  []);

  // Custom dark globe material
  const globeMaterial = useMemo(() =>
    new THREE.MeshPhongMaterial({
      color: new THREE.Color('#0a0f1e'),
      emissive: new THREE.Color('#050a14'),
      emissiveIntensity: 0.2,
      shininess: 3,
      transparent: true,
      opacity: 0.97,
    }),
  []);

  // Convert lat/lon to 3D position on globe surface
  const latLonToVec3 = useCallback((lat: number, lon: number, alt: number = 0): THREE.Vector3 => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const r = GLOBE_RADIUS * (1 + alt);
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    );
  }, []);

  // Handle city click — start zoom animation
  const handleClick = useCallback((layer: string, elemData: object | undefined) => {
    if (layer === 'points' && elemData && (elemData as any).data && !animRef.current?.active) {
      const city = (elemData as any).data as CityData;

      // Calculate target: camera zooms close to the globe surface near the city
      const surfacePos = latLonToVec3(city.lat, city.lon, 0);
      const cameraTarget = surfacePos.clone().normalize().multiplyScalar(GLOBE_RADIUS + 20);

      animRef.current = {
        active: true,
        city,
        targetPos: cameraTarget,
        startPos: camera.position.clone(),
        startTarget: controlsRef.current?.target.clone() || new THREE.Vector3(0, 0, 0),
        targetLookAt: surfacePos,
        progress: 0,
      };

      // Disable controls during animation
      if (controlsRef.current) controlsRef.current.enabled = false;
    }
  }, [camera, latLonToVec3]);

  // Animate zoom towards city
  useFrame((_, delta) => {
    const anim = animRef.current;
    if (!anim?.active) return;

    anim.progress += delta * 0.6; // ~1.7s total animation
    const t = easeInOutCubic(Math.min(anim.progress, 1));

    // Lerp camera position
    camera.position.lerpVectors(anim.startPos, anim.targetPos, t);

    // Lerp look-at target
    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(anim.startTarget, anim.targetLookAt, t);
      controlsRef.current.update();
    }

    // When animation completes, switch to city view
    if (anim.progress >= 1) {
      animRef.current = null;
      onCitySelect(anim.city);
    }
  });

  return (
    <>
      <color attach="background" args={['#0F172A']} />
      <ambientLight color={0xcccccc} intensity={Math.PI} />
      <directionalLight position={[1, 1, 1]} intensity={0.6 * Math.PI} />

      <OrbitControls
        ref={controlsRef}
        minDistance={101}
        maxDistance={1e4}
        dampingFactor={0.1}
        zoomSpeed={0.5}
        rotateSpeed={0.3}
      />

      {countries.length > 0 && (
        <R3fGlobe
          ref={globeRef}
          globeMaterial={globeMaterial}
          showGraticules={false}
          showAtmosphere={true}
          atmosphereColor="#00D9FF"
          atmosphereAltitude={0.25}

          // Country polygon outlines
          polygonsData={countries}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={() => 'rgba(15, 23, 42, 0.5)'}
          polygonSideColor={() => 'rgba(0, 217, 255, 0.03)'}
          polygonStrokeColor={() => 'rgba(0, 217, 255, 0.35)'}
          polygonAltitude={0.004}

          // City markers — clickable
          pointsData={cityPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor={(d: any) => d.isTarget ? '#00D9FF' : '#475569'}
          pointAltitude={0.02}
          pointRadius="size"
          pointsMerge={false}
          onClick={handleClick}

          animateIn={true}
        />
      )}

      <Stars
        radius={200}
        depth={80}
        count={2000}
        factor={2}
        saturation={0}
        fade
        speed={0.3}
      />
    </>
  );
}
