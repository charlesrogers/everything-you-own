"use client"

import { useState } from "react"
import { Plus, Package, Server, Inbox, Minus, DoorClosed, Grid3X3, GripHorizontal, Square, ChevronRight, Check } from "lucide-react"
import type { LocationType, UnitSubtype, CreateLocationInput } from "@/lib/wms-types"
import { SAMLA_BINS } from "@/lib/wms-constants"

// Context-aware options based on parent type
function getChildOptions(parentType: LocationType, parentSubtype: UnitSubtype | null): {
  label: string
  description: string
  type: LocationType
  subtype: UnitSubtype | null
  icon: React.ElementType
}[] {
  switch (parentType) {
    case "room":
      return [
        { label: "Wall / Area", description: "A wall, corner, or area of the room", type: "zone", subtype: null, icon: Grid3X3 },
        { label: "Rack", description: "Freestanding shelving rack (e.g., IKEA OMAR)", type: "unit", subtype: "rack", icon: Server },
        { label: "Cabinet / Tool Chest", description: "Multi-drawer tool chest or cabinet", type: "unit", subtype: "cabinet", icon: Inbox },
        { label: "Closet", description: "Built-in closet with shelves/rod", type: "unit", subtype: "closet", icon: DoorClosed },
        { label: "Pegboard / Wall Mount", description: "Pegboard, hooks, or wall-mounted storage", type: "unit", subtype: "pegboard", icon: Grid3X3 },
      ]
    case "zone":
      return [
        { label: "Rack", description: "Freestanding shelving rack", type: "unit", subtype: "rack", icon: Server },
        { label: "Cabinet / Tool Chest", description: "Multi-drawer tool chest or cabinet", type: "unit", subtype: "cabinet", icon: Inbox },
        { label: "Closet", description: "Built-in closet", type: "unit", subtype: "closet", icon: DoorClosed },
        { label: "Pegboard / Wall Mount", description: "Pegboard or wall-mounted organizer", type: "unit", subtype: "pegboard", icon: Grid3X3 },
        { label: "Floor Space", description: "Items sitting on the floor", type: "compartment", subtype: "floor", icon: Square },
      ]
    case "unit":
      if (parentSubtype === "rack") {
        return [
          { label: "Shelf", description: "A shelf on this rack", type: "compartment", subtype: "shelf", icon: Minus },
        ]
      }
      if (parentSubtype === "cabinet") {
        return [
          { label: "Drawer", description: "A drawer in this cabinet", type: "compartment", subtype: "drawer", icon: Inbox },
          { label: "Shelf", description: "A shelf in this cabinet", type: "compartment", subtype: "shelf", icon: Minus },
        ]
      }
      if (parentSubtype === "closet") {
        return [
          { label: "Shelf", description: "A shelf in this closet", type: "compartment", subtype: "shelf", icon: Minus },
          { label: "Hanging Rod", description: "Clothes hanging rod", type: "compartment", subtype: "hanging_rod", icon: GripHorizontal },
          { label: "Floor Space", description: "Floor of the closet", type: "compartment", subtype: "floor", icon: Square },
          { label: "Drawer", description: "A drawer in this closet", type: "compartment", subtype: "drawer", icon: Inbox },
        ]
      }
      return [
        { label: "Shelf", description: "A shelf or level", type: "compartment", subtype: "shelf", icon: Minus },
        { label: "Drawer", description: "A drawer", type: "compartment", subtype: "drawer", icon: Inbox },
        { label: "Bin / Box", description: "A storage bin or box", type: "compartment", subtype: "bin", icon: Package },
      ]
    case "compartment":
      return [
        { label: "Bin / Box", description: "A SAMLA bin or storage box", type: "compartment", subtype: "bin", icon: Package },
        { label: "Drawer", description: "A sub-drawer or divider", type: "compartment", subtype: "drawer", icon: Inbox },
      ]
    default:
      return []
  }
}

const SAMLA_DESCRIPTIVE: Record<string, { nickname: string; useCase: string }> = {
  samla_1gal:  { nickname: "Half-Width Bin",      useCase: "Fits 6 per OMAR shelf, stackable 2-high" },
  samla_3gal:  { nickname: "Full-Width Shallow",  useCase: "Fits 2 per OMAR shelf, stackable 2-high" },
  samla_6gal:  { nickname: "Standard Bin",        useCase: "Fits 2 per OMAR shelf, full shelf height" },
  samla_12gal: { nickname: "Double-Wide Bin",     useCase: "Fits 1 per OMAR shelf, full shelf height" },
  samla_15gal: { nickname: "Flat Crate",          useCase: "Too deep for OMAR — floor or wide shelves only" },
  samla_17gal: { nickname: "Tall Bin",            useCase: "Too tall for OMAR shelf — floor only" },
  samla_34gal: { nickname: "Extra-Large Bin",     useCase: "Too deep + tall for OMAR — floor only" },
}

const SAMLA_OPTIONS = SAMLA_BINS.map((bin) => {
  const info = SAMLA_DESCRIPTIVE[bin.id]
  return {
    id: bin.id,
    name: `${info?.nickname ?? bin.name} (${bin.volumeGal} gal)`,
    subtitle: `SAMLA ${bin.volumeGal} gal — ${bin.widthIn}" × ${bin.depthIn}" × ${bin.heightIn}"`,
    useCase: info?.useCase ?? "",
    widthIn: bin.widthIn,
    depthIn: bin.depthIn,
    heightIn: bin.heightIn,
  }
})

interface ParentContext {
  id: string
  type: LocationType
  subtype: UnitSubtype | null
  name: string
  childCount: number
}

interface AddSublocationFormProps {
  parentId: string
  parentType: LocationType
  parentSubtype: UnitSubtype | null
  parentName?: string
  existingChildCount: number
  onAdd: (input: CreateLocationInput) => Promise<string | void>
  onCancel: () => void
  /** Called to get child count + type info for a newly created location */
  onGetLocation?: (id: string) => Promise<{ location_type: LocationType; unit_subtype: UnitSubtype | null; name: string } | undefined>
}

export function AddSublocationForm({
  parentId,
  parentType,
  parentSubtype,
  parentName,
  existingChildCount,
  onAdd,
  onCancel,
  onGetLocation,
}: AddSublocationFormProps) {
  // Track context stack so we can drill in without navigating
  const [contextStack, setContextStack] = useState<ParentContext[]>([])
  const currentCtx: ParentContext = contextStack.length > 0
    ? contextStack[contextStack.length - 1]
    : { id: parentId, type: parentType, subtype: parentSubtype, name: parentName ?? "here", childCount: existingChildCount }

  const [step, setStep] = useState<"type" | "details">("type")
  const [selectedType, setSelectedType] = useState<LocationType | null>(null)
  const [selectedSubtype, setSelectedSubtype] = useState<UnitSubtype | null>(null)
  const [name, setName] = useState("")
  const [label, setLabel] = useState("")
  const [dimWidth, setDimWidth] = useState("")
  const [dimDepth, setDimDepth] = useState("")
  const [dimHeight, setDimHeight] = useState("")
  const [selectedBinTemplate, setSelectedBinTemplate] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [saving, setSaving] = useState(false)
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null)
  const [lastCreatedType, setLastCreatedType] = useState<LocationType | null>(null)
  const [lastCreatedSubtype, setLastCreatedSubtype] = useState<UnitSubtype | null>(null)
  const [lastCreatedName, setLastCreatedName] = useState("")
  const [showPostSave, setShowPostSave] = useState(false)

  const childOptions = getChildOptions(currentCtx.type, currentCtx.subtype)

  const handleSelectType = (type: LocationType, subtype: UnitSubtype | null) => {
    setSelectedType(type)
    setSelectedSubtype(subtype)

    // Auto-suggest name
    if (subtype === "shelf") {
      const num = currentCtx.childCount + 1
      setName(`Shelf ${num}`)
    } else if (subtype === "drawer") {
      const num = currentCtx.childCount + 1
      setName(`Drawer ${num}`)
    }

    setStep("details")
  }

  const handleBinSelect = (binId: string) => {
    setSelectedBinTemplate(binId)
    // Don't auto-fill name — let user type a descriptive name like "Holiday Decorations"
    setName("")
  }

  const handleSave = async () => {
    if (!selectedType || !name.trim()) return
    setSaving(true)

    const bin = selectedBinTemplate ? SAMLA_OPTIONS.find((b) => b.id === selectedBinTemplate) : null
    let lastId: string | null = null

    for (let i = 0; i < quantity; i++) {
      const suffix = quantity > 1 ? ` ${existingChildCount + i + 1}` : ""
      const itemName = quantity > 1 ? `${name.trim()}${suffix}` : name.trim()

      const result = await onAdd({
        parent_id: currentCtx.id,
        location_type: selectedType,
        unit_subtype: selectedSubtype,
        name: itemName,
        label: label.trim() || null,
        template_id: selectedBinTemplate,
        width_in: bin?.widthIn ?? (dimWidth ? parseFloat(dimWidth) : null),
        depth_in: bin?.depthIn ?? (dimDepth ? parseFloat(dimDepth) : null),
        height_in: bin?.heightIn ?? (dimHeight ? parseFloat(dimHeight) : null),
        sort_order: currentCtx.childCount + i,
      })
      if (result) lastId = result
    }

    setSaving(false)
    setLastCreatedId(lastId)
    setLastCreatedType(selectedType)
    setLastCreatedSubtype(selectedSubtype)
    setLastCreatedName(quantity > 1 ? `${name.trim()} ${currentCtx.childCount + quantity}` : name.trim())
    setShowPostSave(true)
  }

  const resetForm = () => {
    setShowPostSave(false)
    setLastCreatedId(null)
    setName("")
    setLabel("")
    setDimWidth("")
    setDimDepth("")
    setDimHeight("")
    setSelectedBinTemplate(null)
    setQuantity(1)
  }

  const handleAddAnother = () => {
    resetForm()
    // Stay on same step so they can quickly add more of the same kind
  }

  const handleGoInside = () => {
    if (!lastCreatedId || !lastCreatedType) return
    // Push current context onto stack and switch to the new child
    setContextStack((prev) => [
      ...prev,
      {
        id: lastCreatedId,
        type: lastCreatedType,
        subtype: lastCreatedSubtype,
        name: lastCreatedName,
        childCount: 0,
      },
    ])
    resetForm()
    setStep("type")
  }

  const handleGoBack = () => {
    setContextStack((prev) => prev.slice(0, -1))
    resetForm()
    setStep("type")
  }

  // Post-save: 3 options
  if (showPostSave) {
    // Determine what children could be added to the thing we just created
    const childLabel =
      lastCreatedSubtype === "rack" ? "shelves" :
      lastCreatedSubtype === "cabinet" ? "drawers" :
      lastCreatedSubtype === "shelf" ? "bins" :
      lastCreatedSubtype === "closet" ? "shelves / rod / floor" :
      lastCreatedType === "room" ? "zones & units" :
      lastCreatedType === "zone" ? "storage units" :
      "children"

    return (
      <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="text-[14px] font-semibold text-emerald-600">
            Added {lastCreatedName}!
          </h3>
        </div>
        <div className="p-3 space-y-2">
          <button
            onClick={handleAddAnother}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-accent transition-colors border"
          >
            <Plus className="size-4 text-primary shrink-0" />
            <div>
              <div className="text-[13px] font-medium">Add another to {currentCtx.name}</div>
              <div className="text-[11px] text-muted-foreground">Add more at this same level</div>
            </div>
          </button>
          {lastCreatedId && lastCreatedType && getChildOptions(lastCreatedType, lastCreatedSubtype).length > 0 && (
            <button
              onClick={handleGoInside}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-accent transition-colors border"
            >
              <ChevronRight className="size-4 text-primary shrink-0" />
              <div>
                <div className="text-[13px] font-medium">Add {childLabel} inside {lastCreatedName}</div>
                <div className="text-[11px] text-muted-foreground">Drill into what you just created</div>
              </div>
            </button>
          )}
          <button
            onClick={onCancel}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-accent transition-colors border"
          >
            <Check className="size-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-[13px] font-medium">Done</div>
              <div className="text-[11px] text-muted-foreground">Close this form</div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // Step 1: Pick type
  if (step === "type") {
    return (
      <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            {contextStack.length > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                <button onClick={handleGoBack} className="hover:text-foreground">
                  &larr; Back
                </button>
                <span className="mx-1">&middot;</span>
                <span>Adding to <strong className="text-foreground">{currentCtx.name}</strong></span>
              </div>
            )}
            <h3 className="text-[14px] font-semibold">What are you adding?</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-[12px] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
        <div className="p-2 space-y-1">
          {childOptions.map((opt) => (
            <button
              key={`${opt.type}-${opt.subtype}`}
              onClick={() => handleSelectType(opt.type, opt.subtype)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-accent transition-colors"
            >
              <div className="size-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                <opt.icon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-[13px] font-medium">{opt.label}</div>
                <div className="text-[11px] text-muted-foreground">{opt.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Step 2: Details
  const isBin = selectedSubtype === "bin"
  const isShelfOrDrawer = selectedSubtype === "shelf" || selectedSubtype === "drawer"

  return (
    <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">
          Add {selectedSubtype === "bin" ? "Bin" : selectedSubtype === "shelf" ? "Shelf" : selectedSubtype === "drawer" ? "Drawer" : "Location"}
        </h3>
        <button
          onClick={() => setStep("type")}
          className="text-[12px] text-muted-foreground hover:text-foreground"
        >
          Back
        </button>
      </div>
      <div className="p-4 space-y-4">
        {/* Bin template picker */}
        {isBin && (
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-2 block">
              Bin Type
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {SAMLA_OPTIONS.map((bin) => (
                <button
                  key={bin.id}
                  onClick={() => handleBinSelect(bin.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    selectedBinTemplate === bin.id
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-accent"
                  }`}
                >
                  <Package className={`size-4 shrink-0 ${selectedBinTemplate === bin.id ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">{bin.name}</div>
                    <div className="text-[11px] text-muted-foreground">{bin.subtitle}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5">{bin.useCase}</div>
                  </div>
                </button>
              ))}
              <button
                onClick={() => { setSelectedBinTemplate(null); setName("") }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                  selectedBinTemplate === null && name
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:bg-accent"
                }`}
              >
                <Package className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-[13px] font-medium">Custom bin or box</div>
                  <div className="text-[11px] text-muted-foreground">Any other container</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="text-[12px] font-medium text-muted-foreground mb-1 block">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isBin ? "e.g., Holiday Decorations" : isShelfOrDrawer ? "e.g., Shelf 1" : "e.g., North Wall"}
            className="w-full rounded-lg border bg-background px-3 py-2 text-[13px]"
          />
          {isBin && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Give it a descriptive name like &quot;Holiday Decorations&quot; or &quot;Tape &amp; Adhesives&quot;
            </p>
          )}
        </div>

        {/* Short label */}
        <div>
          <label className="text-[12px] font-medium text-muted-foreground mb-1 block">
            Short Label <span className="text-muted-foreground/50">(optional)</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., R1-S3-B2"
            className="w-full rounded-lg border bg-background px-3 py-2 text-[13px]"
          />
        </div>

        {/* Dimensions — for shelves, drawers, racks, and other non-bin types */}
        {!isBin && (
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
              Dimensions (inches) <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  step="0.25"
                  value={dimWidth}
                  onChange={(e) => setDimWidth(e.target.value)}
                  placeholder="Width"
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-[13px]"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  step="0.25"
                  value={dimDepth}
                  onChange={(e) => setDimDepth(e.target.value)}
                  placeholder="Depth"
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-[13px]"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  step="0.25"
                  value={dimHeight}
                  onChange={(e) => setDimHeight(e.target.value)}
                  placeholder="Height"
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-[13px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Quantity for batch creation */}
        {isShelfOrDrawer && (
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1 block">
              How many?
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setQuantity(n)
                    if (n > 1) setName(selectedSubtype === "shelf" ? "Shelf" : "Drawer")
                  }}
                  className={`size-9 rounded-lg border text-[13px] font-medium transition-colors ${
                    quantity === n ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {quantity > 1 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Will create {name} 1 through {name} {quantity}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            {saving ? "Adding..." : quantity > 1 ? `Add ${quantity} ${name}s` : `Add ${name.trim() || "Location"}`}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border px-4 py-2 text-[13px] font-medium hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
