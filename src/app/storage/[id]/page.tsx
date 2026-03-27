"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Plus, Trash2, Package, Nfc, Trash, Pencil, Check, X, ChevronDown, Copy, ClipboardCheck } from "lucide-react"
import { SAMLA_BINS } from "@/lib/wms-constants"

const SAMLA_OPTIONS = SAMLA_BINS.map((bin) => ({
  id: bin.id,
  name: `${bin.name} (${bin.volumeGal} gal)`,
  subtitle: `${bin.widthIn}" × ${bin.depthIn}" × ${bin.heightIn}"`,
  widthIn: bin.widthIn,
  depthIn: bin.depthIn,
  heightIn: bin.heightIn,
}))
import { useAuth } from "@/components/auth-provider"
import { useStore } from "@/hooks/use-store"
import { buildLocationTree } from "@/lib/wms-local-store"
import type {
  Location,
  LocationBreadcrumb,
  LocationTreeNode,
  ProductLocationWithProduct,
  CreateLocationInput,
} from "@/lib/wms-types"
import { LocationTree } from "@/components/location-tree"
import { AddSublocationForm } from "@/components/add-sublocation-form"
import { RackVisualization } from "@/components/rack-visualization"
import { RoomVisualization } from "@/components/room-visualization"

function getAllDescendants(parentId: string, allLocs: import("@/lib/wms-types").Location[]): import("@/lib/wms-types").Location[] {
  const directKids = allLocs.filter((l) => l.parent_id === parentId)
  const result = [...directKids]
  for (const kid of directKids) {
    result.push(...getAllDescendants(kid.id, allLocs))
  }
  return result
}

export default function LocationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isLoading: authLoading, householdId } = useAuth()
  const store = useStore()
  const locationId = params.id as string

  const [location, setLocation] = useState<Location | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<LocationBreadcrumb[]>([])
  const [children, setChildren] = useState<LocationTreeNode[]>([])
  const [childLocations, setChildLocations] = useState<Location[]>([])
  const [contents, setContents] = useState<ProductLocationWithProduct[]>([])
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [shelfItemsByPosition, setShelfItemsByPosition] = useState<Record<string, { front: Record<string, number>; back: Record<string, number> }>>({})
  const [loading, setLoading] = useState(true)
  const [showAddChild, setShowAddChild] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingDetails, setEditingDetails] = useState(false)
  const [copiedNfc, setCopiedNfc] = useState(false)
  const [editName, setEditName] = useState("")
  const [editLabel, setEditLabel] = useState("")
  const [editWidth, setEditWidth] = useState("")
  const [editDepth, setEditDepth] = useState("")
  const [editHeight, setEditHeight] = useState("")
  const [editBinTemplate, setEditBinTemplate] = useState<string | null>(null)
  const [showBinPicker, setShowBinPicker] = useState(false)

  const loadData = useCallback(async () => {
    if (authLoading) return
    try {
      // Single API call to colocated server — all data in one round trip
      const res = await fetch(`/api/storage?id=${locationId}`)
      const data = await res.json()
      const allLocs = data.locations ?? []
      const items = data.contents ?? []
      const counts = data.itemCounts ?? {}

      const loc = allLocs.find((l: Location) => l.id === locationId)
      if (!loc) {
        router.push("/storage")
        return
      }

      // Build breadcrumbs from the already-fetched locations
      const locMap = new Map(allLocs.map((l: Location) => [l.id, l]))
      const crumbs: LocationBreadcrumb[] = []
      let cur: Location | undefined = loc
      for (let i = 0; i < 10 && cur; i++) {
        crumbs.unshift({ id: cur.id, name: cur.name, location_type: cur.location_type, label: cur.label })
        cur = cur.parent_id ? (locMap.get(cur.parent_id) as Location | undefined) : undefined
      }

      setLocation(loc)
      setBreadcrumbs(crumbs)
      setContents(items)
      setItemCounts(counts)
      setShelfItemsByPosition(data.shelfItemsByPosition ?? {})

      const kids = allLocs.filter((l: Location) => l.parent_id === locationId)
      setChildLocations(kids)
      const allDescendants = getAllDescendants(locationId, allLocs)
      setChildren(buildLocationTree(allDescendants))
    } catch (err) {
      console.error("Failed to load location:", err)
    } finally {
      setLoading(false)
    }
  }, [locationId, router, authLoading, householdId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRemoveItem = async (plId: string) => {
    await store.removeProductFromLocation(plId)
    loadData()
  }

  const handleAddChild = async (input: CreateLocationInput): Promise<string> => {
    const loc = await store.createLocation(input)
    await loadData()
    return loc.id
  }

  const handleDeleteLocation = async (id: string) => {
    await store.deleteLocation(id)
    if (id === locationId) {
      // Deleted self — go to parent or storage root
      const parent = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null
      router.push(parent ? `/storage/${parent.id}` : "/storage")
    } else {
      setConfirmDelete(null)
      await loadData()
    }
  }

  const handleReorderShelves = async (shelfIds: string[]) => {
    for (let i = 0; i < shelfIds.length; i++) {
      await store.updateLocation(shelfIds[i], { sort_order: i })
    }
    await loadData()
  }

  const handleReorderBins = async (shelfId: string, binIds: string[]) => {
    for (let i = 0; i < binIds.length; i++) {
      await store.updateLocation(binIds[i], { sort_order: i })
    }
    await loadData()
  }

  const handleReorderChildren = async (orderedIds: string[]) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await store.updateLocation(orderedIds[i], { sort_order: i })
    }
    await loadData()
  }

  const startEditing = () => {
    if (!location) return
    setEditName(location.name)
    setEditLabel(location.label ?? "")
    setEditWidth(location.width_in?.toString() ?? "")
    setEditDepth(location.depth_in?.toString() ?? "")
    setEditHeight(location.height_in?.toString() ?? "")
    setEditBinTemplate(location.template_id)
    setShowBinPicker(false)
    setEditingDetails(true)
  }

  const saveDetails = async () => {
    const bin = editBinTemplate ? SAMLA_OPTIONS.find((b) => b.id === editBinTemplate) : null
    await store.updateLocation(locationId, {
      name: editName.trim() || location!.name,
      label: editLabel.trim() || null,
      template_id: editBinTemplate,
      width_in: bin?.widthIn ?? (editWidth ? parseFloat(editWidth) : null),
      depth_in: bin?.depthIn ?? (editDepth ? parseFloat(editDepth) : null),
      height_in: bin?.heightIn ?? (editHeight ? parseFloat(editHeight) : null),
    })
    setEditingDetails(false)
    await loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-[13px]">
        Loading...
      </div>
    )
  }

  if (!location) return null

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-[12px] text-muted-foreground flex-wrap">
        <Link href="/storage" className="hover:text-foreground transition-colors">
          Storage
        </Link>
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="size-3" />
            {i === breadcrumbs.length - 1 ? (
              <span className="text-foreground font-medium">{crumb.name}</span>
            ) : (
              <Link href={`/storage/${crumb.id}`} className="hover:text-foreground transition-colors">
                {crumb.name}
              </Link>
            )}
          </span>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {editingDetails ? (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-lg border bg-background px-3 py-1.5 text-[15px] font-semibold w-64"
                  autoFocus
                />
              </div>

              {/* Bin template picker — only for bins */}
              {location.unit_subtype === "bin" && (
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Bin Type</label>
                  <button
                    type="button"
                    onClick={() => setShowBinPicker(!showBinPicker)}
                    className="w-full max-w-xs flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-[13px] hover:bg-accent transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Package className="size-3.5 text-muted-foreground" />
                      {editBinTemplate
                        ? SAMLA_OPTIONS.find((b) => b.id === editBinTemplate)?.name ?? "Unknown"
                        : "Custom bin"}
                    </span>
                    <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${showBinPicker ? "rotate-180" : ""}`} />
                  </button>
                  {showBinPicker && (
                    <div className="mt-1.5 rounded-lg border bg-card shadow-md shadow-black/[0.08] overflow-hidden max-w-xs">
                      {SAMLA_OPTIONS.map((bin) => (
                        <button
                          key={bin.id}
                          onClick={() => {
                            setEditBinTemplate(bin.id)
                            setEditWidth(bin.widthIn.toString())
                            setEditDepth(bin.depthIn.toString())
                            setEditHeight(bin.heightIn.toString())
                            setShowBinPicker(false)
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent transition-colors ${
                            editBinTemplate === bin.id ? "bg-primary/5" : ""
                          }`}
                        >
                          <Package className={`size-3.5 shrink-0 ${editBinTemplate === bin.id ? "text-primary" : "text-muted-foreground"}`} />
                          <div>
                            <div className="text-[12px] font-medium">{bin.name}</div>
                            <div className="text-[10px] text-muted-foreground">{bin.subtitle}</div>
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setEditBinTemplate(null)
                          setShowBinPicker(false)
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent border-t transition-colors ${
                          editBinTemplate === null ? "bg-primary/5" : ""
                        }`}
                      >
                        <Package className={`size-3.5 shrink-0 ${editBinTemplate === null ? "text-primary" : "text-muted-foreground"}`} />
                        <div>
                          <div className="text-[12px] font-medium">Custom bin or box</div>
                          <div className="text-[10px] text-muted-foreground">Enter dimensions manually</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Short Label</label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="e.g., R1-S3"
                  className="rounded-lg border bg-background px-3 py-1.5 text-[13px] font-mono w-40"
                />
              </div>
              {/* Dimensions — hidden when a SAMLA template is selected */}
              {!(location.unit_subtype === "bin" && editBinTemplate) && (
                <div className="flex gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Width (in)</label>
                    <input
                      type="number"
                      step="0.25"
                      value={editWidth}
                      onChange={(e) => setEditWidth(e.target.value)}
                      placeholder="—"
                      className="rounded-lg border bg-background px-3 py-1.5 text-[13px] w-24"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Depth (in)</label>
                    <input
                      type="number"
                      step="0.25"
                      value={editDepth}
                      onChange={(e) => setEditDepth(e.target.value)}
                      placeholder="—"
                      className="rounded-lg border bg-background px-3 py-1.5 text-[13px] w-24"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Height (in)</label>
                    <input
                      type="number"
                      step="0.25"
                      value={editHeight}
                      onChange={(e) => setEditHeight(e.target.value)}
                      placeholder="—"
                      className="rounded-lg border bg-background px-3 py-1.5 text-[13px] w-24"
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={saveDetails}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Check className="size-3" />
                  Save
                </button>
                <button
                  onClick={() => setEditingDetails(false)}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[12px] font-medium hover:bg-accent transition-colors"
                >
                  <X className="size-3" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h1 className="text-[20px] font-bold">{location.name}</h1>
                {location.label && (
                  <span className="text-[11px] font-mono bg-secondary text-muted-foreground px-2 py-0.5 rounded">
                    {location.label}
                  </span>
                )}
                <button
                  onClick={startEditing}
                  className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Edit details"
                >
                  <Pencil className="size-3" />
                </button>
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {location.location_type}
                {location.unit_subtype ? ` \u00b7 ${location.unit_subtype}` : ""}
                {location.width_in && location.depth_in
                  ? ` \u00b7 ${location.width_in}\u2033 \u00d7 ${location.depth_in}\u2033${location.height_in ? ` \u00d7 ${location.height_in}\u2033` : ""}`
                  : ""}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {location.short_id && (
            <button
              onClick={() => {
                const url = `https://stuff.imprevista.com/s/${location.short_id}`
                navigator.clipboard.writeText(url)
                setCopiedNfc(true)
                setTimeout(() => setCopiedNfc(false), 2000)
              }}
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                copiedNfc
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                  : "bg-secondary border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
              title="Copy NFC URL for NFC Tools app"
            >
              {copiedNfc ? <ClipboardCheck className="size-3" /> : <Copy className="size-3" />}
              {copiedNfc ? "Copied!" : "Copy NFC URL"}
            </button>
          )}
          {location.nfc_tag_id && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded-full">
              <Nfc className="size-3" />
              Tagged
            </span>
          )}
          {confirmDelete === locationId ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-destructive">Delete this and all children?</span>
              <button
                onClick={() => handleDeleteLocation(locationId)}
                className="rounded-lg bg-destructive px-2.5 py-1 text-[11px] font-medium text-white hover:bg-destructive/90 transition-colors"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border px-2.5 py-1 text-[11px] font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(locationId)}
              className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete location"
            >
              <Trash className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Visual layout — rooms show rack diagrams, racks show shelf/bin layout */}
      {location.location_type === "room" && children.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-4">
          <RoomVisualization room={{ ...location, children }} itemCounts={itemCounts} />
        </div>
      )}
      {location.unit_subtype === "rack" && children.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-4 flex justify-center">
          <div className="w-full max-w-md">
            <RackVisualization
              rack={{ ...location, children }}
              itemCounts={itemCounts}
              shelfItems={shelfItemsByPosition}
              onReorderShelves={handleReorderShelves}
              onReorderBins={handleReorderBins}
            />
          </div>
        </div>
      )}

      {/* Sub-locations */}
      <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">
            {location.location_type === "room" ? "Zones & Units" :
             location.location_type === "zone" ? "Storage Units" :
             location.location_type === "unit" ? "Shelves & Drawers" :
             "Contents"}
            {children.length > 0 && ` (${children.length})`}
          </h2>
          {!showAddChild && (
            <button
              onClick={() => setShowAddChild(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="size-3" />
              Add
            </button>
          )}
        </div>

        {/* Add sub-location form */}
        {showAddChild && (
          <div className="p-3 border-b bg-accent/30">
            <AddSublocationForm
              parentId={locationId}
              parentType={location.location_type}
              parentSubtype={location.unit_subtype}
              parentName={location.name}
              existingChildCount={childLocations.length}
              onAdd={handleAddChild}
              onCancel={() => setShowAddChild(false)}
            />
          </div>
        )}

        {children.length === 0 && !showAddChild ? (
          <div className="p-8 text-center">
            <p className="text-[13px] text-muted-foreground mb-3">
              {location.location_type === "room"
                ? "Add walls, areas, or storage units to this room."
                : location.location_type === "zone"
                ? "Add racks, cabinets, or closets to this area."
                : location.unit_subtype === "rack"
                ? "Add shelves to this rack."
                : location.unit_subtype === "shelf"
                ? "Add bins or boxes to this shelf."
                : "Add sub-locations to organize this space."}
            </p>
            <button
              onClick={() => setShowAddChild(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="size-3.5" />
              {location.unit_subtype === "rack" ? "Add Shelves" :
               location.unit_subtype === "shelf" ? "Add Bins" :
               location.location_type === "room" ? "Add Zone or Unit" :
               "Add Sub-location"}
            </button>
          </div>
        ) : children.length > 0 ? (
          <div className="p-2">
            <LocationTree tree={children} itemCounts={itemCounts} onDelete={handleDeleteLocation} onReorder={handleReorderChildren} />
          </div>
        ) : null}
      </div>

      {/* Items — only show on leaf-ish locations (shelves, bins, drawers) */}
      {(location.location_type === "compartment" || children.length === 0) && (() => {
        const isShelf = location.unit_subtype === "shelf"
        const hasPositionedItems = isShelf && contents.some((c) => c.depth_row === "back" || c.col_index != null)

        // Group items by position for shelves
        const frontItems = hasPositionedItems ? contents.filter((c) => (c.depth_row ?? "front") === "front") : []
        const backItems = hasPositionedItems ? contents.filter((c) => c.depth_row === "back") : []

        const renderItem = (item: ProductLocationWithProduct) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
          >
            {item.product_image_url ? (
              <img
                src={item.product_image_url}
                alt={item.product_name}
                className="size-10 rounded-lg object-cover border"
              />
            ) : (
              <div className="size-10 rounded-lg bg-secondary flex items-center justify-center">
                <Package className="size-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/products/${item.product_id}`}
                  className="text-[13px] font-medium text-foreground hover:text-primary truncate"
                >
                  {item.product_name}
                </Link>
                {hasPositionedItems && item.col_index != null && (
                  <span className="text-[9px] font-mono bg-secondary text-muted-foreground px-1 py-0.5 rounded shrink-0">
                    C{item.col_index + 1}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {item.product_brand && <span>{item.product_brand} &middot; </span>}
                qty: {item.quantity}
                {item.is_consumable && item.consumable_quantity != null && (
                  <span>
                    {" "}&middot; {item.consumable_quantity} {item.consumable_unit ?? "units"} left
                  </span>
                )}
              </div>
            </div>
            {item.product_price != null && (
              <span className="text-[12px] text-muted-foreground">
                ${item.product_price.toFixed(2)}
              </span>
            )}
            <button
              onClick={() => handleRemoveItem(item.id)}
              className="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Remove from location"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )

        return (
          <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-[14px] font-semibold">
                Items ({contents.length})
              </h2>
              <Link
                href={`/storage/${locationId}/add`}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] font-medium hover:bg-accent transition-colors"
              >
                <Plus className="size-3" />
                Add Item
              </Link>
            </div>

            {contents.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-muted-foreground">
                <Package className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                No items here yet.
                <div className="mt-3">
                  <Link
                    href={`/storage/${locationId}/add`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="size-3.5" />
                    Add Items
                  </Link>
                </div>
              </div>
            ) : hasPositionedItems ? (
              <div>
                {frontItems.length > 0 && (
                  <div>
                    <div className="px-4 py-1.5 bg-secondary/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Front row
                    </div>
                    <div className="divide-y">
                      {frontItems.map(renderItem)}
                    </div>
                  </div>
                )}
                {backItems.length > 0 && (
                  <div>
                    <div className="px-4 py-1.5 bg-secondary/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-t">
                      Back row
                    </div>
                    <div className="divide-y">
                      {backItems.map(renderItem)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {contents.map(renderItem)}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
