"use client"

import { useState } from "react"
import Link from "next/link"
import { GripVertical, GripHorizontal } from "lucide-react"
import type { LocationTreeNode } from "@/lib/wms-types"
import { getEffectiveDimensions, getShelfHeight } from "@/lib/wms-dimensions"

interface RackVisualizationProps {
  rack: LocationTreeNode
  itemCounts: Record<string, number>
  compact?: boolean
  onReorderShelves?: (shelfIds: string[]) => void
  onReorderBins?: (shelfId: string, binIds: string[]) => void
}

export function RackVisualization({ rack, itemCounts, compact = false, onReorderShelves, onReorderBins }: RackVisualizationProps) {
  const rackDims = getEffectiveDimensions(rack)
  const rackWidth = rackDims.width ?? 36.25

  const [shelves, setShelves] = useState(() =>
    rack.children
      .filter((c) => c.unit_subtype === "shelf" || c.location_type === "compartment")
      .sort((a, b) => a.sort_order - b.sort_order)
  )

  // Shelf drag state
  const [dragShelfId, setDragShelfId] = useState<string | null>(null)
  const [dragOverShelfId, setDragOverShelfId] = useState<string | null>(null)

  // Bin drag state
  const [dragBinId, setDragBinId] = useState<string | null>(null)
  const [dragOverBinId, setDragOverBinId] = useState<string | null>(null)
  const [dragBinShelfId, setDragBinShelfId] = useState<string | null>(null)

  // Update shelves when rack children change
  const currentShelves = rack.children
    .filter((c) => c.unit_subtype === "shelf" || c.location_type === "compartment")
    .sort((a, b) => a.sort_order - b.sort_order)

  // Use currentShelves for rendering (shelves state is only for mid-drag preview)
  const displayShelves = dragShelfId ? shelves : currentShelves
  const shelfCount = displayShelves.length
  const PX_PER_INCH = compact ? 3 : 4.5
  const MIN_SHELF_HEIGHT = compact ? 28 : 40
  const MIN_BIN_WIDTH = compact ? 20 : 32

  const handleShelfDragStart = (shelfId: string) => {
    setShelves([...currentShelves])
    setDragShelfId(shelfId)
  }

  const handleShelfDragOver = (e: React.DragEvent, shelfId: string) => {
    e.preventDefault()
    if (!dragShelfId || dragShelfId === shelfId) return
    setDragOverShelfId(shelfId)

    // Reorder preview
    setShelves((prev) => {
      const fromIdx = prev.findIndex((s) => s.id === dragShelfId)
      const toIdx = prev.findIndex((s) => s.id === shelfId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }

  const handleShelfDrop = () => {
    if (dragShelfId && onReorderShelves) {
      onReorderShelves(shelves.map((s) => s.id))
    }
    setDragShelfId(null)
    setDragOverShelfId(null)
  }

  const handleBinDragStart = (shelfId: string, binId: string) => {
    setDragBinId(binId)
    setDragBinShelfId(shelfId)
  }

  const handleBinDragOver = (e: React.DragEvent, binId: string) => {
    e.preventDefault()
    if (!dragBinId || dragBinId === binId) return
    setDragOverBinId(binId)
  }

  const handleBinDrop = (shelfId: string, bins: LocationTreeNode[]) => {
    if (!dragBinId || shelfId !== dragBinShelfId) return

    const fromIdx = bins.findIndex((b) => b.id === dragBinId)
    const toIdx = bins.findIndex((b) => b.id === dragOverBinId)
    if (fromIdx === -1 || toIdx === -1) {
      setDragBinId(null)
      setDragOverBinId(null)
      setDragBinShelfId(null)
      return
    }

    const reordered = [...bins]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    if (onReorderBins) {
      onReorderBins(shelfId, reordered.map((b) => b.id))
    }
    setDragBinId(null)
    setDragOverBinId(null)
    setDragBinShelfId(null)
  }

  const canDragShelves = !compact && !!onReorderShelves
  const canDragBins = !compact && !!onReorderBins

  return (
    <div className="flex flex-col">
      {/* Rack label */}
      <div className={`${compact ? "text-[11px] mb-1" : "text-[12px] mb-2"} font-medium text-center truncate`}>
        {rack.name}
        {rackDims.width && (
          <span className="text-muted-foreground font-normal ml-1">
            {rackDims.width}&Prime;
            {rackDims.depth ? ` \u00d7 ${rackDims.depth}\u2033` : ""}
          </span>
        )}
      </div>

      {/* Rack frame — Shelf 1 at top */}
      <div className="border-2 border-foreground/20 rounded-md overflow-hidden bg-card">
        {displayShelves.map((shelf) => {
          const shelfH = getShelfHeight(shelf, rackDims.height, shelfCount)
          const shelfPx = Math.max(MIN_SHELF_HEIGHT, shelfH * PX_PER_INCH)

          const bins = shelf.children
            .filter((c) => c.unit_subtype === "bin" || c.location_type === "compartment")
            .sort((a, b) => a.sort_order - b.sort_order)

          const usedWidth = bins.reduce((sum, bin) => {
            const binDims = getEffectiveDimensions(bin)
            return sum + (binDims.width ?? 0)
          }, 0)
          const remainingPct = Math.max(0, ((rackWidth - usedWidth) / rackWidth) * 100)
          const count = itemCounts[shelf.id] ?? 0
          const isDragOver = dragOverShelfId === shelf.id && dragShelfId !== shelf.id

          return (
            <div
              key={shelf.id}
              className={`border-b border-foreground/10 last:border-b-0 flex items-end transition-colors ${
                isDragOver ? "bg-primary/10" : ""
              } ${dragShelfId === shelf.id ? "opacity-50" : ""}`}
              style={{ height: `${shelfPx}px` }}
              draggable={canDragShelves}
              onDragStart={() => canDragShelves && handleShelfDragStart(shelf.id)}
              onDragOver={(e) => canDragShelves && handleShelfDragOver(e, shelf.id)}
              onDrop={() => canDragShelves && handleShelfDrop()}
              onDragEnd={() => { setDragShelfId(null); setDragOverShelfId(null) }}
            >
              {/* Shelf label + drag handle */}
              {!compact && (
                <Link
                  href={`/storage/${shelf.id}`}
                  className="w-14 shrink-0 h-full flex items-center justify-center text-[10px] text-muted-foreground font-mono hover:text-primary border-r border-foreground/10 bg-secondary/30 gap-0.5"
                  draggable={false}
                >
                  {canDragShelves && <GripVertical className="size-2.5 text-muted-foreground/40" />}
                  {shelf.label ?? shelf.name.replace("Shelf ", "S")}
                </Link>
              )}

              {/* Bin area */}
              <div className="flex-1 h-full flex items-end gap-px p-px overflow-hidden">
                {bins.map((bin) => {
                  const binDims = getEffectiveDimensions(bin)
                  const binWidthPct = binDims.width ? (binDims.width / rackWidth) * 100 : 30
                  const binHeightPct = binDims.height && shelfH ? Math.min(100, (binDims.height / shelfH) * 100) : 100
                  const binItems = itemCounts[bin.id] ?? 0
                  const hasBinItems = binItems > 0
                  const isBinDragOver = dragOverBinId === bin.id && dragBinId !== bin.id

                  return (
                    <div
                      key={bin.id}
                      className={`relative rounded-sm border transition-colors ${
                        hasBinItems
                          ? "bg-primary/12 border-primary/25 hover:bg-primary/20"
                          : "bg-muted/40 border-dashed border-muted-foreground/20 hover:bg-muted/60"
                      } ${isBinDragOver ? "ring-2 ring-primary/50" : ""} ${dragBinId === bin.id ? "opacity-50" : ""}`}
                      style={{
                        width: `${binWidthPct}%`,
                        minWidth: `${MIN_BIN_WIDTH}px`,
                        height: `${binHeightPct}%`,
                        minHeight: "20px",
                        cursor: canDragBins ? "grab" : undefined,
                      }}
                      title={`${bin.name}${binItems > 0 ? ` (${binItems} items)` : " (empty)"}`}
                      draggable={canDragBins}
                      onDragStart={(e) => { e.stopPropagation(); canDragBins && handleBinDragStart(shelf.id, bin.id) }}
                      onDragOver={(e) => { e.stopPropagation(); canDragBins && handleBinDragOver(e, bin.id) }}
                      onDrop={(e) => { e.stopPropagation(); canDragBins && handleBinDrop(shelf.id, bins) }}
                      onDragEnd={() => { setDragBinId(null); setDragOverBinId(null); setDragBinShelfId(null) }}
                    >
                      <Link
                        href={`/storage/${bin.id}`}
                        draggable={false}
                        className={`absolute inset-0 flex items-center justify-center ${compact ? "text-[8px]" : "text-[9px]"} leading-tight text-center px-0.5 ${
                          hasBinItems ? "text-primary font-medium" : "text-muted-foreground/50"
                        }`}
                      >
                        {compact ? (
                          binItems > 0 ? binItems : ""
                        ) : (
                          <span className="truncate block">
                            {bin.name.length > 12 ? bin.name.slice(0, 10) + "\u2026" : bin.name}
                            {binItems > 0 && (
                              <span className="block text-[8px] opacity-70">{binItems} items</span>
                            )}
                          </span>
                        )}
                      </Link>
                    </div>
                  )
                })}

                {/* Empty space */}
                {remainingPct > 5 && (
                  <div
                    className="h-full rounded-sm border border-dashed border-muted-foreground/10 bg-muted/20"
                    style={{ width: `${remainingPct}%`, minWidth: "8px" }}
                  />
                )}

                {/* Completely empty shelf */}
                {bins.length === 0 && (
                  <Link
                    href={`/storage/${shelf.id}`}
                    className="flex-1 h-full flex items-center justify-center text-[10px] text-muted-foreground/40 hover:text-muted-foreground/60 hover:bg-muted/30 rounded-sm transition-colors"
                    draggable={false}
                  >
                    {compact ? "" : (count > 0 ? `${count} loose items` : "empty")}
                  </Link>
                )}
              </div>
            </div>
          )
        })}

        {/* No shelves */}
        {displayShelves.length === 0 && (
          <div className={`flex items-center justify-center ${compact ? "h-20" : "h-32"} text-[11px] text-muted-foreground/40`}>
            No shelves
          </div>
        )}
      </div>
    </div>
  )
}
