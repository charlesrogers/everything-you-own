import { NextRequest, NextResponse } from "next/server"

const GOOGLE_CLIENT_ID = "862570667285-8i8nms9lu1qkinh6bpas6q6jdmb5v2bi.apps.googleusercontent.com"
const PROD_REDIRECT_URI = "https://everythingyouown.vercel.app/api/auth/google/callback"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const error = request.nextUrl.searchParams.get("error")

  if (error) {
    return NextResponse.redirect(new URL(`/import?error=${encodeURIComponent(error)}`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL("/import?error=no_code", request.url))
  }

  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientSecret) {
    return NextResponse.redirect(new URL("/import?error=missing_client_secret", request.url))
  }

  // Use localhost redirect URI if running locally, prod otherwise
  const isLocalhost = request.nextUrl.hostname === "localhost"
  const redirectUri = isLocalhost
    ? `${request.nextUrl.origin}/api/auth/google/callback`
    : PROD_REDIRECT_URI

  // Exchange authorization code for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })

  const tokenData = await tokenRes.json()

  if (tokenData.error) {
    console.error("Token exchange error:", JSON.stringify(tokenData))
    const errMsg = [tokenData.error, tokenData.error_description].filter(Boolean).join(": ")
    return NextResponse.redirect(
      new URL(`/import?error=${encodeURIComponent(errMsg)}`, request.url)
    )
  }

  // Redirect to import page with token in URL fragment (not sent to server on subsequent requests)
  // Use a short-lived page that stores the token in sessionStorage then redirects
  const html = `<!DOCTYPE html><html><head><title>Redirecting...</title></head><body><script>
    sessionStorage.setItem("gmail_token", ${JSON.stringify(tokenData.access_token)});
    window.location.replace("/import?auth=success");
  </script></body></html>`

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  })
}
