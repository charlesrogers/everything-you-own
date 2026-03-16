"use client"

import { useState, useMemo } from "react"
import { Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Product } from "@/lib/types"
import type { RelationshipType } from "@/lib/types"
import { searchProducts, addRelationship } from "@/lib/store"
import { AVAILABLE_RELATIONSHIP_TYPES } from "@/lib/relationship-labels"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceProductId: string
  onCreated: () => void
}

export function ProductPickerDialog({ open, onOpenChange, sourceProductId, onCreated }: Props) {
  const [step, setStep] = useState<"search" | "type">("search")
  const [query, setQuery] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [relType, setRelType] = useState<RelationshipType>("goes_with")
  const [notes, setNotes] = useState("")

  const results = useMemo(() => {
    if (!query.trim()) return []
    return searchProducts(query).filter((p) => p.id !== sourceProductId).slice(0, 10)
  }, [query, sourceProductId])

  function handleSelectProduct(product: Product) {
    setSelectedProduct(product)
    setStep("type")
  }

  function handleSave() {
    if (!selectedProduct) return
    addRelationship(sourceProductId, selectedProduct.id, relType, notes || undefined)
    handleClose()
    onCreated()
  }

  function handleClose() {
    setStep("search")
    setQuery("")
    setSelectedProduct(null)
    setRelType("goes_with")
    setNotes("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4" />
            {step === "search" ? "Link Product" : "Choose Relationship"}
          </DialogTitle>
          <DialogDescription>
            {step === "search"
              ? "Search for a product to link"
              : `Linking with "${selectedProduct?.name}"`}
          </DialogDescription>
        </DialogHeader>

        {step === "search" ? (
          <Command shouldFilter={false} className="rounded-xl border">
            <CommandInput
              placeholder="Search products..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                {query.trim() ? "No products found" : "Type to search..."}
              </CommandEmpty>
              <CommandGroup>
                {results.map((product) => (
                  <CommandItem
                    key={product.id}
                    onSelect={() => handleSelectProduct(product)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 w-full">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="size-7 rounded object-cover" />
                      ) : (
                        <div className="size-7 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                          {product.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{product.name}</p>
                        {product.brand && (
                          <p className="text-[11px] text-muted-foreground">{product.brand}</p>
                        )}
                      </div>
                      {product.price != null && (
                        <span className="text-[12px] text-muted-foreground">
                          ${product.price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[13px]">Relationship Type</Label>
              <div className="flex flex-col gap-1.5">
                {AVAILABLE_RELATIONSHIP_TYPES.map((rt) => (
                  <label
                    key={rt.value}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      relType === rt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="relType"
                      value={rt.value}
                      checked={relType === rt.value}
                      onChange={() => setRelType(rt.value)}
                      className="accent-primary"
                    />
                    <span className="text-[13px] font-medium">{rt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rel-notes" className="text-[13px]">Notes (optional)</Label>
              <Input
                id="rel-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., matching set, replaced due to wear..."
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("search")}>
                Back
              </Button>
              <Button onClick={handleSave}>
                Link Products
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
