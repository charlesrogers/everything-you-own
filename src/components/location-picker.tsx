"use client"

import { useState, useEffect } from "react"
import type { Location, LocationTreeNode } from "@/lib/wms-types"
import { buildLocationTree } from "@/lib/wms-store"
import { ChevronRight } from "lucide-react"

interface LocationPickerProps {
  locations: Location[]
  value: string | null
  onChange: (locationId: string | null) => void
  placeholder?: string
}

export function LocationPicker({ locations, value, onChange, placeholder = "Select location..." }: LocationPickerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const tree = buildLocationTree(locations)

  // Find selected location name for display
  const selectedLoc = value ? locations.find((l) => l.id === value) : null

  // Build path for display
  const getPath = (id: string): string[] => {
    const parts: string[] = []
    let current = locations.find((l) => l.id === id)
    while (current) {
      parts.unshift(current.name)
      current = current.parent_id ? locations.find((l) => l.id === current!.parent_id) : undefined
    }
    return parts
  }

  const displayText = selectedLoc ? getPath(selectedLoc.id).join(' > ') : placeholder

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderNode = (node: LocationTreeNode, depth: number) => {
    const hasChildren = node.children.length > 0
    const isExpanded = expanded.has(node.id)
    const isSelected = value === node.id

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1 py-1.5 px-2 cursor-pointer rounded text-[13px] transition-colors ${
            isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent text-foreground"
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasChildren && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(node.id) }}
              className="size-4 flex items-center justify-center text-muted-foreground"
            >
              <ChevronRight className={`size-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            </button>
          )}
          {!hasChildren && <span className="size-4" />}
          <span
            className="flex-1 truncate"
            onClick={() => { onChange(node.id); setOpen(false) }}
          >
            {node.name}
          </span>
          {node.label && (
            <span className="text-[10px] text-muted-foreground font-mono">{node.label}</span>
          )}
        </div>
        {isExpanded && hasChildren && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-[13px] text-left hover:bg-accent transition-colors"
      >
        <span className={selectedLoc ? "text-foreground" : "text-muted-foreground"}>
          {displayText}
        </span>
        <ChevronRight className={`size-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border bg-card shadow-md">
          <div
            className="py-1.5 px-2 cursor-pointer text-[13px] text-muted-foreground hover:bg-accent rounded mx-1 mt-1"
            onClick={() => { onChange(null); setOpen(false) }}
          >
            No location (unsorted)
          </div>
          <div className="border-t my-1" />
          {tree.map((node) => renderNode(node, 0))}
        </div>
      )}
    </div>
  )
}
