"use client"

import { useState, useRef, useEffect } from "react"
import { Search, X, MapPin, Package, Minus, Server, DoorOpen } from "lucide-react"

interface LocationOption {
  id: string
  name: string
  path: string
  depth: number
  type: string
  subtype: string | null
}

interface SearchableLocationPickerProps {
  locations: LocationOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  className?: string
}

function getIcon(type: string, subtype: string | null) {
  if (subtype === "bin") return Package
  if (subtype === "shelf" || subtype === "drawer") return Minus
  if (subtype === "rack") return Server
  if (type === "room") return DoorOpen
  return MapPin
}

export function SearchableLocationPicker({
  locations,
  value,
  onChange,
  placeholder = "Search locations...",
  className = "",
}: SearchableLocationPickerProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = locations.find((l) => l.id === value)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const filtered = query.trim()
    ? locations.filter((l) => l.name.toLowerCase().includes(query.toLowerCase()) || l.path.toLowerCase().includes(query.toLowerCase()))
    : locations

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Display / trigger */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-left text-[13px] hover:bg-accent transition-colors"
        >
          {selected ? (
            <>
              {(() => { const Icon = getIcon(selected.type, selected.subtype); return <Icon className="size-3.5 text-muted-foreground shrink-0" /> })()}
              <span className="truncate">{selected.path}</span>
            </>
          ) : (
            <span className="text-muted-foreground">No location (unsorted)</span>
          )}
        </button>
      ) : (
        <div className="rounded-lg border bg-card shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="relative border-b">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-9 pr-8 py-2 text-[13px] bg-transparent outline-none"
              autoFocus
            />
            {(query || value) && (
              <button
                type="button"
                onClick={() => { setQuery(""); onChange(""); setOpen(false) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-64 overflow-y-auto">
            {/* No location option */}
            <button
              type="button"
              onClick={() => { onChange(""); setQuery(""); setOpen(false) }}
              className={`w-full px-3 py-2 text-left text-[12px] hover:bg-accent transition-colors ${!value ? "bg-primary/5 text-primary" : "text-muted-foreground"}`}
            >
              No location (unsorted)
            </button>

            {filtered.length === 0 && query.trim() && (
              <div className="px-3 py-4 text-[12px] text-muted-foreground text-center">
                No locations match &quot;{query}&quot;
              </div>
            )}

            {filtered.map((loc) => {
              const Icon = getIcon(loc.type, loc.subtype)
              const isSelected = value === loc.id
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => { onChange(loc.id); setQuery(""); setOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                  style={{ paddingLeft: `${12 + loc.depth * 12}px` }}
                >
                  <Icon className={`size-3 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-[12px] truncate ${isSelected ? "text-primary font-medium" : ""}`}>
                    {loc.name}
                  </span>
                  {loc.subtype && (
                    <span className="text-[9px] text-muted-foreground/50 shrink-0">
                      {loc.subtype}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Build a flat, tree-ordered list of locations with depth for indentation.
 * Does a depth-first traversal of the location tree.
 */
export function buildLocationOptions(
  locations: Array<{ id: string; name: string; parent_id: string | null; location_type: string; unit_subtype: string | null }>
): LocationOption[] {
  const locMap = new Map(locations.map((l) => [l.id, l]))
  const childMap = new Map<string | null, typeof locations>()
  for (const loc of locations) {
    const pid = loc.parent_id
    if (!childMap.has(pid)) childMap.set(pid, [])
    childMap.get(pid)!.push(loc)
  }

  function getPath(id: string): string {
    const parts: string[] = []
    let cur = locMap.get(id)
    while (cur) {
      parts.unshift(cur.name)
      cur = cur.parent_id ? locMap.get(cur.parent_id) : undefined
    }
    return parts.join(" \u203a ")
  }

  const result: LocationOption[] = []
  function walk(parentId: string | null, depth: number) {
    const children = childMap.get(parentId) ?? []
    for (const child of children) {
      result.push({
        id: child.id,
        name: child.name,
        path: getPath(child.id),
        depth,
        type: child.location_type,
        subtype: child.unit_subtype,
      })
      walk(child.id, depth + 1)
    }
  }
  walk(null, 0)
  return result
}
