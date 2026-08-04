export interface QuoteItem {
  productId: number;
  productName: string;
  image: string;
  selectedVariants: QuoteVariantSelection[];
  qty: number;
  unitPrice: number;
  subtotal: number;
  shippingCost: number;
}

export interface QuoteVariantSelection {
  variantLabel: string;
  optionName: string;
  optionPrice: number;
}

export interface QuoteSummary {
  items: QuoteItem[];
  unpricedItems: QuoteItem[];
  subtotal: number;
  iva: number;
  totalShipping: number;
  grandTotal: number;
  distanceKm: number;
}
