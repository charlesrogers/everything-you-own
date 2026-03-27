"use client"
import { useEffect } from "react"
import { USE_SUPABASE } from "@/lib/feature-flags"
import { isInitialized, seedDefaultTaxonomy } from "@/lib/store"
import { migrateSamlaOrientation as migrateSamlaLocal } from "@/lib/wms-local-store"
import { useAuth } from "@/components/auth-provider"
import { useStore } from "@/hooks/use-store"

export function StoreInitializer() {
  const { isLoading, householdId } = useAuth()
  const store = useStore()

  useEffect(() => {
    if (USE_SUPABASE) {
      // Wait for auth to be ready before hitting Supabase
      if (isLoading || !householdId) return
      store.ensureDefaultCategories()
      store.migrateSamlaOrientation()
    } else {
      if (!isInitialized()) {
        seedDefaultTaxonomy()
      }
      migrateSamlaLocal()
    }
  }, [store, isLoading, householdId])

  return null
}
