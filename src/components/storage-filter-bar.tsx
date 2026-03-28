"use client"

import { useStorageFilter } from "@/components/storage-filter-provider"

export function StorageFilterBar() {
  const {
    filterRoom, setFilterRoom,
    filterUnit, setFilterUnit,
    filterShelf, setFilterShelf,
    filterBinType, setFilterBinType,
    filterUnsorted, setFilterUnsorted,
    hasActiveFilters, clearFilters,
    filterRooms, filterUnits, filterShelves, filterBinTypes,
    locationsLoading,
  } = useStorageFilter()

  if (locationsLoading) return null

  return (
    <div className="border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-medium text-muted-foreground shrink-0">Filter bins:</span>
        <select
          value={filterRoom}
          onChange={(e) => { setFilterRoom(e.target.value); setFilterUnit("all"); setFilterShelf("all") }}
          disabled={filterUnsorted}
          className="rounded-lg border bg-background px-2 py-1 text-[12px] disabled:opacity-40"
        >
          <option value="all">All rooms</option>
          {filterRooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select
          value={filterUnit}
          onChange={(e) => { setFilterUnit(e.target.value); setFilterShelf("all") }}
          disabled={filterUnsorted || filterRoom === "all"}
          className="rounded-lg border bg-background px-2 py-1 text-[12px] disabled:opacity-40"
        >
          <option value="all">All racks</option>
          {filterUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select
          value={filterShelf}
          onChange={(e) => setFilterShelf(e.target.value)}
          disabled={filterUnsorted || (filterRoom === "all" && filterUnit === "all")}
          className="rounded-lg border bg-background px-2 py-1 text-[12px] disabled:opacity-40"
        >
          <option value="all">All shelves</option>
          {filterShelves.map((s) => <option key={s.id} value={s.id}>{s.label ?? s.name}</option>)}
        </select>
        <select
          value={filterBinType}
          onChange={(e) => setFilterBinType(e.target.value)}
          className="rounded-lg border bg-background px-2 py-1 text-[12px]"
        >
          <option value="all">All types</option>
          {filterBinTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button
          onClick={() => {
            setFilterUnsorted(!filterUnsorted)
            if (!filterUnsorted) { setFilterRoom("all"); setFilterUnit("all"); setFilterShelf("all") }
          }}
          className={`rounded-lg border px-2 py-1 text-[12px] font-medium transition-colors ${
            filterUnsorted ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
          }`}
        >
          Unsorted
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
