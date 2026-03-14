import { Badge } from "@/components/ui/badge"
import { ProductStatus } from "@/lib/types"

const statusConfig: Record<ProductStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  purchased: { label: "Purchased", variant: "default" },
  wishlist: { label: "Wishlist", variant: "secondary" },
  returned: { label: "Returned", variant: "destructive" },
  gifted: { label: "Gifted", variant: "outline" },
  sold: { label: "Sold", variant: "outline" },
}

export function StatusBadge({ status }: { status: ProductStatus }) {
  const config = statusConfig[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
