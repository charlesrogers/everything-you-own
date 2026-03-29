import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface EmailInput {
  subject: string
  from: string
  date: string
  body: string
}

interface CategoryInput {
  name: string
  subcategories: string[]
}

function buildSystemPrompt(categories?: CategoryInput[]): string {
  const categoryList = categories?.length
    ? categories.map(c => {
        const subs = c.subcategories.length ? ` (subcategories: ${c.subcategories.join(', ')})` : ''
        return `${c.name}${subs}`
      }).join('\n  ')
    : 'Electronics, Clothing, Home, Sports & Outdoors, Health & Beauty, Food & Groceries, Tools & Hardware'

  return `You are a receipt parser. Given email receipt text, extract every purchased product.

Return a JSON array of objects. Each object must have these fields:
- name: string (clean product name, no size/color suffixes unless they're part of the product identity)
- brand: string | null (manufacturer/brand if identifiable)
- price: number | null (unit price in USD, not total for quantity)
- quantity: number (default 1)
- retailer: string (the store/seller name)
- purchase_date: string | null (YYYY-MM-DD format)
- order_id: string | null
- category: string | null (MUST be one of these exact strings, or null if unsure):
  ${categoryList}
- subcategory: string | null (if you can identify a subcategory from the list above, use it exactly; otherwise null)
- is_consumable: boolean (true for groceries, toiletries, supplements, ammo, etc.)

Rules:
- ONLY extract actual purchased products, NOT shipping fees, taxes, gift cards, discounts, subtotals, or summary lines
- If you see "Qty: 2" or "x2", set quantity=2 and price=unit price
- Clean up product names: remove excessive SKU numbers, but keep model numbers that identify the product
- If multiple emails are provided, process each independently
- Return ONLY the JSON array, no markdown, no explanation`
}

export async function POST(request: NextRequest) {
  try {
    const { emails, categories } = await request.json() as { emails: EmailInput[]; categories?: CategoryInput[] }

    if (!emails?.length) {
      return NextResponse.json({ products: [] })
    }

    // Build prompt with all emails delimited
    const emailBlocks = emails.map((e, i) =>
      `=== EMAIL ${i + 1} ===\nFrom: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date}\n\n${e.body.slice(0, 8000)}`
    ).join('\n\n')

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: buildSystemPrompt(categories),
      messages: [{ role: 'user', content: emailBlocks }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ products: [] })
    }

    const products = JSON.parse(jsonMatch[0])
    return NextResponse.json({ products })
  } catch (err) {
    console.error('Parse receipts error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to parse receipts' },
      { status: 500 }
    )
  }
}
