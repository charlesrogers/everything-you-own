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

export function ShelfOrganizer({ shelf, itemCounts, onMoveBin }: ShelfOrganizerProps) {
  const shelfDims = getEffectiveDimensions(shelf)
  const shelfWidth = shelfDims.width ?? 36
  const shelfDepth = shelfDims.depth ?? 14
  const shelfHeight = shelfDims.height ?? 11.5

  const allBins = shelf.children
    .filter((c) => c.unit_subtype === "bin" || c.location_type === "compartment")

  // Use a sub-grid with 1 unit per inch for precise placement
  const gridCols = Math.round(shelfWidth)

  // Can bins go front/back?
  const minBinDepth = useMemo(() => {
    const depths = allBins.map((b) => getEffectiveDimensions(b).depth).filter((d): d is number => d != null && d > 0)
    return depths.length > 0 ? Math.min(...depths) : shelfDepth
  }, [allBins, shelfDepth])
  const canDoFrontBack = shelfDepth >= minBinDepth * 1.8

  // Build bin placements with grid positions
  const getBinPlacement = (bin: LocationTreeNode) => {
    const meta = bin.metadata as Record<string, unknown>
    const colStart = (meta?.col_index as number) ?? 0  // starting column in inches
    const row: DepthRow = (meta?.depth_row as DepthRow) ?? "front"
    const dims = getEffectiveDimensions(bin)
    const widthCols = Math.round(dims.width ?? 11)  // how many grid columns it spans
    return { bin, colStart: Math.min(colStart, gridCols - widthCols), row, widthCols, stackOrder: bin.sort_order }
  }

  const placements = useMemo(() => allBins.map(getBinPlacement), [allBins, gridCols])

  // Drag state
  const [dragBinId, setDragBinId] = useState<string | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<{ col: number; row: DepthRow } | null>(null)

  const handleDrop = async (col: number, row: DepthRow) => {
    if (!dragBinId) return
    const existing = placements.filter((p) => p.row === row && p.colStart === col)
    await onMoveBin(dragBinId, col, existing.length, row)
    setDragBinId(null)
    setDragOverSlot(null)
  }

  function renderRow(row: DepthRow) {
    const rowBins = placements.filter((p) => p.row === row)

    return (
      <div
        className="relative border-2 border-dashed border-border rounded-lg"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          minHeight: "70px",
          gap: "2px",
          padding: "4px",
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = "move"
          // Calculate which column based on mouse position
          const rect = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - rect.left
          const col = Math.floor((x / rect.width) * gridCols)
          setDragOverSlot({ col: Math.max(0, Math.min(col, gridCols - 1)), row })
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (dragOverSlot && dragOverSlot.row === row) {
            handleDrop(dragOverSlot.col, row)
          }
        }}
        onDragLeave={() => setDragOverSlot(null)}
      >
        {/* Drop indicator */}
        {dragOverSlot && dragOverSlot.row === row && dragBinId && (
          <div
            className="absolute top-0 bottom-0 bg-primary/10 border-2 border-primary/30 rounded pointer-events-none z-0"
            style={{
              gridColumn: `${dragOverSlot.col + 1} / span ${Math.round(getEffectiveDimensions(allBins.find((b) => b.id === dragBinId)!)?.width ?? 11)}`,
              left: `${(dragOverSlot.col / gridCols) * 100}%`,
              width: `${((getEffectiveDimensions(allBins.find((b) => b.id === dragBinId)!)?.width ?? 11) / gridCols) * 100}%`,
            }}
          />
        )}

        {/* Bins */}
        {rowBins.map((p) => {
          const binItems = itemCounts[p.bin.id] ?? 0
          const isDragging = dragBinId === p.bin.id
          const dims = getEffectiveDimensions(p.bin)

          return (
            <div
              key={p.bin.id}
              draggable
              onDragStart={() => setDragBinId(p.bin.id)}
              onDragEnd={() => { setDragBinId(null); setDragOverSlot(null) }}
              className={`rounded-md border px-2 py-1.5 cursor-grab active:cursor-grabbing z-10 transition-opacity ${
                isDragging ? "opacity-20" : ""
              } ${binItems > 0 ? "bg-primary/8 border-primary/20" : "bg-card border-border"}`}
              style={{
                gridColumn: `${p.colStart + 1} / span ${p.widthCols}`,
              }}
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
                <span className="text-[9px] text-muted-foreground">
                  {dims.width}&Prime;w
                </span>
                {binItems > 0 && (
                  <span className="text-[9px] text-muted-foreground">{binItems} items</span>
                )}
              </div>
            </div>
          )
        })}

        {/* Empty state */}
        {rowBins.length === 0 && (
          <div
            className="flex items-center justify-center text-[10px] text-muted-foreground/30"
            style={{ gridColumn: `1 / -1` }}
          >
            {canDoFrontBack ? `${row} row — drop bins here` : "drop bins here"}
          </div>
        )}
      </div>
    )
  }

  // Ruler marks
  const rulerMarks = Array.from({ length: Math.floor(shelfWidth / 6) + 1 }, (_, i) => i * 6)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Shelf Layout</h3>
        <span className="text-[11px] text-muted-foreground">
          {shelfWidth}&Prime; wide &middot; {shelfDepth}&Prime; deep &middot; {shelfHeight}&Prime; tall
          {canDoFrontBack && " &middot; front/back"}
        </span>
      </div>

      {/* Ruler */}
      <div className="relative h-4 border-b border-muted-foreground/20">
        {rulerMarks.map((inch) => (
          <div
            key={inch}
            className="absolute bottom-0 flex flex-col items-center"
            style={{ left: `${(inch / shelfWidth) * 100}%` }}
          >
            <span className="text-[8px] text-muted-foreground/40">{inch}&Prime;</span>
            <div className="w-px h-1.5 bg-muted-foreground/20" />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {canDoFrontBack && (
          <div className="text-[10px] text-muted-foreground font-medium">Back</div>
        )}
        {canDoFrontBack && renderRow("back")}

        {canDoFrontBack && (
          <div className="text-[10px] text-muted-foreground font-medium">Front</div>
        )}
        {renderRow("front")}
      </div>
    </div>
  )
}
