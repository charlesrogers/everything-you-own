"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Mail, CheckCircle, AlertTriangle, Loader2, ChevronLeft,
  Package, Check, X,
} from "lucide-react"
import {
  loadGisScript, requestGmailAccess, searchReceipts, batchGetMetadata,
  getMessageBody, getImportedEmailIds, markEmailsImported,
} from "@/lib/gmail"
import type { GmailMessageMeta } from "@/lib/gmail"
import { parseReceiptEmail } from "@/lib/receipt-parser"
import { addProduct, getCategories, getSubcategories, checkDuplicates } from "@/lib/store"
import type { Category, Subcategory } from "@/lib/types"

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
  included: boolean
  duplicateWarning: string | null
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""

export default function ImportPage() {
  const [phase, setPhase] = useState<Phase>("connect")
  const [token, setToken] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Phase 2: Select
  const [emails, setEmails] = useState<EmailEntry[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | undefined>()
  const [timeframe, setTimeframe] = useState("1y")
  const [loadingMore, setLoadingMore] = useState(false)

  // Phase 3: Review
  const [drafts, setDrafts] = useState<DraftProduct[]>([])
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 })
  const [processing, setProcessing] = useState(false)
  const [saved, setSaved] = useState(false)

  // Shared
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])

  useEffect(() => {
    setCategories(getCategories())
    setSubcategories(getSubcategories())
  }, [])

  // --- Phase 1: Connect ---

  const handleConnect = async () => {
    setError("")
    setLoading(true)
    try {
      await loadGisScript()
      const accessToken = await requestGmailAccess(CLIENT_ID)
      setToken(accessToken)
      setPhase("select")
      await loadEmails(accessToken, timeframe)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect to Gmail")
    } finally {
      setLoading(false)
    }
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
      const imported = getImportedEmailIds()
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
      setError(e instanceof Error ? e.message : "Failed to load emails")
    } finally {
      setLoadingMore(false)
    }
  }

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf)
    setEmails([])
    setNextPageToken(undefined)
    loadEmails(token, tf)
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
    (guess: string | null): { categoryId: string; subcategoryId: string } => {
      if (guess) {
        const cat = categories.find((c) => c.name.toLowerCase() === guess.toLowerCase())
        if (cat) {
          const sub = subcategories.find((s) => s.category_id === cat.id)
          return { categoryId: cat.id, subcategoryId: sub?.id || "" }
        }
      }
      const fallback = categories[0]
      const fallbackSub = fallback ? subcategories.find((s) => s.category_id === fallback.id) : null
      return { categoryId: fallback?.id || "", subcategoryId: fallbackSub?.id || "" }
    },
    [categories, subcategories]
  )

  const handleProcess = async () => {
    const selected = emails.filter((e) => e.selected)
    if (selected.length === 0) return

    setPhase("review")
    setProcessing(true)
    setProcessProgress({ current: 0, total: selected.length })
    const allDrafts: DraftProduct[] = []

    for (let i = 0; i < selected.length; i++) {
      const email = selected[i]
      setProcessProgress({ current: i + 1, total: selected.length })

      try {
        const html = await getMessageBody(token, email.id)
        const result = parseReceiptEmail(html, email.subject, email.from, email.date)

        for (const product of result.products) {
          const { categoryId, subcategoryId } = mapCategoryGuess(product.category_guess)

          // Check for duplicates
          const dupes = checkDuplicates({ name: product.name, brand: product.brand || undefined })
          const duplicateWarning =
            dupes.exact.length > 0
              ? `Exact match: ${dupes.exact[0].name}`
              : dupes.fuzzy.length > 0
                ? `Similar: ${dupes.fuzzy[0].name}`
                : null

          allDrafts.push({
            emailId: email.id,
            name: product.name,
            brand: product.brand || "",
            price: product.price?.toString() || "",
            retailer: product.retailer,
            order_id: product.order_id || "",
            purchase_date: product.purchase_date || "",
            category_id: categoryId,
            subcategory_id: subcategoryId,
            included: !duplicateWarning?.startsWith("Exact"),
            duplicateWarning,
          })
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

    setDrafts(allDrafts)
    setProcessing(false)
  }

  const updateDraft = (index: number, field: keyof DraftProduct, value: string | boolean) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)))
  }

  const handleSave = () => {
    const toSave = drafts.filter((d) => d.included)
    const emailIds = new Set<string>()

    for (const draft of toSave) {
      addProduct({
        name: draft.name,
        brand: draft.brand || undefined,
        category_id: draft.category_id,
        subcategory_id: draft.subcategory_id,
        price: draft.price ? parseFloat(draft.price) : undefined,
        retailer: draft.retailer || undefined,
        order_id: draft.order_id || undefined,
        purchase_date: draft.purchase_date || undefined,
        status: "purchased",
        currency: "USD",
        tags: [],
      })
      emailIds.add(draft.emailId)
    }

    markEmailsImported([...emailIds])
    setSaved(true)
  }

  const includedCount = drafts.filter((d) => d.included).length

  // --- Render ---

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {phase !== "connect" && (
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
        <h1 className="text-[20px] font-bold">Import from Gmail</h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-4 py-3 text-[13px] text-red-700 dark:text-red-400">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
          <button onClick={() => setError("")} className="ml-auto">
            <X className="size-3.5" />
          </button>
        </div>
      )}

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
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:translate-y-px disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            {loading ? "Connecting..." : "Connect Gmail"}
          </button>
        </div>
      )}

      {/* Phase 2: Select Emails */}
      {phase === "select" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <select
                value={timeframe}
                onChange={(e) => handleTimeframeChange(e.target.value)}
                className="rounded-lg border bg-card px-3 py-1.5 text-[13px] font-medium"
              >
                <option value="3m">Last 3 months</option>
                <option value="6m">Last 6 months</option>
                <option value="1y">Last year</option>
                <option value="2y">Last 2 years</option>
              </select>
              <span className="text-[12px] text-muted-foreground">
                {emails.length} email{emails.length !== 1 ? "s" : ""} found
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
            </div>
          </div>

          {loadingMore && emails.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-[13px] text-muted-foreground">Searching inbox...</span>
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mail className="size-10 text-muted-foreground/30 mb-3" />
              <p className="text-[13px] text-muted-foreground">No receipt emails found in this timeframe.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden divide-y">
                {emails.map((email) => (
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

              {nextPageToken && (
                <button
                  onClick={() => loadEmails(token, timeframe, nextPageToken)}
                  disabled={loadingMore}
                  className="w-full rounded-lg border bg-card px-4 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-3.5 animate-spin" /> Loading...
                    </span>
                  ) : (
                    "Load more"
                  )}
                </button>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-[12px] text-muted-foreground">
                  {selectedCount} email{selectedCount !== 1 ? "s" : ""} selected
                </span>
                <button
                  onClick={handleProcess}
                  disabled={selectedCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:translate-y-px disabled:opacity-50"
                >
                  Process Selected
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Phase 3: Review & Save */}
      {phase === "review" && (
        <div className="space-y-4">
          {processing ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-primary mb-3" />
              <p className="text-[13px] font-medium">
                Processing {processProgress.current} of {processProgress.total} emails...
              </p>
              <div className="w-48 h-1.5 bg-muted rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(processProgress.current / processProgress.total) * 100}%` }}
                />
              </div>
            </div>
          ) : saved ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <CheckCircle className="size-7 text-emerald-500" />
              </div>
              <h2 className="text-[15px] font-semibold mb-2">
                {includedCount} product{includedCount !== 1 ? "s" : ""} imported
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
          ) : drafts.length === 0 ? (
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
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-muted-foreground">
                  {drafts.length} product{drafts.length !== 1 ? "s" : ""} extracted — review before saving
                </p>
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
            </>
          )}
        </div>
      )}
    </div>
  )
}
