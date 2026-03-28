import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Server-side API that bundles all storage data in one call.
 * The server is colocated with Supabase so queries are sub-ms.
 * Browser makes ONE request here instead of 3+ to Supabase directly.
 *
 * GET /api/storage — all locations + item counts
 * GET /api/storage?id=xxx — specific location + breadcrumbs + contents + children
 */
export async function GET(request: NextRequest) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get household
  const { data: membership } = await sb
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'No household' }, { status: 403 })
  }

  const hid = membership.household_id
  const locationId = request.nextUrl.searchParams.get('id')
  const searchQuery = request.nextUrl.searchParams.get('q')
  const searchType = request.nextUrl.searchParams.get('type') ?? 'items'

  // Fetch all locations (always needed for tree + breadcrumbs)
  const { data: locations, error: locErr } = await sb
    .from('locations')
    .select('*')
    .eq('household_id', hid)
    .eq('is_archived', false)
    .order('sort_order')

  if (locErr) {
    return NextResponse.json({ error: locErr.message }, { status: 500 })
  }

  // Fetch all product_location counts + position data
  const { data: plData } = await sb
    .from('product_locations')
    .select('location_id, depth_row, col_index')
    .eq('household_id', hid)

  const itemCounts: Record<string, number> = {}
  // shelfItemsByPosition: { [locationId]: { front: { [colIndex|'none']: count }, back: { ... } } }
  const shelfItemsByPosition: Record<string, { front: Record<string, number>; back: Record<string, number> }> = {}
  for (const row of plData ?? []) {
    itemCounts[row.location_id] = (itemCounts[row.location_id] || 0) + 1
    const r = row as Record<string, unknown>
    const depthRow = (r.depth_row as string) ?? 'front'
    const colKey = r.col_index != null ? String(r.col_index) : 'none'
    if (!shelfItemsByPosition[row.location_id]) {
      shelfItemsByPosition[row.location_id] = { front: {}, back: {} }
    }
    const rowBucket = depthRow === 'back' ? 'back' : 'front'
    shelfItemsByPosition[row.location_id][rowBucket][colKey] = (shelfItemsByPosition[row.location_id][rowBucket][colKey] || 0) + 1
  }

  // If a specific location is requested, also fetch its contents
  let contents = null
  if (locationId) {
    const { data: contentData } = await sb
      .from('product_locations')
      .select(`
        id, product_id, location_id, household_id, quantity, notes, depth_row, col_index, added_at, added_by,
        products (name, brand, image_url, price, is_consumable, consumable_quantity, consumable_unit, consumable_min_threshold)
      `)
      .eq('location_id', locationId)
      .order('added_at', { ascending: false })

    contents = (contentData ?? []).map((row) => {
      const product = (row as Record<string, unknown>).products as Record<string, unknown> | null
      const r = row as Record<string, unknown>
      return {
        id: row.id,
        product_id: row.product_id,
        location_id: row.location_id,
        household_id: row.household_id,
        quantity: row.quantity,
        notes: row.notes,
        depth_row: (r.depth_row as string) ?? 'front',
        col_index: r.col_index != null ? Number(r.col_index) : null,
        added_at: row.added_at,
        added_by: row.added_by,
        product_name: product?.name ?? 'Unknown',
        product_brand: product?.brand ?? null,
        product_image_url: product?.image_url ?? null,
        product_price: product?.price != null ? Number(product.price) : null,
        is_consumable: product?.is_consumable ?? false,
        consumable_quantity: product?.consumable_quantity != null ? Number(product.consumable_quantity) : null,
        consumable_unit: product?.consumable_unit ?? null,
        consumable_min_threshold: product?.consumable_min_threshold != null ? Number(product.consumable_min_threshold) : null,
      }
    })
  }

  // Item search — returns products with their storage locations
  let searchResults = null
  if (searchQuery && searchType === 'items') {
    const q = searchQuery.toLowerCase()
    const { data: products } = await sb
      .from('products')
      .select('id, name, brand, image_url, price, status')
      .eq('household_id', hid)
      .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
      .limit(30)

    // Get locations for these products
    const productIds = (products ?? []).map((p) => p.id)
    let productLocMap: Record<string, string[]> = {}
    if (productIds.length > 0) {
      const { data: pls } = await sb
        .from('product_locations')
        .select('product_id, location_id')
        .in('product_id', productIds)

      for (const pl of pls ?? []) {
        if (!productLocMap[pl.product_id]) productLocMap[pl.product_id] = []
        productLocMap[pl.product_id].push(pl.location_id)
      }
    }

    // Build location path lookup from already-fetched locations
    const locMap = new Map((locations ?? []).map((l: Record<string, unknown>) => [l.id as string, l]))
    function getPath(locId: string): string {
      const parts: string[] = []
      let cur = locMap.get(locId) as Record<string, unknown> | undefined
      while (cur) {
        parts.unshift(cur.name as string)
        cur = cur.parent_id ? locMap.get(cur.parent_id as string) as Record<string, unknown> | undefined : undefined
      }
      return parts.join(' › ')
    }

    searchResults = (products ?? []).map((p) => ({
      ...p,
      locations: (productLocMap[p.id] ?? []).map((lid) => ({
        id: lid,
        path: getPath(lid),
      })),
    }))
  }

  return NextResponse.json({
    locations: locations ?? [],
    itemCounts,
    shelfItemsByPosition,
    contents,
    searchResults,
  })
}
