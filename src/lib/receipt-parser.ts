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

type EmailType = "order" | "shipping" | "delivery" | "review" | "promo" | "support" | "subscription" | "unknown"

export function classifyEmail(subject: string): EmailType {
  const s = subject.toLowerCase()

  // Reply/forward chains to support threads
  if (/^(re|fwd?)\s*:/i.test(s)) return "support"

  // Support tickets
  if (/\b(ticket\s*#?\s*\d|inquiry|we're happy to help|support request|help desk)\b/i.test(s)) return "support"
  if (/\[.*\]\s*re:/i.test(s)) return "support"  // [Company] Re: ticket style

  // Subscription renewals
  if (/\b(subscription|has renewed|auto-?renew|recurring|membership)\b/i.test(s) && !/cancel/i.test(s)) return "subscription"

  // Failed/blocked
  if (/\b(unable to|failed|could not|cannot process|minimum order required|access blocked)\b/i.test(s)) return "promo"

  // Review/feedback
  if (/\b(how was your order|rate your|review your|feedback|survey)\b/i.test(s)) return "review"

  // Delivery
  if (/\b(delivered|out for delivery|has arrived|will arrive|ready for pickup|picked up)\b/i.test(s)) return "delivery"

  // Shipping
  if (/\b(has shipped|is shipping|now shipping|shipment|tracking number|track your|is on its way)\b/i.test(s)) return "shipping"

  // Promo
  if (/\b(final call|save \$|% off your order|don't miss|last chance|exclusive offer)\b/i.test(s)) return "promo"

  return "order"
}

// --- Junk name filtering ---

const JUNK_NAME_PATTERNS: RegExp[] = [
  // Financial rows
  /\b(subtotal|sub-total|sub total)\b/i,
  /\b(order total|grand total|total charged|total paid|amount charged|estimated total)\b/i,
  /^total:?$/i,
  /\b(shipping|shipping & handling|standard shipping|free shipping|flat rate)\b.*:?\s*$/i,
  /^(estimated )?(sales )?tax(es)?:?$/i,
  /\b(state|local|county) (sales )?tax/i,
  /^(service fee|delivery fee|fees|tip|gratuity|discount|coupon|promo):?$/i,
  /^(payment method|paid with|payment info|payment):?/i,
  /^visa\b|^mastercard\b|^amex\b|^american express\b|^discover\b/i,
  /\bending in \d{4}\b/i,
  /^(refund|credit|balance|remaining balance|gift card|refunded amount):?/i,
  /^(merchandise discount|item discount|transaction discount):?/i,
  /^(savings|promotional discounts?|equipment deposit):?/i,
  /^(applied discount|discount \(code:)/i,
  /^(package total|package subtotal|est tax):?/i,
  /^(order summary|payment summary):?$/i,
  /^(USD|AUD|EUR|GBP)\s*$/i,
  /^free$/i,
  /^-?\$?\d+[\d.,]*\s*$/,
  /^\d+x\s*$/i,

  // Email UI text
  /^(view|see|check|manage|track|cancel|modify|update|change)\s+(your\s+)?(order|cart|receipt|account|details|items|subscription|preferences|settings|address|payment)/i,
  /^(shop now|buy now|buy again|order again|reorder|continue shopping)/i,
  /^(unsubscribe|email preferences|privacy policy|terms of (service|use)|opt.out)/i,
  /^(need help|contact us|customer (service|support|care)|get help|help center)/i,
  /^(download (the )?app|get the app|available on|app store|google play)/i,
  /^(follow us|connect with us|find us|join us|share|tweet|pin it|like us)/i,
  /^(thank you|thanks) for (your )?(order|purchase|shopping)/i,
  /^(order (placed|received|confirmed)|we got your order)/i,
  /^(questions\??|have questions|got questions|call us|chat with us|email us)/i,
  /\ball rights reserved\b/i,
  /^©/,
  /^(this email|this message|you received this|you're receiving this)/i,
  /^(do not reply|please do not|no-?reply|powered by|sent (by|from|via))/i,
  /^(billing address|shipping address|ship to|bill to|deliver to)/i,
  /^(estimated delivery|delivery date|arrives by|arriving|expected by)/i,
  /^(sold by|fulfilled by|shipped from|ships from)/i,
  /^(return (policy|by|within)|returns & exchanges)/i,
  /^(facebook|twitter|instagram|pinterest|youtube|tiktok|linkedin)\s*$/i,
  /^(earn|points|rewards|loyalty|refer a friend)/i,
  /^(save \$|% off|deal|sale|limited time|exclusive|special offer)/i,

  // Table headers
  /^(qty|quantity|item|description|product|price|amount|unit price|sku|upc|code|extended)$/i,

  // Addresses
  /^\d{1,5}\s+(N|S|E|W|North|South|East|West)?\s*\w+\s+(St|Ave|Blvd|Rd|Dr|Ln|Way|Ct|Pkwy|Hwy)/i,
  /^(suite|ste|apt|unit|floor)\s*#?\s*\d/i,

  // Monthly price / subscription descriptors
  /\best\.?\s*monthly\s*price/i,
  /\bincluding\s*taxes\s*&\s*fees/i,
  /\bper\s*month\b/i,
  /\/month\b/i,
  /\bmonthly\s*(charge|fee|rate|cost)\b/i,

  // Policy/legal text
  /^please (reference|note|review|see|read|check)/i,
  /\b(key notes|important (information|notice))\b/i,
  /\bregarding your (order|shipment|account)\b/i,
  /\b(pick.?up|cancellation|restocking) fee\b/i,
  /\b(insured|uninsured) shipping\b/i,
  /\ball sales are final\b/i,
  /\b(liable|liability|coverage)\b.*\b(carrier|shipping)\b/i,

  // ISP/utility bill text
  /^what to expect/i,
  /\byour (first )?(monthly )?bill\b/i,
  /\b(existing|current) (promotional )?discount\b/i,
  /\bone.?time charges?\b/i,
  /^in addition to your monthly/i,

  // Promotional/deal text within receipt emails
  /^(deals related to|recommended for|you might also|customers also|based on your)/i,
  /^(shop by department|display images)/i,
  /^(proof of purchase|subject to restock)/i,
]

function isJunkName(name: string): boolean {
  const trimmed = name.trim()
  if (trimmed.length < 3 || trimmed.length > 120) return true
  for (const pattern of JUNK_NAME_PATTERNS) {
    if (pattern.test(trimmed)) return true
  }
  // Multiple colons = summary block
  if ((trimmed.match(/:/g) || []).length >= 3) return true
  // Starts with financial prefix
  if (/^(total|subtotal|shipping|tax|fee|discount|tip|paid|charged|refund|delivery|handling)/i.test(trimmed) && trimmed.length < 40) return true
  // Looks like a URL
  if (/^https?:\/\//i.test(trimmed)) return true
  // Mostly non-alpha (punctuation, numbers)
  const alphaCount = (trimmed.match(/[a-zA-Z]/g) || []).length
  if (alphaCount < trimmed.length * 0.3) return true
  // Product code pattern (all uppercase letters + numbers, no spaces)
  if (/^[A-Z0-9_\-]+$/.test(trimmed) && trimmed.length < 30) return true
  // UPC/barcode (long digit string)
  if (/^\d{8,}$/.test(trimmed)) return true
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
  [/pizzahut|pizza\s*hut/i, "Pizza Hut"],
  [/chanel\.com/i, "CHANEL"],
  [/nothingbundtcakes|nothing\s*bundt/i, "Nothing Bundt Cakes"],
  [/designwithinreach|dwr\.com/i, "Design Within Reach"],
  [/cultiver/i, "CULTIVER"],
  [/mdtsportinggoods|mdtess\.com/i, "MDT"],
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
  const match = text.match(/\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/)
  if (!match) return null
  const val = parseFloat(match[1].replace(/,/g, ""))
  // Skip tiny amounts without decimals (likely not real prices — e.g. "$1", "$2")
  if (val < 5 && !match[1].includes(".")) return null
  return val > 0 && val < 100000 ? val : null
}

function extractAllPrices(text: string): number[] {
  const matches = text.match(/\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g) || []
  return matches
    .map((m) => parseFloat(m.replace(/[$,\s]/g, "")))
    .filter((p) => p > 0 && p < 100000)
}

// --- Order ID extraction ---

function extractOrderId(text: string): string | null {
  const patterns = [
    /order\s*#\s*:?\s*([A-Z0-9][A-Z0-9\-]{4,30})/i,         // "Order # 316526" or "Order #: 316526"
    /order\s+number\s*:?\s*([A-Z0-9][A-Z0-9\-]{4,30})/i,     // "Order number: 316526"
    /order:\s*#?\s*([A-Z0-9][A-Z0-9\-]{4,30})/i,             // "Order: #123" (Discogs style)
    /confirmation\s*#\s*:?\s*([A-Z0-9][A-Z0-9\-]{4,30})/i,   // "Confirmation # 316526"
    /invoice\s*#\s*:?\s*([A-Z0-9][A-Z0-9\-]{4,30})/i,        // "Invoice # 316526"
    /transaction\s*#?\s*:?\s*(\d{4,30})/i,                    // "Transaction #: 258508"
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
  [/\b(candle|towel|pillow|blanket|rug|lamp|vase|curtain|bedding|cookware|sofa|chair|shelf|shelves|floor panel|mattress)\b/i, "Home"],
  [/\b(baby|toddler|kids|children|onesie|stroller|diaper|bassinet|nursery)\b/i, "Kids & Baby"],
  [/\b(vitamin|supplement|protein|fitness|yoga|wellness)\b/i, "Health & Wellness"],
  [/\b(phone|laptop|tablet|headphone|charger|cable|camera|speaker|computer|monitor|keyboard|mouse|laser level|red dot|soldering)\b/i, "Electronics"],
  [/\b(grocery|food|snack|coffee|tea|pizza|chicken|rice|beef|pork|dumpling|pad thai|broccoli|cake|bundt)\b/i, "Groceries & Consumables"],
  [/\b(handguard|rifle|pistol|holster|magazine|optic|scope|barrel|stock|grip|trigger|ammo|ammunition|firearm)\b/i, "Firearms & Accessories"],
]

function guessCategory(name: string): string | null {
  for (const [pattern, category] of CATEGORY_KEYWORDS) {
    if (pattern.test(name)) return category
  }
  return null
}

// --- HTML text extraction with line breaks ---

function htmlToText(html: string): string {
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]+>/g, " ")
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")
  doc.querySelectorAll("style, script").forEach((el) => el.remove())
  return doc.body?.textContent || ""
}

// Converts HTML to text while inserting newlines at block boundaries
function htmlToLines(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(tr|div|p|li|h[1-6]|td|th|br\s*\/?)>/gi, "\n")
    .replace(/<(tr|div|p|li|h[1-6]|br)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim()
}

// --- Product extraction ---

interface RawItem {
  name: string
  price: number | null
  url: string | null
}

function cleanNameText(raw: string): string {
  return raw
    .replace(/\$\s?\d{1,6}(?:,\d{3})*(?:\.\d{2})?/g, "")
    .replace(/\bQty:?\s*\d+\.?\d*/gi, "")
    .replace(/\bQuantity:?\s*\d+\.?\d*/gi, "")
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

function extractProducts(html: string, text: string): RawItem[] {
  const items: RawItem[] = []

  // === Strategy 1: DOM-based — scan ALL <tr> elements for name+price rows ===
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")
    doc.querySelectorAll("style, script").forEach((el) => el.remove())

    const allRows = doc.querySelectorAll("tr")
    for (const row of allRows) {
      const cells = row.querySelectorAll(":scope > td, :scope > th")
      if (cells.length < 2) continue

      // Skip layout wrappers: rows where every cell's text is >500 chars (entire email body)
      let isLayoutWrapper = true
      for (const cell of cells) {
        const len = cell.textContent?.trim().length || 0
        if (len > 0 && len < 500) { isLayoutWrapper = false; break }
      }
      if (isLayoutWrapper) continue

      let bestName = ""
      let bestNameLen = 0
      let price: number | null = null
      let url: string | null = null
      let isHeaderRow = true

      for (const cell of cells) {
        const cellText = cell.textContent?.trim() || ""
        if (!cellText) continue

        const cellPrice = extractPrice(cellText)
        if (cellPrice !== null && price === null) {
          price = cellPrice
        }

        if (!/^(qty|quantity|item|description|product|price|amount|unit price|sku|upc|code|extended|total|#)$/i.test(cellText)) {
          isHeaderRow = false
        }

        const cleaned = cleanNameText(cellText)
        if (cleaned.length >= 5 && cleaned.length <= 120 && !isJunkName(cleaned)) {
          if (cleaned.length > bestNameLen) {
            bestName = cleaned
            bestNameLen = cleaned.length
            url = extractLinkFromElement(cell)
          }
        }
      }

      if (isHeaderRow) continue
      if (bestName && price !== null) {
        items.push({ name: bestName, price, url })
      }
    }
  }

  if (items.length > 0) {
    console.log(`[receipt-parser] Strategy 1 (table rows): found ${items.length} items`)
    return deduplicateItems(items).slice(0, 30)
  }

  // === Strategy 2: Nearby-line matching ===
  // Convert HTML to lines, find prices, then look at nearby lines for product names.
  // This handles cases where name and price end up on adjacent lines after HTML conversion.
  const lines = htmlToLines(html).split("\n").map((l) => l.trim()).filter(Boolean)
  const lineItems: RawItem[] = []
  const usedNameLines = new Set<number>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.length > 300) continue

    const price = extractPrice(line)
    if (price === null) continue

    // First: check if this line itself has a product name alongside the price
    const nameOnSameLine = cleanNameText(line)
    if (nameOnSameLine.length >= 4 && nameOnSameLine.length <= 120 && !isJunkName(nameOnSameLine)) {
      lineItems.push({ name: nameOnSameLine, price, url: null })
      continue
    }

    // Otherwise: look at the 1-3 lines BEFORE this price for a product name
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      if (usedNameLines.has(j)) continue
      const prevLine = lines[j].trim()
      if (prevLine.length < 4 || prevLine.length > 150) continue
      // Stop if we hit another price line (belongs to a different product)
      if (/\$\d/.test(prevLine)) break
      const cleaned = cleanNameText(prevLine)
      if (cleaned.length >= 4 && cleaned.length <= 120 && !isJunkName(cleaned)) {
        lineItems.push({ name: cleaned, price, url: null })
        usedNameLines.add(j)
        break
      }
    }
  }

  if (lineItems.length > 0) {
    console.log(`[receipt-parser] Strategy 2 (nearby-line): found ${lineItems.length} items`)
    return deduplicateItems(lineItems).slice(0, 30)
  }

  // === Strategy 3: Plain text nearby-line fallback ===
  const textLines = text.split(/\n/).map((l) => l.trim()).filter(Boolean)
  const textItems: RawItem[] = []
  const usedTextLines = new Set<number>()

  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i]
    if (line.length > 200) continue

    const price = extractPrice(line)
    if (price === null) continue

    const nameOnSameLine = cleanNameText(line)
    if (nameOnSameLine.length >= 5 && nameOnSameLine.length <= 120 && !isJunkName(nameOnSameLine)) {
      textItems.push({ name: nameOnSameLine, price, url: null })
      continue
    }

    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      if (usedTextLines.has(j)) continue
      const prevLine = textLines[j].trim()
      if (prevLine.length < 4 || prevLine.length > 150) continue
      if (/\$\d/.test(prevLine)) break
      const cleaned = cleanNameText(prevLine)
      if (cleaned.length >= 4 && cleaned.length <= 120 && !isJunkName(cleaned)) {
        textItems.push({ name: cleaned, price, url: null })
        usedTextLines.add(j)
        break
      }
    }
  }

  if (textItems.length > 0) {
    console.log(`[receipt-parser] Strategy 3 (text nearby-line): found ${textItems.length} items`)
  } else {
    console.log(`[receipt-parser] No products found in email`)
  }

  return deduplicateItems(textItems).slice(0, 30)
}

function deduplicateItems(items: RawItem[]): RawItem[] {
  if (items.length <= 1) return items

  const kept: RawItem[] = []
  const used = new Set<number>()

  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue
    let best = items[i]

    for (let j = i + 1; j < items.length; j++) {
      if (used.has(j)) continue
      const a = best.name.toLowerCase()
      const b = items[j].name.toLowerCase()

      if (a === b || a.includes(b) || b.includes(a)) {
        used.add(j)
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
  console.log(`[receipt-parser] "${subject}" → classified as: ${emailType}`)

  if (emailType !== "order" && emailType !== "unknown") {
    return { products: [], order_total: null }
  }

  const text = htmlToText(html)

  // Body-level subscription check (catches Google Play "Order Receipt" that are actually renewals)
  if (/\b(subscription|has renewed|auto.?renew)\b/i.test(text) && /\b(renew|recurring|monthly|annually)\b/i.test(text)) {
    console.log(`[receipt-parser] Skipping — body indicates subscription renewal`)
    return { products: [], order_total: null }
  }

  // Body-level ISP/utility check (Cox, Comcast, etc. — service orders, not product purchases)
  if (/\b(monthly price|your bill|promotional discount)\b/i.test(text) && /\b(internet|cable|tv service|wifi|wi-fi|broadband|gigabit|mbps|cox|comcast|xfinity|spectrum)\b/i.test(text)) {
    console.log(`[receipt-parser] Skipping — body indicates ISP/utility service order`)
    return { products: [], order_total: null }
  }
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

    console.log(`[receipt-parser] Extracted ${products.length} products from "${subject}"`)
    const orderTotal = allPrices.length > 0 ? Math.max(...allPrices) : null
    return { products, order_total: orderTotal }
  }

  console.log(`[receipt-parser] No products extracted from "${subject}"`)
  return { products: [], order_total: null }
}
