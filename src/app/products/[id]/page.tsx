"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Edit, Trash2, ExternalLink, Star, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/status-badge"
import { Product, Category, Subcategory } from "@/lib/types"
import { getProduct, getCategories, getSubcategories, deleteProduct } from "@/lib/store"

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [category, setCategory] = useState<Category | undefined>()
  const [subcategory, setSubcategory] = useState<Subcategory | undefined>()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  useEffect(() => {
    const p = getProduct(params.id as string)
    if (!p) {
      router.push("/products")
      return
    }
    setProduct(p)
    const cats = getCategories()
    const subs = getSubcategories()
    setCategory(cats.find((c) => c.id === p.category_id))
    setSubcategory(subs.find((s) => s.id === p.subcategory_id))
  }, [params.id, router])

  if (!product) return null

  function handleDelete() {
    deleteProduct(product!.id)
    router.push("/products")
  }

  const Field = ({ label, value }: { label: string; value?: string | number | null }) => {
    if (!value) return null
    return (
      <div>
        <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</dt>
        <dd className="text-[13px] font-medium mt-0.5">{value}</dd>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/products">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-[20px] font-bold flex-1 truncate">{product.name}</h1>
        <Link href={`/products/${product.id}/edit`}>
          <Button variant="outline" size="sm">
            <Edit className="size-3.5" />
            Edit
          </Button>
        </Link>
        <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6">
        {/* Image */}
        <div className="rounded-xl border overflow-hidden bg-muted aspect-square flex items-center justify-center">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <Package className="size-16 text-muted-foreground/20" />
          )}
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={product.status} />
            {product.condition && product.condition !== "new" && (
              <Badge variant="outline">{product.condition.replace("_", " ")}</Badge>
            )}
            {product.tags?.map((tag) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>

          {product.rating != null && product.rating > 0 && (
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`size-5 ${
                    star <= product.rating! ? "fill-amber-500 text-amber-500" : "text-muted-foreground/20"
                  }`}
                />
              ))}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Brand" value={product.brand} />
            <Field
              label="Category"
              value={`${category?.name || "—"} · ${subcategory?.name || "—"}`}
            />
            <Field label="Price" value={product.price != null ? `$${product.price.toFixed(2)}` : undefined} />
            <Field
              label="Original Price"
              value={product.original_price != null ? `$${product.original_price.toFixed(2)}` : undefined}
            />
            <Field label="Retailer" value={product.retailer} />
            <Field label="SKU" value={product.sku} />
            <Field
              label="Purchase Date"
              value={product.purchase_date ? new Date(product.purchase_date).toLocaleDateString() : undefined}
            />
            <Field label="Order ID" value={product.order_id} />
            <Field label="Material" value={product.material} />
            <Field label="Color" value={product.color} />
            <Field label="Size" value={product.size} />
            <Field label="Condition" value={product.condition} />
            <Field
              label="Return By"
              value={product.return_by_date ? new Date(product.return_by_date).toLocaleDateString() : undefined}
            />
            <Field
              label="Warranty Expires"
              value={
                product.warranty_expires ? new Date(product.warranty_expires).toLocaleDateString() : undefined
              }
            />
          </dl>

          {product.source_url && (
            <a
              href={product.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" />
              View product page
            </a>
          )}

          {product.description && (
            <div>
              <h3 className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Description</h3>
              <p className="text-[13px] leading-relaxed">{product.description}</p>
            </div>
          )}

          {product.notes && (
            <div>
              <h3 className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Notes</h3>
              <p className="text-[13px] leading-relaxed">{product.notes}</p>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Added {new Date(product.date_added).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{product.name}&rdquo;? This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
