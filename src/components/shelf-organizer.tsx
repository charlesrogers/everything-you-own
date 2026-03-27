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

type DepthRow = "front" | "back" | "full"

interface BinPlacement {
  bin: LocationTreeNode
  colStart: number  // starting position in inches from left
  depthRow: DepthRow
  widthIn: number
  heightIn: number
  stackOrder: number
}

export function ShelfOrganizer({ shelf, itemCounts, onMoveBin }: ShelfOrganizerProps) {
  const shelfDims = getEffectiveDimensions(shelf)
  const shelfWidth = shelfDims.width ?? 36
  const shelfDepth = shelfDims.depth ?? 14
  const shelfHeight = shelfDims.height ?? 11.5

  const allBins = shelf.children
    .filter((c) => c.unit_subtype === "bin" || c.location_type === "compartment")

  // Can bins go front/back?
  const minBinDepth = useMemo(() => {
    const depths = allBins.map((b) => getEffectiveDimensions(b).depth).filter((d): d is number => d != null && d > 0)
    return depths.length > 0 ? Math.min(...depths) : shelfDepth
  }, [allBins, shelfDepth])
  const canDoFrontBack = shelfDepth >= minBinDepth * 1.8

  // Typical bin width for column markers
  const typicalBinWidth = useMemo(() => {
    const widths = allBins.map((b) => getEffectiveDimensions(b).width).filter((w): w is number => w != null && w > 0)
    if (widths.length === 0) return 15
    const freq = new Map<number, number>()
    for (const w of widths) freq.set(w, (freq.get(w) ?? 0) + 1)
    return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }, [allBins])
  const numLogicalCols = Math.max(1, Math.floor(shelfWidth / typicalBinWidth))

  // Build placements
  const placements = useMemo(() => allBins.map((bin): BinPlacement => {
    const meta = bin.metadata as Record<string, unknown>
    const colStart = (meta?.col_index as number) ?? 0
    const depthRow = ((meta?.depth_row as string) ?? "front") as DepthRow
    const dims = getEffectiveDimensions(bin)
    const widthIn = dims.width ?? 11
    const heightIn = dims.height ?? 5.5
    return {
      bin,
      colStart: Math.max(0, Math.min(colStart, shelfWidth - widthIn)),
      depthRow,
      widthIn,
      heightIn,
      stackOrder: bin.sort_order,
    }
  }), [allBins, shelfWidth])

  // Drag state
  const [dragBinId, setDragBinId] = useState<string | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<{ col: number; row: "front" | "back" } | null>(null)

  const handleDrop = async (col: number, row: "front" | "back") => {
    if (!dragBinId) return
    const existing = placements.filter((p) =>
      (p.depthRow === row || p.depthRow === "full") && Math.abs(p.colStart - col) < 2
    )
    await onMoveBin(dragBinId, col, existing.length, row)
    setDragBinId(null)
    setDragOverSlot(null)
  }

  // Group overlapping bins into stacks for a given depth row
  function getStacks(row: "front" | "back"): BinPlacement[][] {
    const rowBins = placements
      .filter((p) => p.depthRow === row || p.depthRow === "full")
      .sort((a, b) => a.colStart - b.colStart || a.stackOrder - b.stackOrder)

    // Group bins that start at the same position (within 2" tolerance)
    const stacks: BinPlacement[][] = []
    for (const p of rowBins) {
      const lastStack = stacks[stacks.length - 1]
      if (lastStack && Math.abs(lastStack[0].colStart - p.colStart) < 2) {
        lastStack.push(p)
      } else {
        stacks.push([p])
      }
    }
    return stacks
  }

  function renderBinCard(p: BinPlacement) {
    const binItems = itemCounts[p.bin.id] ?? 0
    const isDragging = dragBinId === p.bin.id
    const heightPct = Math.min(100, (p.heightIn / shelfHeight) * 100)

    return (
      <div
        key={p.bin.id}
        draggable
        onDragStart={(e) => { e.stopPropagation(); setDragBinId(p.bin.id) }}
        onDragEnd={() => { setDragBinId(null); setDragOverSlot(null) }}
        className={`rounded-md border px-2 py-1.5 cursor-grab active:cursor-grabbing transition-opacity ${
          isDragging ? "opacity-20" : ""
        } ${binItems > 0 ? "bg-primary/8 border-primary/20" : "bg-card border-border"}`}
      >
        <div className="flex items-center gap-1.5">
          <GripVertical className="size-3 text-muted-foreground/40 shrink-0" />
          <Link href={`/storage/${p.bin.id}`} className="text-[11px] font-medium truncate flex-1 hover:text-primary" draggable={false}>
            {p.bin.name}
          </Link>
          {p.bin.nfc_tag_id && <Nfc className="size-2.5 text-emerald-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] text-muted-foreground">
            {p.widthIn}&Prime; &times; {p.heightIn}&Prime;
          </span>
          {binItems > 0 && (
            <span className="text-[9px] text-muted-foreground">{binItems} items</span>
          )}
        </div>
      </div>
    )
  }

  function renderRow(row: "front" | "back") {
    const stacks = getStacks(row)
    const isDropRow = dragOverSlot?.row === row

    return (
      <div
        className="relative border-2 border-dashed border-border rounded-lg overflow-hidden"
        style={{ minHeight: "80px" }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = "move"
          const rect = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - rect.left
          const col = Math.round((x / rect.width) * shelfWidth)
          setDragOverSlot({ col: Math.max(0, Math.min(col, Math.round(shelfWidth) - 1)), row })
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (dragOverSlot && dragOverSlot.row === row) handleDrop(dragOverSlot.col, row)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverSlot(null)
        }}
      >
        {/* Column guide lines */}
        {Array.from({ length: numLogicalCols - 1 }, (_, i) => (
          <div
            key={`guide-${i}`}
            className="absolute top-0 bottom-0 border-l border-dashed border-muted-foreground/10 pointer-events-none"
            style={{ left: `${((i + 1) / numLogicalCols) * 100}%` }}
          />
        ))}

        {/* Drop indicator */}
        {isDropRow && dragBinId && (() => {
          const dragBin = allBins.find((b) => b.id === dragBinId)
          const dragWidth = dragBin ? (getEffectiveDimensions(dragBin).width ?? 11) : 11
          return (
            <div
              className="absolute top-1 bottom-1 bg-primary/10 border-2 border-primary/30 rounded pointer-events-none"
              style={{
                left: `${(dragOverSlot!.col / shelfWidth) * 100}%`,
                width: `${(dragWidth / shelfWidth) * 100}%`,
              }}
            />
          )
        })()}

        {/* Bin stacks — absolutely positioned by colStart, width proportional */}
        {stacks.map((stack, si) => {
          const anchor = stack[0]
          return (
            <div
              key={`stack-${si}`}
              className="absolute bottom-1 flex flex-col-reverse gap-0.5"
              style={{
                left: `${(anchor.colStart / shelfWidth) * 100}%`,
                width: `${(anchor.widthIn / shelfWidth) * 100}%`,
                padding: "0 2px",
              }}
            >
              {stack.map((p) => renderBinCard(p))}
            </div>
          )
        })}

        {/* Empty label */}
        {stacks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground/30">
            {canDoFrontBack ? `${row} — drop bins here` : "drop bins here"}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Shelf Layout</h3>
        <span className="text-[11px] text-muted-foreground">
          {shelfWidth}&Prime; &times; {shelfDepth}&Prime; &times; {shelfHeight}&Prime;
          &middot; {numLogicalCols} col{numLogicalCols !== 1 ? "s" : ""}
          {canDoFrontBack && " &middot; front/back"}
        </span>
      </div>

      {/* Ruler with column labels */}
      <div className="relative h-5">
        {Array.from({ length: numLogicalCols }, (_, i) => (
          <div
            key={`col-${i}`}
            className="absolute top-0 bottom-0 text-center"
            style={{
              left: `${(i / numLogicalCols) * 100}%`,
              width: `${(1 / numLogicalCols) * 100}%`,
            }}
          >
            <span className="text-[9px] text-muted-foreground/50">
              Col {i + 1} ({Math.round(i * shelfWidth / numLogicalCols)}&Prime;–{Math.round((i + 1) * shelfWidth / numLogicalCols)}&Prime;)
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {canDoFrontBack && <div className="text-[10px] text-muted-foreground font-medium">Back</div>}
        {canDoFrontBack && renderRow("back")}
        {canDoFrontBack && <div className="text-[10px] text-muted-foreground font-medium">Front</div>}
        {renderRow("front")}
      </div>
    </div>
  )
}
