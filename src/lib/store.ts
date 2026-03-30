import { Product, Category, Subcategory, ProductRelationship, RelationshipType, SortField, SortDirection, ProductStatus, ProductOwnership } from "./types"
import { DEFAULT_TAXONOMY } from "./constants"

const KEYS = {
  products: "eyo_products",
  categories: "eyo_categories",
  subcategories: "eyo_subcategories",
  relationships: "eyo_relationships",
  initialized: "eyo_initialized",
}

function get<T>(key: string): T[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(key)
  return raw ? JSON.parse(raw) : []
}

function set<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data))
}

// --- Initialization ---

export function isInitialized(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(KEYS.initialized) === "true"
}

export function seedDefaultTaxonomy() {
  if (isInitialized()) return

  const categories: Category[] = []
  const subcategories: Subcategory[] = []

  Object.entries(DEFAULT_TAXONOMY).forEach(([catName, subs], catIdx) => {
    const catId = crypto.randomUUID()
    categories.push({
      id: catId,
      name: catName,
      sort_order: catIdx,
      is_default: true,
    })
    subs.forEach((subName, subIdx) => {
      subcategories.push({
        id: crypto.randomUUID(),
        category_id: catId,
        name: subName,
        sort_order: subIdx,
        is_default: true,
      })
    })
  })

  set(KEYS.categories, categories)
  set(KEYS.subcategories, subcategories)
  set(KEYS.products, [])
  localStorage.setItem(KEYS.initialized, "true")
}

// Adds any missing categories from DEFAULT_TAXONOMY (for existing users who seeded before new categories were added)
export function ensureDefaultCategories() {
  if (typeof window === "undefined") return
  const existing = get<Category>(KEYS.categories)
  if (existing.length === 0) return // Not initialized yet, seedDefaultTaxonomy will handle it

  const existingNames = new Set(existing.map((c) => c.name))
  let maxSort = Math.max(...existing.map((c) => c.sort_order), 0)
  const allSubs = get<Subcategory>(KEYS.subcategories)
  let changed = false

  for (const [catName, subs] of Object.entries(DEFAULT_TAXONOMY)) {
    if (existingNames.has(catName)) continue
    maxSort++
    const catId = crypto.randomUUID()
    existing.push({ id: catId, name: catName, sort_order: maxSort, is_default: true })
    subs.forEach((subName, subIdx) => {
      allSubs.push({ id: crypto.randomUUID(), category_id: catId, name: subName, sort_order: subIdx, is_default: true })
    })
    changed = true
  }

  if (changed) {
    set(KEYS.categories, existing)
    set(KEYS.subcategories, allSubs)
  }
}

// --- Categories ---

export function getCategories(): Category[] {
  return get<Category>(KEYS.categories).sort((a, b) => a.sort_order - b.sort_order)
}

export function addCategory(name: string): Category {
  const cats = getCategories()
  const cat: Category = {
    id: crypto.randomUUID(),
    name,
    sort_order: cats.length,
    is_default: false,
  }
  set(KEYS.categories, [...cats, cat])
  return cat
}

export function updateCategory(id: string, updates: Partial<Category>) {
  const cats = getCategories().map((c) => (c.id === id ? { ...c, ...updates } : c))
  set(KEYS.categories, cats)
}

export function deleteCategory(id: string) {
  set(KEYS.categories, getCategories().filter((c) => c.id !== id))
  set(KEYS.subcategories, getSubcategories().filter((s) => s.category_id !== id))
}

// --- Subcategories ---

export function getSubcategories(categoryId?: string): Subcategory[] {
  const all = get<Subcategory>(KEYS.subcategories).sort((a, b) => a.sort_order - b.sort_order)
  return categoryId ? all.filter((s) => s.category_id === categoryId) : all
}

export function addSubcategory(categoryId: string, name: string): Subcategory {
  const subs = getSubcategories(categoryId)
  const sub: Subcategory = {
    id: crypto.randomUUID(),
    category_id: categoryId,
    name,
    sort_order: subs.length,
    is_default: false,
  }
  set(KEYS.subcategories, [...getSubcategories(), sub])
  return sub
}

export function updateSubcategory(id: string, updates: Partial<Subcategory>) {
  const subs = getSubcategories().map((s) => (s.id === id ? { ...s, ...updates } : s))
  set(KEYS.subcategories, subs)
}

export function deleteSubcategory(id: string) {
  set(KEYS.subcategories, getSubcategories().filter((s) => s.id !== id))
}

// --- Products ---

export function getProducts(): Product[] {
  return get<Product>(KEYS.products)
}

export function getProduct(id: string): Product | undefined {
  return getProducts().find((p) => p.id === id)
}

export function addProduct(product: Omit<Product, "id" | "date_added" | "created_at" | "updated_at">): Product {
  const now = new Date().toISOString()
  const newProduct: Product = {
    ...product,
    id: crypto.randomUUID(),
    date_added: now,
    created_at: now,
    updated_at: now,
  }
  set(KEYS.products, [...getProducts(), newProduct])
  return newProduct
}

export function updateProduct(id: string, updates: Partial<Product>) {
  const products = getProducts().map((p) =>
    p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
  )
  set(KEYS.products, products)
}

export function deleteProduct(id: string) {
  set(KEYS.products, getProducts().filter((p) => p.id !== id))
  // Cascade delete relationships
  set(KEYS.relationships, getRelationships().filter((r) => r.product_a !== id && r.product_b !== id))
}

// --- Search ---

export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase().trim()
  if (!q) return getProducts()
  const terms = q.split(/\s+/)
  return getProducts().filter((p) => {
    const searchable = [p.name, p.brand, p.description, p.retailer, p.notes, ...(p.tags || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return terms.every((term) => searchable.includes(term))
  })
}

export function filterProducts(options: {
  status?: ProductStatus | "all"
  categoryId?: string
  subcategoryId?: string
  query?: string
  sortField?: SortField
  sortDirection?: SortDirection
  ownership?: ProductOwnership | "all"
  hideConsumables?: boolean
}): Product[] {
  let products = options.query ? searchProducts(options.query) : getProducts()

  if (options.status && options.status !== "all") {
    products = products.filter((p) => p.status === options.status)
  }
  if (options.categoryId) {
    products = products.filter((p) => p.category_id === options.categoryId)
  }
  if (options.subcategoryId) {
    products = products.filter((p) => p.subcategory_id === options.subcategoryId)
  }
  if (options.ownership && options.ownership !== "all") {
    products = products.filter((p) => (p.ownership || "mine") === options.ownership)
  }
  if (options.hideConsumables) {
    products = products.filter((p) => !p.is_consumable)
  }

  const field = options.sortField || "date_added"
  const dir = options.sortDirection || "desc"
  products.sort((a, b) => {
    let valA: string | number | undefined
    let valB: string | number | undefined

    if (field === "price") {
      valA = a.price ?? 0
      valB = b.price ?? 0
    } else if (field === "name") {
      valA = a.name.toLowerCase()
      valB = b.name.toLowerCase()
    } else if (field === "purchase_date") {
      valA = a.purchase_date || ""
      valB = b.purchase_date || ""
    } else {
      valA = a.date_added
      valB = b.date_added
    }

    if (valA < valB) return dir === "asc" ? -1 : 1
    if (valA > valB) return dir === "asc" ? 1 : -1
    return 0
  })

  return products
}

// --- Duplicate Detection ---

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.search = ""
    u.hash = ""
    return u.toString().replace(/\/+$/, "").toLowerCase()
  } catch {
    return url.toLowerCase().trim()
  }
}

function similarity(a: string, b: string): number {
  const al = a.toLowerCase()
  const bl = b.toLowerCase()
  if (al === bl) return 1
  if (al.includes(bl) || bl.includes(al)) return 0.7
  // Simple bigram similarity
  const bigramsA = new Set<string>()
  const bigramsB = new Set<string>()
  for (let i = 0; i < al.length - 1; i++) bigramsA.add(al.slice(i, i + 2))
  for (let i = 0; i < bl.length - 1; i++) bigramsB.add(bl.slice(i, i + 2))
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0
  let intersection = 0
  bigramsA.forEach((b) => { if (bigramsB.has(b)) intersection++ })
  return (2 * intersection) / (bigramsA.size + bigramsB.size)
}

export interface DuplicateResult {
  exact: Product[]
  fuzzy: Product[]
}

export function checkDuplicates(input: {
  name?: string
  brand?: string
  sku?: string
  upc?: string
  source_url?: string
  excludeId?: string
}): DuplicateResult {
  const products = getProducts().filter((p) => p.id !== input.excludeId)
  const exact: Product[] = []
  const fuzzy: Product[] = []

  for (const p of products) {
    // Exact matches
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

    // Fuzzy match on name + brand
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

// --- Export / Import ---

export function exportAllData(): string {
  return JSON.stringify({
    products: getProducts(),
    categories: getCategories(),
    subcategories: getSubcategories(),
    relationships: getRelationships(),
  }, null, 2)
}

export function importAllData(json: string) {
  const data = JSON.parse(json)
  if (data.products) set(KEYS.products, data.products)
  if (data.categories) set(KEYS.categories, data.categories)
  if (data.subcategories) set(KEYS.subcategories, data.subcategories)
  if (data.relationships) set(KEYS.relationships, data.relationships)
  localStorage.setItem(KEYS.initialized, "true")
}

export function clearAllData() {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key))
}

// --- Product counts by category ---

export function getProductCountsByCategory(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of getProducts()) {
    if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1
  }
  return counts
}

export function getProductCountsBySubcategory(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of getProducts()) {
    if (p.subcategory_id) counts[p.subcategory_id] = (counts[p.subcategory_id] || 0) + 1
  }
  return counts
}

// --- Dashboard Helpers ---

export interface ReturnAlert {
  product: Product
  daysLeft: number
}

export function getReturnAlerts(): ReturnAlert[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return getProducts()
    .filter((p) => p.return_by_date && p.status !== "returned")
    .map((p) => {
      const returnDate = new Date(p.return_by_date!)
      returnDate.setHours(0, 0, 0, 0)
      const daysLeft = Math.ceil((returnDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return { product: p, daysLeft }
    })
    .filter((a) => a.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

export function getWarrantyAlerts(): ReturnAlert[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return getProducts()
    .filter((p) => p.warranty_expires)
    .map((p) => {
      const expDate = new Date(p.warranty_expires!)
      expDate.setHours(0, 0, 0, 0)
      const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return { product: p, daysLeft }
    })
    .filter((a) => a.daysLeft >= 0 && a.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

export interface CategorySpending {
  category: Category
  totalSpend: number
  itemCount: number
  avgPrice: number
  lastPurchase: string | null
  monthlySpend: { month: string; amount: number }[]
}

export function getSpendingByCategory(): CategorySpending[] {
  const products = getProducts().filter((p) => p.status === "purchased" && p.price != null)
  const categories = getCategories()
  const catMap = new Map(categories.map((c) => [c.id, c]))

  const grouped: Record<string, Product[]> = {}
  for (const p of products) {
    const cid = p.category_id ?? "uncategorized"
    if (!grouped[cid]) grouped[cid] = []
    grouped[cid].push(p)
  }

  return Object.entries(grouped)
    .map(([catId, prods]) => {
      const category = catMap.get(catId)
      if (!category) return null

      const totalSpend = prods.reduce((sum, p) => sum + (p.price || 0), 0)
      const dates = prods.map((p) => p.purchase_date || p.date_added).sort()
      const lastPurchase = dates[dates.length - 1] || null

      // Build monthly spend
      const monthly: Record<string, number> = {}
      for (const p of prods) {
        const d = p.purchase_date || p.date_added
        const month = d.slice(0, 7) // YYYY-MM
        monthly[month] = (monthly[month] || 0) + (p.price || 0)
      }
      const monthlySpend = Object.entries(monthly)
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => a.month.localeCompare(b.month))

      return {
        category,
        totalSpend,
        itemCount: prods.length,
        avgPrice: totalSpend / prods.length,
        lastPurchase,
        monthlySpend,
      }
    })
    .filter((x): x is CategorySpending => x !== null)
    .sort((a, b) => b.totalSpend - a.totalSpend)
}

export function getRecentProducts(limit: number): Product[] {
  return getProducts()
    .sort((a, b) => b.date_added.localeCompare(a.date_added))
    .slice(0, limit)
}

// --- Relationships ---

export function getRelationships(): ProductRelationship[] {
  return get<ProductRelationship>(KEYS.relationships)
}

export function addRelationship(
  productA: string,
  productB: string,
  type: RelationshipType,
  notes?: string
): ProductRelationship {
  const rel: ProductRelationship = {
    id: crypto.randomUUID(),
    product_a: productA,
    product_b: productB,
    relationship_type: type,
    notes,
    created_at: new Date().toISOString(),
  }
  set(KEYS.relationships, [...getRelationships(), rel])
  return rel
}

export function deleteRelationship(id: string) {
  set(KEYS.relationships, getRelationships().filter((r) => r.id !== id))
}

export interface RelatedProductResult {
  relationship: ProductRelationship
  product: Product
  type: RelationshipType
  direction: "forward" | "reverse"
}

export function getRelatedProducts(productId: string): RelatedProductResult[] {
  const rels = getRelationships()
  const products = getProducts()
  const productMap = new Map(products.map((p) => [p.id, p]))
  const results: RelatedProductResult[] = []

  for (const r of rels) {
    if (r.product_a === productId) {
      const p = productMap.get(r.product_b)
      if (p) results.push({ relationship: r, product: p, type: r.relationship_type, direction: "forward" })
    } else if (r.product_b === productId) {
      const p = productMap.get(r.product_a)
      if (p) results.push({ relationship: r, product: p, type: r.relationship_type, direction: "reverse" })
    }
  }

  return results
}

// --- Analytics ---

export interface MonthlySpending {
  month: string
  amount: number
}

export function getMonthlySpending(tag?: string): MonthlySpending[] {
  let products = getProducts().filter((p) => p.status === "purchased" && p.price != null)
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

export function getStatusDistribution(): { status: string; count: number }[] {
  const counts: Record<string, number> = {}
  for (const p of getProducts()) {
    counts[p.status] = (counts[p.status] || 0) + 1
  }
  return Object.entries(counts).map(([status, count]) => ({ status, count }))
}

export function getOwnershipDistribution(): { ownership: string; count: number }[] {
  const counts: Record<string, number> = {}
  for (const p of getProducts()) {
    const own = p.ownership || "mine"
    counts[own] = (counts[own] || 0) + 1
  }
  return Object.entries(counts).map(([ownership, count]) => ({ ownership, count }))
}

export function getTopExpensiveProducts(limit: number): Product[] {
  return getProducts()
    .filter((p) => p.price != null)
    .sort((a, b) => (b.price || 0) - (a.price || 0))
    .slice(0, limit)
}

export function getAllTags(): string[] {
  const tags = new Set<string>()
  for (const p of getProducts()) {
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

export function getMonthOverMonthComparison(): MonthComparison[] {
  const now = new Date()
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`

  const purchased = getProducts().filter((p) => p.status === "purchased" && p.price != null)

  const thisMonthProducts = purchased.filter((p) => (p.purchase_date || p.date_added).startsWith(thisMonthStr))
  const lastMonthProducts = purchased.filter((p) => (p.purchase_date || p.date_added).startsWith(lastMonthStr))

  const thisSpend = thisMonthProducts.reduce((s, p) => s + (p.price || 0), 0)
  const lastSpend = lastMonthProducts.reduce((s, p) => s + (p.price || 0), 0)
  const thisAvg = thisMonthProducts.length ? thisSpend / thisMonthProducts.length : 0
  const lastAvg = lastMonthProducts.length ? lastSpend / lastMonthProducts.length : 0

  return [
    { metric: "Total Spend", thisMonth: thisSpend, lastMonth: lastSpend, change: lastSpend ? ((thisSpend - lastSpend) / lastSpend) * 100 : 0 },
    { metric: "Items", thisMonth: thisMonthProducts.length, lastMonth: lastMonthProducts.length, change: lastMonthProducts.length ? ((thisMonthProducts.length - lastMonthProducts.length) / lastMonthProducts.length) * 100 : 0 },
    { metric: "Avg Price", thisMonth: thisAvg, lastMonth: lastAvg, change: lastAvg ? ((thisAvg - lastAvg) / lastAvg) * 100 : 0 },
  ]
}
