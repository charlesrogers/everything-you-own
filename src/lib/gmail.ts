// Gmail OAuth (redirect flow) + API helpers

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"
const IMPORTED_KEY = "eyo_imported_emails"

// --- OAuth (redirect flow) ---

const GOOGLE_CLIENT_ID = "862570667285-rbabrgvrcau40kemjv0m1s451sfrni1i.apps.googleusercontent.com"
const PROD_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://stuff.imprevista.com"

export function getRedirectUri(): string {
  if (typeof window === "undefined") return `${PROD_ORIGIN}/api/auth/google/callback`
  const origin = window.location.origin
  return `${origin}/api/auth/google/callback`
}

export function getGmailAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    access_type: "online",
    prompt: "consent",
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// --- Gmail API helpers ---

async function gmailFetch(token: string, path: string): Promise<Response> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) throw new Error("SESSION_EXPIRED")
  if (!res.ok) throw new Error(`Gmail API error: ${res.status}`)
  return res
}

export interface GmailSearchResult {
  messages: { id: string; threadId: string }[]
  nextPageToken?: string
  resultSizeEstimate: number
}

const TIMEFRAME_QUERIES: Record<string, string> = {
  "1m": "newer_than:1m",
  "3m": "newer_than:3m",
  "6m": "newer_than:6m",
  "1y": "newer_than:1y",
  "2y": "newer_than:2y",
  "5y": "newer_than:5y",
  "all": "",
}

export async function searchReceipts(
  token: string,
  timeframe: string = "1y",
  pageToken?: string
): Promise<GmailSearchResult> {
  // Support custom date ranges like "2025-01-01_2025-06-30"
  let timeQuery = TIMEFRAME_QUERIES[timeframe] || "newer_than:1y"
  if (timeframe.includes("_")) {
    const [after, before] = timeframe.split("_")
    timeQuery = `after:${after.replace(/-/g, "/")} before:${before.replace(/-/g, "/")}`
  }
  const q = `subject:(order OR receipt OR invoice OR confirmation OR purchase) -subject:(shipped OR "out for delivery" OR delivered OR "has arrived" OR "track your" OR "how was" OR "rate your" OR "review your" OR "ready for pickup" OR "picked up" OR "items from your list" OR "add to cart" OR newsletter OR unsubscribe) ${timeQuery}`
  const params = new URLSearchParams({ q, maxResults: "20" })
  if (pageToken) params.set("pageToken", pageToken)

  const res = await gmailFetch(token, `/messages?${params}`)
  const data = await res.json()
  return {
    messages: data.messages || [],
    nextPageToken: data.nextPageToken,
    resultSizeEstimate: data.resultSizeEstimate || 0,
  }
}

export interface GmailMessageMeta {
  id: string
  snippet: string
  subject: string
  from: string
  date: string
}

function extractHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || ""
}

export async function getMessageMetadata(token: string, messageId: string): Promise<GmailMessageMeta> {
  const res = await gmailFetch(
    token,
    `/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
  )
  const data = await res.json()
  const headers = data.payload?.headers || []
  return {
    id: data.id,
    snippet: data.snippet || "",
    subject: extractHeader(headers, "Subject"),
    from: extractHeader(headers, "From"),
    date: extractHeader(headers, "Date"),
  }
}

export async function batchGetMetadata(token: string, ids: string[]): Promise<GmailMessageMeta[]> {
  const results: GmailMessageMeta[] = []
  for (const id of ids) {
    try {
      const meta = await getMessageMetadata(token, id)
      results.push(meta)
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") throw e
    }
  }
  return results
}

// --- MIME body extraction ---

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/")
  try {
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
  } catch {
    return atob(base64)
  }
}

interface MimePart {
  mimeType: string
  body: { data?: string; size: number }
  parts?: MimePart[]
}

function findHtmlPart(part: MimePart): string | null {
  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeBase64Url(part.body.data)
  }
  if (part.parts) {
    for (const child of part.parts) {
      const found = findHtmlPart(child)
      if (found) return found
    }
  }
  return null
}

function findTextPart(part: MimePart): string | null {
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data)
  }
  if (part.parts) {
    for (const child of part.parts) {
      const found = findTextPart(child)
      if (found) return found
    }
  }
  return null
}

export async function getMessageBody(token: string, messageId: string): Promise<string> {
  const res = await gmailFetch(token, `/messages/${messageId}?format=full`)
  const data = await res.json()
  const payload = data.payload as MimePart

  const html = findHtmlPart(payload)
  if (html) return html

  const text = findTextPart(payload)
  if (text) return text

  if (payload.body?.data) return decodeBase64Url(payload.body.data)

  return ""
}

// --- Imported email tracking ---

export function getImportedEmailIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  const raw = localStorage.getItem(IMPORTED_KEY)
  return raw ? new Set(JSON.parse(raw)) : new Set()
}

export function markEmailsImported(ids: string[]) {
  const existing = getImportedEmailIds()
  ids.forEach((id) => existing.add(id))
  localStorage.setItem(IMPORTED_KEY, JSON.stringify([...existing]))
}
