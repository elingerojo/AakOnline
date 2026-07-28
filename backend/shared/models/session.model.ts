export interface QuoteRecord {
  id: string;
  sessionId: string;
  items: QuoteRecordItem[];
  subtotal: number;
  iva: number;
  total: number;
  createdAt: string;
}

export interface QuoteRecordItem {
  productId: number;
  productName: string;
  qty: number;
  unitPrice: number;
  selectedVariants: { label: string; option: string }[];
}
