"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { GripVertical, Nfc } from "lucide-react"
import type { LocationTreeNode } from "@/lib/wms-types"
import { getEffectiveDimensions } from "@/lib/wms-dimensions"

interface ShelfOrganizerProps {
  shelf: LocationTreeNode
  itemCounts: Record<string, number>
  onMoveBin: (binId: string, colIndex: number, sortOrder: number, depthRow?: "front" | "back") => Promise<void>
}

type DepthRow = "front" | "back"

interface BinPlacement {
  bin: LocationTreeNode
  col: number
  row: DepthRow
  stackOrder: number
}

export function ShelfOrganizer({ shelf, itemCounts, onMoveBin }: ShelfOrganizerProps) {
  const shelfDims = getEffectiveDimensions(shelf)
  const shelfWidth = shelfDims.width ?? 36.25
  const shelfDepth = shelfDims.depth ?? 14
  const shelfHeight = shelfDims.height ?? 11.5

  const allBins = shelf.children
    .filter((c) => c.unit_subtype === "bin" || c.location_type === "compartment")

  // Determine number of columns from shelf width and typical bin width
  // Use the most common bin width, or default ~15" (SAMLA standard)
  const typicalBinWidth = useMemo(() => {
    const widths = allBins.map((b) => getEffectiveDimensions(b).width).filter((w): w is number => w != null && w > 0)
    if (widths.length === 0) return 15.25
    // Most common width
    const freq = new Map<number, number>()
    for (const w of widths) freq.set(w, (freq.get(w) ?? 0) + 1)
    return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }, [allBins])

  const numColumns = Math.max(1, Math.floor(shelfWidth / typicalBinWidth))

  // Can bins go front/back? Only if shelf is deep enough for two rows
  const typicalBinDepth = useMemo(() => {
    const depths = allBins.map((b) => getEffectiveDimensions(b).depth).filter((d): d is number => d != null && d > 0)
    if (depths.length === 0) return shelfDepth
    return Math.min(...depths)
  }, [allBins, shelfDepth])
  const canDoFrontBack = shelfDepth >= typicalBinDepth * 1.8 // room for ~2 bins deep

  // Build placements
  const placements = useMemo(() => {
    return allBins.map((bin): BinPlacement => {
      const meta = bin.metadata as Record<string, unknown>
      const col = (meta?.col_index as number) ?? 0
      const row: DepthRow = (meta?.depth_row as DepthRow) ?? "front"
      return { bin, col: Math.min(col, numColumns - 1), row, stackOrder: bin.sort_order }
    })
  }, [allBins, numColumns])

  // Drag state
  const [dragBinId, setDragBinId] = useState<string | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<{ col: number; row: DepthRow } | null>(null)

  const handleDrop = async (col: number, row: DepthRow) => {
    if (!dragBinId) return
    const existingInSlot = placements.filter((p) => p.col === col && p.row === row)
    await onMoveBin(dragBinId, col, existingInSlot.length, row)
    setDragBinId(null)
    setDragOverTarget(null)
  }

  // Render a single cell (one column + one depth row)
  function renderCell(col: number, row: DepthRow) {
    const cellBins = placements
      .filter((p) => p.col === col && p.row === row)
      .sort((a, b) => a.stackOrder - b.stackOrder)
    const isDropTarget = dragOverTarget?.col === col && dragOverTarget?.row === row

    return (
      <div
        key={`${col}-${row}`}
        className={`flex flex-col-reverse gap-1 rounded-lg border-2 border-dashed p-1.5 min-h-[60px] transition-colors ${
          isDropTarget
            ? "border-primary bg-primary/5"
            : cellBins.length > 0
            ? "border-border bg-secondary/20"
            : "border-muted-foreground/10 bg-muted/5"
        }`}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverTarget({ col, row }) }}
        onDrop={(e) => { e.preventDefault(); handleDrop(col, row) }}
        onDragLeave={() => setDragOverTarget(null)}
      >
        {cellBins.length === 0 && !isDropTarget && (
          <div className="flex-1 flex items-center justify-center text-[9px] text-muted-foreground/30">
            empty
          </div>
        )}
        {cellBins.map((p) => {
          const binDims = getEffectiveDimensions(p.bin)
          const binItems = itemCounts[p.bin.id] ?? 0
          const isDragging = dragBinId === p.bin.id

          return (
            <div
              key={p.bin.id}
              draggable
              onDragStart={() => setDragBinId(p.bin.id)}
              onDragEnd={() => { setDragBinId(null); setDragOverTarget(null) }}
              className={`rounded-md border px-2 py-1.5 cursor-grab active:cursor-grabbing transition-all ${
                isDragging ? "opacity-20" : ""
              } ${
                binItems > 0 ? "bg-primary/8 border-primary/20" : "bg-card border-border"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <GripVertical className="size-3 text-muted-foreground/40 shrink-0" />
                <Link
                  href={`/storage/${p.bin.id}`}
                  className="text-[11px] font-medium truncate flex-1 hover:text-primary"
                  draggable={false}
                >
                  {p.bin.name}
                </Link>
                {p.bin.nfc_tag_id && <Nfc className="size-2.5 text-emerald-500 shrink-0" />}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {binDims.width && binDims.height && (
                  <span className="text-[9px] text-muted-foreground">
                    {binDims.width}&Prime;&times;{binDims.depth}&Prime;&times;{binDims.height}&Prime;
                  </span>
                )}
                {binItems > 0 && (
                  <span className="text-[9px] text-muted-foreground">{binItems} items</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Shelf Layout</h3>
        <span className="text-[11px] text-muted-foreground">
          {shelfWidth}&Prime; &times; {shelfDepth}&Prime; &times; {shelfHeight}&Prime;
          &middot; {numColumns} col{numColumns !== 1 ? "s" : ""}
          {canDoFrontBack && " &middot; front/back"}
        </span>
      </div>

      {/* Grid: columns × depth rows */}
      <div className="space-y-2">
        {canDoFrontBack && (
          <div className="text-[10px] text-muted-foreground font-medium px-1">Back row</div>
        )}
        {canDoFrontBack && (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${numColumns}, 1fr)` }}>
            {Array.from({ length: numColumns }, (_, col) => renderCell(col, "back"))}
          </div>
        )}

        {canDoFrontBack && (
          <div className="text-[10px] text-muted-foreground font-medium px-1">Front row</div>
        )}
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${numColumns}, 1fr)` }}>
          {Array.from({ length: numColumns }, (_, col) => renderCell(col, "front"))}
        </div>

        {/* Column labels */}
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${numColumns}, 1fr)` }}>
          {Array.from({ length: numColumns }, (_, col) => (
            <div key={col} className="text-[9px] text-muted-foreground/50 text-center">
              Col {col + 1} (~{Math.round(shelfWidth / numColumns)}&Prime;)
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
