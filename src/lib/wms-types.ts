// --- Location Hierarchy ---

export type LocationType = 'room' | 'zone' | 'unit' | 'compartment'

export type UnitSubtype =
  | 'rack'
  | 'cabinet'
  | 'closet'
  | 'drawer'
  | 'shelf'
  | 'bin'
  | 'pegboard'
  | 'hanging_rod'
  | 'floor'
  | 'custom'

export type MeasurementUnit =
  | 'each' | 'feet' | 'inches' | 'yards' | 'meters'
  | 'bags' | 'rolls' | 'boxes' | 'packs'
  | 'oz' | 'lb' | 'g' | 'kg'
  | 'ml' | 'l' | 'fl_oz' | 'gal'
  | 'sq_ft' | 'sq_in'

export interface Location {
  id: string
  household_id: string
  parent_id: string | null
  location_type: LocationType
  unit_subtype: UnitSubtype | null
  name: string
  label: string | null
  short_id: string | null
  template_id: string | null
  width_in: number | null
  depth_in: number | null
  height_in: number | null
  nfc_tag_id: string | null
  metadata: Record<string, unknown>
  sort_order: number
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface LocationTreeNode extends Location {
  children: LocationTreeNode[]
  item_count?: number
}

export interface LocationBreadcrumb {
  id: string
  name: string
  location_type: LocationType
  label: string | null
}

// --- Product Location Junction ---

export interface ProductLocation {
  id: string
  product_id: string
  location_id: string
  household_id: string
  quantity: number
  notes: string | null
  added_at: string
  added_by: string | null
}

export interface ProductLocationWithProduct extends ProductLocation {
  product_name: string
  product_brand: string | null
  product_image_url: string | null
  product_price: number | null
  is_consumable: boolean
  consumable_quantity: number | null
  consumable_unit: MeasurementUnit | null
  consumable_min_threshold: number | null
}

// --- Usage Log ---

export interface UsageLogEntry {
  id: string
  product_id: string
  household_id: string
  quantity_used: number
  unit: MeasurementUnit
  remaining_quantity: number | null
  note: string | null
  project: string | null
  logged_at: string
  logged_by: string | null
}

// --- Location Templates ---

export interface LocationTemplate {
  id: string
  name: string
  category: string
  width_in: number | null
  depth_in: number | null
  height_in: number | null
  volume_gal: number | null
  default_compartments: {
    count: number
    type: string
    height_in: number
  } | null
}

// --- Form Inputs ---

export interface CreateLocationInput {
  parent_id: string | null
  location_type: LocationType
  unit_subtype?: UnitSubtype | null
  name: string
  label?: string | null
  template_id?: string | null
  width_in?: number | null
  depth_in?: number | null
  height_in?: number | null
  metadata?: Record<string, unknown>
  sort_order?: number
}

export interface AddProductToLocationInput {
  product_id: string
  location_id: string
  quantity?: number
  notes?: string | null
}

export interface LogUsageInput {
  product_id: string
  quantity_used: number
  unit: MeasurementUnit
  note?: string | null
  project?: string | null
}
