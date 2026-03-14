import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const error = request.nextUrl.searchParams.get("error")

  if (error) {
    return NextResponse.redirect(new URL(`/import?error=${encodeURIComponent(error)}`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL("/import?error=no_code", request.url))
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/import?error=missing_config", request.url))
  }

  // Exchange authorization code for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${request.nextUrl.origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  })

  const tokenData = await tokenRes.json()

  if (tokenData.error) {
    console.error("Token exchange error:", tokenData)
    return NextResponse.redirect(
      new URL(`/import?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`, request.url)
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
