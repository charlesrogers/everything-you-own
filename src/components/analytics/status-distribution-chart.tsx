"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

const COLORS: Record<string, string> = {
  purchased: "var(--chart-1)",
  wishlist: "var(--chart-3)",
  returned: "var(--chart-4)",
  gifted: "var(--chart-2)",
  sold: "var(--chart-5)",
}

const LABELS: Record<string, string> = {
  purchased: "Purchased",
  wishlist: "Wishlist",
  returned: "Returned",
  gifted: "Gifted",
  sold: "Sold",
}

interface Props {
  data: { status: string; count: number }[]
}

export function StatusDistributionChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-[12px] text-muted-foreground py-8 text-center">No products yet</p>
  }

  const formatted = data.map((d) => ({
    name: LABELS[d.status] || d.status,
    value: d.count,
    fill: COLORS[d.status] || "var(--muted-foreground)",
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={formatted}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {formatted.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [value, "Items"]}
        />
        <Legend
          formatter={(value) => <span style={{ fontSize: 11, color: "var(--foreground)" }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
