// Client-side receipt email parser using DOMParser + regex heuristics

export interface ParsedProduct {
  name: string
  brand: string | null
  price: number | null
  quantity: number
  retailer: string
  order_id: string | null
  purchase_date: string | null
  category_guess: string | null
  is_consumable: boolean
}

export interface ParseResult {
  products: ParsedProduct[]
  order_total: number | null
}

// --- Retailer detection ---

const RETAILER_PATTERNS: [RegExp, string][] = [
  [/amazon\.com/i, "Amazon"],
  [/target\.com/i, "Target"],
  [/walmart\.com/i, "Walmart"],
  [/bestbuy\.com/i, "Best Buy"],
  [/apple\.com/i, "Apple"],
  [/sephora\.com/i, "Sephora"],
  [/ulta\.com/i, "Ulta"],
  [/nordstrom\.com/i, "Nordstrom"],
  [/macys\.com/i, "Macy's"],
  [/kohls\.com/i, "Kohl's"],
  [/costco\.com/i, "Costco"],
  [/homedepot\.com/i, "Home Depot"],
  [/lowes\.com/i, "Lowe's"],
  [/etsy\.com/i, "Etsy"],
  [/ebay\.com/i, "eBay"],
  [/nike\.com/i, "Nike"],
  [/adidas\.com/i, "Adidas"],
  [/zara\.com/i, "Zara"],
  [/hm\.com|h&m/i, "H&M"],
  [/gap\.com/i, "Gap"],
  [/oldnavy\.com/i, "Old Navy"],
  [/ikea\.com/i, "IKEA"],
  [/wayfair\.com/i, "Wayfair"],
  [/chewy\.com/i, "Chewy"],
  [/shopify/i, "Shopify Store"],
]

function detectRetailer(from: string, html: string): string {
  const combined = `${from} ${html.slice(0, 5000)}`
  for (const [pattern, name] of RETAILER_PATTERNS) {
    if (pattern.test(combined)) return name
  }
  // Try to extract from the From header: "Store Name <email@domain>"
  const fromMatch = from.match(/^"?([^"<]+)"?\s*</)
  if (fromMatch) return fromMatch[1].trim()
  return "Unknown"
}

// --- Price extraction ---

function extractPrices(text: string): number[] {
  const matches = text.match(/\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2}))/g) || []
  return matches
    .map((m) => parseFloat(m.replace(/[$,\s]/g, "")))
    .filter((p) => p > 0 && p < 100000)
}

// --- Order ID extraction ---

function extractOrderId(text: string): string | null {
  const patterns = [
    /order\s*#?\s*:?\s*([A-Z0-9][A-Z0-9\-]{4,30})/i,
    /confirmation\s*#?\s*:?\s*([A-Z0-9][A-Z0-9\-]{4,30})/i,
    /order\s+number\s*:?\s*([A-Z0-9][A-Z0-9\-]{4,30})/i,
    /invoice\s*#?\s*:?\s*([A-Z0-9][A-Z0-9\-]{4,30})/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return m[1]
  }
  return null
}

// --- Date extraction ---

function extractDate(dateHeader: string): string | null {
  if (!dateHeader) return null
  try {
    const d = new Date(dateHeader)
    if (isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  } catch {
    return null
  }
}

// --- Category guessing ---

const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/\b(ring|necklace|bracelet|earring|watch|jewelry|jewellery)\b/i, "Jewelry"],
  [/\b(shirt|top|blouse|dress|pants|jeans|jacket|coat|sweater|hoodie|skirt|legging|shorts)\b/i, "Clothing"],
  [/\b(shoe|sneaker|boot|heel|sandal|slipper|loafer)\b/i, "Shoes"],
  [/\b(serum|moisturizer|cleanser|mascara|lipstick|foundation|skincare|makeup|perfume|fragrance|shampoo|conditioner)\b/i, "Beauty & Skincare"],
  [/\b(bag|purse|handbag|wallet|belt|scarf|sunglasses|hat|backpack)\b/i, "Bags & Accessories"],
  [/\b(candle|towel|pillow|blanket|rug|lamp|vase|curtain|bedding|kitchen|cookware)\b/i, "Home"],
  [/\b(baby|toddler|kids|children|onesie|stroller|diaper)\b/i, "Kids & Baby"],
  [/\b(vitamin|supplement|protein|fitness|yoga|wellness)\b/i, "Health & Wellness"],
  [/\b(phone|laptop|tablet|headphone|charger|cable|camera|speaker|computer|monitor|keyboard|mouse)\b/i, "Electronics"],
  [/\b(grocery|food|snack|coffee|tea|supplement)\b/i, "Groceries & Consumables"],
]

function guessCategory(name: string): string | null {
  for (const [pattern, category] of CATEGORY_KEYWORDS) {
    if (pattern.test(name)) return category
  }
  return null
}

// --- HTML text extraction ---

function htmlToText(html: string): string {
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]+>/g, " ")
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")
  // Remove style and script elements
  doc.querySelectorAll("style, script").forEach((el) => el.remove())
  return doc.body?.textContent || ""
}

// --- Product name extraction ---

function extractProductNames(html: string, text: string): string[] {
  const names: string[] = []

  // Strategy 1: Look for text near price patterns in the HTML
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Look for table rows or divs containing both a product-like text and a price
    const cells = doc.querySelectorAll("td, div, tr, li")
    cells.forEach((cell) => {
      const cellText = cell.textContent?.trim() || ""
      // Skip very long cells (likely full email body) and very short ones
      if (cellText.length > 200 || cellText.length < 5) return
      // Must contain a price
      if (!/\$\d/.test(cellText)) return
      // Extract the non-price part as potential product name
      const namePart = cellText
        .replace(/\$\s?\d{1,6}(?:,\d{3})*(?:\.\d{2})?/g, "")
        .replace(/\bQty:?\s*\d+/gi, "")
        .replace(/\bQuantity:?\s*\d+/gi, "")
        .replace(/\bx\s*\d+/gi, "")
        .replace(/\s+/g, " ")
        .trim()
      if (namePart.length >= 5 && namePart.length <= 150 && !/^\d+$/.test(namePart)) {
        names.push(namePart)
      }
    })
  }

  // Strategy 2: Regex patterns from plain text
  if (names.length === 0) {
    // Look for lines that look like item entries
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
    for (const line of lines) {
      if (/\$\d/.test(line) && line.length < 150 && line.length > 5) {
        const namePart = line
          .replace(/\$\s?\d{1,6}(?:,\d{3})*(?:\.\d{2})?/g, "")
          .replace(/\bQty:?\s*\d+/gi, "")
          .replace(/\s+/g, " ")
          .trim()
        if (namePart.length >= 5 && !/^\d+$/.test(namePart)) {
          names.push(namePart)
        }
      }
    }
  }

  // Deduplicate
  return [...new Set(names)]
}

// --- Main parser ---

export function parseReceiptEmail(
  html: string,
  subject: string,
  from: string,
  dateHeader: string
): ParseResult {
  const text = htmlToText(html)
  const retailer = detectRetailer(from, html)
  const orderId = extractOrderId(text)
  const purchaseDate = extractDate(dateHeader)
  const allPrices = extractPrices(text)
  const productNames = extractProductNames(html, text)

  // If we found product names, pair them with prices
  if (productNames.length > 0) {
    const products: ParsedProduct[] = productNames.map((name, i) => {
      const category_guess = guessCategory(name)
      return {
        name,
        brand: null,
        price: allPrices[i] ?? allPrices[0] ?? null,
        quantity: 1,
        retailer,
        order_id: orderId,
        purchase_date: purchaseDate,
        category_guess,
        is_consumable: category_guess === "Groceries & Consumables",
      }
    })

    // Order total is typically the largest price
    const orderTotal = allPrices.length > 0 ? Math.max(...allPrices) : null

    return { products, order_total: orderTotal }
  }

  // Fallback: create a single product from the subject line
  if (allPrices.length > 0 || subject) {
    const name = subject
      .replace(/^(re:|fwd?:|order confirmation|your order|receipt)\s*[-:–]?\s*/gi, "")
      .replace(/\s*[-–|]\s*order\s*#.*/i, "")
      .trim() || "Unknown Product"

    const fallbackCategory = guessCategory(name)
    return {
      products: [{
        name,
        brand: null,
        price: allPrices.length > 1 ? allPrices[allPrices.length - 2] : allPrices[0] ?? null,
        quantity: 1,
        retailer,
        order_id: orderId,
        purchase_date: purchaseDate,
        category_guess: fallbackCategory,
        is_consumable: fallbackCategory === "Groceries & Consumables",
      }],
      order_total: allPrices.length > 0 ? Math.max(...allPrices) : null,
    }
  }

  return { products: [], order_total: null }
}
