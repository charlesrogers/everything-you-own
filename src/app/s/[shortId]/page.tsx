"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"

export default function ShortScanPage() {
  const params = useParams()
  const router = useRouter()
  const shortId = params.shortId as string
  const [error, setError] = useState(false)

  useEffect(() => {
    // Server-side lookup — works without client auth
    fetch(`/api/scan/${shortId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.locationId) {
          router.replace(`/storage/${data.locationId}`)
        } else {
          setError(true)
        }
      })
      .catch(() => setError(true))
  }, [shortId, router])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-[20px] font-bold mb-2">Location Not Found</h1>
        <p className="text-[13px] text-muted-foreground">
          No bin matches code &quot;{shortId}&quot;
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground text-[13px]">
      Looking up location...
    </div>
  )
}
