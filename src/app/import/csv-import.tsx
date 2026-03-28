"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import {
  Upload, CheckCircle, AlertTriangle, Loader2, Package, Check, X, ChevronRight,
} from "lucide-react"
import { parseCsv } from "@/lib/csv-parser"
import type { Category, Subcategory, ProductOwnership } from "@/lib/types"
import { OWNERSHIP_OPTIONS, EXPENSE_TAGS } from "@/lib/constants"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Store = any

interface CsvImportProps {
  categories: Category[]
  subcategories: Subcategory[]
  store: Store
}

interface DraftProduct {
  name: string
  brand: string
  price: string
  retailer: string
  order_id: string
  purchase_date: string
  category_id: string
  subcategory_id: string
  ownership: ProductOwnership
  is_consumable: boolean
  quantity: number
  notes: string
  included: boolean
  duplicateWarning: string | null
  tags: string[]
}

type Phase = "upload" | "review" | "done"

export function CsvImport({ categories, subcategories, store }: CsvImportProps) {
  const [phase, setPhase] = useState<Phase>("upload")
  const [drafts, setDrafts] = useState<DraftProduct[]>([])
  const [error, setError] = useState("")
  const [parsing, setParsing] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const matchCategory = useCallback((input: string): { categoryId: string; subcategoryId: string } => {
    if (!input) return { categoryId: "", subcategoryId: "" }
    const lower = input.toLowerCase()
    // Exact match
    const exact = categories.find(c => c.name.toLowerCase() === lower)
    if (exact) {
      const sub = subcategories.find(s => s.category_id === exact.id)
      return { categoryId: exact.id, subcategoryId: sub?.id || "" }
    }
    // Substring match
    const partial = categories.find(c =>
      c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
    )
    if (partial) {
      const sub = subcategories.find(s => s.category_id === partial.id)
      return { categoryId: partial.id, subcategoryId: sub?.id || "" }
    }
    // Check subcategory names
    const subMatch = subcategories.find(s => s.name.toLowerCase() === lower)
    if (subMatch) {
      return { categoryId: subMatch.category_id, subcategoryId: subMatch.id }
    }
    return { categoryId: "", subcategoryId: "" }
  }, [categories, subcategories])

  const processFile = async (file: File) => {
    setError("")
    setParsing(true)
    try {
      const text = await file.text()
      const { rows } = parseCsv(text)
      if (rows.length === 0) {
        setError("No valid rows found. Make sure the CSV has a 'name' column.")
        setParsing(false)
        return
      }

      const newDrafts: DraftProduct[] = []
      for (const row of rows) {
        const { categoryId, subcategoryId } = matchCategory(row.category || "")
        const dupes = await store.checkDuplicates({ name: row.name, brand: row.brand || undefined })
        const duplicateWarning =
          dupes.exact.length > 0 ? `Exact match: ${dupes.exact[0].name}`
          : dupes.fuzzy.length > 0 ? `Similar: ${dupes.fuzzy[0].name}`
          : null

        newDrafts.push({
          name: row.name,
          brand: row.brand || "",
          price: row.price || "",
          retailer: row.retailer || "",
          order_id: row.order_id || "",
          purchase_date: row.purchase_date || "",
          category_id: categoryId,
          subcategory_id: subcategoryId,
          ownership: "mine",
          is_consumable: false,
          quantity: parseInt(row.quantity) || 1,
          notes: row.notes || "",
          included: !duplicateWarning?.startsWith("Exact"),
          duplicateWarning,
          tags: [],
        })
      }

      setDrafts(newDrafts)
      setPhase("review")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV")
    } finally {
      setParsing(false)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith(".csv")) processFile(file)
  }

  const updateDraft = (index: number, field: keyof DraftProduct, value: string | boolean | number | string[]) => {
    setDrafts(prev => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)))
  }

  const toggleTag = (index: number, tag: string) => {
    setDrafts(prev => prev.map((d, i) => {
      if (i !== index) return d
      const has = d.tags.includes(tag)
      return { ...d, tags: has ? d.tags.filter(t => t !== tag) : [...d.tags, tag] }
    }))
  }

  const handleSave = async () => {
    const toSave = drafts.filter(d => d.included)
    for (const draft of toSave) {
      for (let q = 0; q < draft.quantity; q++) {
        await store.addProduct({
          name: draft.name,
          brand: draft.brand || undefined,
          category_id: draft.category_id,
          subcategory_id: draft.subcategory_id,
          price: draft.price ? parseFloat(draft.price) : undefined,
          retailer: draft.retailer || undefined,
          order_id: draft.order_id || undefined,
          purchase_date: draft.purchase_date || undefined,
          ownership: draft.ownership,
          is_consumable: draft.is_consumable || undefined,
          notes: draft.notes || undefined,
          status: "purchased",
          currency: "USD",
          tags: draft.tags,
        })
      }
    }
    setSavedCount(toSave.length)
    setPhase("done")
  }

  const includedCount = drafts.filter(d => d.included).length

  // --- Upload Phase ---
  if (phase === "upload") {
    return (
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-4 py-3 text-[13px] text-red-700 dark:text-red-400">
            <AlertTriangle className="size-4 shrink-0" />
            {error}
            <button onClick={() => setError("")} className="ml-auto"><X className="size-3.5" /></button>
          </div>
        )}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          {parsing ? (
            <>
              <Loader2 className="size-8 text-primary animate-spin mb-3" />
              <p className="text-[13px] text-muted-foreground">Parsing CSV...</p>
            </>
          ) : (
            <>
              <Upload className="size-8 text-muted-foreground/40 mb-3" />
              <p className="text-[13px] font-medium mb-1">Drop a CSV file here</p>
              <p className="text-[11px] text-muted-foreground mb-4">
                Columns: name, brand, price, retailer, purchase_date, category, quantity, order_id, notes
              </p>
              <label className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer transition-colors active:translate-y-px">
                <Upload className="size-3.5" />
                Choose File
                <input type="file" accept=".csv" onChange={handleFileInput} className="hidden" />
              </label>
            </>
          )}
        </div>

        <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-4 space-y-2">
          <p className="text-[13px] font-semibold">Expected format</p>
          <p className="text-[11px] text-muted-foreground">
            Only &quot;name&quot; is required. All other columns are optional. Column names are flexible
            (e.g., &quot;product&quot;, &quot;item&quot;, &quot;cost&quot;, &quot;store&quot; all work).
          </p>
          <pre className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-3 overflow-x-auto">
{`name,brand,price,retailer,purchase_date,category
"SAMLA Box 6 gal",IKEA,4.99,IKEA,2026-01-15,Home & Garden
"Atlas Grip Module",Atlas,89.00,Brownells,2026-03-20,Sports & Outdoors`}
          </pre>
        </div>
      </div>
    )
  }

  // --- Done Phase ---
  if (phase === "done") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="size-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
          <CheckCircle className="size-7 text-emerald-500" />
        </div>
        <h2 className="text-[15px] font-semibold mb-2">
          {savedCount} product{savedCount !== 1 ? "s" : ""} imported
        </h2>
        <div className="flex gap-3 mt-4">
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Package className="size-3.5" />
            View Products
          </Link>
          <button
            onClick={() => { setPhase("upload"); setDrafts([]); setSavedCount(0) }}
            className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[13px] font-medium hover:bg-accent transition-colors"
          >
            Import More
          </button>
        </div>
      </div>
    )
  }

  // --- Review Phase ---
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          {drafts.length} product{drafts.length !== 1 ? "s" : ""} found — review before saving
        </p>
        <button
          onClick={() => { setPhase("upload"); setDrafts([]) }}
          className="text-[12px] text-muted-foreground hover:text-foreground"
        >
          Start over
        </button>
      </div>

      <div className="space-y-3">
        {drafts.map((draft, i) => (
          <div
            key={i}
            className={`rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-4 space-y-3 ${
              !draft.included ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.included}
                  onChange={(e) => updateDraft(i, "included", e.target.checked)}
                  className="rounded"
                />
                {draft.retailer && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {draft.retailer}
                  </span>
                )}
                {draft.quantity > 1 && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    Qty: {draft.quantity}
                  </span>
                )}
              </div>
              {draft.duplicateWarning && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-3" />
                  {draft.duplicateWarning}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground">Product Name</label>
                <input
                  value={draft.name}
                  onChange={(e) => updateDraft(i, "name", e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-[13px]"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Brand</label>
                <input
                  value={draft.brand}
                  onChange={(e) => updateDraft(i, "brand", e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-[13px]"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={draft.price}
                  onChange={(e) => updateDraft(i, "price", e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-[13px]"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Purchase Date</label>
                <input
                  type="date"
                  value={draft.purchase_date}
                  onChange={(e) => updateDraft(i, "purchase_date", e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-[13px]"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Category</label>
                <select
                  value={draft.category_id}
                  onChange={(e) => {
                    const catId = e.target.value
                    const firstSub = subcategories.find(s => s.category_id === catId)
                    updateDraft(i, "category_id", catId)
                    updateDraft(i, "subcategory_id", firstSub?.id || "")
                  }}
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-[13px]"
                >
                  <option value="">Select category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Subcategory</label>
                <select
                  value={draft.subcategory_id}
                  onChange={(e) => updateDraft(i, "subcategory_id", e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-[13px]"
                >
                  {subcategories
                    .filter(s => s.category_id === draft.category_id)
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Retailer</label>
                <input
                  value={draft.retailer}
                  onChange={(e) => updateDraft(i, "retailer", e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-[13px]"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Ownership</label>
                <select
                  value={draft.ownership}
                  onChange={(e) => updateDraft(i, "ownership", e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-[13px]"
                >
                  {OWNERSHIP_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.is_consumable}
                onChange={(e) => updateDraft(i, "is_consumable", e.target.checked)}
                className="rounded"
              />
              <span className="text-[12px] text-muted-foreground">Consumable</span>
            </label>

            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(i, tag)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    draft.tags.includes(tag)
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/50 border-transparent text-muted-foreground hover:border-border"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="text-[12px] text-muted-foreground">
          {includedCount} of {drafts.length} will be saved
        </span>
        <button
          onClick={handleSave}
          disabled={includedCount === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:translate-y-px disabled:opacity-50"
        >
          <Check className="size-3.5" />
          Save {includedCount} Product{includedCount !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  )
}
