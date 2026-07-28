import { Injectable } from '@angular/core';
import type { ShippingConfig } from '@shared/models/shipping-config.model';
import shippingData from '../../../../config/shipping-config.json';

interface ShippingConfigFile {
  categories: ShippingConfig[];
  defaultExtraUnitFactor: number;
}

@Injectable({ providedIn: 'root' })
export class ShippingService {
  private config: ShippingConfigFile;

  constructor() {
    this.config = shippingData as ShippingConfigFile;
  }

  /**
   * Calculate shipping cost for a given category and distance.
   * Formula: baseRate + (units - 1) * baseRate * extraUnitFactor
   */
  calculateShippingCost(
    categoryId: number,
    distanceKm: number,
    units: number = 1
  ): number {
    const categoryConfig = this.config.categories.find(
      c => c.categoryId === categoryId
    );
    if (!categoryConfig) return 0;

    const tier = categoryConfig.tiers.find(
      t => distanceKm >= t.minKm && distanceKm <= t.maxKm
    );
    if (!tier) {
      // Distance exceeds all tiers; charge the highest tier price
      const highestTier = categoryConfig.tiers[categoryConfig.tiers.length - 1];
      if (!highestTier) return 0;
      return this.calculateWithExtraUnits(
        highestTier.price,
        units,
        categoryConfig.extraUnitFactor
      );
    }

    return this.calculateWithExtraUnits(
      tier.price,
      units,
      categoryConfig.extraUnitFactor
    );
  }

  /**
   * Get all shipping configs (for admin display)
   */
  getAllConfigs(): ShippingConfig[] {
    return this.config.categories;
  }

  /**
   * Get config for a specific category
   */
  getConfigForCategory(categoryId: number): ShippingConfig | undefined {
    return this.config.categories.find(c => c.categoryId === categoryId);
  }

  private calculateWithExtraUnits(
    baseRate: number,
    units: number,
    extraUnitFactor: number
  ): number {
    if (units <= 1) return baseRate;
    return baseRate + (units - 1) * baseRate * extraUnitFactor;
  }
}
