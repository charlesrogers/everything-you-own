"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ProductForm } from "@/components/product-form"

function NewProductContent() {
  const searchParams = useSearchParams()
  const locationId = searchParams.get("location")

  return (
    <div className="max-w-2xl">
      <h1 className="text-[20px] font-bold mb-6">Add Product</h1>
      <ProductForm mode="create" assignToLocationId={locationId} />
    </div>
  )
}

export default function NewProductPage() {
  return (
    <Suspense>
      <NewProductContent />
    </Suspense>
  )
}
