import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Product,
  Category,
  Subcategory,
  ProductRelationship,
  RelationshipType,
  ProductStatus,
  ProductOwnership,
  SortField,
  SortDirection,
} from './types'

type Client = SupabaseClient

// --- Initialization ---

export async function isInitialized(sb: Client, householdId: string): Promise<boolean> {
  const { count } = await sb
    .from('categories')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId)
  return (count ?? 0) > 0
}

export async function seedDefaultTaxonomy(sb: Client, householdId: string): Promise<void> {
  await sb.rpc('seed_default_taxonomy', { p_household_id: householdId })
}

export async function ensureDefaultCategories(sb: Client, householdId: string): Promise<void> {
  // In Supabase mode, taxonomy is seeded via handle_new_user trigger.
  // This is a no-op for backward compat with callers.
  const initialized = await isInitialized(sb, householdId)
  if (!initialized) {
    await seedDefaultTaxonomy(sb, householdId)
  }
}

// --- Categories ---

export async function getCategories(sb: Client, householdId: string): Promise<Category[]> {
  const { data, error } = await sb
    .from('categories')
    .select('id, name, sort_order, is_default')
    .eq('household_id', householdId)
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function addCategory(sb: Client, householdId: string, name: string): Promise<Category> {
  const cats = await getCategories(sb, householdId)
  const { data, error } = await sb
    .from('categories')
    .insert({ household_id: householdId, name, sort_order: cats.length, is_default: false })
    .select('id, name, sort_order, is_default')
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(sb: Client, id: string, updates: Partial<Category>): Promise<void> {
  const { error } = await sb
    .from('categories')
    .update({ name: updates.name, sort_order: updates.sort_order })
    .eq('id', id)
  if (error) throw error
}

export async function deleteCategory(sb: Client, id: string): Promise<void> {
  // Subcategories cascade via FK ON DELETE CASCADE
  const { error } = await sb.from('categories').delete().eq('id', id)
  if (error) throw error
}

// --- Subcategories ---

export async function getSubcategories(
  sb: Client,
  householdId: string,
  categoryId?: string
): Promise<Subcategory[]> {
  let query = sb
    .from('subcategories')
    .select('id, category_id, name, sort_order, is_default')
    .eq('household_id', householdId)
    .order('sort_order')

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function addSubcategory(
  sb: Client,
  householdId: string,
  categoryId: string,
  name: string
): Promise<Subcategory> {
  const subs = await getSubcategories(sb, householdId, categoryId)
  const { data, error } = await sb
    .from('subcategories')
    .insert({
      household_id: householdId,
      category_id: categoryId,
      name,
      sort_order: subs.length,
      is_default: false,
    })
    .select('id, category_id, name, sort_order, is_default')
    .single()
  if (error) throw error
  return data
}

export async function updateSubcategory(sb: Client, id: string, updates: Partial<Subcategory>): Promise<void> {
  const { error } = await sb
    .from('subcategories')
    .update({ name: updates.name, sort_order: updates.sort_order })
    .eq('id', id)
  if (error) throw error
}

export async function deleteSubcategory(sb: Client, id: string): Promise<void> {
  const { error } = await sb.from('subcategories').delete().eq('id', id)
  if (error) throw error
}

// --- Products ---

export async function getProducts(sb: Client, householdId: string): Promise<Product[]> {
  const { data, error } = await sb
    .from('products')
    .select('*')
    .eq('household_id', householdId)
  if (error) throw error
  return (data ?? []).map(mapProduct)
}

export async function getProduct(sb: Client, id: string): Promise<Product | undefined> {
  const { data, error } = await sb
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapProduct(data) : undefined
}

export async function addProduct(
  sb: Client,
  householdId: string,
  userId: string | null,
  product: Omit<Product, 'id' | 'date_added' | 'created_at' | 'updated_at'>
): Promise<Product> {
  const { data, error } = await sb
    .from('products')
    .insert({
      household_id: householdId,
      added_by: userId,
      name: product.name,
      brand: product.brand || null,
      category_id: product.category_id || null,
      subcategory_id: product.subcategory_id || null,
      description: product.description || null,
      image_url: product.image_url || null,
      additional_images: product.additional_images || [],
      source_url: product.source_url || null,
      retailer: product.retailer || null,
      price: product.price ?? null,
      original_price: product.original_price ?? null,
      currency: product.currency || 'USD',
      purchase_date: product.purchase_date || null,
      status: product.status || 'purchased',
      sku: product.sku || null,
      upc: product.upc || null,
      weight: product.weight ?? null,
      weight_unit: product.weight_unit || null,
      volume: product.volume ?? null,
      volume_unit: product.volume_unit || null,
      dimensions: product.dimensions || null,
      material: product.material || null,
      color: product.color || null,
      size: product.size || null,
      condition: product.condition || null,
      rating: product.rating ?? null,
      notes: product.notes || null,
      return_by_date: product.return_by_date || null,
      warranty_expires: product.warranty_expires || null,
      order_id: product.order_id || null,
      ownership: product.ownership || 'mine',
      is_consumable: product.is_consumable || false,
      tags: product.tags || [],
    })
    .select('*')
    .single()
  if (error) throw error
  return mapProduct(data)
}

export async function updateProduct(sb: Client, id: string, updates: Partial<Product>): Promise<void> {
  // Strip fields that shouldn't be sent to the DB
  const { id: _id, date_added: _da, created_at: _ca, updated_at: _ua, ...rest } = updates as Record<string, unknown>
  const { error } = await sb
    .from('products')
    .update(rest)
    .eq('id', id)
  if (error) throw error
}

export async function deleteProduct(sb: Client, id: string): Promise<void> {
  // Relationships cascade via FK ON DELETE CASCADE
  const { error } = await sb.from('products').delete().eq('id', id)
  if (error) throw error
}

// --- Search & Filter ---

export async function searchProducts(sb: Client, householdId: string, query: string): Promise<Product[]> {
  const q = query.toLowerCase().trim()
  if (!q) return getProducts(sb, householdId)

  // Use ilike for simple text search (full-text search upgrade in Phase 1C)
  const { data, error } = await sb
    .from('products')
    .select('*')
    .eq('household_id', householdId)
    .or(`name.ilike.%${q}%,brand.ilike.%${q}%,description.ilike.%${q}%,retailer.ilike.%${q}%,notes.ilike.%${q}%`)
  if (error) throw error
  return (data ?? []).map(mapProduct)
}

export async function filterProducts(
  sb: Client,
  householdId: string,
  options: {
    status?: ProductStatus | 'all'
    categoryId?: string
    subcategoryId?: string
    query?: string
    sortField?: SortField
    sortDirection?: SortDirection
    ownership?: ProductOwnership | 'all'
    hideConsumables?: boolean
  }
): Promise<Product[]> {
  // If there's a text query, start from search results
  if (options.query) {
    const products = await searchProducts(sb, householdId, options.query)
    return applyClientFiltersAndSort(products, options)
  }

  // Build Supabase query
  let query = sb
    .from('products')
    .select('*')
    .eq('household_id', householdId)

  if (options.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }
  if (options.categoryId) {
    query = query.eq('category_id', options.categoryId)
  }
  if (options.subcategoryId) {
    query = query.eq('subcategory_id', options.subcategoryId)
  }
  if (options.ownership && options.ownership !== 'all') {
    query = query.eq('ownership', options.ownership)
  }
  if (options.hideConsumables) {
    query = query.eq('is_consumable', false)
  }

  // Sort
  const field = options.sortField || 'date_added'
  const ascending = (options.sortDirection || 'desc') === 'asc'
  const dbField = field === 'name' ? 'name' : field === 'price' ? 'price' : field === 'purchase_date' ? 'purchase_date' : 'date_added'
  query = query.order(dbField, { ascending, nullsFirst: false })

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapProduct)
}

// --- Duplicate Detection ---

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.search = ''
    u.hash = ''
    return u.toString().replace(/\/+$/, '').toLowerCase()
  } catch {
    return url.toLowerCase().trim()
  }
}

function similarity(a: string, b: string): number {
  const al = a.toLowerCase()
  const bl = b.toLowerCase()
  if (al === bl) return 1
  if (al.includes(bl) || bl.includes(al)) return 0.7
  const bigramsA = new Set<string>()
  const bigramsB = new Set<string>()
  for (let i = 0; i < al.length - 1; i++) bigramsA.add(al.slice(i, i + 2))
  for (let i = 0; i < bl.length - 1; i++) bigramsB.add(bl.slice(i, i + 2))
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0
  let intersection = 0
  bigramsA.forEach((bg) => { if (bigramsB.has(bg)) intersection++ })
  return (2 * intersection) / (bigramsA.size + bigramsB.size)
}

export interface DuplicateResult {
  exact: Product[]
  fuzzy: Product[]
}

export async function checkDuplicates(
  sb: Client,
  householdId: string,
  input: {
    name?: string
    brand?: string
    sku?: string
    upc?: string
    source_url?: string
    excludeId?: string
  }
): Promise<DuplicateResult> {
  // Fetch all products for this household (same as localStorage approach)
  // Phase 1C will optimize this to targeted queries
  const allProducts = await getProducts(sb, householdId)
  const products = allProducts.filter((p) => p.id !== input.excludeId)
  const exact: Product[] = []
  const fuzzy: Product[] = []

  for (const p of products) {
    if (input.sku && p.sku && input.sku.toLowerCase() === p.sku.toLowerCase()) {
      exact.push(p)
      continue
    }
    if (input.upc && p.upc && input.upc === p.upc) {
      exact.push(p)
      continue
    }
    if (input.source_url && p.source_url && normalizeUrl(input.source_url) === normalizeUrl(p.source_url)) {
      exact.push(p)
      continue
    }
    if (input.name && p.name) {
      const nameSim = similarity(input.name, p.name)
      if (nameSim > 0.4) {
        const brandMatch = !input.brand || !p.brand || similarity(input.brand, p.brand) > 0.5
        if (brandMatch) {
          fuzzy.push(p)
        }
      }
    }
  }

  return { exact, fuzzy }
}

// --- Relationships ---

export async function getRelationships(sb: Client, householdId: string): Promise<ProductRelationship[]> {
  const { data, error } = await sb
    .from('product_relationships')
    .select('id, product_a, product_b, relationship_type, group_name, notes, created_at')
    .eq('household_id', householdId)
  if (error) throw error
  return data ?? []
}

export async function addRelationship(
  sb: Client,
  householdId: string,
  productA: string,
  productB: string,
  type: RelationshipType,
  notes?: string
): Promise<ProductRelationship> {
  const { data, error } = await sb
    .from('product_relationships')
    .insert({
      household_id: householdId,
      product_a: productA,
      product_b: productB,
      relationship_type: type,
      notes: notes || null,
    })
    .select('id, product_a, product_b, relationship_type, group_name, notes, created_at')
    .single()
  if (error) throw error
  return data
}

export async function deleteRelationship(sb: Client, id: string): Promise<void> {
  const { error } = await sb.from('product_relationships').delete().eq('id', id)
  if (error) throw error
}

export interface RelatedProductResult {
  relationship: ProductRelationship
  product: Product
  type: RelationshipType
  direction: 'forward' | 'reverse'
}

export async function getRelatedProducts(sb: Client, productId: string): Promise<RelatedProductResult[]> {
  // Forward relationships (this product is product_a)
  const { data: forwardRels, error: fwdErr } = await sb
    .from('product_relationships')
    .select('id, product_a, product_b, relationship_type, group_name, notes, created_at, products!product_relationships_product_b_fkey(*)')
    .eq('product_a', productId)
  if (fwdErr) throw fwdErr

  // Reverse relationships (this product is product_b)
  const { data: reverseRels, error: revErr } = await sb
    .from('product_relationships')
    .select('id, product_a, product_b, relationship_type, group_name, notes, created_at, products!product_relationships_product_a_fkey(*)')
    .eq('product_b', productId)
  if (revErr) throw revErr

  const results: RelatedProductResult[] = []

  for (const r of forwardRels ?? []) {
    const productData = (r as Record<string, unknown>).products as Record<string, unknown> | null
    if (productData) {
      results.push({
        relationship: { id: r.id, product_a: r.product_a, product_b: r.product_b, relationship_type: r.relationship_type, group_name: r.group_name, notes: r.notes, created_at: r.created_at },
        product: mapProduct(productData),
        type: r.relationship_type as RelationshipType,
        direction: 'forward',
      })
    }
  }

  for (const r of reverseRels ?? []) {
    const productData = (r as Record<string, unknown>).products as Record<string, unknown> | null
    if (productData) {
      results.push({
        relationship: { id: r.id, product_a: r.product_a, product_b: r.product_b, relationship_type: r.relationship_type, group_name: r.group_name, notes: r.notes, created_at: r.created_at },
        product: mapProduct(productData),
        type: r.relationship_type as RelationshipType,
        direction: 'reverse',
      })
    }
  }

  return results
}

// --- Dashboard Helpers ---

export interface ReturnAlert {
  product: Product
  daysLeft: number
}

export async function getReturnAlerts(sb: Client, householdId: string): Promise<ReturnAlert[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('products')
    .select('*')
    .eq('household_id', householdId)
    .not('return_by_date', 'is', null)
    .neq('status', 'returned')
    .gte('return_by_date', today)
    .order('return_by_date')
  if (error) throw error

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  return (data ?? []).map((row) => {
    const p = mapProduct(row)
    const returnDate = new Date(p.return_by_date!)
    returnDate.setHours(0, 0, 0, 0)
    const daysLeft = Math.ceil((returnDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return { product: p, daysLeft }
  })
}

export async function getWarrantyAlerts(sb: Client, householdId: string): Promise<ReturnAlert[]> {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const today = now.toISOString().slice(0, 10)
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data, error } = await sb
    .from('products')
    .select('*')
    .eq('household_id', householdId)
    .not('warranty_expires', 'is', null)
    .gte('warranty_expires', today)
    .lte('warranty_expires', thirtyDays)
    .order('warranty_expires')
  if (error) throw error

  return (data ?? []).map((row) => {
    const p = mapProduct(row)
    const expDate = new Date(p.warranty_expires!)
    expDate.setHours(0, 0, 0, 0)
    const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return { product: p, daysLeft }
  })
}

export interface CategorySpending {
  category: Category
  totalSpend: number
  itemCount: number
  avgPrice: number
  lastPurchase: string | null
  monthlySpend: { month: string; amount: number }[]
}

export async function getSpendingByCategory(sb: Client, householdId: string): Promise<CategorySpending[]> {
  const [products, categories] = await Promise.all([
    getProducts(sb, householdId).then((ps) =>
      ps.filter((p) => p.status === 'purchased' && p.price != null)
    ),
    getCategories(sb, householdId),
  ])

  const catMap = new Map(categories.map((c) => [c.id, c]))
  const grouped: Record<string, Product[]> = {}
  for (const p of products) {
    if (!grouped[p.category_id]) grouped[p.category_id] = []
    grouped[p.category_id].push(p)
  }

  return Object.entries(grouped)
    .map(([catId, prods]) => {
      const category = catMap.get(catId)
      if (!category) return null

      const totalSpend = prods.reduce((sum, p) => sum + (p.price || 0), 0)
      const dates = prods.map((p) => p.purchase_date || p.date_added).sort()
      const lastPurchase = dates[dates.length - 1] || null

      const monthly: Record<string, number> = {}
      for (const p of prods) {
        const d = p.purchase_date || p.date_added
        const month = d.slice(0, 7)
        monthly[month] = (monthly[month] || 0) + (p.price || 0)
      }
      const monthlySpend = Object.entries(monthly)
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => a.month.localeCompare(b.month))

      return { category, totalSpend, itemCount: prods.length, avgPrice: totalSpend / prods.length, lastPurchase, monthlySpend }
    })
    .filter((x): x is CategorySpending => x !== null)
    .sort((a, b) => b.totalSpend - a.totalSpend)
}

export async function getRecentProducts(sb: Client, householdId: string, limit: number): Promise<Product[]> {
  const { data, error } = await sb
    .from('products')
    .select('*')
    .eq('household_id', householdId)
    .order('date_added', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(mapProduct)
}

// --- Analytics ---

export interface MonthlySpending {
  month: string
  amount: number
}

export async function getMonthlySpending(sb: Client, householdId: string, tag?: string): Promise<MonthlySpending[]> {
  let products = await getProducts(sb, householdId)
  products = products.filter((p) => p.status === 'purchased' && p.price != null)
  if (tag) products = products.filter((p) => (p.tags || []).includes(tag))

  const monthly: Record<string, number> = {}
  for (const p of products) {
    const d = p.purchase_date || p.date_added
    const month = d.slice(0, 7)
    monthly[month] = (monthly[month] || 0) + (p.price || 0)
  }
  return Object.entries(monthly)
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

export async function getStatusDistribution(sb: Client, householdId: string): Promise<{ status: string; count: number }[]> {
  const products = await getProducts(sb, householdId)
  const counts: Record<string, number> = {}
  for (const p of products) {
    counts[p.status] = (counts[p.status] || 0) + 1
  }
  return Object.entries(counts).map(([status, count]) => ({ status, count }))
}

export async function getOwnershipDistribution(sb: Client, householdId: string): Promise<{ ownership: string; count: number }[]> {
  const products = await getProducts(sb, householdId)
  const counts: Record<string, number> = {}
  for (const p of products) {
    const own = p.ownership || 'mine'
    counts[own] = (counts[own] || 0) + 1
  }
  return Object.entries(counts).map(([ownership, count]) => ({ ownership, count }))
}

export async function getTopExpensiveProducts(sb: Client, householdId: string, limit: number): Promise<Product[]> {
  const { data, error } = await sb
    .from('products')
    .select('*')
    .eq('household_id', householdId)
    .not('price', 'is', null)
    .order('price', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(mapProduct)
}

export async function getAllTags(sb: Client, householdId: string): Promise<string[]> {
  const products = await getProducts(sb, householdId)
  const tags = new Set<string>()
  for (const p of products) {
    for (const t of p.tags || []) tags.add(t)
  }
  return [...tags].sort()
}

export interface MonthComparison {
  metric: string
  thisMonth: number
  lastMonth: number
  change: number
}

export async function getMonthOverMonthComparison(sb: Client, householdId: string): Promise<MonthComparison[]> {
  const now = new Date()
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`

  const purchased = (await getProducts(sb, householdId)).filter(
    (p) => p.status === 'purchased' && p.price != null
  )

  const thisMonthProducts = purchased.filter((p) => (p.purchase_date || p.date_added).startsWith(thisMonthStr))
  const lastMonthProducts = purchased.filter((p) => (p.purchase_date || p.date_added).startsWith(lastMonthStr))

  const thisSpend = thisMonthProducts.reduce((s, p) => s + (p.price || 0), 0)
  const lastSpend = lastMonthProducts.reduce((s, p) => s + (p.price || 0), 0)
  const thisAvg = thisMonthProducts.length ? thisSpend / thisMonthProducts.length : 0
  const lastAvg = lastMonthProducts.length ? lastSpend / lastMonthProducts.length : 0

  return [
    { metric: 'Total Spend', thisMonth: thisSpend, lastMonth: lastSpend, change: lastSpend ? ((thisSpend - lastSpend) / lastSpend) * 100 : 0 },
    { metric: 'Items', thisMonth: thisMonthProducts.length, lastMonth: lastMonthProducts.length, change: lastMonthProducts.length ? ((thisMonthProducts.length - lastMonthProducts.length) / lastMonthProducts.length) * 100 : 0 },
    { metric: 'Avg Price', thisMonth: thisAvg, lastMonth: lastAvg, change: lastAvg ? ((thisAvg - lastAvg) / lastAvg) * 100 : 0 },
  ]
}

// --- Product Counts ---

export async function getProductCountsByCategory(sb: Client, householdId: string): Promise<Record<string, number>> {
  const products = await getProducts(sb, householdId)
  const counts: Record<string, number> = {}
  for (const p of products) {
    counts[p.category_id] = (counts[p.category_id] || 0) + 1
  }
  return counts
}

export async function getProductCountsBySubcategory(sb: Client, householdId: string): Promise<Record<string, number>> {
  const products = await getProducts(sb, householdId)
  const counts: Record<string, number> = {}
  for (const p of products) {
    counts[p.subcategory_id] = (counts[p.subcategory_id] || 0) + 1
  }
  return counts
}

// --- Export / Import ---

export async function exportAllData(sb: Client, householdId: string): Promise<string> {
  const [products, categories, subcategories, relationships] = await Promise.all([
    getProducts(sb, householdId),
    getCategories(sb, householdId),
    getSubcategories(sb, householdId),
    getRelationships(sb, householdId),
  ])
  return JSON.stringify({ products, categories, subcategories, relationships }, null, 2)
}

export async function importAllData(sb: Client, householdId: string, userId: string | null, json: string): Promise<void> {
  const data = JSON.parse(json)

  // Clear existing data first
  await clearAllData(sb, householdId)

  // Re-seed and import
  if (data.categories) {
    for (const cat of data.categories) {
      await sb.from('categories').insert({
        id: cat.id,
        household_id: householdId,
        name: cat.name,
        sort_order: cat.sort_order,
        is_default: cat.is_default,
      })
    }
  }
  if (data.subcategories) {
    for (const sub of data.subcategories) {
      await sb.from('subcategories').insert({
        id: sub.id,
        household_id: householdId,
        category_id: sub.category_id,
        name: sub.name,
        sort_order: sub.sort_order,
        is_default: sub.is_default,
      })
    }
  }
  if (data.products) {
    for (const p of data.products) {
      await addProduct(sb, householdId, userId, p)
    }
  }
  if (data.relationships) {
    for (const r of data.relationships) {
      await sb.from('product_relationships').insert({
        household_id: householdId,
        product_a: r.product_a,
        product_b: r.product_b,
        relationship_type: r.relationship_type,
        group_name: r.group_name || null,
        notes: r.notes || null,
      })
    }
  }
}

export async function clearAllData(sb: Client, householdId: string): Promise<void> {
  // Delete in order respecting FK constraints
  await sb.from('product_relationships').delete().eq('household_id', householdId)
  await sb.from('imported_emails').delete().eq('household_id', householdId)
  await sb.from('products').delete().eq('household_id', householdId)
  await sb.from('subcategories').delete().eq('household_id', householdId)
  await sb.from('categories').delete().eq('household_id', householdId)
}

// --- Imported Emails ---

export async function getImportedEmailIds(sb: Client, householdId: string): Promise<Set<string>> {
  const { data, error } = await sb
    .from('imported_emails')
    .select('gmail_message_id')
    .eq('household_id', householdId)
  if (error) throw error
  return new Set((data ?? []).map((r) => r.gmail_message_id))
}

export async function markEmailsImported(sb: Client, householdId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const rows = ids.map((id) => ({ household_id: householdId, gmail_message_id: id }))
  const { error } = await sb
    .from('imported_emails')
    .upsert(rows, { onConflict: 'household_id,gmail_message_id' })
  if (error) throw error
}

// --- Helpers ---

// Map Supabase row (snake_case, possibly with extra fields) to our Product type
function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    brand: (row.brand as string) || undefined,
    category_id: row.category_id as string,
    subcategory_id: row.subcategory_id as string,
    description: (row.description as string) || undefined,
    image_url: (row.image_url as string) || undefined,
    additional_images: (row.additional_images as string[]) || [],
    source_url: (row.source_url as string) || undefined,
    retailer: (row.retailer as string) || undefined,
    price: row.price != null ? Number(row.price) : undefined,
    original_price: row.original_price != null ? Number(row.original_price) : undefined,
    currency: (row.currency as string) || 'USD',
    purchase_date: (row.purchase_date as string) || undefined,
    date_added: row.date_added as string,
    status: row.status as Product['status'],
    sku: (row.sku as string) || undefined,
    upc: (row.upc as string) || undefined,
    weight: row.weight != null ? Number(row.weight) : undefined,
    weight_unit: (row.weight_unit as Product['weight_unit']) || undefined,
    volume: row.volume != null ? Number(row.volume) : undefined,
    volume_unit: (row.volume_unit as Product['volume_unit']) || undefined,
    dimensions: (row.dimensions as Product['dimensions']) || undefined,
    material: (row.material as string) || undefined,
    color: (row.color as string) || undefined,
    size: (row.size as string) || undefined,
    condition: (row.condition as Product['condition']) || undefined,
    rating: row.rating != null ? Number(row.rating) : undefined,
    notes: (row.notes as string) || undefined,
    return_by_date: (row.return_by_date as string) || undefined,
    warranty_expires: (row.warranty_expires as string) || undefined,
    order_id: (row.order_id as string) || undefined,
    ownership: (row.ownership as Product['ownership']) || undefined,
    is_consumable: (row.is_consumable as boolean) || false,
    tags: (row.tags as string[]) || [],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

// Client-side filter + sort (used when text query is active)
function applyClientFiltersAndSort(
  products: Product[],
  options: {
    status?: ProductStatus | 'all'
    categoryId?: string
    subcategoryId?: string
    sortField?: SortField
    sortDirection?: SortDirection
    ownership?: ProductOwnership | 'all'
    hideConsumables?: boolean
  }
): Product[] {
  let result = products

  if (options.status && options.status !== 'all') {
    result = result.filter((p) => p.status === options.status)
  }
  if (options.categoryId) {
    result = result.filter((p) => p.category_id === options.categoryId)
  }
  if (options.subcategoryId) {
    result = result.filter((p) => p.subcategory_id === options.subcategoryId)
  }
  if (options.ownership && options.ownership !== 'all') {
    result = result.filter((p) => (p.ownership || 'mine') === options.ownership)
  }
  if (options.hideConsumables) {
    result = result.filter((p) => !p.is_consumable)
  }

  const field = options.sortField || 'date_added'
  const dir = options.sortDirection || 'desc'
  result.sort((a, b) => {
    let valA: string | number | undefined
    let valB: string | number | undefined

    if (field === 'price') {
      valA = a.price ?? 0
      valB = b.price ?? 0
    } else if (field === 'name') {
      valA = a.name.toLowerCase()
      valB = b.name.toLowerCase()
    } else if (field === 'purchase_date') {
      valA = a.purchase_date || ''
      valB = b.purchase_date || ''
    } else {
      valA = a.date_added
      valB = b.date_added
    }

    if (valA < valB) return dir === 'asc' ? -1 : 1
    if (valA > valB) return dir === 'asc' ? 1 : -1
    return 0
  })

  return result
}
