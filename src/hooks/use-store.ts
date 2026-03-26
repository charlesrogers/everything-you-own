'use client'

import { useMemo } from 'react'
import { useAuth } from '@/components/auth-provider'
import { USE_SUPABASE } from '@/lib/feature-flags'
import { createClient } from '@/lib/supabase/client'
import * as sbStore from '@/lib/supabase-store'
import * as wmsStore from '@/lib/wms-store'
import * as wmsLocalStore from '@/lib/wms-local-store'
import * as localStore from '@/lib/store'
import type { Product, Category, Subcategory, RelationshipType, ProductStatus, ProductOwnership, SortField, SortDirection } from '@/lib/types'
import type { CreateLocationInput, AddProductToLocationInput, LogUsageInput } from '@/lib/wms-types'

export function useStore() {
  const { user, householdId } = useAuth()

  return useMemo(() => {
    if (!USE_SUPABASE) {
      // Wrap localStorage functions as async for uniform interface
      return {
        getCategories: async () => localStore.getCategories(),
        addCategory: async (name: string) => localStore.addCategory(name),
        updateCategory: async (id: string, updates: Partial<Category>) => localStore.updateCategory(id, updates),
        deleteCategory: async (id: string) => localStore.deleteCategory(id),
        getSubcategories: async (categoryId?: string) => localStore.getSubcategories(categoryId),
        addSubcategory: async (categoryId: string, name: string) => localStore.addSubcategory(categoryId, name),
        updateSubcategory: async (id: string, updates: Partial<Subcategory>) => localStore.updateSubcategory(id, updates),
        deleteSubcategory: async (id: string) => localStore.deleteSubcategory(id),
        getProducts: async () => localStore.getProducts(),
        getProduct: async (id: string) => localStore.getProduct(id),
        addProduct: async (product: Omit<Product, 'id' | 'date_added' | 'created_at' | 'updated_at'>) => localStore.addProduct(product),
        updateProduct: async (id: string, updates: Partial<Product>) => localStore.updateProduct(id, updates),
        deleteProduct: async (id: string) => localStore.deleteProduct(id),
        searchProducts: async (query: string) => localStore.searchProducts(query),
        filterProducts: async (options: {
          status?: ProductStatus | 'all'
          categoryId?: string
          subcategoryId?: string
          query?: string
          sortField?: SortField
          sortDirection?: SortDirection
          ownership?: ProductOwnership | 'all'
          hideConsumables?: boolean
        }) => localStore.filterProducts(options),
        checkDuplicates: async (input: { name?: string; brand?: string; sku?: string; upc?: string; source_url?: string; excludeId?: string }) => localStore.checkDuplicates(input),
        getRelationships: async () => localStore.getRelationships(),
        addRelationship: async (productA: string, productB: string, type: RelationshipType, notes?: string) => localStore.addRelationship(productA, productB, type, notes),
        deleteRelationship: async (id: string) => localStore.deleteRelationship(id),
        getRelatedProducts: async (productId: string) => localStore.getRelatedProducts(productId),
        getReturnAlerts: async () => localStore.getReturnAlerts(),
        getWarrantyAlerts: async () => localStore.getWarrantyAlerts(),
        getSpendingByCategory: async () => localStore.getSpendingByCategory(),
        getRecentProducts: async (limit: number) => localStore.getRecentProducts(limit),
        getMonthlySpending: async (tag?: string) => localStore.getMonthlySpending(tag),
        getStatusDistribution: async () => localStore.getStatusDistribution(),
        getOwnershipDistribution: async () => localStore.getOwnershipDistribution(),
        getTopExpensiveProducts: async (limit: number) => localStore.getTopExpensiveProducts(limit),
        getAllTags: async () => localStore.getAllTags(),
        getMonthOverMonthComparison: async () => localStore.getMonthOverMonthComparison(),
        getProductCountsByCategory: async () => localStore.getProductCountsByCategory(),
        getProductCountsBySubcategory: async () => localStore.getProductCountsBySubcategory(),
        exportAllData: async () => localStore.exportAllData(),
        importAllData: async (json: string) => localStore.importAllData(json),
        clearAllData: async () => localStore.clearAllData(),
        isInitialized: async () => localStore.isInitialized(),
        seedDefaultTaxonomy: async () => localStore.seedDefaultTaxonomy(),
        ensureDefaultCategories: async () => localStore.ensureDefaultCategories(),
        getImportedEmailIds: async () => {
          const raw = localStorage.getItem('eyo_imported_emails')
          return new Set<string>(raw ? JSON.parse(raw) : [])
        },
        markEmailsImported: async (ids: string[]) => {
          const raw = localStorage.getItem('eyo_imported_emails')
          const existing: string[] = raw ? JSON.parse(raw) : []
          const merged = [...new Set([...existing, ...ids])]
          localStorage.setItem('eyo_imported_emails', JSON.stringify(merged))
        },

        // --- WMS (localStorage) ---
        getLocations: async () => wmsLocalStore.getLocations(),
        getLocation: async (id: string) => wmsLocalStore.getLocation(id),
        getLocationByShortId: async (shortId: string) => wmsLocalStore.getLocationByShortId(shortId),
        createLocation: async (input: CreateLocationInput) => wmsLocalStore.createLocation(input),
        updateLocation: async (id: string, updates: Parameters<typeof wmsLocalStore.updateLocation>[1]) => wmsLocalStore.updateLocation(id, updates),
        deleteLocation: async (id: string) => wmsLocalStore.deleteLocation(id),
        getLocationBreadcrumbs: async (id: string) => wmsLocalStore.getLocationBreadcrumbs(id),
        getLocationContents: async (id: string) => wmsLocalStore.getLocationContents(id),
        getProductLocations: async (productId: string) => wmsLocalStore.getProductLocations(productId),
        addProductToLocation: async (input: AddProductToLocationInput) => wmsLocalStore.addProductToLocation(input),
        removeProductFromLocation: async (id: string) => wmsLocalStore.removeProductFromLocation(id),
        moveProduct: async (productLocationId: string, newLocationId: string) => wmsLocalStore.moveProduct(productLocationId, newLocationId),
        getUnsortedProducts: async () => wmsLocalStore.getUnsortedProducts(),
        getUnsortedCount: async () => wmsLocalStore.getUnsortedCount(),
        getItemCountsByLocation: async () => wmsLocalStore.getItemCountsByLocation(),
        getLocationTemplates: async () => wmsLocalStore.getLocationTemplates(),
        seedBasementStorage: async () => wmsLocalStore.seedBasementStorage(),
        logUsage: async (input: LogUsageInput) => wmsLocalStore.logUsage(input),
        getUsageLog: async (productId: string, limit?: number) => wmsLocalStore.getUsageLog(productId, limit),
        getLowStockProducts: async () => wmsLocalStore.getLowStockProducts(),
      }
    }

    // Supabase mode — bind all functions with client + householdId
    const sb = createClient()
    const hid = householdId || ''
    const uid = user?.id || null

    return {
      getCategories: () => sbStore.getCategories(sb, hid),
      addCategory: (name: string) => sbStore.addCategory(sb, hid, name),
      updateCategory: (id: string, updates: Partial<Category>) => sbStore.updateCategory(sb, id, updates),
      deleteCategory: (id: string) => sbStore.deleteCategory(sb, id),
      getSubcategories: (categoryId?: string) => sbStore.getSubcategories(sb, hid, categoryId),
      addSubcategory: (categoryId: string, name: string) => sbStore.addSubcategory(sb, hid, categoryId, name),
      updateSubcategory: (id: string, updates: Partial<Subcategory>) => sbStore.updateSubcategory(sb, id, updates),
      deleteSubcategory: (id: string) => sbStore.deleteSubcategory(sb, id),
      getProducts: () => sbStore.getProducts(sb, hid),
      getProduct: (id: string) => sbStore.getProduct(sb, id),
      addProduct: (product: Omit<Product, 'id' | 'date_added' | 'created_at' | 'updated_at'>) => sbStore.addProduct(sb, hid, uid, product),
      updateProduct: (id: string, updates: Partial<Product>) => sbStore.updateProduct(sb, id, updates),
      deleteProduct: (id: string) => sbStore.deleteProduct(sb, id),
      searchProducts: (query: string) => sbStore.searchProducts(sb, hid, query),
      filterProducts: (options: {
        status?: ProductStatus | 'all'
        categoryId?: string
        subcategoryId?: string
        query?: string
        sortField?: SortField
        sortDirection?: SortDirection
        ownership?: ProductOwnership | 'all'
        hideConsumables?: boolean
      }) => sbStore.filterProducts(sb, hid, options),
      checkDuplicates: (input: { name?: string; brand?: string; sku?: string; upc?: string; source_url?: string; excludeId?: string }) => sbStore.checkDuplicates(sb, hid, input),
      getRelationships: () => sbStore.getRelationships(sb, hid),
      addRelationship: (productA: string, productB: string, type: RelationshipType, notes?: string) => sbStore.addRelationship(sb, hid, productA, productB, type, notes),
      deleteRelationship: (id: string) => sbStore.deleteRelationship(sb, id),
      getRelatedProducts: (productId: string) => sbStore.getRelatedProducts(sb, productId),
      getReturnAlerts: () => sbStore.getReturnAlerts(sb, hid),
      getWarrantyAlerts: () => sbStore.getWarrantyAlerts(sb, hid),
      getSpendingByCategory: () => sbStore.getSpendingByCategory(sb, hid),
      getRecentProducts: (limit: number) => sbStore.getRecentProducts(sb, hid, limit),
      getMonthlySpending: (tag?: string) => sbStore.getMonthlySpending(sb, hid, tag),
      getStatusDistribution: () => sbStore.getStatusDistribution(sb, hid),
      getOwnershipDistribution: () => sbStore.getOwnershipDistribution(sb, hid),
      getTopExpensiveProducts: (limit: number) => sbStore.getTopExpensiveProducts(sb, hid, limit),
      getAllTags: () => sbStore.getAllTags(sb, hid),
      getMonthOverMonthComparison: () => sbStore.getMonthOverMonthComparison(sb, hid),
      getProductCountsByCategory: () => sbStore.getProductCountsByCategory(sb, hid),
      getProductCountsBySubcategory: () => sbStore.getProductCountsBySubcategory(sb, hid),
      exportAllData: () => sbStore.exportAllData(sb, hid),
      importAllData: (json: string) => sbStore.importAllData(sb, hid, uid, json),
      clearAllData: () => sbStore.clearAllData(sb, hid),
      isInitialized: () => sbStore.isInitialized(sb, hid),
      seedDefaultTaxonomy: () => sbStore.seedDefaultTaxonomy(sb, hid),
      ensureDefaultCategories: () => sbStore.ensureDefaultCategories(sb, hid),
      getImportedEmailIds: () => sbStore.getImportedEmailIds(sb, hid),
      markEmailsImported: (ids: string[]) => sbStore.markEmailsImported(sb, hid, ids),

      // --- WMS ---
      getLocations: () => wmsStore.getLocations(sb, hid),
      getLocation: (id: string) => wmsStore.getLocation(sb, id),
      getLocationByShortId: (shortId: string) => wmsStore.getLocationByShortId(sb, shortId),
      createLocation: (input: CreateLocationInput) => wmsStore.createLocation(sb, hid, input),
      updateLocation: (id: string, updates: Parameters<typeof wmsStore.updateLocation>[2]) => wmsStore.updateLocation(sb, id, updates),
      deleteLocation: (id: string) => wmsStore.deleteLocation(sb, id),
      getLocationBreadcrumbs: (id: string) => wmsStore.getLocationBreadcrumbs(sb, id),
      getLocationContents: (id: string) => wmsStore.getLocationContents(sb, id),
      getProductLocations: (productId: string) => wmsStore.getProductLocations(sb, productId),
      addProductToLocation: (input: AddProductToLocationInput) => wmsStore.addProductToLocation(sb, hid, uid, input),
      removeProductFromLocation: (id: string) => wmsStore.removeProductFromLocation(sb, id),
      moveProduct: (productLocationId: string, newLocationId: string) => wmsStore.moveProduct(sb, hid, uid, productLocationId, newLocationId),
      getUnsortedProducts: () => wmsStore.getUnsortedProducts(sb, hid),
      getUnsortedCount: () => wmsStore.getUnsortedCount(sb, hid),
      getItemCountsByLocation: () => wmsStore.getItemCountsByLocation(sb, hid),
      getLocationTemplates: () => wmsStore.getLocationTemplates(sb),
      seedBasementStorage: () => wmsStore.seedBasementStorage(sb, hid),
      logUsage: (input: LogUsageInput) => wmsStore.logUsage(sb, hid, uid, input),
      getUsageLog: (productId: string, limit?: number) => wmsStore.getUsageLog(sb, productId, limit),
      getLowStockProducts: () => wmsStore.getLowStockProducts(sb, hid),
    }
  }, [user, householdId])
}
