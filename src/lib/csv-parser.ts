/**
 * Simple CSV parser — no dependencies.
 * Handles quoted fields, newline variants, BOM.
 */

const COLUMN_ALIASES: Record<string, string> = {
  product: 'name',
  item: 'name',
  'product name': 'name',
  'item name': 'name',
  cost: 'price',
  amount: 'price',
  total: 'price',
  'unit price': 'price',
  date: 'purchase_date',
  purchased: 'purchase_date',
  'purchase date': 'purchase_date',
  'order date': 'purchase_date',
  store: 'retailer',
  seller: 'retailer',
  vendor: 'retailer',
  merchant: 'retailer',
  category: 'category',
  qty: 'quantity',
  'order id': 'order_id',
  'order number': 'order_id',
  order: 'order_id',
  note: 'notes',
  description: 'notes',
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }
  fields.push(current.trim())
  return fields
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, '')
  const lines = clean.split(/\r?\n/).filter(l => l.trim())

  if (lines.length < 2) return { headers: [], rows: [] }

  // Parse header
  const rawHeaders = parseCsvLine(lines[0])
  const headers = rawHeaders.map(h => {
    const lower = h.toLowerCase().trim()
    return COLUMN_ALIASES[lower] || lower
  })

  // Parse rows
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, j) => {
      if (j < fields.length) row[h] = fields[j]
    })
    // Skip rows without a name
    if (!row.name?.trim()) continue
    rows.push(row)
  }

  return { headers, rows }
}
