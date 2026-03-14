"use client"

import { ProductForm } from "@/components/product-form"

export default function NewProductPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-[20px] font-bold mb-6">Add Product</h1>
      <ProductForm mode="create" />
    </div>
  )
}
