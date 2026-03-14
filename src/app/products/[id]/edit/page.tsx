"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ProductForm } from "@/components/product-form"
import { Product } from "@/lib/types"
import { getProduct } from "@/lib/store"

export default function EditProductPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)

  useEffect(() => {
    const p = getProduct(params.id as string)
    if (!p) {
      router.push("/products")
      return
    }
    setProduct(p)
  }, [params.id, router])

  if (!product) return null

  return (
    <div className="max-w-2xl">
      <h1 className="text-[20px] font-bold mb-6">Edit Product</h1>
      <ProductForm product={product} mode="edit" />
    </div>
  )
}
