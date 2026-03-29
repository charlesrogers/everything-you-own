"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronRight, Star, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ImageUpload } from "./image-upload"
import { Checkbox } from "@/components/ui/checkbox"
import { Product, ProductStatus, ProductCondition, ProductOwnership, Category, Subcategory, Location } from "@/lib/types"
import { STATUS_OPTIONS, CONDITION_OPTIONS, OWNERSHIP_OPTIONS, EXPENSE_TAGS } from "@/lib/constants"
import type { DuplicateResult } from "@/lib/store"
import { useStore } from "@/hooks/use-store"

interface ProductFormProps {
  product?: Product
  mode: "create" | "edit"
  /** If set, auto-assign the new product to this location after creation */
  assignToLocationId?: string | null
}

export function ProductForm({ product, mode, assignToLocationId }: ProductFormProps) {
  const router = useRouter()
  const store = useStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [filteredSubs, setFilteredSubs] = useState<Subcategory[]>([])

  const [showMore, setShowMore] = useState(false)
  const [showPhysical, setShowPhysical] = useState(false)
  const [showTracking, setShowTracking] = useState(false)

  const [duplicates, setDuplicates] = useState<DuplicateResult | null>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

  // Form state
  const [name, setName] = useState(product?.name || "")
  const [brand, setBrand] = useState(product?.brand || "")
  const [categoryId, setCategoryId] = useState(product?.category_id || "")
  const [subcategoryId, setSubcategoryId] = useState(product?.subcategory_id || "")
  const [quantity, setQuantity] = useState("1")
  const [price, setPrice] = useState(product?.price?.toString() || "")
  const [status, setStatus] = useState<ProductStatus>(product?.status || "purchased")
  const [imageUrl, setImageUrl] = useState(product?.image_url || "")
  const [thumbUrl, setThumbUrl] = useState("")

  // More details
  const [retailer, setRetailer] = useState(product?.retailer || "")
  const [sourceUrl, setSourceUrl] = useState(product?.source_url || "")
  const [purchaseDate, setPurchaseDate] = useState(product?.purchase_date || "")
  const [sku, setSku] = useState(product?.sku || "")
  const [description, setDescription] = useState(product?.description || "")
  const [originalPrice, setOriginalPrice] = useState(product?.original_price?.toString() || "")
  const [condition, setCondition] = useState<ProductCondition>(product?.condition || "new")
  const [rating, setRating] = useState(product?.rating || 0)

  // Physical
  const [material, setMaterial] = useState(product?.material || "")
  const [color, setColor] = useState(product?.color || "")
  const [size, setSize] = useState(product?.size || "")

  // Tracking
  const [returnByDate, setReturnByDate] = useState(product?.return_by_date || "")
  const [warrantyExpires, setWarrantyExpires] = useState(product?.warranty_expires || "")
  const [orderId, setOrderId] = useState(product?.order_id || "")
  const [ownership, setOwnership] = useState<ProductOwnership>(product?.ownership || "mine")
  const [isConsumable, setIsConsumable] = useState(product?.is_consumable || false)
  const [notes, setNotes] = useState(product?.notes || "")
  const [tagsInput, setTagsInput] = useState((product?.tags || []).join(", "))

  // Location picker state (for new products)
  const [allLocations, setAllLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(assignToLocationId ?? null)
  const [showLocationPicker, setShowLocationPicker] = useState(!!assignToLocationId)
  const LAST_BIN_KEY = "eyo_last_bin_id"

  useEffect(() => {
    // Load locations for picker
    if (mode === "create") {
      fetch("/api/storage").then((r) => r.json()).then((data) => {
        setAllLocations(data.locations ?? [])
      }).catch(() => {})
    }
  }, [mode])

  // Helper: get path for a location
  function getLocationPath(locId: string): string {
    const locMap = new Map(allLocations.map((l) => [l.id, l]))
    const parts: string[] = []
    let cur = locMap.get(locId)
    while (cur) {
      parts.unshift(cur.name)
      cur = cur.parent_id ? locMap.get(cur.parent_id) : undefined
    }
    return parts.join(" › ")
  }

  // Location groups for cascading picker
  const rooms = allLocations.filter((l) => l.location_type === "room")
  const bins = allLocations.filter((l) => l.unit_subtype === "bin")
  const lastBinId = typeof window !== "undefined" ? localStorage.getItem(LAST_BIN_KEY) : null
  const lastBin = lastBinId ? allLocations.find((l) => l.id === lastBinId) : null

  useEffect(() => {
    async function load() {
      try {
        const [cats, subs] = await Promise.all([
          store.getCategories(),
          store.getSubcategories(),
        ])
        setCategories(cats)
        setSubcategories(subs)
      } catch {
        // Auth may not be ready yet — categories are optional
      }
    }
    load()
  }, [store])

  useEffect(() => {
    setFilteredSubs(subcategories.filter((s) => s.category_id === categoryId))
    if (!subcategories.find((s) => s.id === subcategoryId && s.category_id === categoryId)) {
      setSubcategoryId("")
    }
  }, [categoryId, subcategories, subcategoryId])

  const [duplicateChecked, setDuplicateChecked] = useState(false)

  const runDuplicateCheck = useCallback(async () => {
    if (duplicateChecked) return
    if (!name && !sku && !sourceUrl) return
    const result = await store.checkDuplicates({
      name: name || undefined,
      brand: brand || undefined,
      sku: sku || undefined,
      source_url: sourceUrl || undefined,
      excludeId: product?.id,
    })
    if (result.exact.length > 0 || result.fuzzy.length > 0) {
      setDuplicates(result)
      setShowDuplicateDialog(true)
    }
  }, [store, name, brand, sku, sourceUrl, product?.id, duplicateChecked])

  const addAnotherRef = useRef(false)
  const [saving, setSaving] = useState(false)

  function resetForm() {
    setName("")
    setBrand("")
    setPrice("")
    setQuantity("1")
    setImageUrl("")
    setThumbUrl("")
    setRetailer("")
    setSourceUrl("")
    setPurchaseDate("")
    setSku("")
    setDescription("")
    setOriginalPrice("")
    setRating(0)
    setMaterial("")
    setColor("")
    setSize("")
    setReturnByDate("")
    setWarrantyExpires("")
    setOrderId("")
    setNotes("")
    setTagsInput("")
    setDuplicateChecked(false)
    setDuplicates(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)

    const data = {
      name,
      brand: brand || undefined,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      price: price ? parseFloat(price) : undefined,
      status,
      image_url: imageUrl || undefined,
      additional_images: [],
      retailer: retailer || undefined,
      source_url: sourceUrl || undefined,
      purchase_date: purchaseDate || undefined,
      sku: sku || undefined,
      upc: undefined,
      description: description || undefined,
      original_price: originalPrice ? parseFloat(originalPrice) : undefined,
      currency: "USD",
      condition,
      rating: rating || undefined,
      material: material || undefined,
      color: color || undefined,
      size: size || undefined,
      weight: undefined,
      weight_unit: undefined,
      volume: undefined,
      volume_unit: undefined,
      dimensions: undefined,
      return_by_date: returnByDate || undefined,
      warranty_expires: warrantyExpires || undefined,
      order_id: orderId || undefined,
      ownership,
      is_consumable: isConsumable || undefined,
      notes: notes || undefined,
      tags,
    }

    try {
      if (mode === "create") {
        const newProduct = await store.addProduct(data)
        const targetLocation = selectedLocationId || assignToLocationId
        if (targetLocation) {
          const qty = parseInt(quantity) || 1
          await store.addProductToLocation({ product_id: newProduct.id, location_id: targetLocation, quantity: qty })
          // Remember last bin for "same bin" button
          localStorage.setItem(LAST_BIN_KEY, targetLocation)
          if (addAnotherRef.current) {
            resetForm()
            addAnotherRef.current = false
            return
          }
          window.location.href = `/storage/${targetLocation}`
        } else {
          window.location.href = `/products/${newProduct.id}`
        }
      } else if (product) {
        await store.updateProduct(product.id, data)
        window.location.href = `/products/${product.id}`
      }
    } catch (err) {
      console.error("Failed to save product:", err)
    } finally {
      setSaving(false)
    }
  }

  const SectionToggle = ({
    label,
    open,
    onToggle,
  }: {
    label: string
    open: boolean
    onToggle: () => void
  }) => (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
    >
      {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
      {label}
    </button>
  )

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core fields - always visible */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-[13px]">Product Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={runDuplicateCheck}
                placeholder="e.g. Mejuri Bold Ring"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="brand" className="text-[13px]">Brand</Label>
                <Input
                  id="brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  onBlur={runDuplicateCheck}
                  placeholder="e.g. Mejuri"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price" className="text-[13px]">Price</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quantity" className="text-[13px]">Qty</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Category</Label>
                <Select value={categoryId} onValueChange={(v) => v && setCategoryId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category">
                      {categories.find((c) => c.id === categoryId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Subcategory</Label>
                <Select value={subcategoryId} onValueChange={(v) => v && setSubcategoryId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subcategory">
                      {filteredSubs.find((s) => s.id === subcategoryId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSubs.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px]">Status</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v as ProductStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[13px]">Image</Label>
            <ImageUpload
              value={imageUrl}
              onChange={(full, thumb) => {
                setImageUrl(full || "")
                setThumbUrl(thumb || "")
              }}
            />
          </div>
        </div>

        {/* More Details */}
        <div className="border-t pt-2">
          <SectionToggle label="More Details" open={showMore} onToggle={() => setShowMore(!showMore)} />
          {showMore && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="retailer" className="text-[13px]">Retailer</Label>
                  <Input
                    id="retailer"
                    value={retailer}
                    onChange={(e) => setRetailer(e.target.value)}
                    placeholder="e.g. Amazon, Sephora"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sku" className="text-[13px]">SKU</Label>
                  <Input
                    id="sku"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    onBlur={runDuplicateCheck}
                    placeholder="Product SKU"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sourceUrl" className="text-[13px]">Product URL</Label>
                <Input
                  id="sourceUrl"
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  onBlur={runDuplicateCheck}
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="purchaseDate" className="text-[13px]">Purchase Date</Label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="originalPrice" className="text-[13px]">Original Price</Label>
                  <Input
                    id="originalPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Condition</Label>
                  <Select value={condition} onValueChange={(v) => v && setCondition(v as ProductCondition)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Rating</Label>
                  <div className="flex gap-1 pt-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(rating === star ? 0 : star)}
                        className="transition-colors"
                      >
                        <Star
                          className={`size-5 ${
                            star <= rating
                              ? "fill-amber-500 text-amber-500"
                              : "text-muted-foreground/20 hover:text-amber-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-[13px]">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Product description or personal notes about it..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        {/* Physical Specs */}
        <div className="border-t pt-2">
          <SectionToggle label="Physical Specs" open={showPhysical} onToggle={() => setShowPhysical(!showPhysical)} />
          {showPhysical && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="material" className="text-[13px]">Material</Label>
                  <Input
                    id="material"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    placeholder="e.g. Gold, Cotton"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="color" className="text-[13px]">Color</Label>
                  <Input
                    id="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="e.g. Rose Gold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="size" className="text-[13px]">Size</Label>
                  <Input
                    id="size"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="e.g. S, 7, 32x30"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tracking */}
        <div className="border-t pt-2">
          <SectionToggle label="Tracking" open={showTracking} onToggle={() => setShowTracking(!showTracking)} />
          {showTracking && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="returnByDate" className="text-[13px]">Return By</Label>
                  <Input
                    id="returnByDate"
                    type="date"
                    value={returnByDate}
                    onChange={(e) => setReturnByDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="warrantyExpires" className="text-[13px]">Warranty Expires</Label>
                  <Input
                    id="warrantyExpires"
                    type="date"
                    value={warrantyExpires}
                    onChange={(e) => setWarrantyExpires(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="orderId" className="text-[13px]">Order ID</Label>
                  <Input
                    id="orderId"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="Retailer order number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Ownership</Label>
                  <Select value={ownership} onValueChange={(v) => v && setOwnership(v as ProductOwnership)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OWNERSHIP_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={isConsumable}
                  onCheckedChange={(v) => setIsConsumable(v === true)}
                />
                <span className="text-[13px] font-medium">Consumable</span>
                <span className="text-[11px] text-muted-foreground">(groceries, toiletries, etc.)</span>
              </label>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-[13px]">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Fit notes, care instructions, personal review..."
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[13px]">Expense Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_TAGS.map((tag) => {
                    const currentTags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean)
                    const active = currentTags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean)
                          if (active) {
                            setTagsInput(tags.filter((t) => t !== tag).join(", "))
                          } else {
                            setTagsInput([...tags, tag].join(", "))
                          }
                        }}
                        className={`px-2.5 py-1 rounded-4xl text-[11px] font-medium border transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary text-secondary-foreground border-border hover:bg-accent"
                        }`}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tags" className="text-[13px]">Custom Tags</Label>
                <Input
                  id="tags"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="gift idea, summer 2026, travel (comma-separated)"
                />
              </div>
            </div>
          )}
        </div>

        {/* Location picker — only for new products */}
        {mode === "create" && allLocations.length > 0 && (
          <div className="rounded-lg border bg-secondary/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium">Storage Location</label>
              {!showLocationPicker && (
                <button type="button" onClick={() => setShowLocationPicker(true)} className="text-[12px] text-primary font-medium">
                  Assign to bin
                </button>
              )}
            </div>
            {showLocationPicker && (
              <div className="space-y-2">
                {/* Last bin shortcut */}
                {lastBin && selectedLocationId !== lastBin.id && (
                  <button
                    type="button"
                    onClick={() => setSelectedLocationId(lastBin.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-left hover:bg-accent transition-colors"
                  >
                    <span className="text-[12px] text-primary font-medium">Same as last →</span>
                    <span className="text-[12px] text-muted-foreground truncate">{getLocationPath(lastBin.id)}</span>
                  </button>
                )}
                {/* Bin dropdown */}
                <select
                  value={selectedLocationId ?? ""}
                  onChange={(e) => setSelectedLocationId(e.target.value || null)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-[13px]"
                >
                  <option value="">No location (unsorted)</option>
                  {bins.map((bin) => (
                    <option key={bin.id} value={bin.id}>{getLocationPath(bin.id)}</option>
                  ))}
                </select>
                {selectedLocationId && (
                  <p className="text-[11px] text-muted-foreground">
                    Will be placed in: {getLocationPath(selectedLocationId)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t">
          <Button type="submit" className="flex-1 sm:flex-none" disabled={saving}>
            {saving ? "Saving…" : mode === "create" ? "Save" : "Save Changes"}
          </Button>
          {mode === "create" && assignToLocationId && (
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={(e) => {
                addAnotherRef.current = true
                const form = (e.target as HTMLElement).closest("form")
                if (form) form.requestSubmit()
              }}
            >
              Save & Add Another
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>

      {/* Duplicate Warning Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              {duplicates?.exact.length ? "Duplicate Found" : "Similar Products Found"}
            </DialogTitle>
            <DialogDescription>
              {duplicates?.exact.length
                ? "This product already exists in your collection."
                : "You may already have something similar."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {[...(duplicates?.exact || []), ...(duplicates?.fuzzy || [])].map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="size-10 rounded-md object-cover" />
                ) : (
                  <div className="size-10 rounded-md bg-muted" />
                )}
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.brand}
                    {p.price != null && ` · $${p.price.toFixed(2)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDuplicateDialog(false); setDuplicateChecked(true) }}>
              Got it, continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
