export interface Category {
  id: number;
  name: string;
  slug: string;
  productImage: string;
  bgImage: string;
  models: number;
  variants: CategoryVariant[];
}

export interface CategoryVariant {
  id: string;
  label: string;
  options: CategoryVariantOption[];
}

export interface CategoryVariantOption {
  name: string;
  price: number;
}
