"use client"

import { useState, useRef } from "react"
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
  GripVertical,
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
  draggable?: boolean
  onDragStart?: (e: React.DragEvent, id: string) => void
  onDragOver?: (e: React.DragEvent, id: string) => void
  onDrop?: (e: React.DragEvent) => void
  dragOverId?: string | null
}

function LocationTreeItem({ node, depth, itemCounts, onDelete, draggable, onDragStart, onDragOver, onDrop, dragOverId }: LocationTreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 2)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const hasChildren = node.children.length > 0
  const Icon = getIcon(node)
  const count = itemCounts[node.id] ?? 0

  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart?.(e, node.id) : undefined}
      onDragOver={draggable ? (e) => onDragOver?.(e, node.id) : undefined}
      onDrop={draggable ? onDrop : undefined}
    >
      <div
        className={`group flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-accent transition-colors ${
          dragOverId === node.id ? "bg-primary/10 border-t-2 border-primary" : ""
        }`}
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
        {draggable && (
          <GripVertical className="size-3 text-muted-foreground/50 shrink-0 cursor-grab active:cursor-grabbing" />
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
  onReorder?: (orderedIds: string[]) => void
}

export function LocationTree({ tree, itemCounts, onDelete, onReorder }: LocationTreeProps) {
  const [items, setItems] = useState(tree)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragItemId = useRef<string | null>(null)

  // Sync with prop changes
  const [prevTree, setPrevTree] = useState(tree)
  if (tree !== prevTree) {
    setPrevTree(tree)
    setItems(tree)
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-[13px]">
        No storage locations set up yet.
      </div>
    )
  }

  const canReorder = !!onReorder && items.length > 1

  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragItemId.current = id
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (id !== dragItemId.current) {
      setDragOverId(id)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!dragItemId.current || !dragOverId) {
      setDragOverId(null)
      dragItemId.current = null
      return
    }
    const fromIdx = items.findIndex((n) => n.id === dragItemId.current)
    const toIdx = items.findIndex((n) => n.id === dragOverId)
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
      setDragOverId(null)
      dragItemId.current = null
      return
    }
    const reordered = [...items]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    setItems(reordered)
    setDragOverId(null)
    dragItemId.current = null
    onReorder!(reordered.map((n) => n.id))
  }

  return (
    <div className="space-y-0.5" onDragEnd={() => { setDragOverId(null); dragItemId.current = null }}>
      {items.map((node) => (
        <LocationTreeItem
          key={node.id}
          node={node}
          depth={0}
          itemCounts={itemCounts}
          onDelete={onDelete}
          draggable={canReorder}
          onDragStart={canReorder ? handleDragStart : undefined}
          onDragOver={canReorder ? handleDragOver : undefined}
          onDrop={canReorder ? handleDrop : undefined}
          dragOverId={dragOverId}
        />
      ))}
    </div>
  )
}
