"use client"
import { useEffect } from "react"
import { isInitialized, seedDefaultTaxonomy } from "@/lib/store"

export function StoreInitializer() {
  useEffect(() => {
    if (!isInitialized()) {
      seedDefaultTaxonomy()
    }
  }, [])
  return null
}
