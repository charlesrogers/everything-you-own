"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

const COLORS: Record<string, string> = {
  mine: "var(--chart-1)",
  household: "var(--chart-2)",
  partner: "var(--chart-5)",
}

const LABELS: Record<string, string> = {
  mine: "Mine",
  household: "Household",
  partner: "Partner",
}

interface Props {
  data: { ownership: string; count: number }[]
}

export function OwnershipChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-[12px] text-muted-foreground py-8 text-center">No products yet</p>
  }

  const formatted = data.map((d) => ({
    name: LABELS[d.ownership] || d.ownership,
    count: d.count,
    fill: COLORS[d.ownership] || "var(--muted-foreground)",
  }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={formatted} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
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
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {formatted.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
