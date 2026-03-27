"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Package, GripVertical, Plus, Nfc } from "lucide-react"
import type { LocationTreeNode } from "@/lib/wms-types"
import { getEffectiveDimensions } from "@/lib/wms-dimensions"

interface ShelfOrganizerProps {
  shelf: LocationTreeNode
  itemCounts: Record<string, number>
  onMoveBin: (binId: string, colIndex: number, sortOrder: number) => Promise<void>
}

interface Column {
  index: number
  bins: LocationTreeNode[]
  totalWidthIn: number
}

export function ShelfOrganizer({ shelf, itemCounts, onMoveBin }: ShelfOrganizerProps) {
  const shelfDims = getEffectiveDimensions(shelf)
  const shelfWidth = shelfDims.width ?? 36.25
  const shelfHeight = shelfDims.height ?? 11.5

  const allBins = shelf.children
    .filter((c) => c.unit_subtype === "bin" || c.location_type === "compartment")

  // Group bins into columns by metadata.col_index
  const columns = useMemo(() => {
    const colMap = new Map<number, LocationTreeNode[]>()
    let maxCol = -1

    for (const bin of allBins) {
      const colIdx = (bin.metadata as Record<string, unknown>)?.col_index as number ?? 0
      if (!colMap.has(colIdx)) colMap.set(colIdx, [])
      colMap.get(colIdx)!.push(bin)
      if (colIdx > maxCol) maxCol = colIdx
    }

    // Sort bins within each column by sort_order
    const cols: Column[] = []
    for (let i = 0; i <= Math.max(maxCol, 0); i++) {
      const bins = (colMap.get(i) ?? []).sort((a, b) => a.sort_order - b.sort_order)
      const totalWidthIn = bins.length > 0
        ? Math.max(...bins.map((b) => getEffectiveDimensions(b).width ?? 0))
        : 0
      cols.push({ index: i, bins, totalWidthIn })
    }

    // Always have at least one empty column at the end for drops
    if (cols.length === 0 || cols[cols.length - 1].bins.length > 0) {
      cols.push({ index: cols.length, bins: [], totalWidthIn: 0 })
    }

    return cols
  }, [allBins])

  // Drag state
  const [dragBinId, setDragBinId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<number | null>(null)
  const [dragOverPos, setDragOverPos] = useState<number | null>(null)

  const handleDragStart = (binId: string) => {
    setDragBinId(binId)
  }

  const handleDragOverCol = (e: React.DragEvent, colIndex: number, position: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverCol(colIndex)
    setDragOverPos(position)
  }

  const handleDrop = async (colIndex: number, position: number) => {
    if (!dragBinId) return
    await onMoveBin(dragBinId, colIndex, position)
    setDragBinId(null)
    setDragOverCol(null)
    setDragOverPos(null)
  }

  const handleDragEnd = () => {
    setDragBinId(null)
    setDragOverCol(null)
    setDragOverPos(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Shelf Layout</h3>
        <span className="text-[11px] text-muted-foreground">
          {shelfWidth}&Prime; wide &middot; {shelfHeight}&Prime; tall &middot; Drag bins to rearrange
        </span>
      </div>

      {/* Column-based layout */}
      <div className="flex gap-2 min-h-[80px]">
        {columns.map((col) => {
          const isDropTarget = dragOverCol === col.index
          const colWidthPct = col.totalWidthIn > 0
            ? Math.max(15, (col.totalWidthIn / shelfWidth) * 100)
            : 15 // empty column gets minimum width

          return (
            <div
              key={col.index}
              className={`flex flex-col-reverse gap-1 rounded-lg border-2 border-dashed p-1 transition-colors ${
                isDropTarget
                  ? "border-primary bg-primary/5"
                  : col.bins.length > 0
                  ? "border-border bg-secondary/30"
                  : "border-muted-foreground/10 bg-muted/10"
              }`}
              style={{ width: `${colWidthPct}%`, minWidth: "80px" }}
              onDragOver={(e) => handleDragOverCol(e, col.index, col.bins.length)}
              onDrop={() => handleDrop(col.index, col.bins.length)}
            >
              {col.bins.length === 0 && !isDropTarget && (
                <div className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground/40">
                  Drop here
                </div>
              )}
              {col.bins.map((bin, stackIdx) => {
                const binDims = getEffectiveDimensions(bin)
                const binItems = itemCounts[bin.id] ?? 0
                const isDragging = dragBinId === bin.id
                const isStackDropTarget = dragOverCol === col.index && dragOverPos === stackIdx

                return (
                  <div
                    key={bin.id}
                    draggable
                    onDragStart={() => handleDragStart(bin.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => { e.stopPropagation(); handleDragOverCol(e, col.index, stackIdx) }}
                    onDrop={(e) => { e.stopPropagation(); handleDrop(col.index, stackIdx) }}
                    className={`rounded-md border px-2 py-1.5 cursor-grab active:cursor-grabbing transition-all ${
                      isDragging ? "opacity-30" : ""
                    } ${isStackDropTarget ? "border-t-2 border-t-primary" : ""} ${
                      binItems > 0
                        ? "bg-primary/8 border-primary/20"
                        : "bg-card border-border"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <GripVertical className="size-3 text-muted-foreground/40 shrink-0" />
                      <Link
                        href={`/storage/${bin.id}`}
                        className="text-[11px] font-medium truncate flex-1 hover:text-primary"
                        draggable={false}
                      >
                        {bin.name}
                      </Link>
                      {bin.nfc_tag_id && <Nfc className="size-2.5 text-emerald-500 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {binDims.width && (
                        <span className="text-[9px] text-muted-foreground">
                          {binDims.width}&Prime;&times;{binDims.height}&Prime;
                        </span>
                      )}
                      {binItems > 0 && (
                        <span className="text-[9px] text-muted-foreground">{binItems} items</span>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Column label */}
              <div className="text-[9px] text-muted-foreground/50 text-center pt-0.5">
                Col {col.index + 1}
                {col.totalWidthIn > 0 && ` (${col.totalWidthIn}\u2033)`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
