export type Role = "admin" | "sales" | "designer" | "production" | "delivery" | "finance";

export interface BaseProduct {
  id: string;
  name: string;
  imageUrl?: string;
  defaultPrice?: number;  // default unit price
  stock?: number;         // available stock quantity
  stockThreshold?: number; // minimum stock threshold
}

export interface ProductAttribute {
  key: string; // "size", "color"
  label: string; // "Size", "Color"
  options: Array<{ value: string; label: string; priceDelta?: number }>;
}

export interface ConfiguredProduct {
  id: string;              // unique per selection (uuid or baseId + timestamp)
  productId: string;       // base product id
  name: string;
  imageUrl?: string;
  quantity: number;
  price: number;           // unit price
  attributes: Record<string, string>; // { size: "L", color: "Red" }
  sku?: string;
  customRequirements?: string; // Custom design requirements for this product
  design?: {
    ready: boolean;
    needCustom: boolean;
    customRequirements: string;
    files?: Array<{ name: string; size: number; type: string; file?: File }>; // Legacy - kept for backward compatibility
    uploadedFiles?: Array<{
      id: number;
      order: number;
      order_code: string;
      file_url: string;
      file_name: string;
      file_type: string;
      file_size: number;
      mime_type: string;
      uploaded_by: string;
      uploaded_by_role: string;
      stage: string;
      visible_to_roles: string[];
      description: string;
      product_related: string;
      uploaded_at: string;
    }>;
  };
}