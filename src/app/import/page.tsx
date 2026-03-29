"use client"

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Mail, CheckCircle, AlertTriangle, Loader2, ChevronLeft, ChevronRight,
  Package, Check, X, Download, Upload,
} from "lucide-react"
import {
  getGmailAuthUrl, searchReceipts, batchGetMetadata,
  getMessageBody,
} from "@/lib/gmail"
import type { GmailMessageMeta } from "@/lib/gmail"
import { parseReceiptEmail, classifyEmail, htmlToText } from "@/lib/receipt-parser"
import { useStore } from "@/hooks/use-store"
import { useAuth } from "@/components/auth-provider"
import type { Category, Subcategory, ProductOwnership } from "@/lib/types"
import { OWNERSHIP_OPTIONS, EXPENSE_TAGS } from "@/lib/constants"
import { CsvImport } from "./csv-import"
import { SearchableLocationPicker, buildLocationOptions } from "@/components/searchable-location-picker"

interface RejectedEmail {
  id: string
  subject: string
  from: string
  date: string
  reason: string
  bodyText: string
}

type Phase = "connect" | "select" | "review"

interface EmailEntry extends GmailMessageMeta {
  selected: boolean
  alreadyImported: boolean
}

interface DraftProduct {
  emailId: string
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
  source_url: string
  included: boolean
  duplicateWarning: string | null
  emailBody: string
  tags: string[]
  location_id: string
}

interface ImportLocation {
  id: string
  name: string
  path: string
}

function VendorFilter({ drafts, onToggle }: { drafts: DraftProduct[]; onToggle: (vendor: string, included: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Build vendor stats
  const vendors = useMemo(() => {
    const map = new Map<string, { total: number; included: number }>()
    for (const d of drafts) {
      const v = d.retailer || "Unknown"
      const entry = map.get(v) || { total: 0, included: 0 }
      entry.total++
      if (d.included) entry.included++
      map.set(v, entry)
    }
    return [...map.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total)
  }, [drafts])

  const excludedCount = vendors.filter((v) => v.included === 0).length
  const filtered = search.trim()
    ? vendors.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()))
    : vendors

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${
          excludedCount > 0
            ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
            : "bg-secondary border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        Vendors ({vendors.length})
        {excludedCount > 0 && <span>· {excludedCount} excluded</span>}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 w-72 rounded-lg border bg-card shadow-lg overflow-hidden">
          {/* Search */}
          <div className="border-b px-3 py-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendors..."
              className="w-full text-[12px] bg-transparent outline-none"
              autoFocus
            />
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 px-3 py-1.5 border-b text-[11px]">
            <button
              type="button"
              onClick={() => { for (const v of vendors) onToggle(v.name, true) }}
              className="text-primary hover:underline"
            >
              Include all
            </button>
            <button
              type="button"
              onClick={() => { for (const v of vendors) onToggle(v.name, false) }}
              className="text-destructive hover:underline"
            >
              Exclude all
            </button>
          </div>

          {/* Vendor list */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.map((v) => {
              const allIncluded = v.included === v.total
              const noneIncluded = v.included === 0
              return (
                <label
                  key={v.name}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={allIncluded}
                    ref={(el) => { if (el) el.indeterminate = !allIncluded && !noneIncluded }}
                    onChange={() => onToggle(v.name, noneIncluded || !allIncluded)}
                    className="rounded"
                  />
                  <span className={`text-[12px] flex-1 truncate ${noneIncluded ? "line-through text-muted-foreground" : ""}`}>
                    {v.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {v.included}/{v.total}
                  </span>
                </label>
              )
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-[12px] text-muted-foreground text-center">
                No vendors match &quot;{search}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ImportPage() {
  return (
    <Suspense>
      <ImportContent />
    </Suspense>
  )
}

function ImportContent() {
  const searchParams = useSearchParams()
  const { householdId } = useAuth()
  const store = useStore()
  const [phase, setPhase] = useState<Phase>("connect")
  const [token, setToken] = useState("")
  const [error, setError] = useState("")

  // Phase 2: Select
  const [emails, setEmails] = useState<EmailEntry[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | undefined>()
  const [timeframe, setTimeframe] = useState("1y")
  const [customAfter, setCustomAfter] = useState("")
  const [customBefore, setCustomBefore] = useState("")
  const [loadCancelledRef] = useState({ current: 0 }) // increment to cancel current load
  const [loadingMore, setLoadingMore] = useState(false)

  // Phase 3: Review
  // Note: `drafts` is derived from pages[currentPage].drafts below
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 })
  const [processing, setProcessing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [importLocations, setImportLocations] = useState<ImportLocation[]>([])
  const [locationOptions, setLocationOptions] = useState<ReturnType<typeof buildLocationOptions>>([])
  // Note: rejectedEmails derived from pages[currentPage].rejected below
  const [reviewTab, setReviewTab] = useState<"products" | "rejected">("products")
  const [emailFilter, setEmailFilter] = useState<"new" | "imported" | "all">("new")
  const [bulkLocationId, setBulkLocationId] = useState("")
  const SESSION_KEY = "eyo_import_session"

  // Pipeline batch processing with pages
  const BATCH_SIZE = 20

  interface BatchPage {
    pageNum: number
    emailRange: string
    drafts: DraftProduct[]
    rejected: RejectedEmail[]
    status: "processing" | "ready" | "saved"
    savedCount: number
  }

  const [pages, setPages] = useState<BatchPage[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [processingComplete, setProcessingComplete] = useState(false)
  const [totalEmailsProcessed, setTotalEmailsProcessed] = useState(0)
  const [selectedForProcessing, setSelectedForProcessing] = useState<EmailEntry[]>([])
  const [allSavedCount, setAllSavedCount] = useState(0)

  // Shared
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [activeTab, setActiveTab] = useState<"gmail" | "csv">("gmail")

  useEffect(() => {
    if (!householdId) return
    async function init() {
      await store.ensureDefaultCategories()
      const [cats, subs] = await Promise.all([
        store.getCategories(),
        store.getSubcategories(),
      ])
      setCategories(cats)
      setSubcategories(subs)

      // Load locations for picker — all types, tree-ordered
      try {
        const res = await fetch("/api/storage")
        const data = await res.json()
        const locs = (data.locations ?? []) as Array<{ id: string; name: string; parent_id: string | null; location_type: string; unit_subtype: string | null }>
        const opts = buildLocationOptions(locs)
        setLocationOptions(opts)
        // Also keep bins-only list for backward compat
        const bins = opts.filter((l) => l.subtype === "bin").map((l) => ({ id: l.id, name: l.name, path: l.path }))
        setImportLocations(bins)
      } catch {}
    }
    init()
  }, [store, householdId])

  // Check for OAuth redirect callback
  useEffect(() => {
    const authParam = searchParams.get("auth")
    const errorParam = searchParams.get("error")

    if (errorParam) {
      setError(decodeURIComponent(errorParam))
      // Clean up URL
      window.history.replaceState({}, "", "/import")
      return
    }

    if (authParam === "success") {
      const savedToken = sessionStorage.getItem("gmail_token")
      if (savedToken) {
        setToken(savedToken)
        setPhase("select")
        // Clean up URL
        window.history.replaceState({}, "", "/import")
      } else {
        setError("Token not found. Please try connecting again.")
      }
    }
  }, [searchParams])

  // Auto-load ALL emails when entering select phase with a token
  useEffect(() => {
    if (phase === "select" && token && emails.length === 0 && householdId) {
      loadAllEmails(token, timeframe)
    }
  }, [phase, token, householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Phase 1: Connect ---

  const handleConnect = () => {
    const authUrl = getGmailAuthUrl()
    window.location.href = authUrl
  }

  // --- Phase 2: Select ---

  const loadEmails = async (accessToken: string, tf: string, pageToken?: string) => {
    setLoadingMore(true)
    try {
      const result = await searchReceipts(accessToken, tf, pageToken)
      if (result.messages.length === 0 && !pageToken) {
        setEmails([])
        setNextPageToken(undefined)
        return
      }

      const metas = await batchGetMetadata(accessToken, result.messages.map((m) => m.id))
      const imported = await store.getImportedEmailIds()
      const entries: EmailEntry[] = metas.map((m) => ({
        ...m,
        selected: !imported.has(m.id),
        alreadyImported: imported.has(m.id),
      }))

      if (pageToken) {
        setEmails((prev) => [...prev, ...entries])
      } else {
        setEmails(entries)
      }
      setNextPageToken(result.nextPageToken)
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        setError("Session expired. Please reconnect.")
        setPhase("connect")
        return
      }
      setError(e instanceof Error ? `Failed to load emails: ${e.message}` : "Failed to load emails")
    } finally {
      setLoadingMore(false)
    }
  }

  // Auto-load ALL emails from the selected timeframe (paginate through everything)
  const loadAllEmails = async (accessToken: string, tf: string) => {
    // Cancel any in-progress load
    const loadId = ++loadCancelledRef.current
    setLoadingMore(true)
    setEmails([])
    setNextPageToken(undefined)

    const imported = await store.getImportedEmailIds()
    let pt: string | undefined = undefined
    let allEntries: EmailEntry[] = []

    try {
      while (true) {
        if (loadCancelledRef.current !== loadId) return // cancelled
        const result = await searchReceipts(accessToken, tf, pt)
        if (result.messages.length === 0) break

        const metas = await batchGetMetadata(accessToken, result.messages.map((m) => m.id))
        if (loadCancelledRef.current !== loadId) return // cancelled

        const entries: EmailEntry[] = metas.map((m) => ({
          ...m,
          selected: !imported.has(m.id),
          alreadyImported: imported.has(m.id),
        }))
        allEntries = [...allEntries, ...entries]
        setEmails([...allEntries]) // Update UI progressively

        pt = result.nextPageToken
        if (!pt) break
      }
    } catch (e) {
      if (loadCancelledRef.current !== loadId) return
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        setError("Session expired. Please reconnect.")
        setPhase("connect")
        return
      }
      console.error("Error loading all emails:", e)
    }

    if (loadCancelledRef.current === loadId) {
      setNextPageToken(undefined)
      setLoadingMore(false)
    }
  }

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf)
    setEmails([])
    setNextPageToken(undefined)
    loadAllEmails(token, tf)
  }

  const toggleEmail = (id: string) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, selected: !e.selected } : e)))
  }

  const toggleAll = (selected: boolean) => {
    setEmails((prev) => prev.map((e) => (e.alreadyImported ? e : { ...e, selected })))
  }

  const selectedCount = emails.filter((e) => e.selected).length

  // --- Phase 3: Process & Review ---

  const mapCategoryGuess = useCallback(
    (categoryGuess: string | null, subcategoryGuess?: string | null): { categoryId: string; subcategoryId: string } => {
      if (!categoryGuess) return { categoryId: "", subcategoryId: "" }

      const lower = categoryGuess.toLowerCase()

      // Exact match
      let cat = categories.find((c) => c.name.toLowerCase() === lower)
      // Partial match (category name contains guess or vice versa)
      if (!cat) cat = categories.find((c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()))

      if (cat) {
        // Try to match subcategory
        let sub = null
        if (subcategoryGuess) {
          const subLower = subcategoryGuess.toLowerCase()
          sub = subcategories.find((s) => s.category_id === cat!.id && s.name.toLowerCase() === subLower)
          if (!sub) sub = subcategories.find((s) => s.category_id === cat!.id && (s.name.toLowerCase().includes(subLower) || subLower.includes(s.name.toLowerCase())))
        }
        if (!sub) sub = subcategories.find((s) => s.category_id === cat!.id)
        return { categoryId: cat.id, subcategoryId: sub?.id || "" }
      }

      // Check if the guess matches a subcategory name
      const subMatch = subcategories.find((s) => s.name.toLowerCase() === lower)
      if (subMatch) {
        return { categoryId: subMatch.category_id, subcategoryId: subMatch.id }
      }

      return { categoryId: "", subcategoryId: "" }
    },
    [categories, subcategories]
  )

  // Pipeline: process all batches in background, present as pages
  const handleProcess = async () => {
    const selected = emails.filter((e) => e.selected)
    if (selected.length === 0) return

    setSelectedForProcessing(selected)
    setPhase("review")
    setProcessingComplete(false)
    setTotalEmailsProcessed(0)
    setSaved(false)

    const numBatches = Math.ceil(selected.length / BATCH_SIZE)
    const initialPages: BatchPage[] = Array.from({ length: numBatches }, (_, i) => ({
      pageNum: i,
      emailRange: `${i * BATCH_SIZE + 1}–${Math.min((i + 1) * BATCH_SIZE, selected.length)}`,
      drafts: [],
      rejected: [],
      status: "processing" as const,
      savedCount: 0,
    }))
    setPages(initialPages)
    setCurrentPage(0)

    // Process each batch sequentially in background
    for (let i = 0; i < numBatches; i++) {
      const batchEmails = selected.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
      const { drafts: batchDrafts, rejected: batchRejected } = await processOneBatch(batchEmails)

      setPages((prev) => prev.map((p, idx) =>
        idx === i ? { ...p, drafts: batchDrafts, rejected: batchRejected, status: "ready" } : p
      ))
      setTotalEmailsProcessed((prev) => prev + batchEmails.length)

      // Auto-navigate to first ready page if user hasn't moved
      if (i === 0) setCurrentPage(0)
    }
    setProcessingComplete(true)
  }

  // Process a single batch of emails → returns drafts + rejected
  const processOneBatch = async (batchEmails: EmailEntry[]): Promise<{ drafts: DraftProduct[]; rejected: RejectedEmail[] }> => {
    const emailBodies: { id: string; subject: string; from: string; date: string; body: string; bodyText: string }[] = []
    const rejected: RejectedEmail[] = []

    for (const email of batchEmails) {
      const emailType = classifyEmail(email.subject)
      if (emailType !== "order" && emailType !== "unknown") {
        rejected.push({ id: email.id, subject: email.subject, from: email.from, date: email.date, reason: emailType, bodyText: "" })
        continue
      }
      try {
        const html = await getMessageBody(token, email.id)
        emailBodies.push({ id: email.id, subject: email.subject, from: email.from, date: email.date, body: htmlToText(html), bodyText: htmlToText(html) })
      } catch (e) {
        if (e instanceof Error && e.message === "SESSION_EXPIRED") {
          setError("Session expired. Please reconnect.")
          setPhase("connect")
          return { drafts: [], rejected }
        }
        console.error(`Failed to fetch email ${email.id}:`, e)
      }
    }

    const batchDrafts: DraftProduct[] = []
    const apiBatchSize = 10

    for (let b = 0; b < emailBodies.length; b += apiBatchSize) {
      const apiBatch = emailBodies.slice(b, b + apiBatchSize)
      try {
        const res = await fetch("/api/parse-receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emails: apiBatch.map(e => ({ subject: e.subject, from: e.from, date: e.date, body: e.body })),
            categories: categories.map(c => ({ name: c.name, subcategories: subcategories.filter(s => s.category_id === c.id).map(s => s.name) })),
          }),
        })
        const data = await res.json()
        if (data.products && Array.isArray(data.products)) {
          for (const product of data.products) {
            const { categoryId, subcategoryId } = mapCategoryGuess(product.category || null, product.subcategory || null)
            const dupes = await store.checkDuplicates({ name: product.name, brand: product.brand || undefined })
            const duplicateWarning = dupes.exact.length > 0 ? `Exact match: ${dupes.exact[0].name}` : dupes.fuzzy.length > 0 ? `Similar: ${dupes.fuzzy[0].name}` : null
            const matchEmail = apiBatch.find(e => e.from.toLowerCase().includes((product.retailer || "").toLowerCase()) || e.subject.toLowerCase().includes((product.name || "").toLowerCase().slice(0, 20))) || apiBatch[0]
            batchDrafts.push({
              emailId: matchEmail.id, name: product.name || "", brand: product.brand || "",
              price: product.price?.toString() || "", retailer: product.retailer || "",
              order_id: product.order_id || "", purchase_date: product.purchase_date || "",
              category_id: categoryId, subcategory_id: subcategoryId, ownership: "mine",
              is_consumable: product.is_consumable || false, source_url: "",
              included: !duplicateWarning?.startsWith("Exact"), duplicateWarning,
              emailBody: matchEmail.bodyText, tags: [], location_id: bulkLocationId,
            })
          }
        }
      } catch (e) {
        console.error("Claude API error, falling back to regex:", e)
        for (const email of apiBatch) {
          const result = parseReceiptEmail(email.body, email.subject, email.from, email.date)
          for (const product of result.products) {
            const { categoryId, subcategoryId } = mapCategoryGuess(product.category_guess)
            const dupes = await store.checkDuplicates({ name: product.name, brand: product.brand || undefined })
            const duplicateWarning = dupes.exact.length > 0 ? `Exact match: ${dupes.exact[0].name}` : dupes.fuzzy.length > 0 ? `Similar: ${dupes.fuzzy[0].name}` : null
            batchDrafts.push({
              emailId: email.id, name: product.name, brand: product.brand || "",
              price: product.price?.toString() || "", retailer: product.retailer,
              order_id: product.order_id || "", purchase_date: product.purchase_date || "",
              category_id: categoryId, subcategory_id: subcategoryId, ownership: "mine",
              is_consumable: product.is_consumable, source_url: product.source_url || "",
              included: !duplicateWarning?.startsWith("Exact"), duplicateWarning,
              emailBody: email.bodyText, tags: [], location_id: bulkLocationId,
            })
          }
        }
      }
    }

    // Dedup: remove products with same name+price+order_id within this batch
    const seen = new Set<string>()
    const dedupedDrafts = batchDrafts.filter((d) => {
      const key = `${d.name.toLowerCase()}|${d.price}|${d.order_id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Emails with 0 products → rejected
    const draftEmailIds = new Set(dedupedDrafts.map((d) => d.emailId))
    for (const eb of emailBodies) {
      if (!draftEmailIds.has(eb.id)) {
        rejected.push({ id: eb.id, subject: eb.subject, from: eb.from, date: eb.date, reason: "0 products extracted", bodyText: eb.bodyText })
      }
    }
    return { drafts: dedupedDrafts, rejected }
  }

  // Current page's data
  const currentPageData = pages[currentPage]
  const drafts = currentPageData?.drafts ?? []
  const rejectedEmails = currentPageData?.rejected ?? []

  // Helpers to update current page's drafts/rejected (replaces old setState)
  const setDrafts = (updater: DraftProduct[] | ((prev: DraftProduct[]) => DraftProduct[])) => {
    setPages((prev) => prev.map((p, i) =>
      i === currentPage ? { ...p, drafts: typeof updater === "function" ? updater(p.drafts) : updater } : p
    ))
  }
  const setRejectedEmails = (updater: RejectedEmail[] | ((prev: RejectedEmail[]) => RejectedEmail[])) => {
    setPages((prev) => prev.map((p, i) =>
      i === currentPage ? { ...p, rejected: typeof updater === "function" ? updater(p.rejected) : updater } : p
    ))
  }

  const updateDraft = (index: number, field: keyof DraftProduct, value: string | boolean | string[]) => {
    setPages((prev) => prev.map((p, pi) =>
      pi === currentPage ? { ...p, drafts: p.drafts.map((d, i) => i === index ? { ...d, [field]: value } : d) } : p
    ))
  }

  const toggleTag = (index: number, tag: string) => {
    setPages((prev) => prev.map((p, pi) =>
      pi === currentPage ? {
        ...p,
        drafts: p.drafts.map((d, i) => {
          if (i !== index) return d
          const has = d.tags.includes(tag)
          return { ...d, tags: has ? d.tags.filter((t) => t !== tag) : [...d.tags, tag] }
        })
      } : p
    ))
  }

  const handleSave = async () => {
    const toSave = drafts.filter((d) => d.included)
    const emailIds = new Set<string>()
    let savedCount = 0

    for (const draft of toSave) {
      // Skip exact duplicates: same name + brand + order_id already exists
      const dupes = await store.checkDuplicates({
        name: draft.name,
        brand: draft.brand || undefined,
        sku: draft.order_id || undefined,
      })
      if (dupes.exact.length > 0) {
        console.log(`Skipping duplicate: ${draft.name} (order ${draft.order_id})`)
        emailIds.add(draft.emailId) // Still mark email as imported
        continue
      }

      const newProduct = await store.addProduct({
        name: draft.name, brand: draft.brand || undefined,
        category_id: draft.category_id, subcategory_id: draft.subcategory_id,
        price: draft.price ? parseFloat(draft.price) : undefined,
        retailer: draft.retailer || undefined, order_id: draft.order_id || undefined,
        purchase_date: draft.purchase_date || undefined, ownership: draft.ownership,
        is_consumable: draft.is_consumable || undefined, source_url: draft.source_url || undefined,
        visibility: "shared", status: "purchased", currency: "USD", tags: draft.tags,
      })
      if (draft.location_id) {
        await store.addProductToLocation({ product_id: newProduct.id, location_id: draft.location_id })
        localStorage.setItem("eyo_last_bin_id", draft.location_id)
      }
      emailIds.add(draft.emailId)
      savedCount++
    }

    await store.markEmailsImported([...emailIds])

    const logEntries = [
      ...toSave.map((d) => ({ gmail_message_id: d.emailId, email_subject: d.name, email_from: d.retailer, email_date: d.purchase_date, status: "imported" as const, products_extracted: 1 })),
      ...rejectedEmails.map((r) => ({ gmail_message_id: r.id, email_subject: r.subject, email_from: r.from, email_date: r.date, status: "rejected" as const, rejection_reason: r.reason, products_extracted: 0 })),
    ]
    if (logEntries.length > 0 && store.logProcessedEmails) {
      await store.logProcessedEmails(logEntries).catch(() => {})
    }

    // Mark page as saved and advance
    const updatedPages = pages.map((p, i) => i === currentPage ? { ...p, status: "saved" as const, savedCount } : p)
    setPages(updatedPages)

    // Save session to localStorage for resume
    try {
      const session = {
        pages: updatedPages.map((p) => ({ ...p, drafts: p.status === "saved" ? [] : p.drafts })), // don't store saved drafts
        currentPage,
        totalSaved: totalSaved + savedCount,
        timestamp: Date.now(),
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {}

    // Auto-advance to next unsaved page
    const nextUnsaved = updatedPages.findIndex((p, i) => i > currentPage && p.status === "ready")
    if (nextUnsaved !== -1) {
      setCurrentPage(nextUnsaved)
    } else if (updatedPages.every((p) => p.status === "saved" || p.status === "processing")) {
      setSaved(true)
      localStorage.removeItem(SESSION_KEY) // cleanup when done
    }
  }

  const includedCount = drafts.filter((d) => d.included).length
  const totalSaved = pages.reduce((sum, p) => sum + p.savedCount, 0)
  const totalProducts = pages.reduce((sum, p) => sum + p.drafts.length, 0)

  // --- Render helpers ---

  const formatFrom = (from: string) => {
    const match = from.match(/^"?([^"<]+)"?\s*</)
    return match ? match[1].trim() : from.split("@")[0]
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    } catch {
      return dateStr
    }
  }

  // --- Gmail CSV Export ---
  const handleExportCsv = async () => {
    const selected = emails.filter((e) => e.selected)
    if (selected.length === 0) return

    setPhase("review")
    setProcessing(true)
    setProcessProgress({ current: 0, total: selected.length })

    const csvRows: string[][] = [["name", "brand", "price", "retailer", "purchase_date", "category", "order_id", "quantity", "notes"]]

    for (let i = 0; i < selected.length; i++) {
      const email = selected[i]
      setProcessProgress({ current: i + 1, total: selected.length })

      const emailType = classifyEmail(email.subject)
      if (emailType !== "order" && emailType !== "unknown") continue

      try {
        const html = await getMessageBody(token, email.id)
        const result = parseReceiptEmail(html, email.subject, email.from, email.date)

        for (const product of result.products) {
          csvRows.push([
            product.name,
            product.brand || "",
            product.price?.toString() || "",
            product.retailer,
            product.purchase_date || "",
            product.category_guess || "",
            product.order_id || "",
            product.quantity?.toString() || "1",
            "",
          ])
        }
      } catch (e) {
        if (e instanceof Error && e.message === "SESSION_EXPIRED") {
          setError("Session expired. Please reconnect.")
          setPhase("connect")
          return
        }
        console.error(`Failed to process email ${email.id}:`, e)
      }
    }

    // Trigger download
    const csvContent = csvRows.map(row =>
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")
    ).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `receipt-products-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)

    setProcessing(false)
    setPhase("select")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {activeTab === "gmail" && phase !== "connect" && (
          <button
            onClick={() => {
              if (phase === "review" && !processing) setPhase("select")
              else if (phase === "select") setPhase("connect")
            }}
            className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        <h1 className="text-[20px] font-bold">Import Products</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab("gmail")}
          className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors ${
            activeTab === "gmail" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mail className="size-3.5 inline mr-1.5" />
          Gmail
        </button>
        <button
          onClick={() => setActiveTab("csv")}
          className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors ${
            activeTab === "csv" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="size-3.5 inline mr-1.5" />
          CSV Upload
        </button>
      </div>

      {/* CSV Tab */}
      {activeTab === "csv" && (
        <CsvImport categories={categories} subcategories={subcategories} store={store} />
      )}

      {/* Gmail Tab */}
      {activeTab === "gmail" && (<>


      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-4 py-3 text-[13px] text-red-700 dark:text-red-400">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
          <button onClick={() => setError("")} className="ml-auto">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Resume session banner */}
      {phase !== "review" && (() => {
        try {
          const raw = localStorage.getItem(SESSION_KEY)
          if (!raw) return null
          const session = JSON.parse(raw)
          const savedPages = (session.pages as BatchPage[]).filter((p) => p.status === "saved").length
          const totalPages = (session.pages as BatchPage[]).length
          const age = Date.now() - session.timestamp
          if (age > 24 * 60 * 60 * 1000) { localStorage.removeItem(SESSION_KEY); return null } // expire after 24h
          return (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between">
              <span className="text-[13px] text-amber-700">
                You have an unfinished import — {savedPages} of {totalPages} pages saved ({session.totalSaved} products)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPages(session.pages)
                    setCurrentPage(session.pages.findIndex((p: BatchPage) => p.status === "ready") ?? 0)
                    setPhase("review")
                  }}
                  className="rounded-lg bg-amber-600 px-3 py-1 text-[12px] font-medium text-white hover:bg-amber-700"
                >
                  Resume
                </button>
                <button
                  onClick={() => localStorage.removeItem(SESSION_KEY)}
                  className="rounded-lg border px-3 py-1 text-[12px] font-medium hover:bg-accent"
                >
                  Discard
                </button>
              </div>
            </div>
          )
        } catch { return null }
      })()}

      {/* Phase 1: Connect */}
      {phase === "connect" && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Mail className="size-8 text-primary" />
          </div>
          <h2 className="text-[15px] font-semibold mb-2">Connect your Gmail</h2>
          <p className="text-[13px] text-muted-foreground max-w-sm mb-6">
            We&apos;ll search your inbox for order confirmations and receipts.
            Only email content is read — nothing is stored on any server.
          </p>
          <button
            onClick={handleConnect}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:translate-y-px"
          >
            <Mail className="size-4" />
            Connect Gmail
          </button>
        </div>
      )}

      {/* Phase 2: Select Emails */}
      {phase === "select" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <select
                value={timeframe.includes("_") ? "custom" : timeframe}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === "custom") {
                    // Don't load yet — wait for date inputs
                    setTimeframe("custom")
                  } else {
                    handleTimeframeChange(v)
                  }
                }}
                className="rounded-lg border bg-card px-3 py-1.5 text-[13px] font-medium"
              >
                <option value="1m">Last month</option>
                <option value="3m">Last 3 months</option>
                <option value="6m">Last 6 months</option>
                <option value="1y">Last year</option>
                <option value="2y">Last 2 years</option>
                <option value="5y">Last 5 years</option>
                <option value="all">All time</option>
                <option value="custom">Custom range</option>
              </select>
              {(timeframe === "custom" || timeframe.includes("_")) && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={customAfter}
                    onChange={(e) => setCustomAfter(e.target.value)}
                    className="rounded-lg border bg-card px-2 py-1 text-[12px]"
                  />
                  <span className="text-[11px] text-muted-foreground">to</span>
                  <input
                    type="date"
                    value={customBefore}
                    onChange={(e) => setCustomBefore(e.target.value)}
                    className="rounded-lg border bg-card px-2 py-1 text-[12px]"
                  />
                  <button
                    onClick={() => {
                      if (customAfter && customBefore) {
                        // Ensure after < before, swap if needed
                        const [a, b] = customAfter < customBefore ? [customAfter, customBefore] : [customBefore, customAfter]
                        setCustomAfter(a)
                        setCustomBefore(b)
                        const tf = `${a}_${b}`
                        handleTimeframeChange(tf)
                      }
                    }}
                    disabled={!customAfter || !customBefore}
                    className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                  >
                    Go
                  </button>
                </div>
              )}
              <span className="text-[12px] text-muted-foreground">
                {loadingMore ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="size-3 animate-spin" />
                    Loading... {emails.length} emails so far
                  </span>
                ) : (
                  <>{emails.length} email{emails.length !== 1 ? "s" : ""} loaded</>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleAll(true)}
                className="text-[12px] text-primary hover:underline"
              >
                Select all
              </button>
              <span className="text-muted-foreground/30">|</span>
              <button
                onClick={() => toggleAll(false)}
                className="text-[12px] text-primary hover:underline"
              >
                None
              </button>
              <button
                onClick={handleProcess}
                disabled={selectedCount === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 ml-2"
              >
                Process {selectedCount}
              </button>
            </div>
          </div>

          {loadingMore && emails.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-[13px] text-muted-foreground">Searching inbox...</span>
            </div>
          ) : emails.length === 0 && !loadingMore ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mail className="size-10 text-muted-foreground/30 mb-3" />
              <p className="text-[13px] text-muted-foreground">No receipt emails found in this timeframe.</p>
            </div>
          ) : (
            <>
              {/* Import filter */}
              {(() => {
                const importedCount = emails.filter((e) => e.alreadyImported).length
                const newCount = emails.length - importedCount
                return (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] text-muted-foreground">
                      {emails.length} emails &middot; {newCount} new &middot; {importedCount} imported
                      {loadingMore && " (loading...)"}
                    </span>
                    <div className="flex gap-1">
                      {(["new", "imported", "all"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setEmailFilter(f)}
                          className={`text-[11px] font-medium px-2 py-1 rounded-lg transition-colors ${
                            emailFilter === f ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {f === "new" ? `New (${newCount})` : f === "imported" ? `Imported (${importedCount})` : `All (${emails.length})`}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}

              <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden divide-y">
                {emails.filter((e) => emailFilter === "all" ? true : emailFilter === "new" ? !e.alreadyImported : e.alreadyImported).map((email) => (
                  <label
                    key={email.id}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                      email.alreadyImported ? "opacity-60" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={email.selected}
                      onChange={() => toggleEmail(email.id)}
                      className="mt-1 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium truncate">{formatFrom(email.from)}</span>
                        {email.alreadyImported && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            Already imported
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-foreground truncate">{email.subject}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{email.snippet}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDate(email.date)}
                    </span>
                  </label>
                ))}
              </div>

              {loadingMore && (
                <div className="flex items-center justify-center py-3 text-[12px] text-muted-foreground gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading emails... ({emails.length} so far)
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-[12px] text-muted-foreground">
                  {selectedCount} email{selectedCount !== 1 ? "s" : ""} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCsv}
                    disabled={selectedCount === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[13px] font-medium text-foreground hover:bg-accent transition-colors active:translate-y-px disabled:opacity-50"
                  >
                    <Download className="size-3.5" />
                    Download CSV
                  </button>
                  <button
                    onClick={handleProcess}
                    disabled={selectedCount === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:translate-y-px disabled:opacity-50"
                  >
                    Process Selected
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Phase 3: Review & Save */}
      {phase === "review" && (
        <div className="space-y-4">
          {/* Global progress bar */}
          {!processingComplete && pages.length > 0 && (
            <div className="rounded-lg border bg-secondary/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-medium inline-flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  Processing {totalEmailsProcessed} of {selectedForProcessing.length} emails
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {pages.filter((p) => p.status === "ready" || p.status === "saved").length} of {pages.length} pages ready
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(totalEmailsProcessed / selectedForProcessing.length) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Page tabs */}
          {pages.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              {pages.map((p, i) => (
                <button
                  key={i}
                  onClick={() => p.status !== "processing" && setCurrentPage(i)}
                  disabled={p.status === "processing"}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    i === currentPage
                      ? "bg-primary text-primary-foreground"
                      : p.status === "saved"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : p.status === "ready"
                      ? "bg-secondary text-foreground hover:bg-accent"
                      : "bg-muted text-muted-foreground/50"
                  }`}
                >
                  {p.status === "saved" ? "✓ " : p.status === "processing" ? "⏳ " : ""}
                  Page {i + 1}
                  {p.status === "saved" && ` (${p.savedCount})`}
                  {p.status === "ready" && ` (${p.drafts.filter((d) => d.included).length})`}
                </button>
              ))}
            </div>
          )}

          {/* All done */}
          {saved && pages.every((p) => p.status === "saved") ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <CheckCircle className="size-7 text-emerald-500" />
              </div>
              <h2 className="text-[15px] font-semibold mb-2">
                {totalSaved} product{totalSaved !== 1 ? "s" : ""} imported from {pages.length} pages
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
                  onClick={() => {
                    setSaved(false)
                    setDrafts([])
                    setPhase("select")
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[13px] font-medium hover:bg-accent transition-colors"
                >
                  Import More
                </button>
              </div>
            </div>
          ) : currentPageData?.status === "processing" ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-primary mb-3" />
              <p className="text-[13px] font-medium">Processing page {currentPage + 1}...</p>
            </div>
          ) : drafts.length === 0 && pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="size-10 text-muted-foreground/30 mb-3" />
              <p className="text-[13px] text-muted-foreground">
                No products could be extracted from the selected emails.
              </p>
              <button
                onClick={() => setPhase("select")}
                className="mt-4 text-[13px] text-primary hover:underline"
              >
                Try different emails
              </button>
            </div>
          ) : (
            <>
              {/* Vendor filter dropdown */}
              <VendorFilter drafts={drafts} onToggle={(vendor, included) => {
                setDrafts((prev) => prev.map((d) => d.retailer === vendor ? { ...d, included } : d))
              }} />

              {/* Review tabs */}
              <div className="flex items-center gap-4 border-b">
                <button
                  onClick={() => setReviewTab("products")}
                  className={`pb-2 text-[13px] font-medium border-b-2 transition-colors ${
                    reviewTab === "products" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                  }`}
                >
                  Products ({drafts.filter((d) => d.included).length})
                </button>
                {rejectedEmails.length > 0 && (
                  <button
                    onClick={() => setReviewTab("rejected")}
                    className={`pb-2 text-[13px] font-medium border-b-2 transition-colors ${
                      reviewTab === "rejected" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                    }`}
                  >
                    Rejected ({rejectedEmails.length})
                  </button>
                )}
              </div>

              {/* Products tab */}
              {reviewTab === "products" && (<div>

              {/* Bulk location assignment */}
              {locationOptions.length > 0 && (
                <div className="rounded-lg border bg-secondary/30 p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] font-medium shrink-0">Set all to:</span>
                    <SearchableLocationPicker
                      locations={locationOptions}
                      value={bulkLocationId}
                      onChange={(id) => {
                        setBulkLocationId(id)
                        setDrafts((prev) => prev.map((d) => ({ ...d, location_id: id })))
                      }}
                      className="flex-1"
                    />
                  {(() => {
                    const lastBinId = typeof window !== "undefined" ? localStorage.getItem("eyo_last_bin_id") : null
                    const lastBin = lastBinId ? importLocations.find((l) => l.id === lastBinId) : null
                    return lastBin ? (
                      <button
                        type="button"
                        onClick={() => {
                          setBulkLocationId(lastBin.id)
                          setDrafts((prev) => prev.map((d) => ({ ...d, location_id: lastBin.id })))
                        }}
                        className="text-[11px] text-primary font-medium shrink-0 hover:underline"
                      >
                        Same as last
                      </button>
                    ) : null
                  })()}
                </div>
                </div>
              )}

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
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {draft.retailer}
                        </span>
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
                            const firstSub = subcategories.find((s) => s.category_id === catId)
                            updateDraft(i, "category_id", catId)
                            updateDraft(i, "subcategory_id", firstSub?.id || "")
                          }}
                          className="w-full rounded-lg border bg-background px-3 py-1.5 text-[13px]"
                        >
                          <option value="">Select category</option>
                          {categories.map((c) => (
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
                            .filter((s) => s.category_id === draft.category_id)
                            .map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground">Order ID</label>
                        <input
                          value={draft.order_id}
                          onChange={(e) => updateDraft(i, "order_id", e.target.value)}
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
                          {OWNERSHIP_OPTIONS.map((opt) => (
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
                      <span className="text-[12px] text-muted-foreground">Consumable (groceries, toiletries, etc.)</span>
                    </label>

                    <div className="flex flex-wrap gap-1.5">
                      {EXPENSE_TAGS.map((tag) => (
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

                    {/* Storage location */}
                    {locationOptions.length > 0 && (
                      <div>
                        <label className="text-[11px] text-muted-foreground">Storage Location</label>
                        <SearchableLocationPicker
                          locations={locationOptions}
                          value={draft.location_id}
                          onChange={(id) => updateDraft(i, "location_id", id)}
                          placeholder="Search locations..."
                        />
                      </div>
                    )}

                    {/* Show first product per email only gets the email body disclosure */}
                    {(i === 0 || drafts[i - 1]?.emailId !== draft.emailId) && draft.emailBody && (
                      <details className="group">
                        <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
                          <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
                          See full email
                        </summary>
                        <pre className="mt-2 p-3 rounded-lg bg-muted/50 text-[11px] text-muted-foreground whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto leading-relaxed">
                          {draft.emailBody}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>

              {/* Page save controls */}
              {currentPageData?.status === "ready" && (
              <div className="sticky bottom-0 z-10 rounded-lg border bg-card shadow-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[12px] text-muted-foreground">
                      Page {currentPage + 1} of {pages.length}: {includedCount} of {drafts.length} products
                    </span>
                    {totalSaved > 0 && (
                      <span className="text-[11px] text-muted-foreground ml-2">({totalSaved} saved total)</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {/* Save & Next = primary CTA when more pages exist */}
                    {pages.some((p, i) => i > currentPage && (p.status === "ready" || p.status === "processing")) ? (
                      <>
                        <button
                          onClick={handleSave}
                          disabled={includedCount === 0}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:translate-y-px disabled:opacity-50"
                        >
                          <Check className="size-3.5" />
                          Save & Next Page →
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleSave}
                        disabled={includedCount === 0}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:translate-y-px disabled:opacity-50"
                      >
                        <Check className="size-3.5" />
                        Save ({includedCount})
                      </button>
                    )}
                  </div>
                </div>
              </div>
              )}

              {currentPageData?.status === "saved" ? (
                <div className="rounded-lg border bg-emerald-500/10 p-3 text-center text-[13px] text-emerald-600 font-medium">
                  Page {currentPage + 1} saved ({currentPageData.savedCount} products)
                </div>
              ) : null}

              </div>
              )}
              {/* end products tab */}

              {/* Rejected tab */}
              {reviewTab === "rejected" && (
                <div className="space-y-3">
                  <p className="text-[12px] text-muted-foreground">
                    These emails were skipped because they didn&apos;t look like purchase receipts or no products could be extracted.
                  </p>
                  {rejectedEmails.length === 0 ? (
                    <div className="p-8 text-center text-[13px] text-muted-foreground">
                      No rejected emails in this batch.
                    </div>
                  ) : rejectedEmails.map((rej) => (
                    <div key={rej.id} className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-medium">{rej.subject}</p>
                          <p className="text-[11px] text-muted-foreground">{rej.from} &middot; {rej.date}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                          {rej.reason}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            // Re-parse: force parse the email body and add any products found
                            const parsed = parseReceiptEmail(rej.bodyText, rej.subject, rej.from, rej.date)
                            if (parsed.products.length > 0) {
                              const newDrafts: DraftProduct[] = parsed.products.map((p) => ({
                                emailId: rej.id,
                                name: p.name,
                                brand: p.brand || "",
                                price: p.price?.toString() || "",
                                retailer: p.retailer || rej.from.replace(/<.*>/, "").trim(),
                                order_id: p.order_id || "",
                                purchase_date: p.purchase_date || rej.date,
                                category_id: "",
                                subcategory_id: "",
                                ownership: "mine",
                                is_consumable: false,
                                source_url: "",
                                included: true,
                                duplicateWarning: null,
                                emailBody: rej.bodyText,
                                tags: [],
                                location_id: bulkLocationId,
                              }))
                              setDrafts((prev) => [...prev, ...newDrafts])
                              setRejectedEmails((prev) => prev.filter((r) => r.id !== rej.id))
                              setReviewTab("products")
                            } else {
                              alert("Still no products found in this email.")
                            }
                          }}
                          className="text-[11px] text-primary font-medium hover:underline"
                        >
                          Re-check
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // Add blank product manually from this email
                            const newDraft: DraftProduct = {
                              emailId: rej.id,
                              name: "",
                              brand: "",
                              price: "",
                              retailer: rej.from.replace(/<.*>/, "").trim(),
                              order_id: "",
                              purchase_date: rej.date,
                              category_id: "",
                              subcategory_id: "",
                              ownership: "mine",
                              is_consumable: false,
                              source_url: "",
                              included: true,
                              duplicateWarning: null,
                              emailBody: rej.bodyText,
                              tags: [],
                              location_id: bulkLocationId,
                            }
                            setDrafts((prev) => [...prev, newDraft])
                            setRejectedEmails((prev) => prev.filter((r) => r.id !== rej.id))
                            setReviewTab("products")
                          }}
                          className="text-[11px] text-muted-foreground font-medium hover:underline"
                        >
                          Add manually
                        </button>
                      </div>
                      {rej.bodyText && (
                        <details className="group">
                          <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                            <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
                            See email
                          </summary>
                          <pre className="mt-2 p-3 rounded-lg bg-muted/50 text-[11px] text-muted-foreground whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto leading-relaxed">
                            {rej.bodyText}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </>
          )}
        </div>
      )}
      </>)}
    </div>
  )
}
