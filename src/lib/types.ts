export type ProductStatus = "purchased" | "wishlist" | "returned" | "gifted" | "sold"
export type ProductOwnership = "mine" | "household" | "partner"
export type ProductCondition = "new" | "like_new" | "good" | "fair" | "poor"
export type WeightUnit = "oz" | "lb" | "g" | "kg"
export type VolumeUnit = "ml" | "l" | "fl_oz" | "gal"
export type RelationshipType = "goes_with" | "replaced_by" | "variant_of" | "accessory_for" | "outfit_ensemble" | "set_member" | "repurchase_of" | "parent_child"

export interface Dimensions {
  length?: number
  width?: number
  height?: number
  unit?: string
}

export interface Product {
  id: string
  name: string
  brand?: string
  category_id: string
  subcategory_id: string
  description?: string
  image_url?: string
  additional_images?: string[]
  source_url?: string
  retailer?: string
  price?: number
  original_price?: number
  currency: string
  purchase_date?: string
  date_added: string
  status: ProductStatus
  sku?: string
  upc?: string
  weight?: number
  weight_unit?: WeightUnit
  volume?: number
  volume_unit?: VolumeUnit
  dimensions?: Dimensions
  material?: string
  color?: string
  size?: string
  condition?: ProductCondition
  rating?: number
  notes?: string
  return_by_date?: string
  warranty_expires?: string
  order_id?: string
  ownership?: ProductOwnership
  is_consumable?: boolean
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  sort_order: number
  is_default: boolean
}

export interface Subcategory {
  id: string
  category_id: string
  name: string
  sort_order: number
  is_default: boolean
}

export interface ProductRelationship {
  id: string
  product_a: string
  product_b: string
  relationship_type: RelationshipType
  group_name?: string
  notes?: string
  created_at: string
}

export type SortField = "date_added" | "price" | "name" | "purchase_date"
export type SortDirection = "asc" | "desc"
export type ViewMode = "grid" | "list"
