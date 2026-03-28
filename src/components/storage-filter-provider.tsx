"use client"

import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react"
import { useAuth } from "@/components/auth-provider"
import type { Location } from "@/lib/wms-types"
import { SAMLA_BINS } from "@/lib/wms-constants"

interface StorageFilterContextValue {
  // Filter state
  filterRoom: string
  setFilterRoom: (v: string) => void
  filterUnit: string
  setFilterUnit: (v: string) => void
  filterShelf: string
  setFilterShelf: (v: string) => void
  filterBinType: string
  setFilterBinType: (v: string) => void
  filterUnsorted: boolean
  setFilterUnsorted: (v: boolean) => void
  hasActiveFilters: boolean
  clearFilters: () => void

  // Derived filter options (for dropdowns)
  filterRooms: Location[]
  filterUnits: Location[]
  filterShelves: Location[]
  filterBinTypes: { id: string; name: string }[]

  // Location data (shared)
  locations: Location[]
  locMap: Map<string, Location>
  binAncestors: Record<string, { roomId: string | null; unitId: string | null; shelfId: string | null }>

  // Loading state
  locationsLoading: boolean
  reloadLocations: () => Promise<void>
}

const StorageFilterContext = createContext<StorageFilterContextValue | null>(null)

export function useStorageFilter() {
  const ctx = useContext(StorageFilterContext)
  if (!ctx) throw new Error("useStorageFilter must be used within StorageFilterProvider")
  return ctx
}

export function StorageFilterProvider({ children }: { children: ReactNode }) {
  const { isLoading: authLoading } = useAuth()
  const [locations, setLocations] = useState<Location[]>([])
  const [locationsLoading, setLocationsLoading] = useState(true)

  // Filter state
  const [filterRoom, setFilterRoom] = useState("all")
  const [filterUnit, setFilterUnit] = useState("all")
  const [filterShelf, setFilterShelf] = useState("all")
  const [filterBinType, setFilterBinType] = useState("all")
  const [filterUnsorted, setFilterUnsorted] = useState(false)

  const hasActiveFilters = filterRoom !== "all" || filterUnit !== "all" || filterShelf !== "all" || filterBinType !== "all" || filterUnsorted

  function clearFilters() {
    setFilterRoom("all")
    setFilterUnit("all")
    setFilterShelf("all")
    setFilterBinType("all")
    setFilterUnsorted(false)
  }

  // Load locations once
  async function loadLocations() {
    try {
      const res = await fetch("/api/storage")
      const data = await res.json()
      setLocations(data.locations ?? [])
    } catch (err) {
      console.error("Failed to load locations for filters:", err)
    } finally {
      setLocationsLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    loadLocations()
  }, [authLoading])

  // Location map
  const locMap = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations])

  // Precompute ancestors for each bin
  const binAncestors = useMemo(() => {
    const result: Record<string, { roomId: string | null; unitId: string | null; shelfId: string | null }> = {}
    for (const loc of locations) {
      if (loc.unit_subtype !== "bin") continue
      let roomId: string | null = null
      let unitId: string | null = null
      let shelfId: string | null = null
      let cur = loc.parent_id ? locMap.get(loc.parent_id) : undefined
      while (cur) {
        if (!shelfId && (cur.unit_subtype === "shelf" || cur.unit_subtype === "drawer")) shelfId = cur.id
        if (!unitId && cur.location_type === "unit") unitId = cur.id
        if (!roomId && cur.location_type === "room") roomId = cur.id
        cur = cur.parent_id ? locMap.get(cur.parent_id) : undefined
      }
      result[loc.id] = { roomId, unitId, shelfId }
    }
    return result
  }, [locations, locMap])

  const allBins = useMemo(() => locations.filter((l) => l.unit_subtype === "bin"), [locations])

  // Cascading filter options
  const filterRooms = useMemo(() => {
    const ids = new Set(Object.values(binAncestors).map((a) => a.roomId).filter(Boolean) as string[])
    return [...ids].map((id) => locMap.get(id)!).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  }, [binAncestors, locMap])

  const filterUnits = useMemo(() => {
    const ids = new Set(
      Object.values(binAncestors)
        .filter((a) => filterRoom === "all" || a.roomId === filterRoom)
        .map((a) => a.unitId)
        .filter(Boolean) as string[]
    )
    return [...ids].map((id) => locMap.get(id)!).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  }, [binAncestors, locMap, filterRoom])

  const filterShelves = useMemo(() => {
    const ids = new Set(
      Object.values(binAncestors)
        .filter((a) => (filterRoom === "all" || a.roomId === filterRoom) && (filterUnit === "all" || a.unitId === filterUnit))
        .map((a) => a.shelfId)
        .filter(Boolean) as string[]
    )
    return [...ids].map((id) => locMap.get(id)!).filter(Boolean).sort((a, b) => a.sort_order - b.sort_order)
  }, [binAncestors, locMap, filterRoom, filterUnit])

  const filterBinTypes = useMemo(() => {
    const ids = new Set(allBins.map((b) => b.template_id ?? "none"))
    return [...ids].sort().map((id) => {
      if (id === "none") return { id: "none", name: "Custom / No type" }
      const samla = SAMLA_BINS.find((b) => b.id === id)
      return { id, name: samla ? samla.name : id }
    })
  }, [allBins])

  const value: StorageFilterContextValue = {
    filterRoom, setFilterRoom,
    filterUnit, setFilterUnit,
    filterShelf, setFilterShelf,
    filterBinType, setFilterBinType,
    filterUnsorted, setFilterUnsorted,
    hasActiveFilters, clearFilters,
    filterRooms, filterUnits, filterShelves, filterBinTypes,
    locations, locMap, binAncestors,
    locationsLoading,
    reloadLocations: loadLocations,
  }

  return (
    <StorageFilterContext.Provider value={value}>
      {children}
    </StorageFilterContext.Provider>
  )
}
