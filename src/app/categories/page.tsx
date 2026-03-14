"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Category, Subcategory } from "@/lib/types"
import {
  getCategories,
  getSubcategories,
  addCategory,
  updateCategory,
  deleteCategory,
  addSubcategory,
  updateSubcategory,
  deleteSubcategory,
  getProductCountsByCategory,
  getProductCountsBySubcategory,
} from "@/lib/store"

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [newCatName, setNewCatName] = useState("")
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null)
  const [newSubName, setNewSubName] = useState("")
  const [catCounts, setCatCounts] = useState<Record<string, number>>({})
  const [subCounts, setSubCounts] = useState<Record<string, number>>({})

  function refresh() {
    setCategories(getCategories())
    setSubcategories(getSubcategories())
    setCatCounts(getProductCountsByCategory())
    setSubCounts(getProductCountsBySubcategory())
  }

  useEffect(refresh, [])

  function toggleExpanded(id: string) {
    const next = new Set(expanded)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpanded(next)
  }

  function handleAddCategory() {
    if (!newCatName.trim()) return
    addCategory(newCatName.trim())
    setNewCatName("")
    refresh()
  }

  function handleAddSubcategory(categoryId: string) {
    if (!newSubName.trim()) return
    addSubcategory(categoryId, newSubName.trim())
    setNewSubName("")
    setAddingSubTo(null)
    refresh()
  }

  function startEditing(id: string, currentName: string) {
    setEditingId(id)
    setEditValue(currentName)
  }

  function saveEdit(type: "category" | "subcategory") {
    if (!editingId || !editValue.trim()) return
    if (type === "category") {
      updateCategory(editingId, { name: editValue.trim() })
    } else {
      updateSubcategory(editingId, { name: editValue.trim() })
    }
    setEditingId(null)
    refresh()
  }

  function handleDeleteCategory(id: string) {
    if (catCounts[id]) return // Don't delete categories with products
    deleteCategory(id)
    refresh()
  }

  function handleDeleteSubcategory(id: string) {
    if (subCounts[id]) return
    deleteSubcategory(id)
    refresh()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-[20px] font-bold mb-6">Categories</h1>

      <div className="space-y-1">
        {categories.map((cat) => {
          const isExpanded = expanded.has(cat.id)
          const subs = subcategories.filter((s) => s.category_id === cat.id)

          return (
            <div key={cat.id}>
              <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 group">
                <button onClick={() => toggleExpanded(cat.id)} className="shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </button>
                <GripVertical className="size-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 cursor-grab" />

                {editingId === cat.id ? (
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => saveEdit("category")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit("category")
                      if (e.key === "Escape") setEditingId(null)
                    }}
                    className="h-7 text-[13px]"
                    autoFocus
                  />
                ) : (
                  <span
                    className="text-[13px] font-medium flex-1 cursor-pointer"
                    onDoubleClick={() => startEditing(cat.id, cat.name)}
                  >
                    {cat.name}
                  </span>
                )}

                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {catCounts[cat.id] || 0}
                </span>

                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => {
                    setAddingSubTo(cat.id)
                    setExpanded(new Set([...expanded, cat.id]))
                  }}
                >
                  <Plus className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover:opacity-100 text-destructive"
                  onClick={() => handleDeleteCategory(cat.id)}
                  disabled={!!catCounts[cat.id]}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>

              {isExpanded && (
                <div className="ml-8 space-y-0.5">
                  {subs.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-muted/50 group/sub"
                    >
                      {editingId === sub.id ? (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEdit("subcategory")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit("subcategory")
                            if (e.key === "Escape") setEditingId(null)
                          }}
                          className="h-6 text-[12px]"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="text-[12px] text-muted-foreground flex-1 cursor-pointer hover:text-foreground"
                          onDoubleClick={() => startEditing(sub.id, sub.name)}
                        >
                          {sub.name}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                        {subCounts[sub.id] || 0}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-0 group-hover/sub:opacity-100 text-destructive"
                        onClick={() => handleDeleteSubcategory(sub.id)}
                        disabled={!!subCounts[sub.id]}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}
                  {addingSubTo === cat.id && (
                    <div className="flex items-center gap-2 py-1 px-2">
                      <Input
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddSubcategory(cat.id)
                          if (e.key === "Escape") setAddingSubTo(null)
                        }}
                        placeholder="New subcategory name"
                        className="h-6 text-[12px]"
                        autoFocus
                      />
                      <Button size="xs" onClick={() => handleAddSubcategory(cat.id)}>
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add Category */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t">
        <Input
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddCategory()
          }}
          placeholder="New category name"
          className="h-8 text-[13px]"
        />
        <Button size="sm" onClick={handleAddCategory} disabled={!newCatName.trim()}>
          <Plus className="size-3.5" />
          Add Category
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground mt-6">
        Double-click a name to edit. Categories with products cannot be deleted.
      </p>
    </div>
  )
}
