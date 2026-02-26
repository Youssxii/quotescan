// VitroBOT QuoteScan Pricing Engine
// Based on deck: $3/m² vs $20-30/m² market rate

export interface SurfaceType {
  id: string;
  label: string;
  pricePerM2: number;
  marketPrice: number;
  color: string;
}

export const SURFACE_TYPES: Record<string, SurfaceType> = {
  glass: { id: 'glass', label: 'Glass / Curtain Wall', pricePerM2: 3.50, marketPrice: 25, color: '#00e5ff' },
  concrete: { id: 'concrete', label: 'Concrete / Stone', pricePerM2: 2.20, marketPrice: 18, color: '#9e9e9e' },
  cladding: { id: 'cladding', label: 'Metal Cladding', pricePerM2: 2.80, marketPrice: 22, color: '#ff6d00' },
  stone: { id: 'stone', label: 'Natural Stone', pricePerM2: 4.50, marketPrice: 30, color: '#8d6e63' },
  composite: { id: 'composite', label: 'Composite Panel', pricePerM2: 3.20, marketPrice: 24, color: '#7c4dff' },
  wood: { id: 'wood', label: 'Wood / Timber', pricePerM2: 3.80, marketPrice: 28, color: '#ffab00' },
};

export interface BuildingQuote {
  height: number;
  estimatedPerimeter: number;
  facadeArea: number;
  surfaceType: SurfaceType;
  vitroBotPrice: number;
  marketPrice: number;
  savings: number;
  savingsPercent: number;
  roiMonths: number;
  cleaningsPerYear: number;
  annualCost: number;
  annualMarketCost: number;
}

export function estimateBuildingQuote(heightM: number): BuildingQuote {
  // Estimate facade area from height
  // Average building perimeter ~120m for tall buildings, scales with height
  const estimatedPerimeter = Math.min(80 + heightM * 0.5, 200);
  const facadeArea = heightM * estimatedPerimeter;

  // Default to glass for tall buildings
  const surfaceType = SURFACE_TYPES.glass;

  const vitroBotPrice = facadeArea * surfaceType.pricePerM2;
  const marketPrice = facadeArea * surfaceType.marketPrice;
  const savings = marketPrice - vitroBotPrice;
  const savingsPercent = (savings / marketPrice) * 100;

  // 4 cleanings per year for commercial high-rises
  const cleaningsPerYear = 4;
  const annualCost = vitroBotPrice * cleaningsPerYear;
  const annualMarketCost = marketPrice * cleaningsPerYear;

  // ROI: VitroBOT robot costs $50K, saves (marketPrice - vitroBotPrice) * 4 per year
  const annualSavings = (annualMarketCost - annualCost);
  const roiMonths = Math.round((50000 / annualSavings) * 12);

  return {
    height: heightM,
    estimatedPerimeter,
    facadeArea,
    surfaceType,
    vitroBotPrice,
    marketPrice,
    savings,
    savingsPercent,
    roiMonths,
    cleaningsPerYear,
    annualCost,
    annualMarketCost,
  };
}

export function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatArea(m2: number): string {
  if (m2 >= 10000) return `${(m2 / 1000).toFixed(0)}K m²`;
  return `${m2.toFixed(0)} m²`;
}
