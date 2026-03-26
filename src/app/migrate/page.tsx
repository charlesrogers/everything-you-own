"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"
import type { Product, Category, Subcategory, ProductRelationship } from "@/lib/types"

interface MigrationResult {
  categories: number
  subcategories: number
  products: number
  relationships: number
  errors: string[]
}

export default function MigratePage() {
  const { user, householdId } = useAuth()
  const router = useRouter()
  const [migrating, setMigrating] = useState(false)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [progress, setProgress] = useState("")

  function getLocalData() {
    const raw = (key: string) => {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : []
    }
    return {
      categories: raw("eyo_categories") as Category[],
      subcategories: raw("eyo_subcategories") as Subcategory[],
      products: raw("eyo_products") as Product[],
      relationships: raw("eyo_relationships") as ProductRelationship[],
    }
  }

  async function runMigration() {
    if (!user || !householdId) return
    setMigrating(true)
    const errors: string[] = []
    const sb = createClient()

    try {
      const local = getLocalData()
      setProgress(`Found ${local.products.length} products, ${local.categories.length} categories locally`)

      // Step 1: Get existing Supabase categories (seeded by trigger)
      setProgress("Loading Supabase categories...")
      const { data: sbCats } = await sb
        .from("categories")
        .select("id, name")
        .eq("household_id", householdId)

      const { data: sbSubs } = await sb
        .from("subcategories")
        .select("id, category_id, name")
        .eq("household_id", householdId)

      // Step 2: Build name-to-ID maps for Supabase categories
      const catNameToId = new Map((sbCats ?? []).map((c) => [c.name, c.id]))
      const subNameToId = new Map<string, Map<string, string>>()
      for (const sub of sbSubs ?? []) {
        const catId = sub.category_id
        if (!subNameToId.has(catId)) subNameToId.set(catId, new Map())
        subNameToId.get(catId)!.set(sub.name, sub.id)
      }

      // Step 3: Build local category ID → Supabase category ID map
      const localCatMap = new Map<string, string>()
      for (const lc of local.categories) {
        const sbId = catNameToId.get(lc.name)
        if (sbId) {
          localCatMap.set(lc.id, sbId)
        } else {
          // Category doesn't exist in Supabase — create it
          setProgress(`Creating category: ${lc.name}`)
          const { data: newCat, error } = await sb
            .from("categories")
            .insert({ household_id: householdId, name: lc.name, sort_order: lc.sort_order, is_default: false })
            .select("id")
            .single()
          if (error) {
            errors.push(`Category "${lc.name}": ${error.message}`)
          } else {
            localCatMap.set(lc.id, newCat.id)
            catNameToId.set(lc.name, newCat.id)
          }
        }
      }

      // Step 4: Build local subcategory ID → Supabase subcategory ID map
      const localSubMap = new Map<string, string>()
      for (const ls of local.subcategories) {
        const sbCatId = localCatMap.get(ls.category_id)
        if (!sbCatId) {
          errors.push(`Subcategory "${ls.name}" has unmapped category`)
          continue
        }
        const catSubs = subNameToId.get(sbCatId)
        const sbId = catSubs?.get(ls.name)
        if (sbId) {
          localSubMap.set(ls.id, sbId)
        } else {
          setProgress(`Creating subcategory: ${ls.name}`)
          const { data: newSub, error } = await sb
            .from("subcategories")
            .insert({ household_id: householdId, category_id: sbCatId, name: ls.name, sort_order: ls.sort_order, is_default: false })
            .select("id")
            .single()
          if (error) {
            errors.push(`Subcategory "${ls.name}": ${error.message}`)
          } else {
            localSubMap.set(ls.id, newSub.id)
          }
        }
      }

      // Step 5: Migrate products
      const localProductMap = new Map<string, string>() // local ID → supabase ID
      let productCount = 0
      for (const p of local.products) {
        productCount++
        setProgress(`Migrating product ${productCount}/${local.products.length}: ${p.name}`)

        const sbCatId = localCatMap.get(p.category_id)
        const sbSubId = localSubMap.get(p.subcategory_id)
        if (!sbCatId || !sbSubId) {
          errors.push(`Product "${p.name}" has unmapped category/subcategory`)
          continue
        }

        const { data: newProd, error } = await sb
          .from("products")
          .insert({
            household_id: householdId,
            added_by: user.id,
            name: p.name,
            brand: p.brand || null,
            category_id: sbCatId,
            subcategory_id: sbSubId,
            description: p.description || null,
            image_url: p.image_url || null,
            additional_images: p.additional_images || [],
            source_url: p.source_url || null,
            retailer: p.retailer || null,
            price: p.price ?? null,
            original_price: p.original_price ?? null,
            currency: p.currency || "USD",
            purchase_date: p.purchase_date || null,
            status: p.status || "purchased",
            sku: p.sku || null,
            upc: p.upc || null,
            weight: p.weight ?? null,
            weight_unit: p.weight_unit || null,
            volume: p.volume ?? null,
            volume_unit: p.volume_unit || null,
            dimensions: p.dimensions || null,
            material: p.material || null,
            color: p.color || null,
            size: p.size || null,
            condition: p.condition || null,
            rating: p.rating ?? null,
            notes: p.notes || null,
            return_by_date: p.return_by_date || null,
            warranty_expires: p.warranty_expires || null,
            order_id: p.order_id || null,
            ownership: p.ownership || "mine",
            is_consumable: p.is_consumable || false,
            tags: p.tags || [],
          })
          .select("id")
          .single()

        if (error) {
          errors.push(`Product "${p.name}": ${error.message}`)
        } else {
          localProductMap.set(p.id, newProd.id)
        }
      }

      // Step 6: Migrate relationships
      let relCount = 0
      for (const r of local.relationships) {
        const sbA = localProductMap.get(r.product_a)
        const sbB = localProductMap.get(r.product_b)
        if (!sbA || !sbB) {
          errors.push(`Relationship skipped: missing product mapping`)
          continue
        }
        relCount++
        const { error } = await sb
          .from("product_relationships")
          .insert({
            household_id: householdId,
            product_a: sbA,
            product_b: sbB,
            relationship_type: r.relationship_type,
            group_name: r.group_name || null,
            notes: r.notes || null,
          })
        if (error) {
          errors.push(`Relationship: ${error.message}`)
        }
      }

      // Step 7: Migrate imported email IDs
      const emailIdsRaw = localStorage.getItem("eyo_imported_emails")
      if (emailIdsRaw) {
        const emailIds: string[] = JSON.parse(emailIdsRaw)
        if (emailIds.length > 0) {
          setProgress(`Migrating ${emailIds.length} imported email records...`)
          const rows = emailIds.map((id) => ({ household_id: householdId, gmail_message_id: id }))
          await sb.from("imported_emails").upsert(rows, { onConflict: "household_id,gmail_message_id" })
        }
      }

      setResult({
        categories: localCatMap.size,
        subcategories: localSubMap.size,
        products: localProductMap.size,
        relationships: relCount,
        errors,
      })
    } catch (err) {
      errors.push(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`)
      setResult({ categories: 0, subcategories: 0, products: 0, relationships: 0, errors })
    } finally {
      setMigrating(false)
    }
  }

  const hasLocalData = typeof window !== "undefined" && localStorage.getItem("eyo_products")

  if (!user || !householdId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="size-12 text-muted-foreground/30 mb-4" />
        <p className="text-[13px] text-muted-foreground">
          Please sign in first to migrate your data.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-[20px] font-bold">Migrate Data</h1>
        <p className="text-[12px] text-muted-foreground mt-1">
          Move your local data to the cloud so it syncs across devices.
        </p>
      </div>

      {result ? (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          {result.errors.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="size-5" />
              <span className="text-[15px] font-semibold">Migration complete</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="size-5" />
              <span className="text-[15px] font-semibold">Migration completed with warnings</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-[20px] font-bold">{result.products}</div>
              <div className="text-muted-foreground">Products</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-[20px] font-bold">{result.categories}</div>
              <div className="text-muted-foreground">Categories</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-[20px] font-bold">{result.subcategories}</div>
              <div className="text-muted-foreground">Subcategories</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-[20px] font-bold">{result.relationships}</div>
              <div className="text-muted-foreground">Relationships</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 space-y-1 text-[12px]">
              {result.errors.map((err, i) => (
                <p key={i} className="text-amber-700 dark:text-amber-400">{err}</p>
              ))}
            </div>
          )}

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          {hasLocalData ? (
            <>
              <p className="text-[13px]">
                We found local data in your browser. Click below to migrate it to your cloud account.
              </p>
              <div className="rounded-lg bg-muted/50 p-3 text-[12px] text-muted-foreground">
                Tip: Export a backup from Settings first, just in case.
              </div>
              <button
                onClick={runMigration}
                disabled={migrating}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {migrating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {progress || "Migrating..."}
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Start Migration
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-[13px] text-muted-foreground">
                No local data found. Nothing to migrate.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
