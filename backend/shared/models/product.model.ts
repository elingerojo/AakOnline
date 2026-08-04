export interface Product {
  id: number;
  sku: string;
  categoryId: number;
  name: string | null;       // null until Gemini suggests a name
  slug: string;

  // Images
  image: string;
  imageList: string[];

  // Variant selections (indexes referencing Category.variants[].options[])
  variantSelections: VariantSelection[];

  // Pricing (0 = placeholder until admin sets them)
  originalPrice: number;
  currentPrice: number;

  // Shipping (empty until admin fills them)
  shippingComponents: ShippingComponent[];

  // Metadata
  featuredSection: FeaturedSection | null;
  featuredImage: string;
  tags: string[];
  score: number;
  ratings: number;

  // Descriptions (empty strings until Gemini generates them)
  shortDescription: string;
  longDescription: string;
  marketingPhrase: string;

  // Status
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export type ProductStatus = 'pendiente' | 'activo' | 'suspendido' | 'almacenado';

/** Sección del Home donde se despliega el producto (requiere featuredImage). */
export type FeaturedSection = 'destacados' | 'nuevos';

export interface VariantSelection {
  variantId: string;
  enabledOptionIndices: number[];
}

export interface ShippingComponent {
  name: string;
  netWeightKg: number;
  packagedWeightKg: number;
  packagedDimensionsCm: {
    width: number;
    depth: number;
    height: number;
  };
  packagingDescription: string;
}
