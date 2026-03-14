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
  source_url: string | null
}

export interface ParseResult {
  products: ParsedProduct[]
  order_total: number | null
}

// --- Email classification ---

type EmailType = "order" | "shipping" | "delivery" | "review" | "promo" | "support" | "unknown"

const SHIPPING_SUBJECT = /\b(has shipped|is shipping|now shipping|shipment|tracking number|track your|is on its way)\b/i
const DELIVERY_SUBJECT = /\b(delivered|out for delivery|has arrived|will arrive|ready for pickup|picked up|is ready)\b/i
const REVIEW_SUBJECT = /\b(how was your order|rate your|review your|feedback|survey)\b/i
const PROMO_SUBJECT = /\b(final call|save \$|off your order|don't miss|last chance|exclusive offer)\b/i
const SUPPORT_SUBJECT = /\b(ticket \d|inquiry|question about|we're happy to help|support request)\b/i
const FAILED_SUBJECT = /\b(unable to|failed|could not|cannot process|minimum order required|access blocked)\b/i

export function classifyEmail(subject: string): EmailType {
  const s = subject.toLowerCase()
  if (FAILED_SUBJECT.test(s)) return "promo"
  if (REVIEW_SUBJECT.test(s)) return "review"
  if (SUPPORT_SUBJECT.test(s)) return "support"
  if (PROMO_SUBJECT.test(s)) return "promo"
  // Check delivery before shipping (more specific)
  if (DELIVERY_SUBJECT.test(s)) return "delivery"
  if (SHIPPING_SUBJECT.test(s)) return "shipping"
  return "order"
}

// --- Junk name filtering ---

const JUNK_NAME_PATTERNS: RegExp[] = [
  /^(subtotal|sub-total|sub total):?$/i,
  /^(total|order total|grand total|total charged|total paid|amount charged|estimated total):?$/i,
  /^(shipping|shipping & handling|standard shipping|free shipping|flat rate):?$/i,
  /^(estimated )?(sales )?tax(es)?:?$/i,
  /^(state|local|county) (sales )?tax:?/i,
  /^(service fee|delivery fee|fees|tip|gratuity|discount|coupon|promo):?$/i,
  /^(payment method|paid with|payment info):?/i,
  /^visa|^mastercard|^amex|^american express|^discover/i,
  /\bending in \d{4}\b/i,
  /^(refund|credit|balance|remaining balance|gift card|refunded amount):?/i,
  /^(continue shopping|items from your list|you may also like|recommended for you)/i,
  /^(how was|rate your|review your|track your|track package)/i,
  /\b(has shipped|is shipping|out for delivery|has arrived|has been delivered|will arrive|ready for pickup|picked up)\b/i,
  /^(per month|\/month)$/i,
  /^(USD|AUD|EUR|GBP)\s*$/i,
  /^free$/i,
  /^(merchandise|merchandise discount):?/i,
  /^(item discount|transaction discount):?/i,
  /^(savings|promotional discounts?|equipment deposit):?/i,
  /^(renewal discount|credit)-?:?$/i,
  /^(applied discount|discount \(code:)/i,
  /^(package total|package subtotal|est tax):?/i,
  /\bsignature delivery\b/i,
  /^(free gift|you deserved it)/i,
  /^(order summary|payment summary):?$/i,
  /^-?\$?\d+[\d.,]*\s*$/,  // pure numbers/prices
  /^\d+x\s*$/i,  // just "1x" or "3x"
  /^(includes connectivity discount|requires activation)/i,
]

function isJunkName(name: string): boolean {
  const trimmed = name.trim()
  if (trimmed.length < 3) return true
  for (const pattern of JUNK_NAME_PATTERNS) {
    if (pattern.test(trimmed)) return true
  }
  // Names that are just "Subtotal: Discount: Fees: Taxes: Tip: Total: Paid with..."
  if ((trimmed.match(/:/g) || []).length >= 3) return true
  // Names starting with common financial prefixes
  if (/^(total|subtotal|shipping|tax|fee|discount|tip|paid|charged|refund)/i.test(trimmed) && trimmed.length < 40) return true
  return false
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
  const fromMatch = from.match(/^"?([^"<]+)"?\s*</)
  if (fromMatch) return fromMatch[1].trim()
  return "Unknown"
}

// --- Price extraction ---

function extractPrice(text: string): number | null {
  const match = text.match(/\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2}))/)
  if (!match) return null
  const val = parseFloat(match[1].replace(/,/g, ""))
  return val > 0 && val < 100000 ? val : null
}

function extractAllPrices(text: string): number[] {
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
  [/\b(shirt|top|blouse|dress|pants|jeans|jacket|coat|sweater|hoodie|skirt|legging|shorts|jogger)\b/i, "Clothing"],
  [/\b(shoe|sneaker|boot|heel|sandal|slipper|loafer|clogs)\b/i, "Shoes"],
  [/\b(serum|moisturizer|cleanser|mascara|lipstick|foundation|skincare|makeup|perfume|fragrance|shampoo|conditioner|headband)\b/i, "Beauty & Skincare"],
  [/\b(bag|purse|handbag|wallet|belt|scarf|sunglasses|hat|backpack)\b/i, "Bags & Accessories"],
  [/\b(candle|towel|pillow|blanket|rug|lamp|vase|curtain|bedding|cookware|sofa|chair|shelf|shelves|floor panel)\b/i, "Home"],
  [/\b(baby|toddler|kids|children|onesie|stroller|diaper|bassinet|nursery)\b/i, "Kids & Baby"],
  [/\b(vitamin|supplement|protein|fitness|yoga|wellness)\b/i, "Health & Wellness"],
  [/\b(phone|laptop|tablet|headphone|charger|cable|camera|speaker|computer|monitor|keyboard|mouse|laser level|red dot|soldering)\b/i, "Electronics"],
  [/\b(grocery|food|snack|coffee|tea|pizza|chicken|rice|beef|pork|dumpling|pad thai|broccoli|cake)\b/i, "Groceries & Consumables"],
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
  doc.querySelectorAll("style, script").forEach((el) => el.remove())
  return doc.body?.textContent || ""
}

// --- Product extraction with price pairing ---

interface RawItem {
  name: string
  price: number | null
  url: string | null
}

function extractProducts(html: string, text: string): RawItem[] {
  const items: RawItem[] = []

  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Strategy 1: Look for table rows with product + price cells
    const rows = doc.querySelectorAll("tr")
    for (const row of rows) {
      const cells = row.querySelectorAll("td")
      if (cells.length < 2) continue

      let nameText = ""
      let price: number | null = null
      let url: string | null = null

      for (const cell of cells) {
        const cellText = cell.textContent?.trim() || ""
        // Look for a cell that has a price
        const cellPrice = extractPrice(cellText)
        if (cellPrice !== null && price === null) {
          price = cellPrice
        }
        // Look for a cell with meaningful text (potential product name)
        const stripped = cellText
          .replace(/\$\s?\d{1,6}(?:,\d{3})*(?:\.\d{2})?/g, "")
          .replace(/\bQty:?\s*\d+/gi, "")
          .replace(/\bQuantity:?\s*\d+/gi, "")
          .replace(/\bSKU:?\s*\S+/gi, "")
          .replace(/\s+/g, " ")
          .trim()
        if (stripped.length >= 5 && stripped.length <= 150 && !nameText) {
          nameText = stripped
          // Check for link in this cell
          const link = cell.querySelector("a[href]")
          if (link) {
            const href = link.getAttribute("href") || ""
            if (href.startsWith("http") && !href.includes("unsubscribe") && !href.includes("track")) {
              url = href
            }
          }
        }
      }

      if (nameText && !isJunkName(nameText)) {
        items.push({ name: nameText, price, url })
      }
    }

    // Strategy 2: Look for div/td elements containing both text and price
    if (items.length === 0) {
      const cells = doc.querySelectorAll("td, div, li")
      for (const cell of cells) {
        const cellText = cell.textContent?.trim() || ""
        if (cellText.length > 200 || cellText.length < 5) continue
        if (!/\$\d/.test(cellText)) continue

        // Check this isn't a parent of something we already found
        const price = extractPrice(cellText)
        const namePart = cellText
          .replace(/\$\s?\d{1,6}(?:,\d{3})*(?:\.\d{2})?/g, "")
          .replace(/\bQty:?\s*\d+/gi, "")
          .replace(/\bQuantity:?\s*\d+/gi, "")
          .replace(/\bSKU:?\s*\S+/gi, "")
          .replace(/\bx\s*\d+\s*$/gi, "")
          .replace(/\s+/g, " ")
          .trim()

        if (namePart.length >= 5 && namePart.length <= 150 && !isJunkName(namePart)) {
          // Try to find a link
          let url: string | null = null
          const link = cell.querySelector("a[href]")
          if (link) {
            const href = link.getAttribute("href") || ""
            if (href.startsWith("http") && !href.includes("unsubscribe") && !href.includes("track")) {
              url = href
            }
          }
          items.push({ name: namePart, price, url })
        }
      }
    }
  }

  // Strategy 3: Plain text fallback
  if (items.length === 0) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
    for (const line of lines) {
      if (/\$\d/.test(line) && line.length < 150 && line.length > 5) {
        const price = extractPrice(line)
        const namePart = line
          .replace(/\$\s?\d{1,6}(?:,\d{3})*(?:\.\d{2})?/g, "")
          .replace(/\bQty:?\s*\d+/gi, "")
          .replace(/\s+/g, " ")
          .trim()
        if (namePart.length >= 5 && !isJunkName(namePart)) {
          items.push({ name: namePart, price, url: null })
        }
      }
    }
  }

  // Deduplicate: if one name is a substring of another, keep the shorter (cleaner) one
  const deduped = deduplicateItems(items)

  return deduped
}

function deduplicateItems(items: RawItem[]): RawItem[] {
  if (items.length <= 1) return items

  // Group by similar names and keep the best version
  const kept: RawItem[] = []
  const used = new Set<number>()

  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue
    let best = items[i]

    for (let j = i + 1; j < items.length; j++) {
      if (used.has(j)) continue
      const a = best.name.toLowerCase()
      const b = items[j].name.toLowerCase()

      // If names are identical or one contains the other
      if (a === b || a.includes(b) || b.includes(a)) {
        used.add(j)
        // Keep the one with more info (price, shorter cleaner name)
        if (!best.price && items[j].price) best = items[j]
        if (best.name.length > items[j].name.length && items[j].name.length >= 5) {
          best = { ...best, name: items[j].name }
        }
        if (!best.url && items[j].url) best = { ...best, url: items[j].url }
      }
    }

    kept.push(best)
  }

  return kept
}

// --- Main parser ---

export function parseReceiptEmail(
  html: string,
  subject: string,
  from: string,
  dateHeader: string
): ParseResult {
  // Pre-filter: skip non-order emails
  const emailType = classifyEmail(subject)
  if (emailType !== "order" && emailType !== "unknown") {
    return { products: [], order_total: null }
  }

  const text = htmlToText(html)
  const retailer = detectRetailer(from, html)
  const orderId = extractOrderId(text)
  const purchaseDate = extractDate(dateHeader)
  const allPrices = extractAllPrices(text)
  const rawItems = extractProducts(html, text)

  if (rawItems.length > 0) {
    const products: ParsedProduct[] = rawItems.map((item) => {
      const category_guess = guessCategory(item.name)
      return {
        name: item.name,
        brand: null,
        price: item.price,
        quantity: 1,
        retailer,
        order_id: orderId,
        purchase_date: purchaseDate,
        category_guess,
        is_consumable: category_guess === "Groceries & Consumables",
        source_url: item.url,
      }
    })

    const orderTotal = allPrices.length > 0 ? Math.max(...allPrices) : null
    return { products, order_total: orderTotal }
  }

  // Fallback: create a single product from the subject line
  // But only if the subject looks like it contains product info, not just "Your order confirmation"
  const cleanSubject = subject
    .replace(/^(re:|fwd?:|order confirmation|your order|receipt|thank you for your order)\s*[-:–]?\s*/gi, "")
    .replace(/\s*[-–|]\s*order\s*#.*/i, "")
    .replace(/\s*#\d+.*/i, "")
    .trim()

  if (cleanSubject.length > 5 && allPrices.length > 0 && !/^(your |order |receipt)/i.test(cleanSubject)) {
    const fallbackCategory = guessCategory(cleanSubject)
    return {
      products: [{
        name: cleanSubject,
        brand: null,
        price: allPrices.length > 1 ? allPrices[allPrices.length - 2] : allPrices[0] ?? null,
        quantity: 1,
        retailer,
        order_id: orderId,
        purchase_date: purchaseDate,
        category_guess: fallbackCategory,
        is_consumable: fallbackCategory === "Groceries & Consumables",
        source_url: null,
      }],
      order_total: allPrices.length > 0 ? Math.max(...allPrices) : null,
    }
  }

  return { products: [], order_total: null }
}
