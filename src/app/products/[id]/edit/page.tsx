"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ProductForm } from "@/components/product-form"
import { Product } from "@/lib/types"
import { useStore } from "@/hooks/use-store"
import { LoadingSkeleton } from "@/components/loading-skeleton"

export default function EditProductPage() {
  const params = useParams()
  const router = useRouter()
  const store = useStore()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const p = await store.getProduct(params.id as string)
      if (!p) {
        router.push("/products")
        return
      }
      setProduct(p)
      setLoading(false)
    }
    load()
  }, [params.id, router, store])

  if (loading) return <LoadingSkeleton />

  return (
    <div className="max-w-2xl">
      <h1 className="text-[20px] font-bold mb-6">Edit Product</h1>
      <ProductForm product={product ?? undefined} mode="edit" />
    </div>
  )
}
