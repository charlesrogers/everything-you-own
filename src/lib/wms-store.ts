import type { SupabaseClient } from '@supabase/supabase-js'
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

type Client = SupabaseClient

// ============================================
// LOCATION TEMPLATES
// ============================================

export async function getLocationTemplates(sb: Client): Promise<LocationTemplate[]> {
  const { data, error } = await sb
    .from('location_templates')
    .select('*')
    .order('id')
  if (error) throw error
  return (data ?? []).map(mapTemplate)
}

// ============================================
// LOCATIONS — CRUD
// ============================================

export async function getLocations(sb: Client, householdId: string): Promise<Location[]> {
  const { data, error } = await sb
    .from('locations')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_archived', false)
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map(mapLocation)
}

export async function getLocation(sb: Client, id: string): Promise<Location | undefined> {
  const { data, error } = await sb
    .from('locations')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapLocation(data) : undefined
}

export async function getLocationByShortId(sb: Client, shortId: string): Promise<Location | undefined> {
  const { data, error } = await sb
    .from('locations')
    .select('*')
    .eq('short_id', shortId)
    .maybeSingle()
  if (error) throw error
  return data ? mapLocation(data) : undefined
}

export async function createLocation(
  sb: Client,
  householdId: string,
  input: CreateLocationInput,
): Promise<Location> {
  const { data, error } = await sb
    .from('locations')
    .insert({
      household_id: householdId,
      parent_id: input.parent_id,
      location_type: input.location_type,
      unit_subtype: input.unit_subtype ?? null,
      name: input.name,
      label: input.label ?? null,
      template_id: input.template_id ?? null,
      width_in: input.width_in ?? null,
      depth_in: input.depth_in ?? null,
      height_in: input.height_in ?? null,
      metadata: input.metadata ?? {},
      sort_order: input.sort_order ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapLocation(data)
}

export async function updateLocation(
  sb: Client,
  id: string,
  updates: Partial<Pick<Location, 'name' | 'label' | 'unit_subtype' | 'template_id' | 'width_in' | 'depth_in' | 'height_in' | 'nfc_tag_id' | 'metadata' | 'sort_order' | 'is_archived'>>,
): Promise<void> {
  const { error } = await sb
    .from('locations')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function deleteLocation(sb: Client, id: string): Promise<void> {
  const { error } = await sb.from('locations').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// LOCATION TREE
// ============================================

export function buildLocationTree(locations: Location[]): LocationTreeNode[] {
  const map = new Map<string, LocationTreeNode>()
  const roots: LocationTreeNode[] = []

  // Initialize all nodes
  for (const loc of locations) {
    map.set(loc.id, { ...loc, children: [] })
  }

  // Build parent-child relationships
  for (const loc of locations) {
    const node = map.get(loc.id)!
    if (loc.parent_id && map.has(loc.parent_id)) {
      map.get(loc.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children by sort_order
  const sortChildren = (nodes: LocationTreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order)
    for (const node of nodes) sortChildren(node.children)
  }
  sortChildren(roots)

  return roots
}

export async function getLocationBreadcrumbs(
  sb: Client,
  locationId: string,
): Promise<LocationBreadcrumb[]> {
  const crumbs: LocationBreadcrumb[] = []
  let currentId: string | null = locationId

  // Walk up the tree (max 10 levels to prevent infinite loops)
  for (let i = 0; i < 10 && currentId; i++) {
    const loc = await getLocation(sb, currentId)
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

export async function getLocationContents(
  sb: Client,
  locationId: string,
): Promise<ProductLocationWithProduct[]> {
  const { data, error } = await sb
    .from('product_locations')
    .select(`
      id, product_id, location_id, household_id, quantity, notes, added_at, added_by,
      products (name, brand, image_url, price, is_consumable, consumable_quantity, consumable_unit, consumable_min_threshold)
    `)
    .eq('location_id', locationId)
    .order('added_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((row) => {
    const product = (row as Record<string, unknown>).products as Record<string, unknown> | null
    return {
      id: row.id,
      product_id: row.product_id,
      location_id: row.location_id,
      household_id: row.household_id,
      quantity: row.quantity,
      notes: row.notes,
      added_at: row.added_at,
      added_by: row.added_by,
      product_name: product?.name as string ?? 'Unknown',
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

export async function getProductLocations(
  sb: Client,
  productId: string,
): Promise<(ProductLocation & { location_name: string; location_label: string | null })[]> {
  const { data, error } = await sb
    .from('product_locations')
    .select(`
      id, product_id, location_id, household_id, quantity, notes, added_at, added_by,
      locations (name, label)
    `)
    .eq('product_id', productId)
  if (error) throw error

  return (data ?? []).map((row) => {
    const loc = (row as Record<string, unknown>).locations as Record<string, unknown> | null
    return {
      id: row.id,
      product_id: row.product_id,
      location_id: row.location_id,
      household_id: row.household_id,
      quantity: row.quantity,
      notes: row.notes,
      added_at: row.added_at,
      added_by: row.added_by,
      location_name: (loc?.name as string) ?? 'Unknown',
      location_label: (loc?.label as string) ?? null,
    }
  })
}

export async function addProductToLocation(
  sb: Client,
  householdId: string,
  userId: string | null,
  input: AddProductToLocationInput,
): Promise<ProductLocation> {
  const { data, error } = await sb
    .from('product_locations')
    .upsert(
      {
        product_id: input.product_id,
        location_id: input.location_id,
        household_id: householdId,
        quantity: input.quantity ?? 1,
        notes: input.notes ?? null,
        added_by: userId,
      },
      { onConflict: 'product_id,location_id' },
    )
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateProductLocation(
  sb: Client,
  id: string,
  updates: { quantity?: number; notes?: string | null },
): Promise<void> {
  const { error } = await sb
    .from('product_locations')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function removeProductFromLocation(sb: Client, id: string): Promise<void> {
  const { error } = await sb.from('product_locations').delete().eq('id', id)
  if (error) throw error
}

export async function moveProduct(
  sb: Client,
  householdId: string,
  userId: string | null,
  productLocationId: string,
  newLocationId: string,
): Promise<void> {
  // Get current record
  const { data: current, error: getErr } = await sb
    .from('product_locations')
    .select('*')
    .eq('id', productLocationId)
    .single()
  if (getErr) throw getErr

  // Delete old, create new
  await removeProductFromLocation(sb, productLocationId)
  await addProductToLocation(sb, householdId, userId, {
    product_id: current.product_id,
    location_id: newLocationId,
    quantity: current.quantity,
    notes: current.notes,
  })
}

// ============================================
// UNSORTED PRODUCTS (no location assigned)
// ============================================

export async function getUnsortedProducts(
  sb: Client,
  householdId: string,
): Promise<{ id: string; name: string; brand: string | null; image_url: string | null; date_added: string }[]> {
  // Get all product IDs that have a location
  const { data: placedIds, error: plErr } = await sb
    .from('product_locations')
    .select('product_id')
    .eq('household_id', householdId)
  if (plErr) throw plErr

  const placedSet = new Set((placedIds ?? []).map((r) => r.product_id))

  // Get all products and filter out the placed ones
  const { data: products, error: pErr } = await sb
    .from('products')
    .select('id, name, brand, image_url, date_added')
    .eq('household_id', householdId)
    .in('status', ['purchased'])
    .order('date_added', { ascending: false })
  if (pErr) throw pErr

  return (products ?? []).filter((p) => !placedSet.has(p.id))
}

export async function getUnsortedCount(sb: Client, householdId: string): Promise<number> {
  const unsorted = await getUnsortedProducts(sb, householdId)
  return unsorted.length
}

// ============================================
// USAGE LOG (consumables)
// ============================================

export async function logUsage(
  sb: Client,
  householdId: string,
  userId: string | null,
  input: LogUsageInput,
): Promise<UsageLogEntry> {
  // Get current consumable quantity
  const { data: product, error: pErr } = await sb
    .from('products')
    .select('consumable_quantity')
    .eq('id', input.product_id)
    .single()
  if (pErr) throw pErr

  const currentQty = product.consumable_quantity != null ? Number(product.consumable_quantity) : 0
  const remaining = Math.max(0, currentQty - input.quantity_used)

  // Insert usage log
  const { data, error } = await sb
    .from('usage_log')
    .insert({
      product_id: input.product_id,
      household_id: householdId,
      quantity_used: input.quantity_used,
      unit: input.unit,
      remaining_quantity: remaining,
      note: input.note ?? null,
      project: input.project ?? null,
      logged_by: userId,
    })
    .select('*')
    .single()
  if (error) throw error

  // Update product's consumable_quantity
  await sb
    .from('products')
    .update({ consumable_quantity: remaining })
    .eq('id', input.product_id)

  return mapUsageLogEntry(data)
}

export async function getUsageLog(
  sb: Client,
  productId: string,
  limit: number = 20,
): Promise<UsageLogEntry[]> {
  const { data, error } = await sb
    .from('usage_log')
    .select('*')
    .eq('product_id', productId)
    .order('logged_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(mapUsageLogEntry)
}

export async function getLowStockProducts(
  sb: Client,
  householdId: string,
): Promise<{ id: string; name: string; brand: string | null; consumable_quantity: number; consumable_unit: MeasurementUnit; consumable_min_threshold: number }[]> {
  const { data, error } = await sb
    .from('products')
    .select('id, name, brand, consumable_quantity, consumable_unit, consumable_min_threshold')
    .eq('household_id', householdId)
    .eq('is_consumable', true)
    .not('consumable_min_threshold', 'is', null)
    .not('consumable_quantity', 'is', null)
  if (error) throw error

  return (data ?? []).filter(
    (p) => Number(p.consumable_quantity) <= Number(p.consumable_min_threshold),
  ) as typeof data
}

// ============================================
// SEED HELPERS
// ============================================

export async function seedBasementStorage(sb: Client, householdId: string): Promise<string> {
  const { data, error } = await sb.rpc('seed_basement_storage', {
    p_household_id: householdId,
  })
  if (error) throw error
  return data as string  // returns room UUID
}

// ============================================
// ITEM COUNT PER LOCATION
// ============================================

export async function getItemCountsByLocation(
  sb: Client,
  householdId: string,
): Promise<Record<string, number>> {
  const { data, error } = await sb
    .from('product_locations')
    .select('location_id')
    .eq('household_id', householdId)
  if (error) throw error

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.location_id] = (counts[row.location_id] || 0) + 1
  }
  return counts
}

// ============================================
// MAPPERS
// ============================================

function mapLocation(row: Record<string, unknown>): Location {
  return {
    id: row.id as string,
    household_id: row.household_id as string,
    parent_id: (row.parent_id as string) ?? null,
    location_type: row.location_type as Location['location_type'],
    unit_subtype: (row.unit_subtype as Location['unit_subtype']) ?? null,
    name: row.name as string,
    label: (row.label as string) ?? null,
    short_id: (row.short_id as string) ?? null,
    template_id: (row.template_id as string) ?? null,
    width_in: row.width_in != null ? Number(row.width_in) : null,
    depth_in: row.depth_in != null ? Number(row.depth_in) : null,
    height_in: row.height_in != null ? Number(row.height_in) : null,
    nfc_tag_id: (row.nfc_tag_id as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    sort_order: Number(row.sort_order ?? 0),
    is_archived: (row.is_archived as boolean) ?? false,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

function mapTemplate(row: Record<string, unknown>): LocationTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as string,
    width_in: row.width_in != null ? Number(row.width_in) : null,
    depth_in: row.depth_in != null ? Number(row.depth_in) : null,
    height_in: row.height_in != null ? Number(row.height_in) : null,
    volume_gal: row.volume_gal != null ? Number(row.volume_gal) : null,
    default_compartments: row.default_compartments as LocationTemplate['default_compartments'],
  }
}

function mapUsageLogEntry(row: Record<string, unknown>): UsageLogEntry {
  return {
    id: row.id as string,
    product_id: row.product_id as string,
    household_id: row.household_id as string,
    quantity_used: Number(row.quantity_used),
    unit: row.unit as MeasurementUnit,
    remaining_quantity: row.remaining_quantity != null ? Number(row.remaining_quantity) : null,
    note: (row.note as string) ?? null,
    project: (row.project as string) ?? null,
    logged_at: row.logged_at as string,
    logged_by: (row.logged_by as string) ?? null,
  }
}
