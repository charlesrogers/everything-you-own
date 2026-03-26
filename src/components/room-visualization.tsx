"use client"

import Link from "next/link"
import { Archive, DoorClosed, Inbox, Grid3X3, Package } from "lucide-react"
import type { LocationTreeNode } from "@/lib/wms-types"
import { RackVisualization } from "./rack-visualization"

const SUBTYPE_ICONS: Record<string, React.ElementType> = {
  cabinet: Archive,
  closet: DoorClosed,
  drawer: Inbox,
  pegboard: Grid3X3,
}

interface RoomVisualizationProps {
  room: LocationTreeNode
  itemCounts: Record<string, number>
}

export function RoomVisualization({ room, itemCounts }: RoomVisualizationProps) {
  // Separate children into zones (which contain units) and direct units
  const zones = room.children.filter((c) => c.location_type === "zone")
  const directUnits = room.children.filter((c) => c.location_type === "unit")
  const directCompartments = room.children.filter((c) => c.location_type === "compartment")

  // Collect all units (from zones + direct)
  const allUnits: { unit: LocationTreeNode; zoneName?: string }[] = []
  for (const zone of zones) {
    for (const unit of zone.children.filter((c) => c.location_type === "unit")) {
      allUnits.push({ unit, zoneName: zone.name })
    }
  }
  for (const unit of directUnits) {
    allUnits.push({ unit })
  }

  // Split into racks and other units
  const racks = allUnits.filter((u) => u.unit.unit_subtype === "rack")
  const otherUnits = allUnits.filter((u) => u.unit.unit_subtype !== "rack")

  // Count total items recursively
  const countItemsDeep = (node: LocationTreeNode): number => {
    let total = itemCounts[node.id] ?? 0
    for (const child of node.children) {
      total += countItemsDeep(child)
    }
    return total
  }

  return (
    <div className="space-y-6">
      {/* Racks — visual diagrams */}
      {racks.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold mb-3">Racks</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {racks.map(({ unit, zoneName }) => (
              <div key={unit.id} className="space-y-1">
                {zoneName && (
                  <span className="text-[10px] text-muted-foreground">{zoneName}</span>
                )}
                <RackVisualization rack={unit} itemCounts={itemCounts} compact />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other units — summary cards */}
      {otherUnits.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold mb-3">Other Storage</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {otherUnits.map(({ unit, zoneName }) => {
              const Icon = SUBTYPE_ICONS[unit.unit_subtype ?? ""] ?? Package
              const totalItems = countItemsDeep(unit)
              const childCount = unit.children.length

              return (
                <Link
                  key={unit.id}
                  href={`/storage/${unit.id}`}
                  className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-4 hover:shadow-md hover:shadow-black/[0.06] transition-shadow"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="text-[13px] font-medium truncate">{unit.name}</span>
                  </div>
                  {zoneName && (
                    <div className="text-[10px] text-muted-foreground mb-1">{zoneName}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    {totalItems} items &middot; {childCount} {unit.unit_subtype === "cabinet" ? "drawers" : "sections"}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Loose compartments (floor items, etc.) */}
      {directCompartments.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold mb-3">Other</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {directCompartments.map((comp) => {
              const totalItems = countItemsDeep(comp)
              return (
                <Link
                  key={comp.id}
                  href={`/storage/${comp.id}`}
                  className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-4 hover:shadow-md hover:shadow-black/[0.06] transition-shadow"
                >
                  <span className="text-[13px] font-medium">{comp.name}</span>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {totalItems} items
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty room */}
      {racks.length === 0 && otherUnits.length === 0 && directCompartments.length === 0 && zones.length === 0 && (
        <div className="text-center py-8 text-[13px] text-muted-foreground">
          No storage units in this room yet.
        </div>
      )}
    </div>
  )
}
