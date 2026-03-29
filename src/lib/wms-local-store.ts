/**
 * localStorage-backed WMS store for local development / no-Supabase mode.
 * Mirrors the API of wms-store.ts but uses localStorage.
 */
import type {
  Location,
  LocationTreeNode,
  LocationBreadcrumb,
  LocationTemplate,
  ProductLocation,
  ProductLocationWithProduct,
  UsageLogEntry,
  CreateLocationInput,
  AddProductToLocationInput,
  LogUsageInput,
  MeasurementUnit,
} from './wms-types'

const KEYS = {
  locations: 'eyo_wms_locations',
  productLocations: 'eyo_wms_product_locations',
  usageLog: 'eyo_wms_usage_log',
}

function get<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(key)
  return raw ? JSON.parse(raw) : []
}

function set<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data))
}

function generateShortId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// ============================================
// LOCATION TEMPLATES
// ============================================

const TEMPLATES: LocationTemplate[] = [
  { id: 'samla_1gal',  name: 'SAMLA 1 gal',    category: 'bin',     width_in: 11,    depth_in: 7.5,   height_in: 5.5,  volume_gal: 1,    default_compartments: null, brand: null, household_id: null },
  { id: 'samla_3gal',  name: 'SAMLA 3 gal',    category: 'bin',     width_in: 15.25, depth_in: 11,    height_in: 5.5,  volume_gal: 3,    default_compartments: null, brand: null, household_id: null },
  { id: 'samla_6gal',  name: 'SAMLA 6 gal',    category: 'bin',     width_in: 15.25, depth_in: 11,    height_in: 11,   volume_gal: 6,    default_compartments: null, brand: null, household_id: null },
  { id: 'samla_12gal', name: 'SAMLA 12 gal',   category: 'bin',     width_in: 22,    depth_in: 15.25, height_in: 11,   volume_gal: 12,   default_compartments: null, brand: null, household_id: null },
  { id: 'samla_15gal', name: 'SAMLA 15 gal',   category: 'bin',     width_in: 30.75, depth_in: 22,    height_in: 7,    volume_gal: 15,   default_compartments: null, brand: null, household_id: null },
  { id: 'samla_17gal', name: 'SAMLA 17 gal',   category: 'bin',     width_in: 22.5,  depth_in: 15.25, height_in: 16.5, volume_gal: 17,   default_compartments: null, brand: null, household_id: null },
  { id: 'samla_34gal', name: 'SAMLA 34 gal',   category: 'bin',     width_in: 30.75, depth_in: 22,    height_in: 17,   volume_gal: 34,   default_compartments: null, brand: null, household_id: null },
  { id: 'omar_rack',   name: 'IKEA OMAR Rack', category: 'rack',    width_in: 36.25, depth_in: 14,    height_in: 72,   volume_gal: null, default_compartments: { count: 6, type: 'shelf', height_in: 11.5 }, brand: null, household_id: null },
  { id: 'tool_chest',  name: 'Tool Chest',     category: 'cabinet', width_in: null,  depth_in: null,  height_in: null, volume_gal: null, default_compartments: null, brand: null, household_id: null },
  { id: 'closet',      name: 'Closet',         category: 'closet',  width_in: null,  depth_in: null,  height_in: null, volume_gal: null, default_compartments: null, brand: null, household_id: null },
  { id: 'kitchen_drawer', name: 'Kitchen Drawer', category: 'drawer', width_in: null, depth_in: null, height_in: null, volume_gal: null, default_compartments: null, brand: null, household_id: null },
  { id: 'custom',      name: 'Custom',         category: 'custom',  width_in: null,  depth_in: null,  height_in: null, volume_gal: null, default_compartments: null, brand: null, household_id: null },
]

export function getLocationTemplates(): LocationTemplate[] {
  return TEMPLATES
}

// ============================================
// LOCATIONS — CRUD
// ============================================

export function getLocations(): Location[] {
  return get<Location>(KEYS.locations).filter((l) => !l.is_archived)
}

export function getLocation(id: string): Location | undefined {
  return get<Location>(KEYS.locations).find((l) => l.id === id)
}

export function getLocationByShortId(shortId: string): Location | undefined {
  return get<Location>(KEYS.locations).find((l) => l.short_id === shortId)
}

export function createLocation(input: CreateLocationInput): Location {
  const locations = get<Location>(KEYS.locations)
  const now = new Date().toISOString()
  const loc: Location = {
    id: crypto.randomUUID(),
    household_id: 'local',
    parent_id: input.parent_id,
    location_type: input.location_type,
    unit_subtype: input.unit_subtype ?? null,
    name: input.name,
    label: input.label ?? null,
    short_id: generateShortId(),
    template_id: input.template_id ?? null,
    width_in: input.width_in ?? null,
    depth_in: input.depth_in ?? null,
    height_in: input.height_in ?? null,
    nfc_tag_id: null,
    metadata: input.metadata ?? {},
    sort_order: input.sort_order ?? 0,
    is_archived: false,
    created_at: now,
    updated_at: now,
  }
  locations.push(loc)
  set(KEYS.locations, locations)
  return loc
}

export function updateLocation(
  id: string,
  updates: Partial<Pick<Location, 'name' | 'label' | 'unit_subtype' | 'template_id' | 'width_in' | 'depth_in' | 'height_in' | 'nfc_tag_id' | 'metadata' | 'sort_order' | 'is_archived'>>,
): void {
  const locations = get<Location>(KEYS.locations)
  const idx = locations.findIndex((l) => l.id === id)
  if (idx === -1) return
  locations[idx] = { ...locations[idx], ...updates, updated_at: new Date().toISOString() }
  set(KEYS.locations, locations)
}

// One-time migration: swap width/depth on samla_3gal and samla_6gal bins
// These were stored with widthIn=15.25, depthIn=11 but correct shelf orientation is 11 across, 15.25 deep
export function migrateSamlaOrientation(): void {
  const flag = 'eyo_wms_samla_orientation_fixed'
  if (localStorage.getItem(flag)) return
  const locations = get<Location>(KEYS.locations)
  let changed = false
  for (const loc of locations) {
    if (
      (loc.template_id === 'samla_3gal' || loc.template_id === 'samla_6gal') &&
      loc.width_in === 15.25 && loc.depth_in === 11
    ) {
      loc.width_in = 11
      loc.depth_in = 15.25
      loc.updated_at = new Date().toISOString()
      changed = true
    }
  }
  if (changed) set(KEYS.locations, locations)
  localStorage.setItem(flag, '1')
}

export function deleteLocation(id: string): void {
  let locations = get<Location>(KEYS.locations)
  // Recursively delete children
  const toDelete = new Set<string>()
  const collectChildren = (parentId: string) => {
    toDelete.add(parentId)
    locations.filter((l) => l.parent_id === parentId).forEach((l) => collectChildren(l.id))
  }
  collectChildren(id)
  locations = locations.filter((l) => !toDelete.has(l.id))
  set(KEYS.locations, locations)

  // Also clean up product_locations
  const pls = get<ProductLocation>(KEYS.productLocations).filter((pl) => !toDelete.has(pl.location_id))
  set(KEYS.productLocations, pls)
}

// ============================================
// LOCATION TREE
// ============================================

export function buildLocationTree(locations: Location[]): LocationTreeNode[] {
  const map = new Map<string, LocationTreeNode>()
  const roots: LocationTreeNode[] = []

  for (const loc of locations) {
    map.set(loc.id, { ...loc, children: [] })
  }

  for (const loc of locations) {
    const node = map.get(loc.id)!
    if (loc.parent_id && map.has(loc.parent_id)) {
      map.get(loc.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortChildren = (nodes: LocationTreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order)
    for (const node of nodes) sortChildren(node.children)
  }
  sortChildren(roots)
  return roots
}

export function getLocationBreadcrumbs(locationId: string): LocationBreadcrumb[] {
  const locations = get<Location>(KEYS.locations)
  const crumbs: LocationBreadcrumb[] = []
  let currentId: string | null = locationId

  for (let i = 0; i < 10 && currentId; i++) {
    const loc = locations.find((l) => l.id === currentId)
    if (!loc) break
    crumbs.unshift({
      id: loc.id,
      name: loc.name,
      location_type: loc.location_type,
      label: loc.label,
    })
    currentId = loc.parent_id
  }
  return crumbs
}

// ============================================
// PRODUCT LOCATIONS
// ============================================

export function getLocationContents(locationId: string): ProductLocationWithProduct[] {
  const pls = get<ProductLocation>(KEYS.productLocations).filter((pl) => pl.location_id === locationId)
  const productsRaw = localStorage.getItem('eyo_products')
  const products: Record<string, unknown>[] = productsRaw ? JSON.parse(productsRaw) : []
  const productMap = new Map(products.map((p) => [p.id as string, p]))

  return pls.map((pl) => {
    const product = productMap.get(pl.product_id)
    return {
      ...pl,
      product_name: (product?.name as string) ?? 'Unknown',
      product_brand: (product?.brand as string) ?? null,
      product_image_url: (product?.image_url as string) ?? null,
      product_price: product?.price != null ? Number(product.price) : null,
      is_consumable: (product?.is_consumable as boolean) ?? false,
      consumable_quantity: product?.consumable_quantity != null ? Number(product.consumable_quantity) : null,
      consumable_unit: (product?.consumable_unit as MeasurementUnit) ?? null,
      consumable_min_threshold: product?.consumable_min_threshold != null ? Number(product.consumable_min_threshold) : null,
    }
  })
}

export function getProductLocations(productId: string): (ProductLocation & { location_name: string; location_label: string | null })[] {
  const pls = get<ProductLocation>(KEYS.productLocations).filter((pl) => pl.product_id === productId)
  const locations = get<Location>(KEYS.locations)
  const locMap = new Map(locations.map((l) => [l.id, l]))

  return pls.map((pl) => {
    const loc = locMap.get(pl.location_id)
    return {
      ...pl,
      location_name: loc?.name ?? 'Unknown',
      location_label: loc?.label ?? null,
    }
  })
}

export function addProductToLocation(input: AddProductToLocationInput): ProductLocation {
  const pls = get<ProductLocation>(KEYS.productLocations)
  const existing = pls.find((pl) => pl.product_id === input.product_id && pl.location_id === input.location_id)
  if (existing) {
    existing.quantity = input.quantity ?? existing.quantity
    existing.notes = input.notes ?? existing.notes
    existing.depth_row = input.depth_row ?? existing.depth_row
    existing.col_index = input.col_index ?? existing.col_index
    set(KEYS.productLocations, pls)
    return existing
  }

  const pl: ProductLocation = {
    id: crypto.randomUUID(),
    product_id: input.product_id,
    location_id: input.location_id,
    household_id: 'local',
    quantity: input.quantity ?? 1,
    notes: input.notes ?? null,
    depth_row: input.depth_row ?? 'front',
    col_index: input.col_index ?? null,
    added_at: new Date().toISOString(),
    added_by: null,
  }
  pls.push(pl)
  set(KEYS.productLocations, pls)
  return pl
}

export function updateProductLocation(id: string, updates: { quantity?: number; notes?: string | null }): void {
  const pls = get<ProductLocation>(KEYS.productLocations)
  const idx = pls.findIndex((pl) => pl.id === id)
  if (idx === -1) return
  pls[idx] = { ...pls[idx], ...updates }
  set(KEYS.productLocations, pls)
}

export function removeProductFromLocation(id: string): void {
  const pls = get<ProductLocation>(KEYS.productLocations).filter((pl) => pl.id !== id)
  set(KEYS.productLocations, pls)
}

export function moveProduct(productLocationId: string, newLocationId: string): void {
  const pls = get<ProductLocation>(KEYS.productLocations)
  const idx = pls.findIndex((pl) => pl.id === productLocationId)
  if (idx === -1) return
  pls[idx] = { ...pls[idx], location_id: newLocationId }
  set(KEYS.productLocations, pls)
}

// ============================================
// UNSORTED PRODUCTS
// ============================================

export function getUnsortedProducts(): { id: string; name: string; brand: string | null; image_url: string | null; date_added: string }[] {
  const pls = get<ProductLocation>(KEYS.productLocations)
  const placedIds = new Set(pls.map((pl) => pl.product_id))
  const productsRaw = localStorage.getItem('eyo_products')
  const products: Record<string, unknown>[] = productsRaw ? JSON.parse(productsRaw) : []

  return products
    .filter((p) => !placedIds.has(p.id as string) && (p.status as string) === 'purchased')
    .map((p) => ({
      id: p.id as string,
      name: p.name as string,
      brand: (p.brand as string) ?? null,
      image_url: (p.image_url as string) ?? null,
      date_added: p.date_added as string,
    }))
}

export function getUnsortedCount(): number {
  return getUnsortedProducts().length
}

// ============================================
// ITEM COUNTS
// ============================================

export function getItemCountsByLocation(): Record<string, number> {
  const pls = get<ProductLocation>(KEYS.productLocations)
  const counts: Record<string, number> = {}
  for (const pl of pls) {
    counts[pl.location_id] = (counts[pl.location_id] || 0) + 1
  }
  return counts
}

// ============================================
// USAGE LOG
// ============================================

export function logUsage(input: LogUsageInput): UsageLogEntry {
  const log = get<UsageLogEntry>(KEYS.usageLog)

  // Update product's consumable_quantity
  const productsRaw = localStorage.getItem('eyo_products')
  const products: Record<string, unknown>[] = productsRaw ? JSON.parse(productsRaw) : []
  const product = products.find((p) => p.id === input.product_id)
  const currentQty = product?.consumable_quantity != null ? Number(product.consumable_quantity) : 0
  const remaining = Math.max(0, currentQty - input.quantity_used)

  if (product) {
    product.consumable_quantity = remaining
    localStorage.setItem('eyo_products', JSON.stringify(products))
  }

  const entry: UsageLogEntry = {
    id: crypto.randomUUID(),
    product_id: input.product_id,
    household_id: 'local',
    quantity_used: input.quantity_used,
    unit: input.unit,
    remaining_quantity: remaining,
    note: input.note ?? null,
    project: input.project ?? null,
    logged_at: new Date().toISOString(),
    logged_by: null,
  }
  log.push(entry)
  set(KEYS.usageLog, log)
  return entry
}

export function getUsageLog(productId: string, limit: number = 20): UsageLogEntry[] {
  return get<UsageLogEntry>(KEYS.usageLog)
    .filter((e) => e.product_id === productId)
    .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
    .slice(0, limit)
}

export function getLowStockProducts(): { id: string; name: string; brand: string | null; consumable_quantity: number; consumable_unit: MeasurementUnit; consumable_min_threshold: number }[] {
  const productsRaw = localStorage.getItem('eyo_products')
  const products: Record<string, unknown>[] = productsRaw ? JSON.parse(productsRaw) : []

  return products
    .filter(
      (p) =>
        p.is_consumable === true &&
        p.consumable_min_threshold != null &&
        p.consumable_quantity != null &&
        Number(p.consumable_quantity) <= Number(p.consumable_min_threshold),
    )
    .map((p) => ({
      id: p.id as string,
      name: p.name as string,
      brand: (p.brand as string) ?? null,
      consumable_quantity: Number(p.consumable_quantity),
      consumable_unit: (p.consumable_unit as MeasurementUnit) ?? 'each',
      consumable_min_threshold: Number(p.consumable_min_threshold),
    }))
}

// ============================================
// SEED: Basement Storage
// ============================================

export function seedBasementStorage(): string {
  const room = createLocation({
    parent_id: null,
    location_type: 'room',
    name: 'Basement Storage Room',
    sort_order: 0,
  })

  for (let r = 1; r <= 4; r++) {
    const rack = createLocation({
      parent_id: room.id,
      location_type: 'unit',
      unit_subtype: 'rack',
      name: `OMAR Rack ${r}`,
      label: `R${r}`,
      template_id: 'omar_rack',
      width_in: 36.25,
      depth_in: 14,
      height_in: 72,
      metadata: { brand: 'IKEA', model: 'OMAR', shelves: 6 },
      sort_order: r - 1,
    })

    for (let s = 1; s <= 6; s++) {
      createLocation({
        parent_id: rack.id,
        location_type: 'compartment',
        unit_subtype: 'shelf',
        name: `Shelf ${s}`,
        label: `R${r}-S${s}`,
        width_in: 36.25,
        depth_in: 14,
        height_in: 11.5,
        sort_order: s - 1,
      })
    }
  }

  return room.id
}
