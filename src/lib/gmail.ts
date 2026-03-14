// Gmail OAuth (redirect flow) + API helpers

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"
const IMPORTED_KEY = "eyo_imported_emails"

// --- OAuth (redirect flow) ---

export function getGmailAuthUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""
  const redirectUri = typeof window !== "undefined"
    ? `${window.location.origin}/api/auth/google/callback`
    : ""

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
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
  "3m": "newer_than:3m",
  "6m": "newer_than:6m",
  "1y": "newer_than:1y",
  "2y": "newer_than:2y",
}

export async function searchReceipts(
  token: string,
  timeframe: string = "1y",
  pageToken?: string
): Promise<GmailSearchResult> {
  const q = `subject:(order confirmation OR receipt OR "your order" OR "order shipped" OR "payment confirmation" OR invoice) ${TIMEFRAME_QUERIES[timeframe] || "newer_than:1y"}`
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
