import { StorageFilterProvider } from "@/components/storage-filter-provider"
import { StorageFilterBar } from "@/components/storage-filter-bar"

export default function StorageLayout({ children }: { children: React.ReactNode }) {
  return (
    <StorageFilterProvider>
      <StorageFilterBar />
      {children}
    </StorageFilterProvider>
  )
}
