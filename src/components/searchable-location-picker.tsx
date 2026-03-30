"use client"

import { useState, useRef, useEffect } from "react"
import { Search, X, MapPin, Package, Minus, Server, DoorOpen, Plus } from "lucide-react"

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
  onCreateBin?: (name: string, parentId: string) => Promise<string | void>
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
  onCreateBin,
  placeholder = "Search locations...",
  className = "",
}: SearchableLocationPickerProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newBinName, setNewBinName] = useState("")
  const [newBinParent, setNewBinParent] = useState("")
  const [creating, setCreating] = useState(false)
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

  const lastUsedId = typeof window !== "undefined" ? localStorage.getItem("eyo_last_bin_id") : null

  const filtered = (() => {
    const base = query.trim()
      ? locations.filter((l) => l.name.toLowerCase().includes(query.toLowerCase()) || l.path.toLowerCase().includes(query.toLowerCase()))
      : locations
    // Put last-used location at the top
    if (lastUsedId && !query.trim()) {
      const idx = base.findIndex((l) => l.id === lastUsedId)
      if (idx > 0) {
        const copy = [...base]
        const [item] = copy.splice(idx, 1)
        return [item, ...copy]
      }
    }
    return base
  })()

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

            {/* Create new bin */}
            {onCreateBin && !showCreate && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-left text-[12px] text-primary hover:bg-accent transition-colors border-b"
              >
                <Plus className="size-3" />
                Create new bin
              </button>
            )}
            {onCreateBin && showCreate && (
              <div className="px-3 py-2 space-y-2 border-b bg-accent/30">
                <input
                  type="text"
                  value={newBinName}
                  onChange={(e) => setNewBinName(e.target.value)}
                  placeholder="Bin name (e.g., Power Tools)"
                  className="w-full rounded border bg-background px-2 py-1 text-[12px]"
                  autoFocus
                />
                <select
                  value={newBinParent}
                  onChange={(e) => setNewBinParent(e.target.value)}
                  className="w-full rounded border bg-background px-2 py-1 text-[12px]"
                >
                  <option value="">Select parent shelf...</option>
                  {locations.filter((l) => l.subtype === "shelf" || l.subtype === "drawer").map((l) => (
                    <option key={l.id} value={l.id}>{l.path}</option>
                  ))}
                </select>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={!newBinName.trim() || !newBinParent || creating}
                    onClick={async () => {
                      setCreating(true)
                      const id = await onCreateBin(newBinName.trim(), newBinParent)
                      if (id) {
                        onChange(id as string)
                        setOpen(false)
                      }
                      setShowCreate(false)
                      setNewBinName("")
                      setNewBinParent("")
                      setCreating(false)
                    }}
                    className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setNewBinName(""); setNewBinParent("") }}
                    className="rounded border px-2 py-1 text-[11px] font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {filtered.length === 0 && query.trim() && (
              <div className="px-3 py-4 text-[12px] text-muted-foreground text-center">
                No locations match &quot;{query}&quot;
              </div>
            )}

            {filtered.map((loc) => {
              const Icon = getIcon(loc.type, loc.subtype)
              const isSelected = value === loc.id
              const isSearching = !!query.trim()
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => { onChange(loc.id); setQuery(""); setOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                  style={{ paddingLeft: isSearching ? "12px" : `${12 + loc.depth * 12}px` }}
                >
                  <Icon className={`size-3 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-[12px] truncate ${isSelected ? "text-primary font-medium" : ""}`}>
                    {isSearching ? loc.path : loc.name}
                  </span>
                  {!isSearching && loc.subtype && (
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
