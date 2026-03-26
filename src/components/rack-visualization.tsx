"use client"

import Link from "next/link"
import { Package } from "lucide-react"
import type { LocationTreeNode } from "@/lib/wms-types"
import { getEffectiveDimensions, getShelfHeight } from "@/lib/wms-dimensions"

interface RackVisualizationProps {
  rack: LocationTreeNode
  itemCounts: Record<string, number>
  compact?: boolean // smaller version for room overview
}

export function RackVisualization({ rack, itemCounts, compact = false }: RackVisualizationProps) {
  const rackDims = getEffectiveDimensions(rack)
  const rackWidth = rackDims.width ?? 36.25

  // Get shelves sorted bottom-to-top (shelf 1 at bottom)
  const shelves = rack.children
    .filter((c) => c.unit_subtype === "shelf" || c.location_type === "compartment")
    .sort((a, b) => a.sort_order - b.sort_order)

  const shelfCount = shelves.length
  const PX_PER_INCH = compact ? 3 : 4.5
  const MIN_SHELF_HEIGHT = compact ? 28 : 40
  const MIN_BIN_WIDTH = compact ? 20 : 32

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

      {/* Rack frame — shelves rendered top-to-bottom (highest shelf first) */}
      <div className="border-2 border-foreground/20 rounded-md overflow-hidden bg-card">
        {[...shelves].reverse().map((shelf) => {
          const shelfH = getShelfHeight(shelf, rackDims.height, shelfCount)
          const shelfPx = Math.max(MIN_SHELF_HEIGHT, shelfH * PX_PER_INCH)

          // Get bins on this shelf
          const bins = shelf.children
            .filter((c) => c.unit_subtype === "bin" || c.location_type === "compartment")
            .sort((a, b) => a.sort_order - b.sort_order)

          // Calculate used width
          const usedWidth = bins.reduce((sum, bin) => {
            const binDims = getEffectiveDimensions(bin)
            return sum + (binDims.width ?? 0)
          }, 0)
          const remainingPct = Math.max(0, ((rackWidth - usedWidth) / rackWidth) * 100)

          const count = itemCounts[shelf.id] ?? 0
          const totalBinItems = bins.reduce((sum, bin) => sum + (itemCounts[bin.id] ?? 0), 0)

          return (
            <div
              key={shelf.id}
              className="border-b border-foreground/10 last:border-b-0 flex items-end"
              style={{ height: `${shelfPx}px` }}
            >
              {/* Shelf label */}
              {!compact && (
                <Link
                  href={`/storage/${shelf.id}`}
                  className="w-14 shrink-0 h-full flex items-center justify-center text-[10px] text-muted-foreground font-mono hover:text-primary border-r border-foreground/10 bg-secondary/30"
                >
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

                  return (
                    <Link
                      key={bin.id}
                      href={`/storage/${bin.id}`}
                      className={`relative rounded-sm border transition-colors ${
                        hasBinItems
                          ? "bg-primary/12 border-primary/25 hover:bg-primary/20"
                          : "bg-muted/40 border-dashed border-muted-foreground/20 hover:bg-muted/60"
                      }`}
                      style={{
                        width: `${binWidthPct}%`,
                        minWidth: `${MIN_BIN_WIDTH}px`,
                        height: `${binHeightPct}%`,
                        minHeight: "20px",
                      }}
                      title={`${bin.name}${binItems > 0 ? ` (${binItems} items)` : " (empty)"}`}
                    >
                      {/* Bin label */}
                      <span className={`absolute inset-0 flex items-center justify-center ${compact ? "text-[8px]" : "text-[9px]"} leading-tight text-center px-0.5 ${
                        hasBinItems ? "text-primary font-medium" : "text-muted-foreground/50"
                      }`}>
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
                      </span>
                    </Link>
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
                  >
                    {compact ? "" : (count > 0 ? `${count} loose items` : "empty")}
                  </Link>
                )}
              </div>
            </div>
          )
        })}

        {/* No shelves */}
        {shelves.length === 0 && (
          <div className={`flex items-center justify-center ${compact ? "h-20" : "h-32"} text-[11px] text-muted-foreground/40`}>
            No shelves
          </div>
        )}
      </div>
    </div>
  )
}
