"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ChevronRight,
  ChevronDown,
  DoorOpen,
  LayoutGrid,
  Server,
  Archive,
  Package,
  Inbox,
  Minus,
  DoorClosed,
  Grid3X3,
  GripHorizontal,
  Square,
  Settings,
  Box,
  Trash2,
} from "lucide-react"
import type { LocationTreeNode, LocationType, UnitSubtype } from "@/lib/wms-types"

const TYPE_ICONS: Record<LocationType, React.ElementType> = {
  room: DoorOpen,
  zone: LayoutGrid,
  unit: Archive,
  compartment: Box,
}

const SUBTYPE_ICONS: Record<string, React.ElementType> = {
  rack: Server,
  cabinet: Archive,
  closet: DoorClosed,
  drawer: Inbox,
  shelf: Minus,
  bin: Package,
  pegboard: Grid3X3,
  hanging_rod: GripHorizontal,
  floor: Square,
  custom: Settings,
}

function getIcon(node: LocationTreeNode): React.ElementType {
  if (node.unit_subtype && SUBTYPE_ICONS[node.unit_subtype]) {
    return SUBTYPE_ICONS[node.unit_subtype]
  }
  return TYPE_ICONS[node.location_type] ?? Box
}

interface LocationTreeItemProps {
  node: LocationTreeNode
  depth: number
  itemCounts: Record<string, number>
  onDelete?: (id: string) => void
}

function LocationTreeItem({ node, depth, itemCounts, onDelete }: LocationTreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 2)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const hasChildren = node.children.length > 0
  const Icon = getIcon(node)
  const count = itemCounts[node.id] ?? 0

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-accent transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="size-5" />
        )}
        <Icon className="size-3.5 text-muted-foreground shrink-0" />
        <Link
          href={`/storage/${node.id}`}
          className="flex-1 text-[13px] font-medium text-foreground hover:text-primary truncate"
        >
          {node.name}
        </Link>
        {node.label && (
          <span className="text-[10px] text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">
            {node.label}
          </span>
        )}
        {count > 0 && (
          <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
        {onDelete && !confirmingDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmingDelete(true) }}
            className="size-5 hidden group-hover:flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="size-3" />
          </button>
        )}
        {onDelete && confirmingDelete && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { onDelete(node.id); setConfirmingDelete(false) }}
              className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-white"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="rounded border px-1.5 py-0.5 text-[10px] font-medium"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <LocationTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              itemCounts={itemCounts}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface LocationTreeProps {
  tree: LocationTreeNode[]
  itemCounts: Record<string, number>
  onDelete?: (id: string) => void
}

export function LocationTree({ tree, itemCounts, onDelete }: LocationTreeProps) {
  if (tree.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-[13px]">
        No storage locations set up yet.
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <LocationTreeItem key={node.id} node={node} depth={0} itemCounts={itemCounts} onDelete={onDelete} />
      ))}
    </div>
  )
}
