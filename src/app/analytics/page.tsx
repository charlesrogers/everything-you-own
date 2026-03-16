"use client"

import { useEffect, useState } from "react"
import { Filter } from "lucide-react"
import {
  getMonthlySpending,
  getSpendingByCategory,
  getStatusDistribution,
  getOwnershipDistribution,
  getTopExpensiveProducts,
  getAllTags,
  getMonthOverMonthComparison,
  type MonthlySpending,
  type CategorySpending,
  type MonthComparison,
} from "@/lib/store"
import type { Product } from "@/lib/types"
import { MonthlySpendingChart } from "@/components/analytics/monthly-spending-chart"
import { CategoryBreakdownChart } from "@/components/analytics/category-breakdown-chart"
import { StatusDistributionChart } from "@/components/analytics/status-distribution-chart"
import { MonthComparisonCard } from "@/components/analytics/month-comparison-card"
import { TopItemsList } from "@/components/analytics/top-items-list"
import { OwnershipChart } from "@/components/analytics/ownership-chart"

export default function AnalyticsPage() {
  const [monthly, setMonthly] = useState<MonthlySpending[]>([])
  const [byCategory, setByCategory] = useState<CategorySpending[]>([])
  const [statusDist, setStatusDist] = useState<{ status: string; count: number }[]>([])
  const [ownershipDist, setOwnershipDist] = useState<{ ownership: string; count: number }[]>([])
  const [topItems, setTopItems] = useState<Product[]>([])
  const [comparison, setComparison] = useState<MonthComparison[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [selectedTag, setSelectedTag] = useState<string>("")

  useEffect(() => {
    setTags(getAllTags())
    loadData()
  }, [])

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTag])

  function loadData() {
    setMonthly(getMonthlySpending(selectedTag || undefined))
    setByCategory(getSpendingByCategory())
    setStatusDist(getStatusDistribution())
    setOwnershipDist(getOwnershipDistribution())
    setTopItems(getTopExpensiveProducts(10))
    setComparison(getMonthOverMonthComparison())
  }

  const totalSpend = monthly.reduce((s, m) => s + m.amount, 0)
  const totalItems = statusDist.reduce((s, d) => s + d.count, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold">Analytics</h1>
          <p className="text-[12px] text-muted-foreground">
            {totalItems} items tracked &middot; ${totalSpend.toFixed(2)} total spend
          </p>
        </div>
        {tags.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" />
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="text-[12px] bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-foreground"
            >
              <option value="">All items</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Month-over-month comparison */}
      <section>
        <h2 className="text-[15px] font-semibold mb-3">Month over Month</h2>
        <MonthComparisonCard data={comparison} />
      </section>

      {/* Two-column grid for charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-4">
          <h2 className="text-[15px] font-semibold mb-3">Spending Over Time</h2>
          <MonthlySpendingChart data={monthly} />
        </section>

        <section className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-4">
          <h2 className="text-[15px] font-semibold mb-3">By Category</h2>
          <CategoryBreakdownChart data={byCategory} />
        </section>

        <section className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-4">
          <h2 className="text-[15px] font-semibold mb-3">Status Breakdown</h2>
          <StatusDistributionChart data={statusDist} />
        </section>

        <section className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-4">
          <h2 className="text-[15px] font-semibold mb-3">By Ownership</h2>
          <OwnershipChart data={ownershipDist} />
        </section>
      </div>

      {/* Top items */}
      <section className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-4">
        <h2 className="text-[15px] font-semibold mb-3">Top 10 Most Expensive</h2>
        <TopItemsList data={topItems} />
      </section>
    </div>
  )
}
