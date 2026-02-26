// Holographic building shader — VitroBOT DA: slate dark + cyan (#00D9FF) accent

export const hologramVertexShader = /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying float vHeight;

  void main() {
    vPosition = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    vHeight = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const hologramFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uHover;
  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec3 vPosition;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying float vHeight;

  void main() {
    // Fresnel edge glow (use world-space position for correct view direction)
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 5.0);

    // Scanlines (scaled for CITY_SCALE: 100m = 6 units, so ~10 lines per unit)
    float scanline = sin(vPosition.y * 10.0 + uTime * 3.0) * 0.5 + 0.5;
    scanline = smoothstep(0.2, 0.8, scanline);

    // Horizontal scan band sweeping upward
    float scanBand = smoothstep(0.0, 0.15, sin(uTime * 0.5 - vPosition.y * 0.5));

    // Height gradient — brighter at top (scale for CITY_SCALE 0.06 where 100m = 6 units)
    float heightGrad = smoothstep(0.0, 1.0, vHeight * 0.15);

    // Base color: cyan (#00D9FF) = vec3(0.0, 0.851, 1.0)
    vec3 color = uColor;
    // Edge glow: slightly brighter cyan-white
    color += fresnel * vec3(0.3, 0.95, 1.0) * 2.0;
    // Top gets slightly warmer white
    color += heightGrad * vec3(0.1, 0.15, 0.2);

    // Hover: brighter green success color
    color += uHover * vec3(0.29, 0.87, 0.5) * 0.3;

    // Alpha
    float alpha = uOpacity;
    alpha *= (0.25 + fresnel * 0.75);
    alpha *= (0.7 + scanline * 0.3);
    alpha *= (0.8 + scanBand * 0.2);
    alpha = clamp(alpha, 0.0, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`;

// Grid floor shader — cyan lines on slate dark
export const gridVertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const gridFragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPos;

  void main() {
    // Grid lines
    vec2 grid = abs(fract(vWorldPos.xz * 0.05) - 0.5);
    float line = min(grid.x, grid.y);
    float gridAlpha = 1.0 - smoothstep(0.0, 0.02, line);

    // Sub-grid
    vec2 subGrid = abs(fract(vWorldPos.xz * 0.2) - 0.5);
    float subLine = min(subGrid.x, subGrid.y);
    float subAlpha = 1.0 - smoothstep(0.0, 0.015, subLine);

    // Distance fade
    float dist = length(vWorldPos.xz);
    float fade = 1.0 - smoothstep(30.0, 120.0, dist);

    // Pulse ring
    float ring = abs(dist - mod(uTime * 8.0, 150.0));
    float ringAlpha = smoothstep(2.0, 0.0, ring) * 0.25;

    // Cyan color: #00D9FF
    vec3 color = vec3(0.0, 0.851, 1.0);
    float alpha = (gridAlpha * 0.18 + subAlpha * 0.06 + ringAlpha) * fade;

    gl_FragColor = vec4(color, alpha);
  }
`;

// Globe atmosphere shader — cyan glow
export const atmosphereVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const atmosphereFragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float uTime;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - dot(viewDir, vNormal), 3.0);

    // Cyan atmosphere: mix from subtle slate-blue to bright cyan
    vec3 color = mix(
      vec3(0.06, 0.09, 0.16),   // slate-900 tint
      vec3(0.0, 0.851, 1.0),     // #00D9FF
      fresnel
    );

    float pulse = sin(uTime * 0.3) * 0.1 + 0.9;
    float alpha = fresnel * 0.5 * pulse;

    gl_FragColor = vec4(color, alpha);
  }
`;

// Building points shader — cyan particles
export const pointsVertexShader = /* glsl */ `
  attribute float aHeight;
  attribute float aRandom;
  uniform float uTime;
  uniform float uPointSize;
  varying float vAlpha;
  varying float vHeight;

  void main() {
    vHeight = aHeight;

    vec3 pos = position;
    // Subtle floating animation
    pos.y += sin(uTime * 0.5 + aRandom * 6.28) * 0.15;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;

    // Size attenuation
    gl_PointSize = uPointSize * (200.0 / -mvPos.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 8.0);

    // Alpha based on height + distance
    float dist = -mvPos.z;
    vAlpha = smoothstep(500.0, 50.0, dist) * (0.4 + aHeight * 0.006);
  }
`;

export const pointsFragmentShader = /* glsl */ `
  uniform float uTime;
  varying float vAlpha;
  varying float vHeight;

  void main() {
    // Circular point
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;

    float glow = 1.0 - smoothstep(0.0, 0.5, dist);

    // Color gradient: slate-blue at base → cyan at top
    vec3 color = mix(
      vec3(0.12, 0.16, 0.26),   // slate-800 tint
      vec3(0.0, 0.851, 1.0),     // #00D9FF cyan
      smoothstep(0.0, 150.0, vHeight)
    );

    // Subtle pulse
    float pulse = sin(uTime + vHeight * 0.05) * 0.15 + 0.85;

    gl_FragColor = vec4(color * glow * pulse, vAlpha * glow);
  }
`;
