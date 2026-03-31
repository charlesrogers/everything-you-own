"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 0, backgroundColor: "#fafafa", color: "#1a1a1a" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ fontSize: "13px", color: "#666", marginTop: "8px" }}>
            A critical error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: "24px", padding: "8px 16px", fontSize: "13px", fontWeight: 500, backgroundColor: "#6d28d9", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
