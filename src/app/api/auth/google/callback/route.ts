import { NextRequest, NextResponse } from "next/server"

const GOOGLE_CLIENT_ID = "862570667285-rbabrgvrcau40kemjv0m1s451sfrni1i.apps.googleusercontent.com"
const PROD_REDIRECT_URI = "https://stuff.imprevista.com/api/auth/google/callback"

export async function GET(request: NextRequest) {
  // Behind Traefik, request.url shows localhost — use X-Forwarded-Host to get the real origin
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https"
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : request.nextUrl.origin

  const code = request.nextUrl.searchParams.get("code")
  const error = request.nextUrl.searchParams.get("error")

  if (error) {
    return NextResponse.redirect(new URL(`/import?error=${encodeURIComponent(error)}`, origin))
  }

  if (!code) {
    return NextResponse.redirect(new URL("/import?error=no_code", origin))
  }

  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientSecret) {
    return NextResponse.redirect(new URL("/import?error=missing_client_secret", origin))
  }

  // Always use PROD_REDIRECT_URI for token exchange — must match what the client sent to Google
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: clientSecret,
      redirect_uri: PROD_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  })

  const tokenData = await tokenRes.json()

  if (tokenData.error) {
    console.error("Token exchange error:", JSON.stringify(tokenData))
    const errMsg = [tokenData.error, tokenData.error_description].filter(Boolean).join(": ")
    return NextResponse.redirect(
      new URL(`/import?error=${encodeURIComponent(errMsg)}`, origin)
    )
  }

  // Store token in sessionStorage then redirect — token never hits the server again
  const html = `<!DOCTYPE html><html><head><title>Redirecting...</title></head><body><script>
    localStorage.setItem("gmail_token", ${JSON.stringify(tokenData.access_token)});
    window.location.replace("/import?auth=success");
  </script></body></html>`

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  })
}
