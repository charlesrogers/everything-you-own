"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { GripVertical, Nfc } from "lucide-react"
import type { LocationTreeNode } from "@/lib/wms-types"
import { getEffectiveDimensions } from "@/lib/wms-dimensions"

// Atomic unit: 1-gal SAMLA bin = 11" wide × 5.5" tall
const SLOT_W = 11
const SLOT_H = 5.5

interface ShelfOrganizerProps {
  shelf: LocationTreeNode
  itemCounts: Record<string, number>
  onMoveBin: (binId: string, gridCol: number, gridRow: number, depthRow?: "front" | "back") => Promise<void>
}

type DepthRow = "front" | "back" | "full"

interface BinGrid {
  bin: LocationTreeNode
  gridCol: number   // 0-indexed column
  gridRow: number   // 0-indexed row from bottom
  spanW: number     // columns wide
  spanH: number     // rows tall
  depthRow: DepthRow
  widthIn: number
  heightIn: number
}

export function ShelfOrganizer({ shelf, itemCounts, onMoveBin }: ShelfOrganizerProps) {
  const shelfDims = getEffectiveDimensions(shelf)
  const shelfWidth = shelfDims.width ?? 36
  const shelfDepth = shelfDims.depth ?? 14
  const shelfHeight = shelfDims.height ?? 11.5

  const numCols = Math.max(1, Math.floor(shelfWidth / SLOT_W))
  const numRows = Math.max(1, Math.floor(shelfHeight / SLOT_H))

  const allBins = shelf.children
    .filter((c) => c.unit_subtype === "bin" || c.location_type === "compartment")

  // Can bins go front/back?
  const minBinDepth = useMemo(() => {
    const depths = allBins.map((b) => getEffectiveDimensions(b).depth).filter((d): d is number => d != null && d > 0)
    return depths.length > 0 ? Math.min(...depths) : shelfDepth
  }, [allBins, shelfDepth])
  const canDoFrontBack = shelfDepth >= minBinDepth * 1.8

  // Build grid placements — use explicit positions or auto-pack
  const gridBins = useMemo(() => {
    // First pass: collect bins with known positions and unknown positions
    const withPos: BinGrid[] = []
    const needsPos: { bin: LocationTreeNode; spanW: number; spanH: number; depthRow: DepthRow; widthIn: number; heightIn: number }[] = []

    for (const bin of allBins) {
      const meta = bin.metadata as Record<string, unknown>
      const dims = getEffectiveDimensions(bin)
      const widthIn = dims.width ?? SLOT_W
      const heightIn = dims.height ?? SLOT_H
      const spanW = Math.max(1, Math.round(widthIn / SLOT_W))
      const spanH = Math.max(1, Math.round(heightIn / SLOT_H))
      const depthRow = ((meta?.depth_row as string) ?? "front") as DepthRow

      const hasGridPos = meta?.grid_col != null && meta?.grid_row != null
      const hasLegacyCol = meta?.col_index != null

      if (hasGridPos) {
        let gridCol = meta.grid_col as number
        let gridRow = meta.grid_row as number
        gridCol = Math.max(0, Math.min(gridCol, numCols - spanW))
        gridRow = Math.max(0, Math.min(gridRow, numRows - spanH))
        withPos.push({ bin, gridCol, gridRow, spanW, spanH, depthRow, widthIn, heightIn })
      } else if (hasLegacyCol) {
        const rawCol = meta.col_index as number
        let gridCol = Math.round(rawCol / SLOT_W)
        gridCol = Math.max(0, Math.min(gridCol, numCols - spanW))
        withPos.push({ bin, gridCol, gridRow: 0, spanW, spanH, depthRow, widthIn, heightIn })
      } else {
        needsPos.push({ bin, spanW, spanH, depthRow, widthIn, heightIn })
      }
    }

    // Auto-pack bins without positions (Tetris: left-to-right, bottom-to-top)
    // Build an occupancy grid per depth row
    function autoPlace(bins: typeof needsPos, existingBins: BinGrid[], depthRow: "front" | "back"): BinGrid[] {
      // Occupancy: occupied[row][col] = true
      const occupied: boolean[][] = Array.from({ length: numRows }, () => Array(numCols).fill(false))

      // Mark existing bins
      for (const gb of existingBins) {
        if (gb.depthRow !== depthRow && gb.depthRow !== "full") continue
        for (let r = gb.gridRow; r < gb.gridRow + gb.spanH && r < numRows; r++) {
          for (let c = gb.gridCol; c < gb.gridCol + gb.spanW && c < numCols; c++) {
            occupied[r][c] = true
          }
        }
      }

      const result: BinGrid[] = []
      for (const b of bins) {
        if (b.depthRow !== depthRow && b.depthRow !== "full") continue
        let placed = false
        // Scan bottom-to-top, left-to-right
        for (let row = 0; row <= numRows - b.spanH && !placed; row++) {
          for (let col = 0; col <= numCols - b.spanW && !placed; col++) {
            // Check if all cells are free
            let fits = true
            for (let r = row; r < row + b.spanH && fits; r++) {
              for (let c = col; c < col + b.spanW && fits; c++) {
                if (occupied[r][c]) fits = false
              }
            }
            if (fits) {
              // Place it
              for (let r = row; r < row + b.spanH; r++) {
                for (let c = col; c < col + b.spanW; c++) {
                  occupied[r][c] = true
                }
              }
              result.push({ bin: b.bin, gridCol: col, gridRow: row, spanW: b.spanW, spanH: b.spanH, depthRow: b.depthRow, widthIn: b.widthIn, heightIn: b.heightIn })
              placed = true
            }
          }
        }
        if (!placed) {
          // Overflow — place at 0,0 anyway
          result.push({ bin: b.bin, gridCol: 0, gridRow: 0, spanW: b.spanW, spanH: b.spanH, depthRow: b.depthRow, widthIn: b.widthIn, heightIn: b.heightIn })
        }
      }
      return result
    }

    // For "full" depth bins, auto-place them in "front" row
    const frontBins = needsPos.filter((b) => b.depthRow === "front" || b.depthRow === "full")
    const backBins = needsPos.filter((b) => b.depthRow === "back")

    const autoFront = autoPlace(frontBins, withPos, "front")
    const autoBack = autoPlace(backBins, [...withPos, ...autoFront], "back")

    return [...withPos, ...autoFront, ...autoBack]
  }, [allBins, numCols, numRows])

  // Drag state
  const [dragBinId, setDragBinId] = useState<string | null>(null)
  const [hoverCell, setHoverCell] = useState<{ col: number; row: number; depthRow: "front" | "back" } | null>(null)

  // Check if a cell range is occupied (excluding a specific bin)
  function isOccupied(col: number, row: number, spanW: number, spanH: number, excludeBinId: string | null, depthRow: "front" | "back"): boolean {
    for (const gb of gridBins) {
      if (gb.bin.id === excludeBinId) continue
      if (gb.depthRow !== depthRow && gb.depthRow !== "full") continue
      // Check overlap
      if (col < gb.gridCol + gb.spanW && col + spanW > gb.gridCol &&
          row < gb.gridRow + gb.spanH && row + spanH > gb.gridRow) {
        return true
      }
    }
    return false
  }

  function handleDrop(col: number, row: number, depthRow: "front" | "back") {
    if (!dragBinId) return
    const gb = gridBins.find((g) => g.bin.id === dragBinId)
    if (!gb) return
    // Check bounds
    if (col + gb.spanW > numCols || row + gb.spanH > numRows) return
    // Check collision
    if (isOccupied(col, row, gb.spanW, gb.spanH, dragBinId, depthRow)) return
    onMoveBin(dragBinId, col, row, depthRow)
    setDragBinId(null)
    setHoverCell(null)
  }

  function renderGrid(depthRow: "front" | "back") {
    const rowBins = gridBins.filter((gb) => gb.depthRow === depthRow || gb.depthRow === "full")

    // Build occupied cell map for highlighting
    const occupiedMap = new Set<string>()
    for (const gb of rowBins) {
      for (let c = gb.gridCol; c < gb.gridCol + gb.spanW; c++) {
        for (let r = gb.gridRow; r < gb.gridRow + gb.spanH; r++) {
          occupiedMap.add(`${c},${r}`)
        }
      }
    }

    // Check if hover position is valid for the dragged bin
    let hoverValid = false
    let hoverSpanW = 1
    let hoverSpanH = 1
    if (hoverCell && hoverCell.depthRow === depthRow && dragBinId) {
      const gb = gridBins.find((g) => g.bin.id === dragBinId)
      if (gb) {
        hoverSpanW = gb.spanW
        hoverSpanH = gb.spanH
        hoverValid = hoverCell.col + gb.spanW <= numCols &&
                     hoverCell.row + gb.spanH <= numRows &&
                     !isOccupied(hoverCell.col, hoverCell.row, gb.spanW, gb.spanH, dragBinId, depthRow)
      }
    }

    const PX_PER_ROW = 40

    return (
      <div
        className="relative border-2 border-border rounded-lg overflow-hidden"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${numCols}, 1fr)`,
          gridTemplateRows: `repeat(${numRows}, ${PX_PER_ROW}px)`,
        }}
      >
        {/* Background grid cells */}
        {Array.from({ length: numRows }, (_, r) =>
          Array.from({ length: numCols }, (_, c) => {
            const cssRow = numRows - r  // flip: physical row 0 (bottom) = CSS grid row numRows
            const isOcc = occupiedMap.has(`${c},${r}`)
            const isHover = hoverCell?.depthRow === depthRow && hoverCell?.col === c && hoverCell?.row === r

            return (
              <div
                key={`cell-${c}-${r}`}
                className={`border border-dashed transition-colors ${
                  isOcc ? "border-transparent" : "border-muted-foreground/10"
                } ${isHover && !isOcc ? "bg-primary/5" : ""}`}
                style={{ gridColumn: c + 1, gridRow: cssRow }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = "move"
                  setHoverCell({ col: c, row: r, depthRow })
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDrop(c, r, depthRow)
                }}
              />
            )
          })
        )}

        {/* Drop preview */}
        {hoverCell && hoverCell.depthRow === depthRow && dragBinId && (
          <div
            className={`pointer-events-none border-2 rounded ${
              hoverValid ? "border-primary bg-primary/10" : "border-destructive bg-destructive/10"
            }`}
            style={{
              gridColumn: `${hoverCell.col + 1} / span ${hoverSpanW}`,
              gridRow: `${numRows - hoverCell.row - hoverSpanH + 1} / span ${hoverSpanH}`,
            }}
          />
        )}

        {/* Bins */}
        {rowBins.map((gb) => {
          const binItems = itemCounts[gb.bin.id] ?? 0
          const isDragging = dragBinId === gb.bin.id
          const cssRowStart = numRows - gb.gridRow - gb.spanH + 1

          return (
            <div
              key={gb.bin.id}
              draggable
              onDragStart={() => setDragBinId(gb.bin.id)}
              onDragEnd={() => { setDragBinId(null); setHoverCell(null) }}
              className={`rounded-md border m-0.5 px-1.5 py-1 cursor-grab active:cursor-grabbing transition-opacity z-10 flex flex-col justify-center ${
                isDragging ? "opacity-20" : ""
              } ${binItems > 0 ? "bg-primary/8 border-primary/20" : "bg-card border-border"}`}
              style={{
                gridColumn: `${gb.gridCol + 1} / span ${gb.spanW}`,
                gridRow: `${cssRowStart} / span ${gb.spanH}`,
              }}
            >
              <div className="flex items-center gap-1">
                <GripVertical className="size-2.5 text-muted-foreground/40 shrink-0" />
                <Link
                  href={`/storage/${gb.bin.id}`}
                  className="text-[10px] font-medium truncate flex-1 hover:text-primary"
                  draggable={false}
                >
                  {gb.bin.name}
                </Link>
                {gb.bin.nfc_tag_id && <Nfc className="size-2 text-emerald-500 shrink-0" />}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[8px] text-muted-foreground">
                  {gb.spanW}×{gb.spanH}
                </span>
                {binItems > 0 && (
                  <span className="text-[8px] text-muted-foreground">{binItems} items</span>
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
          {shelfWidth}&Prime; × {shelfHeight}&Prime;
          → {numCols}×{numRows} grid
          {canDoFrontBack && " · front/back"}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${numCols}, 1fr)` }}>
        {Array.from({ length: numCols }, (_, i) => (
          <div key={i} className="text-[9px] text-muted-foreground/50 text-center">
            Col {i + 1} ({SLOT_W}&Prime;)
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {canDoFrontBack && <div className="text-[10px] text-muted-foreground font-medium">Back</div>}
        {canDoFrontBack && renderGrid("back")}
        {canDoFrontBack && <div className="text-[10px] text-muted-foreground font-medium">Front</div>}
        {renderGrid("front")}
      </div>

      {/* Row legend */}
      <div className="text-[9px] text-muted-foreground/40">
        Each slot = {SLOT_W}&Prime; × {SLOT_H}&Prime; (1-gal bin). Drag bins to rearrange.
      </div>
    </div>
  )
}
