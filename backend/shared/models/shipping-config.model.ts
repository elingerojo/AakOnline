export interface ShippingConfig {
  categoryId: number;
  categoryName: string;
  tiers: DistanceTier[];
  extraUnitFactor: number;
}

export interface DistanceTier {
  minKm: number;
  maxKm: number;
  price: number;
}
