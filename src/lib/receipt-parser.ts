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
  // Financial rows
  /^(subtotal|sub-total|sub total):?$/i,
  /^(total|order total|grand total|total charged|total paid|amount charged|estimated total):?$/i,
  /^(shipping|shipping & handling|standard shipping|free shipping|flat rate|delivery):?$/i,
  /^(estimated )?(sales )?tax(es)?:?$/i,
  /^(state|local|county) (sales )?tax:?/i,
  /^(service fee|delivery fee|fees|tip|gratuity|discount|coupon|promo):?$/i,
  /^(payment method|paid with|payment info|payment):?/i,
  /^visa|^mastercard|^amex|^american express|^discover/i,
  /\bending in \d{4}\b/i,
  /^(refund|credit|balance|remaining balance|gift card|refunded amount):?/i,
  /^(merchandise|merchandise discount):?/i,
  /^(item discount|transaction discount):?/i,
  /^(savings|promotional discounts?|equipment deposit):?/i,
  /^(renewal discount|credit)-?:?$/i,
  /^(applied discount|discount \(code:)/i,
  /^(package total|package subtotal|est tax):?/i,
  /^(order summary|payment summary):?$/i,
  /^(per month|\/month)$/i,
  /^(USD|AUD|EUR|GBP)\s*$/i,
  /^free$/i,
  /\bsignature delivery\b/i,
  /^(free gift|you deserved it)/i,
  /^-?\$?\d+[\d.,]*\s*$/,
  /^\d+x\s*$/i,
  /^(includes connectivity discount|requires activation)/i,

  // Email UI / navigation text
  /^(continue shopping|items from your list|you may also like|recommended for you)/i,
  /^(view (your )?(order|cart|receipt|account|details|items))/i,
  /^(shop now|buy now|buy again|order again|reorder)/i,
  /^(manage (your )?(order|account|subscription|preferences))/i,
  /^(update (your )?(preferences|settings|account|address|payment))/i,
  /^(unsubscribe|email preferences|privacy policy|terms of (service|use))/i,
  /^(need help|contact us|customer (service|support|care)|get help|help center|support center)/i,
  /^(download (the )?app|get the app|available on)/i,
  /^(follow us|connect with us|find us|join us)/i,
  /^(thank you|thanks) for (your )?(order|purchase|shopping)/i,
  /^(order placed|order received|we got your order|order confirmed)/i,
  /^(how was|rate your|review your|track your|track package)/i,
  /\b(has shipped|is shipping|out for delivery|has arrived|has been delivered|will arrive|ready for pickup|picked up)\b/i,
  /^(questions\??|have questions|got questions)/i,
  /^(call us|chat with us|email us|write to us)/i,
  /\ball rights reserved\b/i,
  /^©/,
  /^(if you have|if you need|if you're having|for questions)/i,
  /^(this email|this message|this is a|you received this|you're receiving this)/i,
  /^(do not reply|please do not|no-?reply)/i,
  /^(powered by|sent (by|from|via))/i,
  /^(qty|quantity|item|description|product|price|amount|unit price)$/i,
  /^(billing address|shipping address|ship to|bill to|deliver to)/i,
  /^(estimated delivery|delivery date|arrives|arriving|expected)/i,
  /^(sold by|fulfilled by|shipped from|ships from)/i,
  /^(return (policy|by|within)|returns|exchanges)/i,
  /^(cancel|cancellation|modify order)/i,

  // Social / promo
  /^(facebook|twitter|instagram|pinterest|youtube|tiktok|linkedin)/i,
  /^(share|tweet|pin it|like us)/i,
  /^(earn|points|rewards|loyalty|refer)/i,
  /^(save \$|% off|deal|sale|limited time|exclusive|special offer)/i,
  /^(gift cards?|e-?gift)/i,

  // Address/location fragments
  /^\d{1,5}\s+(N|S|E|W|North|South|East|West)?\s*\w+\s+(St|Ave|Blvd|Rd|Dr|Ln|Way|Ct|Pkwy|Hwy)/i,
  /^(suite|ste|apt|unit|floor)\s*#?\s*\d/i,
  /\b\d{5}(-\d{4})?\s*$/,  // zip code at end
]

function isJunkName(name: string): boolean {
  const trimmed = name.trim()
  if (trimmed.length < 3) return true
  if (trimmed.length > 120) return true
  for (const pattern of JUNK_NAME_PATTERNS) {
    if (pattern.test(trimmed)) return true
  }
  // Multiple colons = summary block ("Subtotal: $x Fees: $y Tax: $z Total: $w")
  if ((trimmed.match(/:/g) || []).length >= 3) return true
  // Starts with common financial/logistic prefixes
  if (/^(total|subtotal|shipping|tax|fee|discount|tip|paid|charged|refund|delivery|handling)/i.test(trimmed) && trimmed.length < 40) return true
  // Looks like a URL
  if (/^https?:\/\//i.test(trimmed)) return true
  // Mostly punctuation or numbers (not a real product name)
  const alphaCount = (trimmed.match(/[a-zA-Z]/g) || []).length
  if (alphaCount < trimmed.length * 0.3) return true
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

function cleanNameText(raw: string): string {
  return raw
    .replace(/\$\s?\d{1,6}(?:,\d{3})*(?:\.\d{2})?/g, "")
    .replace(/\bQty:?\s*\d+/gi, "")
    .replace(/\bQuantity:?\s*\d+/gi, "")
    .replace(/\bSKU:?\s*\S+/gi, "")
    .replace(/\bx\s*\d+\s*$/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

function extractLinkFromElement(el: Element): string | null {
  const link = el.querySelector("a[href]")
  if (!link) return null
  const href = link.getAttribute("href") || ""
  if (href.startsWith("http") && !href.includes("unsubscribe") && !href.includes("track") && !href.includes("mailto:")) {
    return href
  }
  return null
}

function parseTableRow(row: Element): RawItem | null {
  const cells = row.querySelectorAll("td")
  if (cells.length < 2) return null

  let nameText = ""
  let price: number | null = null
  let url: string | null = null

  for (const cell of cells) {
    const cellText = cell.textContent?.trim() || ""
    const cellPrice = extractPrice(cellText)
    if (cellPrice !== null && price === null) {
      price = cellPrice
    }
    const stripped = cleanNameText(cellText)
    if (stripped.length >= 5 && stripped.length <= 120 && !nameText && !isJunkName(stripped)) {
      nameText = stripped
      url = extractLinkFromElement(cell)
    }
  }

  if (!nameText || isJunkName(nameText)) return null
  return { name: nameText, price, url }
}

function extractProducts(html: string, text: string): RawItem[] {
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Remove noise elements
    doc.querySelectorAll("style, script").forEach((el) => el.remove())

    // === Strategy 1: Find product TABLES ===
    // A product table has multiple rows with name+price pairs.
    // We scan each <table> independently and keep tables where ≥2 rows have prices.
    const tables = doc.querySelectorAll("table")
    const productTableItems: RawItem[] = []

    for (const table of tables) {
      // Get direct or near-direct rows (skip deeply nested sub-tables)
      const rows = table.querySelectorAll(":scope > tr, :scope > thead > tr, :scope > tbody > tr")
      const rowItems: (RawItem | null)[] = []
      let priceCount = 0

      for (const row of rows) {
        // Skip rows that contain nested tables (layout wrappers)
        if (row.querySelector("table")) continue
        const item = parseTableRow(row)
        rowItems.push(item)
        if (item?.price !== null && item?.price !== undefined) priceCount++
      }

      // A valid product table has ≥2 rows with prices, OR exactly 1 row with price (single-item order)
      if (priceCount >= 1) {
        for (const item of rowItems) {
          // In a confirmed product table, accept rows with name+price
          if (item && item.price !== null) {
            productTableItems.push(item)
          }
        }
      }
    }

    if (productTableItems.length > 0) {
      return deduplicateItems(productTableItems).slice(0, 30)
    }

    // === Strategy 2: Inline name+price in same element ===
    // Look for elements where BOTH a product name and price coexist.
    // Only use leaf-ish elements (no children that are also matches).
    const inlineItems: RawItem[] = []
    const candidates = doc.querySelectorAll("td, div, li, p, span")
    const seen = new Set<string>()

    for (const el of candidates) {
      const elText = el.textContent?.trim() || ""
      if (elText.length > 200 || elText.length < 8) continue
      if (!/\$\d/.test(elText)) continue
      // Skip if this element has child elements that also match (we want leaves)
      const childMatch = el.querySelector("td, div, li, p, span")
      if (childMatch && /\$\d/.test(childMatch.textContent || "")) continue

      const price = extractPrice(elText)
      if (price === null) continue

      const namePart = cleanNameText(elText)
      if (namePart.length < 5 || namePart.length > 120 || isJunkName(namePart)) continue

      const key = `${namePart}::${price}`
      if (seen.has(key)) continue
      seen.add(key)

      inlineItems.push({ name: namePart, price, url: extractLinkFromElement(el) })
    }

    if (inlineItems.length > 0) {
      return deduplicateItems(inlineItems).slice(0, 30)
    }
  }

  // === Strategy 3: Plain text fallback — require name+price on same line ===
  const textItems: RawItem[] = []
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (!/\$\d/.test(line) || line.length > 150 || line.length < 8) continue
    const price = extractPrice(line)
    if (price === null) continue
    const namePart = cleanNameText(line)
    if (namePart.length >= 5 && !isJunkName(namePart)) {
      textItems.push({ name: namePart, price, url: null })
    }
  }

  return deduplicateItems(textItems).slice(0, 30)
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

  // No products found — don't create garbage fallbacks from subject lines.
  // It's better to skip an email than to create a junk product.
  return { products: [], order_total: null }
}
